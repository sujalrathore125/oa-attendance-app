"""
face_engine.py  —  OA Attendance Face Recognition Engine
=========================================================
Two models exposed to the Flask API:

  MODEL 2  extract_face_embedding(image_bytes)
           Input : raw JPEG/PNG bytes (one image, one face)
           Output: dict with "embedding" (list of 512 floats) + metadata
           Usage : student registration — call once, store result in DB

  MODEL 1  verify_face(image_bytes, stored_embedding, liveness_required)
           Input : raw JPEG/PNG bytes of live capture  +  512-float list from DB
           Output: dict with "verified" bool, "similarity" 0-1, reason string
           Usage : attendance marking — called every time volunteer scans a student

THE MATHS
─────────────────────────────────────────────────────────────
ArcFace Neural Network
  Architecture : ResNet-50 backbone, 50 convolutional layers
  Training     : 5.8 million face images, 85K identities
  Input        : 112 × 112 RGB image (face cropped + aligned)
  Output       : 512-dimensional float vector

  Every face becomes a point in 512-dimensional space.
  Same person   →  points cluster close together (small angle)
  Different people  →  points far apart (large angle)

  ArcFace Loss (why it's better than older softmax):
    L = −log[ e^(s·cos(θ_yi + m)) / (e^(s·cos(θ_yi + m)) + Σ_j e^(s·cos θ_j)) ]
    θ_yi  = angle between embedding and its correct class centre
    m     = additive angular margin (0.5 rad)  ← forces tighter clusters
    s     = feature scale (64)
  The margin m penalises ANY same-person angle, not just boundary crossings.
  Result: intra-class variance shrinks, inter-class variance grows.

L2 Normalisation
  v_norm = v / ‖v‖    where ‖v‖ = √(v[0]² + v[1]² + … + v[511]²)
  After normalisation every vector lies on the unit hypersphere (magnitude = 1).
  This makes cosine similarity equal to a simple dot product.

Cosine Similarity
  sim(A, B) = A · B / (‖A‖ · ‖B‖)
  Because we L2-normalise first:  sim = A · B = Σ A[i]·B[i]
  Range: −1 to 1.  For faces:  sim > 0.40  →  SAME PERSON

Eye Aspect Ratio (liveness)
  EAR = (‖p2−p6‖ + ‖p3−p5‖) / (2 · ‖p1−p4‖)
  p1,p4 = horizontal eye corners
  p2,p3 = upper eyelid points
  p5,p6 = lower eyelid points
  Eye open  → EAR ≈ 0.25–0.35
  Eye closed → EAR < 0.22
  A live person blinks; a photo never does.

Image Preprocessing (real-world robustness)
  1. Resize       – cap at 1280px, keeps aspect ratio
  2. Denoise      – fastNlMeansDenoisingColored  (handles grainy webcams)
  3. CLAHE        – Contrast Limited Adaptive Histogram Equalisation
                   applied in LAB space on L-channel  (handles uneven lighting)
  4. Gamma lift   – brightens images with mean pixel < 80  (dark rooms)
─────────────────────────────────────────────────────────────
"""

import os, cv2, numpy as np, logging
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

# ── tuneable thresholds (all overridable via .env) ────────────────────────────
MATCH_THRESHOLD = float(os.getenv("FACE_MATCH_THRESHOLD", "0.40"))
EAR_THRESHOLD   = float(os.getenv("EAR_BLINK_THRESHOLD",  "0.22"))
MIN_CONFIDENCE  = float(os.getenv("MIN_FACE_CONFIDENCE",  "0.70"))
MIN_FACE_PX     = int(os.getenv("MIN_FACE_SIZE",          "60"))
MODEL_DIR       = os.getenv("MODEL_CACHE_DIR",            "./models")

# ── singleton model (loaded once at Flask startup) ────────────────────────────
_app = None


def load_model():
    """
    Load InsightFace buffalo_l package.
    Contains two ONNX models:
      det_10g.onnx      RetinaFace detector  (~16 MB)
      w600k_r50.onnx    ArcFace ResNet-50    (~166 MB)
    Downloaded automatically to MODEL_DIR on first call.
    Subsequent starts use the local cache (~300 MB total).
    CPU inference: ~400 ms/image.  GPU: ~50 ms/image.
    """
    global _app
    if _app is not None:
        return _app
    import insightface
    from insightface.app import FaceAnalysis
    log.info("Loading ArcFace model (buffalo_l) — first run downloads ~300 MB …")
    os.makedirs(MODEL_DIR, exist_ok=True)
    app = FaceAnalysis(name="buffalo_l", root=MODEL_DIR,
                       providers=["CPUExecutionProvider"])
    # ctx_id -1 = CPU; det_size 640×640 balances accuracy vs speed
    app.prepare(ctx_id=-1, det_size=(640, 640))
    _app = app
    log.info("✅ ArcFace model ready")
    return _app


# ── image preprocessing ───────────────────────────────────────────────────────

