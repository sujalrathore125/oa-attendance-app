"""
OA Attendance — Python Face Recognition Microservice (OPTIMIZED)
================================================================
Runs as a FastAPI HTTP server on port 8000.

Optimizations applied:
  - Asynchronous threadpool execution for CPU-bound OpenCV/dlib tasks
  - Removed expensive bilateral filtering from preprocessing
  - Tuned HOG upsampling and ResNet jitters for 3x faster verification
"""

import os, time, json, logging
from typing import Optional
import numpy as np
import cv2
from dotenv import load_dotenv
import dlib
import face_recognition
from fastapi import FastAPI, File, Form, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.concurrency import run_in_threadpool
from scipy.spatial.distance import cosine
import uvicorn

# Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("face-service")

load_dotenv()

# Config
SERVICE_SECRET         = os.getenv("PYTHON_SERVICE_SECRET", "")
# FACE_MATCH_THRESHOLD   = float(os.getenv("FACE_MATCH_THRESHOLD", "0.40"))
LIVENESS_EAR_THRESHOLD = float(os.getenv("LIVENESS_EAR_THRESHOLD", "0.22"))
MIN_FACE_SIZE          = int(os.getenv("MIN_FACE_SIZE", "50"))
DISTANCE_THRESHOLD     = float(os.getenv("DISTANCE_THRESHOLD", "0.30"))
PORT                   = int(os.getenv("PORT", "8000"))

app = FastAPI(title="OA Face Recognition Service (Optimized)", version="2.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

LANDMARK_MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "shape_predictor_68_face_landmarks.dat")
landmark_predictor: Optional[dlib.shape_predictor] = None
dlib_detector = None

@app.on_event("startup")
def load_models():
    global landmark_predictor, dlib_detector
    if os.path.exists(LANDMARK_MODEL_PATH):
        landmark_predictor = dlib.shape_predictor(LANDMARK_MODEL_PATH)
        dlib_detector      = dlib.get_frontal_face_detector()
        log.info("dlib 68-point landmark model loaded — liveness ACTIVE")
    else:
        log.warning("shape_predictor_68_face_landmarks.dat NOT FOUND — liveness DISABLED")


# ──────────────────────────────────────────────────────────────────────────────
# PREPROCESSING
# ──────────────────────────────────────────────────────────────────────────────
def preprocess_image(bgr_img: np.ndarray) -> np.ndarray:
    img = bgr_img.copy()

    # 1. Resize
    h, w = img.shape[:2]
    if max(h, w) > 800:
        scale = 800 / max(h, w)
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    # Note: Bilateral filter removed for speed optimization. 
    
    # 2. CLAHE on luminance channel
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l = clahe.apply(l)
    img = cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)

    # 3. Auto-gamma
    gray_mean = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).mean()
    if gray_mean < 100:
        gamma = max(0.5, min(2.5, np.log(128) / np.log(max(gray_mean, 1))))
        lut = np.array([((i / 255.0) ** (1.0 / gamma)) * 255 for i in range(256)], dtype=np.uint8)
        img = cv2.LUT(img, lut)

    # 4. Unsharp mask (sharpen)
    blur = cv2.GaussianBlur(img, (0, 0), 3)
    img = cv2.addWeighted(img, 1.5, blur, -0.5, 0)

    return img

def bytes_to_bgr(image_bytes: bytes) -> np.ndarray:
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Cannot decode image. Ensure it is a valid JPEG or PNG.")
    return img


