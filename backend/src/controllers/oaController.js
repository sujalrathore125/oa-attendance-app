const { pool } = require('../config/db');
const { setCache, getCache, delCachePattern } = require('../config/redis');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');

// ─── Create OA Session (TPO Admin) ────────────────────────────────────────────
const createOASession = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { title, description, oa_date, start_time, end_time, branches } = req.body;

  try {
    const [result] = await pool.execute(
      `INSERT INTO oa_sessions (title, description, oa_date, start_time, end_time, branches, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title, description, oa_date, start_time, end_time, JSON.stringify(branches), req.user.id]
    );

    await delCachePattern('oa_sessions:*');

    logger.info('OA session created', { sessionId: result.insertId, createdBy: req.user.id });
    res.status(201).json({ success: true, message: 'OA session created', data: { id: result.insertId } });
  } catch (err) {
    logger.error('Create OA error', { error: err.message });
    res.status(500).json({ success: false, message: 'Failed to create OA session' });
  }
};

// ─── Get all OA Sessions with filters ─────────────────────────────────────────
const getOASessions = async (req, res) => {
  const { start_date, end_date, status, date } = req.query;
  const cacheKey = `oa_sessions:${JSON.stringify(req.query)}`;

  try {
    const cached = await getCache(cacheKey);
    if (cached) return res.json({ success: true, data: cached, fromCache: true });

    let query = `
      SELECT os.*, u.full_name as created_by_name,
        (SELECT COUNT(*) FROM attendance a WHERE a.oa_session_id = os.id) as attendance_count
      FROM oa_sessions os
      JOIN users u ON os.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (date) {
      query += ' AND os.oa_date = ?';
      params.push(date);
    }
    if (start_date) { query += ' AND os.oa_date >= ?'; params.push(start_date); }
    if (end_date) { query += ' AND os.oa_date <= ?'; params.push(end_date); }
    if (status) { query += ' AND os.status = ?'; params.push(status); }

    // Pagination
    const pageStr = req.query.page || '1';
    const limitStr = req.query.limit || '10';
    const page = Math.max(1, parseInt(pageStr));
    const limit = parseInt(limitStr);
    const offset = (page - 1) * limit;

    query += ' ORDER BY os.oa_date DESC, os.start_time DESC LIMIT ? OFFSET ?';
    
    // Count query
    let countQuery = `
      SELECT COUNT(*) as total FROM oa_sessions os JOIN users u ON os.created_by = u.id WHERE 1=1
    `;
    const countParams = [];
    if (date) { countQuery += ' AND os.oa_date = ?'; countParams.push(date); }
    if (start_date) { countQuery += ' AND os.oa_date >= ?'; countParams.push(start_date); }
    if (end_date) { countQuery += ' AND os.oa_date <= ?'; countParams.push(end_date); }
    if (status) { countQuery += ' AND os.status = ?'; countParams.push(status); }

    const [[{ total }]] = await pool.execute(countQuery, countParams);
    const [sessions] = await pool.execute(query, [...params, String(limit), String(offset)]);

    // Parse JSON fields
    const parsed = sessions.map(s => ({
      ...s,
      branches: typeof s.branches === 'string' ? JSON.parse(s.branches) : s.branches
    }));

    const response = {
      success: true, 
      data: parsed,
      meta: {
        totalCount: total,
        totalPages: Math.ceil(total / limit),
        currentPage: page
      }
    };
    await setCache(cacheKey, response, 30); // cache 30s
    res.json(response);
  } catch (err) {
    logger.error('Get OA sessions error', { error: err.message });
    res.status(500).json({ success: false, message: 'Failed to fetch OA sessions' });
  }
};

// ─── Get single OA session ────────────────────────────────────────────────────
const getOASession = async (req, res) => {
  const { id } = req.params;
  try {
    const [sessions] = await pool.execute(
      `SELECT os.*, u.full_name as created_by_name FROM oa_sessions os
       JOIN users u ON os.created_by = u.id WHERE os.id = ?`,
      [id]
    );
    if (!sessions.length) return res.status(404).json({ success: false, message: 'OA session not found' });

    const session = {
      ...sessions[0],
      branches: typeof sessions[0].branches === 'string' ? JSON.parse(sessions[0].branches) : sessions[0].branches,
    };

    res.json({ success: true, data: session });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch session' });
  }
};

