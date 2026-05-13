"""
OA Attendance — Python Face Recognition Microservice
====================================================
Engine Switch: MediaPipe for Liveness, face_recognition for Embeddings.
"""

import os, time, json, logging
from typing import Optional
from dotenv import load_dotenv
import numpy as np
import cv2
import face_recognition
import mediapipe as mp
from fastapi import FastAPI, File, Form, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.concurrency import run_in_threadpool
import uvicorn

# Load .env file
load_dotenv()

# Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("face-service")

# Config
SERVICE_SECRET         = os.getenv("PYTHON_SERVICE_SECRET", "")
FACE_MATCH_THRESHOLD   = float(os.getenv("FACE_MATCH_THRESHOLD", "0.40"))
LIVENESS_EAR_THRESHOLD = float(os.getenv("LIVENESS_EAR_THRESHOLD", "0.22"))
MIN_FACE_SIZE          = int(os.getenv("MIN_FACE_SIZE", "50"))
PORT                   = int(os.getenv("PORT", "8000"))
DISTANCE_THRESHOLD     = float(os.getenv("DISTANCE_THRESHOLD", "0.35"))

app = FastAPI(title="OA Face Recognition Service (MediaPipe Edition)", version="3.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ──────────────────────────────────────────────────────────────────────────────
# MEDIAPIPE INITIALIZATION (Replaces dlib shape predictor)
# ──────────────────────────────────────────────────────────────────────────────
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(
    static_image_mode=True,       # True because we are processing independent HTTP images
    max_num_faces=1,              # Strict 1-person policy
    refine_landmarks=True,        # Crucial for accurate eye/iris tracking
    min_detection_confidence=0.5
)

# MediaPipe exact eye indices (468 point mesh)
RIGHT_EYE_INDICES = [33, 160, 158, 133, 153, 144] 
LEFT_EYE_INDICES  = [362, 385, 387, 263, 373, 380]

log.info("MediaPipe Face Mesh loaded — liveness ACTIVE")


# ──────────────────────────────────────────────────────────────────────────────
# PREPROCESSING
# ──────────────────────────────────────────────────────────────────────────────
def preprocess_image(bgr_img: np.ndarray) -> np.ndarray:
    img = bgr_img.copy()
    h, w = img.shape[:2]
    
    if max(h, w) > 800:
        scale = 800 / max(h, w)
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l = clahe.apply(l)
    img = cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)

    gray_mean = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).mean()
    if gray_mean < 100:
        gamma = max(0.5, min(2.5, np.log(128) / np.log(max(gray_mean, 1))))
        lut = np.array([((i / 255.0) ** (1.0 / gamma)) * 255 for i in range(256)], dtype=np.uint8)
        img = cv2.LUT(img, lut)

    blur = cv2.GaussianBlur(img, (0, 0), 3)
    img = cv2.addWeighted(img, 1.5, blur, -0.5, 0)
    return img

def bytes_to_bgr(image_bytes: bytes) -> np.ndarray:
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None: raise ValueError("Cannot decode image.")
    return img


# ──────────────────────────────────────────────────────────────────────────────
# FACE EMBEDDING (Still uses face_recognition/dlib for the 128-vector)
# ──────────────────────────────────────────────────────────────────────────────
def extract_embedding(bgr_img: np.ndarray, jitters: int = 1, upsample: int = 1):
    rgb_img = cv2.cvtColor(bgr_img, cv2.COLOR_BGR2RGB)
    face_locations = face_recognition.face_locations(rgb_img, model="hog", number_of_times_to_upsample=upsample)

    if not face_locations: raise ValueError("No face detected.")
    if len(face_locations) > 1: raise ValueError("Multiple faces detected.")

    loc = face_locations[0]
    top, right, bottom, left = loc
    face_w, face_h = right - left, bottom - top

    if face_w < MIN_FACE_SIZE or face_h < MIN_FACE_SIZE:
        raise ValueError(f"Face too small ({face_w}x{face_h}px).")

    encodings = face_recognition.face_encodings(rgb_img, known_face_locations=[loc], num_jitters=jitters)
    if not encodings: raise ValueError("Could not extract features.")

    return encodings[0].tolist(), min(1.0, max(face_w, face_h) / 200.0), loc

def calculate_euclidean_distance(vec_a: list, vec_b: list) -> float:
    return float(np.linalg.norm(np.array(vec_a, dtype=np.float64) - np.array(vec_b, dtype=np.float64)))


# ──────────────────────────────────────────────────────────────────────────────
# NEW MEDIAPIPE LIVENESS DETECTION
# ──────────────────────────────────────────────────────────────────────────────
def compute_ear_mediapipe(landmarks, indices, img_w, img_h):
    """Calculates EAR using MediaPipe landmarks scaled to image dimensions."""
    # Convert normalized coordinates (0.0 - 1.0) to pixel coordinates
    pts = [np.array([landmarks[i].x * img_w, landmarks[i].y * img_h]) for i in indices]
    
    # MediaPipe Index order in the array: [corner_out, top_1, top_2, corner_in, bottom_2, bottom_1]
    # pts[0] & pts[3] are horizontal corners
    # pts[1] & pts[5] are vertical pair 1
    # pts[2] & pts[4] are vertical pair 2
    
    A = np.linalg.norm(pts[1] - pts[5])
    B = np.linalg.norm(pts[2] - pts[4])
    C = np.linalg.norm(pts[0] - pts[3])
    
    if C == 0: return 0.0 # Prevent division by zero
    return float((A + B) / (2.0 * C))

