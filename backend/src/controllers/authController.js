const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken, invalidateToken } = require('../utils/jwt');
const { setCache, delCache } = require('../config/redis');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');

const registerStudent = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { login_id, password, full_name, scholar_no, branch, section } = req.body;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [existing] = await conn.execute('SELECT id FROM users WHERE login_id = ?', [login_id]);
    if (existing.length) {
      return res.status(409).json({ success: false, message: 'Login ID already registered' });
    }

    const [existingScholar] = await conn.execute('SELECT id FROM students WHERE scholar_no = ?', [scholar_no]);
    if (existingScholar.length) {
      return res.status(409).json({ success: false, message: 'Scholar number already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const [userResult] = await conn.execute(
      'INSERT INTO users (login_id, password, role, full_name) VALUES (?, ?, "student", ?)',
      [login_id, hashedPassword, full_name]
    );

    await conn.execute(
      'INSERT INTO students (user_id, scholar_no, branch, section) VALUES (?, ?, ?, ?)',
      [userResult.insertId, scholar_no, branch, section]
    );

    await conn.commit();
    logger.info('Student registered', { login_id, scholar_no });

    res.status(201).json({ success: true, message: 'Registration successful. Please login.' });
  } catch (err) {
    await conn.rollback();
    logger.error('Registration error', { error: err.message });
    res.status(500).json({ success: false, message: 'Registration failed' });
  } finally {
    conn.release();
  }
};

// ─── Login (all roles) ────────────────────────────────────────────────────────
const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { login_id, password } = req.body;

  try {
    const [users] = await pool.execute(
      'SELECT id, login_id, password, role, full_name, is_active FROM users WHERE login_id = ?',
      [login_id]
    );

    if (!users.length) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user = users[0];
    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Account is inactive' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // If student, get face_registered status
    let extraData = {};
    if (user.role === 'student') {
      const [studentData] = await pool.execute(
        'SELECT scholar_no, branch, section, face_registered FROM students WHERE user_id = ?',
        [user.id]
      );
      if (studentData.length) extraData = studentData[0];
    }

    const tokenPayload = { userId: user.id, role: user.role };
    const accessToken  = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Store refresh token in DB
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await pool.execute(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, refreshToken, expiresAt]
    );

    logger.info('User logged in', { login_id, role: user.role });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          login_id: user.login_id,
          role: user.role,
          full_name: user.full_name,
          ...extraData,
        },
      },
    });
  } catch (err) {
    logger.error('Login error', { error: err.message });
    res.status(500).json({ success: false, message: 'Login failed' });
  }
};

// ─── Logout ───────────────────────────────────────────────────────────────────
const logout = async (req, res) => {
  try {
    await invalidateToken(req.token);

    const { refreshToken } = req.body;
    if (refreshToken) {
      await pool.execute('DELETE FROM refresh_tokens WHERE token = ? AND user_id = ?', [
        refreshToken,
        req.user.id,
      ]);
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    logger.error('Logout error', { error: err.message });
    res.status(500).json({ success: false, message: 'Logout failed' });
  }
};

// ─── Refresh Token ────────────────────────────────────────────────────────────
const refreshAccessToken = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(401).json({ success: false, message: 'Refresh token required' });
  }

  try {
    const decoded = verifyRefreshToken(refreshToken);

    const [tokens] = await pool.execute(
      'SELECT id, user_id, expires_at FROM refresh_tokens WHERE token = ? AND user_id = ?',
      [refreshToken, decoded.userId]
    );

    if (!tokens.length || new Date(tokens[0].expires_at) < new Date()) {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
    }

    const [users] = await pool.execute('SELECT id, role FROM users WHERE id = ? AND is_active = 1', [decoded.userId]);
    if (!users.length) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    const accessToken = generateAccessToken({ userId: users[0].id, role: users[0].role });
    res.json({ success: true, data: { accessToken } });
  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }
};