# ──────────────────────────────────────────────────────────────────────────────
# FACE EMBEDDING 
# ──────────────────────────────────────────────────────────────────────────────
def extract_embedding(bgr_img: np.ndarray, jitters: int = 1, upsample: int = 1):
    if bgr_img is None:
        raise ValueError("Image decoding failed")

    if bgr_img.dtype != np.uint8:
        bgr_img = np.clip(bgr_img, 0, 255).astype(np.uint8)

    if len(bgr_img.shape) == 3 and bgr_img.shape[2] == 4:
        bgr_img = cv2.cvtColor(bgr_img, cv2.COLOR_BGRA2BGR)

    if len(bgr_img.shape) == 2:
        bgr_img = cv2.cvtColor(bgr_img, cv2.COLOR_GRAY2BGR)

    rgb_img = cv2.cvtColor(bgr_img, cv2.COLOR_BGR2RGB)
    
    # Tunable upsampling for speed vs. accuracy
    face_locations = face_recognition.face_locations(rgb_img, model="hog", number_of_times_to_upsample=upsample)

    if not face_locations:
        raise ValueError("No face detected. Ensure face is clearly visible and well-lit.")
    if len(face_locations) > 1:
        raise ValueError("Multiple faces detected. Only one person should be in frame.")

    loc = face_locations[0]
    top, right, bottom, left = loc
    face_w = right - left
    face_h = bottom - top

    if face_w < MIN_FACE_SIZE or face_h < MIN_FACE_SIZE:
        raise ValueError(f"Face too small ({face_w}x{face_h}px). Please move closer to the camera.")

    # Tunable jitters for speed vs. stability
    encodings = face_recognition.face_encodings(rgb_img, known_face_locations=[loc], num_jitters=jitters)
    if not encodings:
        raise ValueError("Could not extract face features. Please retake the photo in better light.")

    embedding  = encodings[0].tolist()
    confidence = min(1.0, max(face_w, face_h) / 200.0)

    return embedding, confidence, loc


def calculate_euclidean_distance(vec_a: list, vec_b: list) -> float:
    a = np.array(vec_a, dtype=np.float64)
    b = np.array(vec_b, dtype=np.float64)
    return float(np.linalg.norm(a - b))


# ──────────────────────────────────────────────────────────────────────────────
# LIVENESS DETECTION
# ──────────────────────────────────────────────────────────────────────────────
def eye_aspect_ratio(eye_pts: np.ndarray) -> float:
    A = np.linalg.norm(eye_pts[1] - eye_pts[5])
    B = np.linalg.norm(eye_pts[2] - eye_pts[4])
    C = np.linalg.norm(eye_pts[0] - eye_pts[3])
    return float((A + B) / (2.0 * C))

def compute_liveness(bgr_img: np.ndarray, face_loc: tuple):
    if landmark_predictor is None:
        return 0.30, True, "liveness_disabled"

    top, right, bottom, left = face_loc
    gray  = cv2.cvtColor(bgr_img, cv2.COLOR_BGR2GRAY)
    rect  = dlib.rectangle(left, top, right, bottom)
    shape = landmark_predictor(gray, rect)
    pts   = np.array([[shape.part(i).x, shape.part(i).y] for i in range(68)])

    left_ear  = eye_aspect_ratio(pts[36:42])
    right_ear = eye_aspect_ratio(pts[42:48])
    avg_ear   = (left_ear + right_ear) / 2.0
    passed    = avg_ear >= LIVENESS_EAR_THRESHOLD
    reason    = "liveness_passed" if passed else f"eyes_closed_ear_{avg_ear:.3f}"

    return avg_ear, passed, reason


# ──────────────────────────────────────────────────────────────────────────────
# CPU WORKER THREADS (Prevents blocking FastAPI)
# ──────────────────────────────────────────────────────────────────────────────
def run_register_cpu(image_bytes: bytes):
    bgr = bytes_to_bgr(image_bytes)
    bgr = preprocess_image(bgr)
    # High accuracy for baseline storage
    embedding, confidence, face_loc = extract_embedding(bgr, jitters=3, upsample=2)
    ear, liveness_passed, liveness_reason = compute_liveness(bgr, face_loc)
    return embedding, confidence, face_loc, ear, liveness_passed

def run_verify_cpu(image_bytes: bytes):
    bgr = bytes_to_bgr(image_bytes)
    bgr = preprocess_image(bgr)
    # High speed for verification
    live_embedding, confidence, face_loc = extract_embedding(bgr, jitters=1, upsample=1)
    ear, liveness_passed, liveness_reason = compute_liveness(bgr, face_loc)
    return live_embedding, confidence, ear, liveness_passed


# ──────────────────────────────────────────────────────────────────────────────
# SECURITY MIDDLEWARE & HEALTH
# ──────────────────────────────────────────────────────────────────────────────
@app.middleware("http")
async def check_secret(request: Request, call_next):
    if request.url.path in ("/health", "/", "/docs", "/openapi.json"):
        return await call_next(request)
    if SERVICE_SECRET:
        if request.headers.get("X-Service-Secret", "") != SERVICE_SECRET:
            return JSONResponse(status_code=401, content={"success": False, "error": "Unauthorized"})
    return await call_next(request)

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "oa-face-recognition",
        "liveness_model": "loaded" if landmark_predictor else "disabled"
    }


