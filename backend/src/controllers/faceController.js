const { pool }   = require('../config/db');
const { registerStudentFace, verifyStudentFace, checkPythonService } = require('../services/faceService');
const logger     = require('../utils/logger');

// ─── Register Face (student, first time) ──────────────────────────────────────
const registerFace = async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Face image is required' });

  try {
    const userId = req.user.id;
    const [rows] = await pool.execute('SELECT id, face_registered FROM students WHERE user_id = ?', [userId]);

    if (!rows.length) return res.status(404).json({ success: false, message: 'Student not found' });
    if (rows[0].face_registered) {
      return res.status(400).json({ success: false, message: 'Face already registered. Contact admin to reset.' });
    }

    // Python Model 2: extract 128-dim embedding
    const result = await registerStudentFace(req.file.buffer);

    // Store embedding as JSON string in face_token column
    await pool.execute(
      'UPDATE students SET face_token = ?, face_registered = 1 WHERE user_id = ?',
      [result.faceToken, userId]   // faceToken = JSON.stringify([128 floats])
    );

    logger.info('Face registered', { userId, liveness_ear: result.livenessEar, confidence: result.confidence });

    res.json({
      success: true,
      message: 'Face registered successfully',
      data: {
        livenessScore:  Math.round(result.livenessEar * 100),
        confidence:     result.confidence,
        faceSize:       result.faceSize,
      },
    });
  } catch (err) {
    logger.error('Face registration error', { error: err.message, userId: req.user?.id });
    res.status(400).json({ success: false, message: err.message });
  }
};

// ─── Reset face (admin) ────────────────────────────────────────────────────────
const resetFaceRegistration = async (req, res) => {
  const { studentId } = req.params;
  try {
    await pool.execute('UPDATE students SET face_token = NULL, face_registered = 0 WHERE id = ?', [studentId]);
    res.json({ success: true, message: 'Face registration reset. Student can re-register.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Reset failed' });
  }
};

// ─── Verify face during OA (volunteer) ────────────────────────────────────────
const verifyFace = async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Captured image is required' });

  const { scholar_no } = req.body;
  if (!scholar_no)     return res.status(400).json({ success: false, message: 'scholar_no is required' });

  try {
    const [students] = await pool.execute(
      `SELECT s.id, s.face_token, s.face_registered,
              u.full_name, s.branch, s.section, s.scholar_no
       FROM students s JOIN users u ON s.user_id = u.id
       WHERE s.scholar_no = ?`,
      [scholar_no]
    );

    if (!students.length) return res.status(404).json({ success: false, message: 'Student not found' });

    const student = students[0];
    if (!student.face_registered || !student.face_token) {
      return res.status(400).json({ success: false, message: 'Student has not registered their face yet' });
    }

    // Python Model 1: compare live image vs stored embedding
    const result = await verifyStudentFace(student.face_token, req.file.buffer);

    logger.info('Face verification', {
      scholarNo: scholar_no,
      verified:   result.verified,
      matchScore: result.matchScore,
    });

    res.json({
      success: true,
      data: {
        student: {
          id:          student.id,
          scholar_no:  student.scholar_no,
          full_name:   student.full_name,
          branch:      student.branch,
          section:     student.section,
        },
        verification: {
          livenessScore: result.livenessScore,
          matchScore:    result.matchScore,
          isMatch:       result.isMatch,
          verified:      result.verified,
          reason:        result.reason,
          threshold:     Math.round((1 - parseFloat(process.env.FACE_MATCH_THRESHOLD || '0.40')) * 100),
        },
      },
    });
  } catch (err) {
    logger.error('Face verification error', { error: err.message });
    res.status(400).json({ success: false, message: err.message });
  }
};

// ─── Python service health (admin) ────────────────────────────────────────────
const pythonServiceHealth = async (req, res) => {
  const isUp = await checkPythonService();
  res.json({
    success:        true,
    python_service: isUp ? 'online' : 'offline',
    url:            process.env.PYTHON_FACE_SERVICE_URL || 'http://localhost:8000',
  });
};

module.exports = { registerFace, verifyFace, resetFaceRegistration, pythonServiceHealth };