// ─── Get current user profile ─────────────────────────────────────────────────
const getProfile = async (req, res) => {
  try {
    let profile = { ...req.user };

    if (req.user.role === 'student') {
      const [studentData] = await pool.execute(
        'SELECT scholar_no, branch, section, face_registered FROM students WHERE user_id = ?',
        [req.user.id]
      );
      if (studentData.length) Object.assign(profile, studentData[0]);
    }

    res.json({ success: true, data: profile });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
};

// ─── Change Password (all roles) ─────────────────────────────────────────────
const changePassword = async (req, res) => {
  const { old_password, new_password } = req.body;

  if (!old_password || !new_password) {
    return res.status(400).json({ success: false, message: 'Both old and new password required' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
  }

  try {
    const [users] = await pool.execute('SELECT id, password FROM users WHERE id = ?', [req.user.id]);
    if (!users.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(old_password, users[0].password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    const hashedNew = await bcrypt.hash(new_password, 12);
    await pool.execute('UPDATE users SET password = ? WHERE id = ?', [hashedNew, req.user.id]);

    logger.info('Password changed', { userId: req.user.id });
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    logger.error('Change password error', { error: err.message });
    res.status(500).json({ success: false, message: 'Failed to change password' });
  }
};

// ─── Delete Account (admin/staff) ─────────────────────────────────────────────
const deleteStudent = async (req, res) => {
  const { studentId } = req.params;

  try {
    const [rows] = await pool.execute('SELECT user_id FROM students WHERE id = ?', [studentId]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Student not found.' });

    const userId = rows[0].user_id;

    // Delete user (cascade will delete student and attendance)
    await pool.execute('DELETE FROM users WHERE id = ?', [userId]);

    logger.info('Student account deleted by admin/staff', { deletedStudentId: studentId, deletedBy: req.user.id });
    res.json({ success: true, message: 'Student account deleted successfully.' });
  } catch (err) {
    logger.error('Delete student account error', { error: err.message });
    res.status(500).json({ success: false, message: 'Failed to delete student account.' });
  }
};

// ─── Create Staff Account (TPO Admin) ─────────────────────────────────────────
const createStaff = async (req, res) => {
  const { login_id, password, full_name, role } = req.body;

  if (!login_id || !password || !full_name || !role) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }

  const validRoles = ['tpo_volunteer', 'tpo_coordinator'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ success: false, message: 'Invalid role. Must be tpo_volunteer or tpo_coordinator' });
  }

  if (password.length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
  }

  try {
    const [existing] = await pool.execute('SELECT id FROM users WHERE login_id = ?', [login_id]);
    if (existing.length) {
      return res.status(409).json({ success: false, message: 'Login ID already in use' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    await pool.execute(
      'INSERT INTO users (login_id, password, role, full_name) VALUES (?, ?, ?, ?)',
      [login_id, hashedPassword, role, full_name]
    );

    logger.info('Staff account created', { login_id, role, createdBy: req.user.id });
    res.status(201).json({ success: true, message: 'Staff account created' });
  } catch (err) {
    logger.error('Create staff error', { error: err.message });
    res.status(500).json({ success: false, message: 'Failed to create staff account' });
  }
};

// ─── Delete Staff Account (TPO Admin) ─────────────────────────────────────────
const deleteStaff = async (req, res) => {
  const { userId } = req.params;

  try {
    // Verify user is a staff member (not a student or admin)
    const [users] = await pool.execute('SELECT id, role, login_id FROM users WHERE id = ?', [userId]);
    if (!users.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const targetUser = users[0];
    if (!['tpo_volunteer', 'tpo_coordinator'].includes(targetUser.role)) {
      return res.status(400).json({ success: false, message: 'Can only delete volunteer or coordinator accounts' });
    }

    await pool.execute('DELETE FROM users WHERE id = ?', [userId]);

    logger.info('Staff account deleted', { deletedUser: targetUser.login_id, deletedBy: req.user.id });
    res.json({ success: true, message: 'Staff account deleted' });
  } catch (err) {
    logger.error('Delete staff error', { error: err.message });
    res.status(500).json({ success: false, message: 'Failed to delete staff account' });
  }
};

// ─── Get Staff List (TPO Admin) ───────────────────────────────────────────────
const getStaffList = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, login_id, role, full_name, is_active, created_at FROM users WHERE role IN (?, ?) ORDER BY created_at DESC',
      ['tpo_volunteer', 'tpo_coordinator']
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch staff list' });
  }
};

// ─── Force Password Reset (TPO Admin Only) ──────────────────────────────────
const forcePasswordReset = async (req, res) => {
  const { userId } = req.params;
  const { new_password } = req.body;

  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
  }

  try {
    const [users] = await pool.execute('SELECT id FROM users WHERE id = ?', [userId]);
    if (!users.length) return res.status(404).json({ success: false, message: 'User not found' });

    const hashedNew = await bcrypt.hash(new_password, 12);
    await pool.execute('UPDATE users SET password = ? WHERE id = ?', [hashedNew, userId]);

    logger.info('Password forcefully reset by admin', { targetUser: userId, admin: req.user.id });
    res.json({ success: true, message: 'User password reset successfully' });
  } catch (err) {
    logger.error('Force password reset error', { error: err.message });
    res.status(500).json({ success: false, message: 'Failed to reset user password' });
  }
};

// ─── Edit Student Details (TPO Admin / Coordinator) ───────────────────────────
const updateStudentDetails = async (req, res) => {
  const { id } = req.params;
  const { full_name, scholar_no, branch, section } = req.body;

  if (!full_name || !scholar_no || !branch || !section) {
    return res.status(400).json({ success: false, message: 'All student fields are required' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [students] = await conn.execute('SELECT user_id FROM students WHERE id = ?', [id]);
    if (!students.length) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    const userId = students[0].user_id;

    // Check for duplicate scholar number across OTHER students
    const [existingScholar] = await conn.execute(
      'SELECT id FROM students WHERE scholar_no = ? AND id != ?',
      [scholar_no, id]
    );
    if (existingScholar.length) {
      return res.status(409).json({ success: false, message: 'Scholar number already exists for another student' });
    }

    await conn.execute('UPDATE users SET full_name = ? WHERE id = ?', [full_name, userId]);
    await conn.execute(
      'UPDATE students SET scholar_no = ?, branch = ?, section = ? WHERE id = ?',
      [scholar_no, branch, section, id]
    );

    await conn.commit();
    logger.info('Student details updated', { studentId: id, updatedBy: req.user.id });
    res.json({ success: true, message: 'Student details updated successfully' });
  } catch (err) {
    await conn.rollback();
    logger.error('Update student details error', { error: err.message });
    res.status(500).json({ success: false, message: 'Failed to update student details' });
  } finally {
    conn.release();
  }
};

module.exports = {
  registerStudent,
  login,
  logout,
  refreshAccessToken,
  getProfile,
  changePassword,
  deleteStudent,
  createStaff,
  deleteStaff,
  getStaffList,
  forcePasswordReset,
  updateStudentDetails,
};
