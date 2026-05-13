/**
 * faceService.js
 * ==============
 * Node.js ↔ Python face recognition microservice bridge.
 * Replaces Face++ API. Runs locally — zero API cost.
 *
 * registerStudentFace(imageBuffer)
 *   → POST Python /api/face/register
 *   → Returns 128-float embedding to store in DB as JSON string
 *
 * verifyStudentFace(storedEmbedding, captureImageBuffer)
 *   → POST Python /api/face/verify
 *   → Returns { verified, similarity, livenessScore, reason }
 */

const FormData = require('form-data');
const fetch    = require('node-fetch');
const logger   = require('../utils/logger');
require('dotenv').config();

const PYTHON_URL     = process.env.PYTHON_FACE_SERVICE_URL || 'http://localhost:8000';
const SERVICE_SECRET = process.env.PYTHON_SERVICE_SECRET   || '';

const serviceHeaders = () => ({ 'X-Service-Secret': SERVICE_SECRET });

// Check if Python service is alive
const checkPythonService = async () => {
  try {
    const res = await fetch(`${PYTHON_URL}/health`, { timeout: 3000 });
    return res.ok;
  } catch { return false; }
};

/**
 * MODEL 2 — Register face: extract 128-dim embedding
 * Input:  imageBuffer  (Multer memory buffer)
 * Output: { faceToken (JSON string), livenessEar, confidence, faceSize }
 *
 * faceToken = JSON.stringify([128 floats])  → stored in MySQL face_token column
 */
const registerStudentFace = async (imageBuffer) => {
  const form = new FormData();
  form.append('image', imageBuffer, { filename: 'face.jpg', contentType: 'image/jpeg' });

  let res;
  try {
    res = await fetch(`${PYTHON_URL}/api/face/register`, {
      method:  'POST',
      headers: { ...serviceHeaders(), ...form.getHeaders() },
      body:    form,
      timeout: 25000,
    });
  } catch (err) {
    logger.error('Python face service unreachable', { error: err.message });
    throw new Error('Face recognition service is offline. Please contact admin.');
  }

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Face registration failed');
  }

  logger.info('Python register OK', {
    confidence:  data.confidence,
    liveness_ear: data.liveness_ear,
    ms:          data.processing_time_ms,
  });

  return {
    faceToken:    JSON.stringify(data.embedding),   // 128 floats as JSON string → DB
    embedding:    data.embedding,
    livenessEar:  data.liveness_ear,
    livenessScore: Math.round(data.liveness_ear * 100),
    confidence:   data.confidence,
    faceSize:     data.face_size,
  };
};

/**
 * MODEL 1 — Verify face: compare live image vs stored embedding
 * Input:  storedEmbedding (JSON string from DB), captureImageBuffer
 * Output: { verified, isMatch, matchScore, livenessScore, reason }
 */
const verifyStudentFace = async (storedEmbedding, captureImageBuffer, livenessRequired = true) => {
  // Parse stored embedding
  let embeddingArray = storedEmbedding;
  if (typeof storedEmbedding === 'string') {
    try { embeddingArray = JSON.parse(storedEmbedding); }
    catch { throw new Error('Stored face data is corrupted. Student must re-register.'); }
  }
  if (!Array.isArray(embeddingArray) || embeddingArray.length !== 128) {
    throw new Error(`Invalid face data (expected 128 values, got ${Array.isArray(embeddingArray) ? embeddingArray.length : 'invalid'}). Student must re-register.`);
  }

  const form = new FormData();
  form.append('image',              captureImageBuffer, { filename: 'capture.jpg', contentType: 'image/jpeg' });
  form.append('embedding',          JSON.stringify(embeddingArray));
  form.append('liveness_required',  livenessRequired ? 'true' : 'false');

  let res;
  try {
    res = await fetch(`${PYTHON_URL}/api/face/verify`, {
      method:  'POST',
      headers: { ...serviceHeaders(), ...form.getHeaders() },
      body:    form,
      timeout: 25000,
    });
  } catch (err) {
    logger.error('Python face service unreachable during verify', { error: err.message });
    throw new Error('Face recognition service is offline. Please contact admin.');
  }

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Face verification failed');
  }

  logger.info('Python verify OK', {
    verified:   data.verified,
    similarity: data.similarity,
    ms:         data.processing_time_ms,
  });

  return {
    verified:       data.verified,
    isMatch:        data.verified,
    similarity:     data.similarity,
    matchScore:     data.similarity_percent,
    livenessScore:  data.liveness_passed ? Math.round(data.liveness_score * 100) : 15,
    livenessEar:    data.liveness_score,
    confidence:     data.confidence,
    reason:         data.reason,
  };
};

module.exports = { registerStudentFace, verifyStudentFace, checkPythonService };