// ─── Update OA status (Admin) ─────────────────────────────────────────────────
const updateOAStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const validStatuses = ['upcoming', 'active', 'extended', 'closed'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }

  try {
    await pool.execute('UPDATE oa_sessions SET status = ? WHERE id = ?', [status, id]);
    await delCachePattern('oa_sessions:*');
    res.json({ success: true, message: 'OA status updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Update failed' });
  }
};

// ─── Extend OA attendance window (TPO Volunteer) ──────────────────────────────
const extendOASession = async (req, res) => {
  const { id } = req.params;
  const { duration } = req.body; // 30 or 60 minutes
  const maxHours = parseFloat(process.env.OA_MAX_EXTENSION_HOURS) || 10.5;

  // Validate duration
  const minutes = parseInt(duration) || 30;
  if (![30, 60].includes(minutes)) {
    return res.status(400).json({ success: false, message: 'Duration must be 30 or 60 minutes' });
  }

  try {
    const [sessions] = await pool.execute(
      'SELECT oa_date, start_time, end_time, status, extended_until FROM oa_sessions WHERE id = ?',
      [id]
    );
    if (!sessions.length) return res.status(404).json({ success: false, message: 'OA not found' });

    const session = sessions[0];
    const oaStart = new Date(`${session.oa_date}T${session.start_time}`);
    const maxEnd = new Date(oaStart.getTime() + maxHours * 60 * 60 * 1000);

    // Properly calculate extended_until string combining dates
    // If we parse the date string manually, we avoid timezone issues
    let currentEndMs;
    if (session.extended_until) {
      currentEndMs = new Date(session.extended_until).getTime();
    } else {
      // session.oa_date might be an object if mysql returns dates, pad and parse
      let dateStr = session.oa_date;
      if (typeof dateStr === 'object') {
        const offset = dateStr.getTimezoneOffset() * 60000;
        dateStr = (new Date(dateStr.getTime() - offset)).toISOString().split('T')[0];
      }
      currentEndMs = new Date(`${dateStr}T${session.end_time}`).getTime();
    }

    const newEnd = new Date(currentEndMs + minutes * 60 * 1000);

    if (newEnd > maxEnd) {
      return res.status(400).json({
        success: false,
        message: `Cannot extend beyond ${maxHours} hours of OA start time`,
      });
    }

    await pool.execute(
      'UPDATE oa_sessions SET status = "extended", extended_until = ? WHERE id = ?',
      [newEnd, id]
    );

    await delCachePattern('oa_sessions:*');

    const timeStr = newEnd.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    res.json({
      success: true,
      message: `OA extended by ${minutes} minutes (until ${timeStr})`,
      data: { extended_until: newEnd },
    });
  } catch (err) {
    logger.error('Extend OA error', { error: err.message });
    res.status(500).json({ success: false, message: 'Extension failed' });
  }
};



const getActiveOASessions = async (req, res) => {
  try {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISOTime = new Date(now.getTime() - tzOffset).toISOString().slice(0, 19); // YYYY-MM-DDTHH:MM:SS
    
    const today = localISOTime.split('T')[0]; // YYYY-MM-DD
    const currentTime = localISOTime.split('T')[1]; // HH:MM:SS
    const nowDatetime = localISOTime.replace('T', ' '); // YYYY-MM-DD HH:MM:SS

    const [sessions] = await pool.execute(
      `SELECT * FROM oa_sessions
       WHERE oa_date = ? AND status IN ('active', 'extended')
       AND (
         (status = 'active' AND start_time <= ? AND end_time >= ?)
         OR (status = 'extended' AND extended_until >= ?)
       )`,
      [today, currentTime, currentTime, nowDatetime]
    );

    
    console.log('Raw OA sessions from DB:', sessions);

    const parsed = sessions.map(s => ({
      ...s,
      branches: typeof s.branches === 'string' ? JSON.parse(s.branches) : s.branches
    }));

    console.log('Active OA sessions:', parsed);

    res.json({ success: true, data: parsed });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch active sessions' });
  }
};

module.exports = {
  createOASession,
  getOASessions,
  getOASession,
  updateOAStatus,
  extendOASession,
  getActiveOASessions,
};
