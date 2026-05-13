const { verifyAccessToken, isTokenBlacklisted } = require('../utils/jwt');
const { pool } = require('../config/db');
const logger = require('../utils/logger');

// ─── Authenticate JWT ─────────────────────────────────────────────────────────
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    // Check if token is blacklisted (logged out)
    if (await isTokenBlacklisted(token)) {
      return res.status(401).json({ success: false, message: 'Token has been invalidated' });
    }

    const decoded = verifyAccessToken(token);

    // Verify user still exists and is active
    const [rows] = await pool.execute(
      'SELECT id, login_id, role, full_name, is_active FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (!rows.length || !rows[0].is_active) {
      return res.status(401).json({ success: false, message: 'User not found or inactive' });
    }

    req.user = rows[0];
    req.token = token;
    next();
  } catch (err) {
    logger.error('Auth middleware error', { error: err.message });
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// ─── Role-based access control ────────────────────────────────────────────────
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${roles.join(', ')}`,
      });
    }
    next();
  };
};

// Convenience role guards
const isStudent      = authorize('student');
const isTpoAdmin     = authorize('tpo_admin');
const isTpoVolunteer = authorize('tpo_volunteer', 'tpo_admin');
const isCoordinator  = authorize('tpo_coordinator', 'tpo_admin');
const isTpoAdminOrCoordinator = authorize('tpo_admin', 'tpo_coordinator');
const isTpoAny       = authorize('tpo_admin', 'tpo_volunteer', 'tpo_coordinator');

module.exports = { authenticate, authorize, isStudent, isTpoAdmin, isTpoVolunteer, isCoordinator, isTpoAdminOrCoordinator, isTpoAny };
