const { pool } = require('../config/db');
const { delCachePattern, getCache, setCache } = require('../config/redis');
const { verifyStudentFace } = require('../services/faceService');
const ExcelJS = require('exceljs');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');

// ─── Mark Attendance (TPO Volunteer) ─────────────────────────────────────────
const markAttendance = async (req, res) => {
  const { oa_session_id, scholar_no, face_match_score, liveness_score } = req.body;
  console.log("Hello", liveness_score);
  if (!oa_session_id || !scholar_no) {
    return res.status(400).json({ success: false, message: 'oa_session_id and scholar_no are required' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Verify OA session is active
    const [sessions] = await conn.execute(
      `SELECT id, status, extended_until FROM oa_sessions WHERE id = ?`,
      [oa_session_id]
    );
    if (!sessions.length) {
      return res.status(404).json({ success: false, message: 'OA session not found' });
    }

    const session = sessions[0];
    if (!['active', 'extended'].includes(session.status)) {
      return res.status(400).json({ success: false, message: 'OA session is not active' });
    }

    if (session.status === 'extended' && new Date(session.extended_until) < new Date()) {
      return res.status(400).json({ success: false, message: 'Extended period has expired' });
    }

    // Get student
    const [students] = await conn.execute(
      'SELECT id FROM students WHERE scholar_no = ?',
      [scholar_no]
    );
    if (!students.length) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const studentId = students[0].id;

    // Check duplicate attendance
    const [existing] = await conn.execute(
      'SELECT id FROM attendance WHERE oa_session_id = ? AND student_id = ?',
      [oa_session_id, studentId]
    );
    if (existing.length) {
      return res.status(409).json({ success: false, message: 'Attendance already marked for this student' });
    }

    let captureImageUrl = null;

    const isExtended = session.status === 'extended' ? 1 : 0;
    const deviceInfo = req.headers['user-agent']?.substring(0, 255) || null;

    const [result] = await conn.execute(
      `INSERT INTO attendance (oa_session_id, student_id, marked_by, status, face_match_score, liveness_score, capture_image_url, is_extended, device_info)
       VALUES (?, ?, ?, 'present', ?, ?, ?, ?, ?)`,
      [oa_session_id, studentId, req.user.id, face_match_score, liveness_score, captureImageUrl, isExtended, deviceInfo]
    );

    await conn.commit();
    await delCachePattern(`attendance:*`);

    logger.info('Attendance marked', { attendanceId: result.insertId, scholarNo: scholar_no, oaSessionId: oa_session_id });

    res.status(201).json({
      success: true,
      message: 'Attendance marked successfully',
      data: { attendance_id: result.insertId, is_extended: isExtended },
    });
  } catch (err) {
    await conn.rollback();
    logger.error('Mark attendance error', { error: err.message });
    res.status(500).json({ success: false, message: 'Failed to mark attendance' });
  } finally {
    conn.release();
  }
};

// ─── Get attendance for an OA Session ────────────────────────────────────────
const getOAAttendance = async (req, res) => {
  const { session_id } = req.params;
  const cacheKey = `attendance:oa:${session_id}`;

  const page = Math.max(1, parseInt(req.query.page || '1'));
  const limit = parseInt(req.query.limit || '20');
  const offset = (page - 1) * limit;

  try {
    const cached = await getCache(cacheKey);
    if (cached) return res.json({ success: true, data: cached, fromCache: true });

    const [records] = await pool.execute(
      `SELECT a.id, a.status, a.face_match_score, a.liveness_score, a.marked_at,
              a.is_extended, a.capture_image_url,
              s.scholar_no, u.full_name, s.branch, s.section,
              mv.full_name as marked_by_name
       FROM attendance a
       JOIN students s ON a.student_id = s.id
       JOIN users u    ON s.user_id = u.id
       JOIN users mv   ON a.marked_by = mv.id
       WHERE a.oa_session_id = ?
       ORDER BY s.branch, s.section, u.full_name LIMIT ? OFFSET ?`,
      [session_id, String(limit), String(offset)]
    );

    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) as total FROM attendance WHERE oa_session_id = ?`,
      [session_id]
    );

    res.json({ 
      success: true, 
      data: records, 
      meta: {
        totalCount: total,
        totalPages: Math.ceil(total / limit),
        currentPage: page
      }
    });
  } catch (err) {
    logger.error('Get attendance error', { error: err.message });
    res.status(500).json({ success: false, message: 'Failed to fetch attendance' });
  }
};

// ─── Get student's own attendance history ─────────────────────────────────────
const getStudentHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const [student] = await pool.execute('SELECT id FROM students WHERE user_id = ?', [userId]);
    if (!student.length) return res.status(404).json({ success: false, message: 'Student not found' });

    const page = Math.max(1, parseInt(req.query.page || '1'));
    const limit = parseInt(req.query.limit || '10');
    const offset = (page - 1) * limit;

    const [records] = await pool.execute(
      `SELECT a.id, a.status, a.marked_at, a.is_extended, a.face_match_score,
              os.title, os.oa_date, os.start_time, os.end_time
       FROM attendance a
       JOIN oa_sessions os ON a.oa_session_id = os.id
       WHERE a.student_id = ?
       ORDER BY os.oa_date DESC LIMIT ? OFFSET ?`,
      [student[0].id, String(limit), String(offset)]
    );

    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) as total FROM attendance WHERE student_id = ?`,
      [student[0].id]
    );

    res.json({ 
      success: true, 
      data: records, 
      meta: {
        totalCount: total,
        totalPages: Math.ceil(total / limit),
        currentPage: page
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch history' });
  }
};

// ─── Export attendance as Excel (Coordinator/Admin) ──────────────────────────
const exportAttendanceExcel = async (req, res) => {
  const { session_id } = req.params;
  const { branch } = req.query;

  try {
    const [session] = await pool.execute('SELECT * FROM oa_sessions WHERE id = ?', [session_id]);
    if (!session.length) return res.status(404).json({ success: false, message: 'OA not found' });

    let query = `
      SELECT s.scholar_no, u.full_name, s.branch, s.section,
             a.marked_at, a.is_extended
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      JOIN users u ON s.user_id = u.id
      WHERE a.oa_session_id = ? AND a.status = 'present'
    `;
    const params = [session_id];

    if (branch) {
      query += ' AND s.branch = ?';
      params.push(branch);
    }

    query += ' ORDER BY s.branch, s.section, u.full_name';

    const [students] = await pool.execute(query, params);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'OA Attendance System';
    workbook.created = new Date();

    // Create a single main sheet
    const sheet = workbook.addWorksheet('Attendance');

    // Header
    sheet.addRow([`OA: ${session[0].title}`, '', '', '', '', '']);
    sheet.addRow([`Date: ${session[0].oa_date}`, '', '', '', '', '']);
    sheet.addRow([]);

    sheet.addRow(['Scholar No', 'Full Name', 'Branch', 'Section', 'Marked At', 'Is Extended']);

    // Style header row
    const headerRow = sheet.getRow(4);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };

    students.forEach(r => {
      sheet.addRow([
        r.scholar_no,
        r.full_name,
        r.branch,
        r.section,
        r.marked_at ? new Date(r.marked_at).toLocaleString() : '-',
        r.is_extended ? 'Yes' : 'No',
      ]);
    });

    sheet.columns.forEach(col => { col.width = 20; });

    // Summary sheet
    const summary = workbook.addWorksheet('Summary');
    summary.addRow(['OA Title', session[0].title]);
    summary.addRow(['Date', session[0].oa_date]);
    summary.addRow(['Total Present', students.length]);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=OA_Attendance_${session_id}_${Date.now()}.xlsx`);

    await workbook.xlsx.write(res);
  } catch (err) {
    logger.error('Export Excel error', { error: err.message });
    res.status(500).json({ success: false, message: 'Export failed' });
  }
};

// ─── Dashboard stats (admin) ──────────────────────────────────────────────────
const getDashboardStats = async (req, res) => {
  try {
    const [[totalStudents]] = await pool.execute('SELECT COUNT(*) as count FROM students');
    const [[totalOA]]       = await pool.execute('SELECT COUNT(*) as count FROM oa_sessions');
    const [[activeOA]]      = await pool.execute(`SELECT COUNT(*) as count FROM oa_sessions WHERE status IN ('active','extended')`);
    const [[totalAttend]]   = await pool.execute(`SELECT COUNT(*) as count FROM attendance WHERE status = 'present'`);

    const [recentOA] = await pool.execute(
      `SELECT os.id, os.title, os.oa_date, os.status,
              COUNT(a.id) as attendance_count
       FROM oa_sessions os
       LEFT JOIN attendance a ON a.oa_session_id = os.id
       GROUP BY os.id ORDER BY os.oa_date DESC LIMIT 5`
    );

    res.json({
      success: true,
      data: {
        total_students: totalStudents.count,
        total_oa: totalOA.count,
        active_oa: activeOA.count,
        total_attendance_marked: totalAttend.count,
        recent_oa: recentOA,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
};

module.exports = {
  markAttendance,
  getOAAttendance,
  getStudentHistory,
  exportAttendanceExcel,
  getDashboardStats,
};