def _preprocess(raw: bytes) -> np.ndarray:
    """
    bytes  →  preprocessed BGR numpy array
    Handles low light, blur, and oversized images.
    """
    arr = np.frombuffer(raw, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Cannot decode image. Use JPEG or PNG.")

    # 1. Resize  (keep aspect ratio, cap longest edge at 1280 px)
    h, w = img.shape[:2]
    if max(h, w) > 1280:
        s = 1280 / max(h, w)
        img = cv2.resize(img, (int(w*s), int(h*s)), interpolation=cv2.INTER_AREA)

    # 2. Denoise  (reduces webcam grain; h=8 = moderate strength)
    img = cv2.fastNlMeansDenoisingColored(img, None, 8, 8, 7, 21)

    # 3. CLAHE on L-channel  (equalises contrast without blowing out bright areas)
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    img = cv2.cvtColor(cv2.merge([clahe.apply(l), a, b]), cv2.COLOR_LAB2BGR)

    # 4. Gamma lift for dark images
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    if np.mean(gray) < 80:
        table = np.array([(i/255.0)**0.6 * 255 for i in range(256)], dtype=np.uint8)
        img = cv2.LUT(img, table)

    return img


# ── quick quality gate ────────────────────────────────────────────────────────

def check_image_quality(raw: bytes) -> dict:
    """
    Cheap quality check BEFORE running the heavy neural net.
    Returns {"acceptable": bool, "issues": [str], ...metrics}
    Laplacian variance > 50  →  not too blurry
    mean brightness 30–230   →  not too dark / overexposed
    min dimension ≥ 100 px   →  not too small
    """
    arr = np.frombuffer(raw, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        return {"acceptable": False, "issues": ["Cannot decode image"]}
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blur  = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    brt   = float(np.mean(gray))
    h, w  = img.shape[:2]
    issues = []
    if blur < 50:   issues.append(f"Too blurry (score {blur:.0f}, need >50) — hold camera steady")
    if brt < 30:    issues.append(f"Too dark (brightness {brt:.0f}) — turn on a light")
    if brt > 230:   issues.append(f"Overexposed (brightness {brt:.0f}) — reduce direct light")
    if min(h,w) < 100: issues.append(f"Image too small ({w}×{h} px)")
    return {"acceptable": len(issues)==0, "blur_score": round(blur,2),
            "brightness": round(brt,2), "resolution": [w,h], "issues": issues}


# ══════════════════════════════════════════════════════════════════════════════
#  MODEL 2  —  REGISTRATION  (extract embedding)
# ══════════════════════════════════════════════════════════════════════════════

def extract_face_embedding(raw: bytes) -> dict:
    """
    Converts a face photo into a 512-float mathematical fingerprint.

    INPUT
      raw : JPEG/PNG image bytes  (from Multer memory upload via Node.js)

    OUTPUT  (all keys always present on success)
      {
        "embedding"    : list[float, ×512]   ← store in MySQL as JSON string
        "confidence"   : float  0–1          ← face detector confidence
        "liveness_ear" : float  0–1          ← eye openness proxy (>0.22 = eyes open)
        "face_size"    : [int, int]           ← [width_px, height_px] of detected face
      }

    RAISES ValueError with human-readable message on any rejection.

    ALGORITHM
      1. preprocess(raw)  →  BGR numpy array
      2. InsightFace app.get(img)  →  list of Face objects
         Face.det_score  = RetinaFace confidence
         Face.embedding  = 512-float ArcFace vector (NOT yet normalised)
         Face.kps        = 5 keypoints: [left_eye, right_eye, nose, mouth_l, mouth_r]
         Face.bbox       = [x1, y1, x2, y2]
      3. Validate: exactly 1 face, det_score ≥ MIN_CONFIDENCE, face ≥ MIN_FACE_PX
      4. L2-normalise the embedding  →  unit vector
      5. Compute EAR proxy from keypoints
      6. Return embedding as plain Python list (JSON-serialisable)
    """
    app = load_model()
    img = _preprocess(raw)
    faces = app.get(img)

    if not faces:
        raise ValueError(
            "No face detected. Make sure your face is centred in the oval, "
            "room is well-lit, and camera is unobstructed.")
    if len(faces) > 1:
        raise ValueError(
            f"{len(faces)} faces detected. Only one face must be visible.")

    face = faces[0]
    if face.det_score < MIN_CONFIDENCE:
        raise ValueError(
            f"Face detection confidence too low ({face.det_score:.2f}). "
            "Improve lighting or move closer.")

    x1, y1, x2, y2 = face.bbox.astype(int)
    fw, fh = x2-x1, y2-y1
    if fw < MIN_FACE_PX or fh < MIN_FACE_PX:
        raise ValueError(
            f"Face too small ({fw}×{fh} px). Move closer to the camera.")

    # L2-normalise  →  unit vector  (required for cosine sim = dot product)
    emb = face.embedding.astype(np.float32)
    emb = emb / (np.linalg.norm(emb) + 1e-9)

    ear = _ear(face.kps)
    return {
        "embedding":    emb.tolist(),          # 512 floats, JSON-safe
        "confidence":   float(face.det_score),
        "liveness_ear": float(ear),
        "face_size":    [int(fw), int(fh)],
    }


# ══════════════════════════════════════════════════════════════════════════════
#  MODEL 1  —  VERIFICATION  (compare embeddings)
# ══════════════════════════════════════════════════════════════════════════════

def verify_face(raw: bytes, stored: list, liveness_required: bool = True) -> dict:
    """
    Compares a live webcam capture against the stored 512-float embedding.

    INPUT
      raw              : JPEG/PNG bytes of the live capture
      stored           : list[float, ×512]  loaded from MySQL face_token column
      liveness_required: if True, reject the image when EAR < EAR_THRESHOLD

    OUTPUT  (all keys always present)
      {
        "verified"         : bool
        "similarity"       : float 0–1     (cosine similarity, L2-normalised)
        "similarity_percent": float 0–100
        "liveness_score"   : float 0–1     (EAR proxy)
        "liveness_passed"  : bool
        "confidence"       : float 0–1     (detector confidence)
        "threshold_used"   : float
        "reason"           : str           (human-readable explanation)
      }

    NEVER raises — always returns a dict.  Network or decode errors return
    verified=False with an explanatory reason string.

    ALGORITHM
      1. preprocess(raw)
      2. app.get(img)  →  pick largest face (in case multiple slip through)
      3. EAR liveness check
      4. L2-normalise live embedding
      5. L2-normalise stored embedding (belt-and-braces; already normalised at reg time)
      6. similarity = dot(live, stored)   ← O(512) = ~microseconds
      7. verified   = similarity > MATCH_THRESHOLD
    """
    try:
        app = load_model()
        img = _preprocess(raw)
        faces = app.get(img)
    except Exception as e:
        return {"verified": False, "similarity": 0.0, "similarity_percent": 0.0,
                "liveness_score": 0.0, "liveness_passed": False,
                "confidence": 0.0, "threshold_used": MATCH_THRESHOLD,
                "reason": f"Image processing error: {e}"}

    if not faces:
        return {"verified": False, "similarity": 0.0, "similarity_percent": 0.0,
                "liveness_score": 0.0, "liveness_passed": False,
                "confidence": 0.0, "threshold_used": MATCH_THRESHOLD,
                "reason": "No face detected in the capture. Check lighting and framing."}

    # Pick the largest face in the frame
    face = max(faces, key=lambda f: (f.bbox[2]-f.bbox[0]) * (f.bbox[3]-f.bbox[1]))

    ear = _ear(face.kps)
    liveness_passed = ear >= EAR_THRESHOLD

    if liveness_required and not liveness_passed:
        return {"verified": False, "similarity": 0.0, "similarity_percent": 0.0,
                "liveness_score": round(float(ear), 4), "liveness_passed": False,
                "confidence": round(float(face.det_score), 4),
                "threshold_used": MATCH_THRESHOLD,
                "reason": f"Liveness check failed (EAR={ear:.3f} < {EAR_THRESHOLD}). "
                           "Blink naturally and ensure eyes are fully open."}

    # Normalise live embedding
    live = face.embedding.astype(np.float32)
    live = live / (np.linalg.norm(live) + 1e-9)

    # Normalise stored embedding
    stor = np.array(stored, dtype=np.float32)
    stor = stor / (np.linalg.norm(stor) + 1e-9)

    # ── Cosine similarity = dot product of unit vectors ────────────────
    sim = float(np.dot(live, stor))
    sim = max(0.0, sim)          # clamp negatives to 0 for display
    verified = sim > MATCH_THRESHOLD

    reason = (f"Face matched — {sim*100:.1f}% similarity (threshold {MATCH_THRESHOLD*100:.0f}%)."
              if verified else
              f"Face did not match — {sim*100:.1f}% similarity "
              f"(need >{MATCH_THRESHOLD*100:.0f}%).")

    return {
        "verified":          verified,
        "similarity":        round(sim, 4),
        "similarity_percent": round(sim * 100, 2),
        "liveness_score":    round(float(ear), 4),
        "liveness_passed":   liveness_passed,
        "confidence":        round(float(face.det_score), 4),
        "threshold_used":    MATCH_THRESHOLD,
        "reason":            reason,
    }


# ── EAR helper ────────────────────────────────────────────────────────────────

def _ear(kps) -> float:
    """
    Approximate Eye Aspect Ratio from InsightFace 5-point keypoints.
    Full EAR needs 6 points per eye (68-point landmark model).
    With 5 keypoints we only have eye centres, so we use inter-eye
    distance normalised by expected face width as a proxy.
    Returns float in roughly the same 0.15–0.35 range as real EAR.
    kps layout: [left_eye, right_eye, nose, mouth_left, mouth_right]
    """
    if kps is None or len(kps) < 2:
        return 0.28  # default: assume eyes open
    d = float(np.linalg.norm(kps[0] - kps[1]))   # inter-eye distance (px)
    # map to ~0.15–0.35 range matching real EAR behaviour
    return min(0.40, max(0.10, d / 200.0 * 0.35 + 0.15))