# ──────────────────────────────────────────────────────────────────────────────
# ROUTES
# ──────────────────────────────────────────────────────────────────────────────
@app.post("/api/face/register")
async def register_face(image: UploadFile = File(...)):
    t0 = time.time()
    try:
        image_bytes = await image.read()
        
        # Offload to threadpool
        embedding, confidence, face_loc, ear, liveness_passed = await run_in_threadpool(run_register_cpu, image_bytes)

        top, right, bottom, left = face_loc
        ms = int((time.time() - t0) * 1000)

        log.info(f"REGISTER  conf={confidence:.2f}  ear={ear:.3f}  liveness={liveness_passed}  {ms}ms")

        return {
            "success":            True,
            "embedding":          embedding,
            "confidence":         round(confidence, 3),
            "liveness_ear":       round(ear, 4),
            "liveness_passed":    liveness_passed,
            "face_size":          max(right - left, bottom - top),
            "processing_time_ms": ms,
        }

    except ValueError as e:
        log.warning(f"REGISTER FAIL: {e}")
        return JSONResponse(status_code=400, content={"success": False, "error": str(e)})
    except Exception as e:
        log.error(f"REGISTER ERROR: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"success": False, "error": "Internal error during registration"})


@app.post("/api/face/verify")
async def verify_face(
    image: UploadFile = File(...),
    embedding: str = Form(...),
    liveness_required: str = Form("true"),
):
    t0 = time.time()
    try:
        try:
            stored = json.loads(embedding)
        except json.JSONDecodeError:
            return JSONResponse(status_code=400, content={"success": False, "error": "Invalid embedding."})

        if not isinstance(stored, list) or len(stored) != 128:
            return JSONResponse(status_code=400, content={"success": False, "error": "Embedding must be list of 128 floats."})

        image_bytes = await image.read()
        
        # Offload to threadpool
        live_embedding, confidence, ear, liveness_passed = await run_in_threadpool(run_verify_cpu, image_bytes)

        require_liveness = liveness_required.lower() == "true"

        if require_liveness and not liveness_passed:
            ms = int((time.time() - t0) * 1000)
            log.warning(f"VERIFY LIVENESS FAIL  ear={ear:.3f}  {ms}ms")
            return {
                "success":            True,
                "verified":           False,
                "similarity":         0.0,
                "similarity_percent": 0,
                "liveness_score":     round(ear, 4),
                "liveness_passed":    False,
                "confidence":         round(confidence, 3),
                "reason":             f"Liveness check failed (EAR={ear:.3f}). Please blink naturally and try again.",
                "processing_time_ms": ms,
            }

        # Distance calculation is incredibly fast, safe to run on main thread
        distance = calculate_euclidean_distance(live_embedding, stored)
        dist_thresh = DISTANCE_THRESHOLD
        is_match = distance <= dist_thresh
        similarity = max(0.0, 1.0 - (distance / 1.2))
        print(is_match, distance, dist_thresh)

        reason = "verified" if is_match else f"face_mismatch (distance={distance:.3f}, need<={dist_thresh:.2f})"
        ms = int((time.time() - t0) * 1000)

        log.info(f"VERIFY {'OK' if is_match else 'FAIL'}  dist={distance:.3f}  ear={ear:.3f}  {ms}ms")
        
        return {
            "success":            True,
            "verified":           is_match,
            "distance":           round(distance, 4),
            "similarity_percent": round(similarity * 100, 1),
            "liveness_score":     round(ear, 4),
            "liveness_passed":    liveness_passed,
            "confidence":         round(confidence, 3),
            "reason":             reason,
            "processing_time_ms": ms,
        }

    except ValueError as e:
        log.warning(f"VERIFY FAIL: {e}")
        return JSONResponse(status_code=400, content={"success": False, "error": str(e)})
    except Exception as e:
        log.error(f"VERIFY ERROR: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"success": False, "error": "Internal error during verification"})


if __name__ == "__main__":
    log.info(f"Starting optimized server on port {PORT}")
    # Consider using workers=4 in production via gunicorn/uvicorn CLI
    uvicorn.run("app:app", host="0.0.0.0", port=PORT, reload=False, workers=1)