def compute_liveness(bgr_img: np.ndarray):
    """Returns (ear_score, passed, reason) using MediaPipe"""
    rgb_img = cv2.cvtColor(bgr_img, cv2.COLOR_BGR2RGB)
    results = face_mesh.process(rgb_img)
    
    if not results.multi_face_landmarks:
        return 0.0, False, "no_face_mesh_detected"

    landmarks = results.multi_face_landmarks[0].landmark
    h, w = bgr_img.shape[:2]

    right_ear = compute_ear_mediapipe(landmarks, RIGHT_EYE_INDICES, w, h)
    left_ear  = compute_ear_mediapipe(landmarks, LEFT_EYE_INDICES, w, h)
    
    avg_ear = (left_ear + right_ear) / 2.0
    passed = avg_ear >= LIVENESS_EAR_THRESHOLD
    reason = "liveness_passed" if passed else f"eyes_closed_ear_{avg_ear:.3f}"

    return avg_ear, passed, reason


# ──────────────────────────────────────────────────────────────────────────────
# WORKERS & ROUTES
# ──────────────────────────────────────────────────────────────────────────────
def run_register_cpu(image_bytes: bytes):
    bgr = preprocess_image(bytes_to_bgr(image_bytes))
    embedding, confidence, face_loc = extract_embedding(bgr, jitters=3, upsample=2)
    # MediaPipe doesn't need bounding boxes, it processes the whole image natively
    ear, liveness_passed, liveness_reason = compute_liveness(bgr) 
    return embedding, confidence, face_loc, ear, liveness_passed

def run_verify_cpu(image_bytes: bytes):
    bgr = preprocess_image(bytes_to_bgr(image_bytes))
    live_embedding, confidence, face_loc = extract_embedding(bgr, jitters=1, upsample=1)
    ear, liveness_passed, liveness_reason = compute_liveness(bgr)
    return live_embedding, confidence, ear, liveness_passed

@app.middleware("http")
async def check_secret(request: Request, call_next):
    if request.url.path in ("/health", "/", "/docs", "/openapi.json"): return await call_next(request)
    if SERVICE_SECRET and request.headers.get("X-Service-Secret", "") != SERVICE_SECRET:
        return JSONResponse(status_code=401, content={"success": False, "error": "Unauthorized"})
    return await call_next(request)

@app.get("/health")
def health():
    return {"status": "ok", "service": "oa-face-recognition", "liveness_model": "mediapipe_active"}

@app.post("/api/face/register")
async def register_face(image: UploadFile = File(...)):
    t0 = time.time()
    try:
        embedding, conf, loc, ear, passed = await run_in_threadpool(run_register_cpu, await image.read())
        ms = int((time.time() - t0) * 1000)
        log.info(f"REGISTER conf={conf:.2f} ear={ear:.3f} liveness={passed} {ms}ms")
        return {
            "success": True, "embedding": embedding, "confidence": round(conf, 3),
            "liveness_ear": round(ear, 4), "liveness_passed": passed, "processing_time_ms": ms
        }
    except Exception as e:
        return JSONResponse(status_code=400, content={"success": False, "error": str(e)})

@app.post("/api/face/verify")
async def verify_face(image: UploadFile = File(...), embedding: str = Form(...), liveness_required: str = Form("true")):
    t0 = time.time()
    try:
        stored = json.loads(embedding)
        live_embed, conf, ear, passed = await run_in_threadpool(run_verify_cpu, await image.read())

        if liveness_required.lower() == "true" and not passed:
            ms = int((time.time() - t0) * 1000)
            return {
                "success": True, "verified": False, "similarity_percent": 0,
                "liveness_score": round(ear, 4), "liveness_passed": False,
                "reason": f"Liveness check failed (EAR={ear:.3f}).", "processing_time_ms": ms
            }

        dist = calculate_euclidean_distance(live_embed, stored)
        is_match = dist <= DISTANCE_THRESHOLD
        ms = int((time.time() - t0) * 1000)

        print(f"DEBUG: dist={dist:.4f} threshold={DISTANCE_THRESHOLD:.4f} ear={ear:.3f} liveness_passed={passed} {is_match}")  
        
        log.info(f"VERIFY {'OK' if is_match else 'FAIL'} dist={dist:.3f} ear={ear:.3f} {ms}ms")
        return {
            "success": True, "verified": is_match, "distance": round(dist, 4),
            "similarity_percent": round(max(0.0, 1.0 - (dist / 1.2)) * 100, 1),
            "liveness_score": round(ear, 4), "liveness_passed": passed, "reason": "verified" if is_match else "mismatch",
            "processing_time_ms": ms
        }
    except Exception as e:
        return JSONResponse(status_code=400, content={"success": False, "error": str(e)})

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=PORT, reload=False, workers=1)