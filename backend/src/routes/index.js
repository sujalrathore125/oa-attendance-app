const express = require('express');
const router  = express.Router();
const { body } = require('express-validator');

const authCtrl   = require('../controllers/authController');
const faceCtrl   = require('../controllers/faceController');
const oaCtrl     = require('../controllers/oaController');
const attendCtrl = require('../controllers/attendanceController');

const {
  authenticate, isStudent, isTpoAdmin,
  isTpoVolunteer, isCoordinator, isTpoAny, isTpoAdminOrCoordinator
} = require('../middleware/auth');
const { loginLimiter, faceLimiter } = require('../middleware/errorHandler');
const { uploadMemory }  = require('../middleware/upload');

// ════════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════════
router.post('/auth/register',
  [
    body('login_id').notEmpty().trim().isLength({ min: 3, max: 50 }),
    body('password').isLength({ min: 6, max: 100 }),
    body('full_name').notEmpty().trim().isLength({ min: 2, max: 100 }),
    body('scholar_no').notEmpty().trim().isLength({ min: 2, max: 20 }),
    body('branch').notEmpty().trim(),
    body('section').notEmpty().trim(),
  ],
  authCtrl.registerStudent
);



router.post('/auth/login', [body('login_id').notEmpty(), body('password').notEmpty()], authCtrl.login);
router.post('/auth/logout',   authenticate, authCtrl.logout);
router.post('/auth/refresh',  authCtrl.refreshAccessToken);
router.get('/auth/profile',   authenticate, authCtrl.getProfile);

// Change password (all authenticated users)
router.patch('/auth/change-password', authenticate, authCtrl.changePassword);

// Force change user password (TPO Admin)
router.patch('/auth/user/:userId/password', authenticate, isTpoAdmin, authCtrl.forcePasswordReset);

// Delete account (Staff/Admin)
router.delete('/auth/student/:studentId', authenticate, isTpoAny, authCtrl.deleteStudent);

// Staff management (TPO Admin only)
router.get('/auth/staff',           authenticate, isTpoAdmin, authCtrl.getStaffList);
router.post('/auth/create-staff',   authenticate, isTpoAdmin, authCtrl.createStaff);
router.delete('/auth/staff/:userId', authenticate, isTpoAdmin, authCtrl.deleteStaff);

// ════════════════════════════════════════════════════
// FACE  (Python microservice replaces Face++ API)
// ════════════════════════════════════════════════════
router.post('/face/register',
  authenticate, isStudent, faceLimiter,
  uploadMemory.single('face_image'),
  faceCtrl.registerFace
);

router.post('/face/verify',
  authenticate, isTpoVolunteer, faceLimiter,
  uploadMemory.single('face_image'),
  faceCtrl.verifyFace
);

router.patch('/face/reset/:studentId',
  authenticate, isTpoAdminOrCoordinator,
  faceCtrl.resetFaceRegistration
);

router.get('/face/health',
  authenticate, isTpoAdmin,
  faceCtrl.pythonServiceHealth
);

// ════════════════════════════════════════════════════
// OA SESSIONS
// ════════════════════════════════════════════════════
router.post('/oa',
  authenticate, isTpoAdmin,
  [
    body('title').notEmpty().trim(),
    body('oa_date').isDate(),
    body('start_time').matches(/^\d{2}:\d{2}$/),
    body('end_time').matches(/^\d{2}:\d{2}$/),
    body('branches').isArray({ min: 1 })
  ],
  oaCtrl.createOASession
);
router.get('/oa',                  authenticate, isTpoAny,       oaCtrl.getOASessions);
router.get('/oa/active',           authenticate,                 oaCtrl.getActiveOASessions);
router.get('/oa/:id',              authenticate,                 oaCtrl.getOASession);
router.patch('/oa/:id/status',     authenticate, isTpoAdmin,     oaCtrl.updateOAStatus);
router.patch('/oa/:id/extend',     authenticate, isTpoVolunteer, oaCtrl.extendOASession);

// ════════════════════════════════════════════════════
// ATTENDANCE
// ════════════════════════════════════════════════════
router.post('/attendance',
  authenticate, isTpoVolunteer,
  uploadMemory.single('capture_image'),
  attendCtrl.markAttendance
);
router.get('/attendance/oa/:session_id',     authenticate, isTpoAny,    attendCtrl.getOAAttendance);
router.get('/attendance/history',            authenticate, isStudent,   attendCtrl.getStudentHistory);
router.get('/attendance/export/:session_id', authenticate, isCoordinator, attendCtrl.exportAttendanceExcel);
router.get('/attendance/stats/dashboard',    authenticate, isTpoAdmin,  attendCtrl.getDashboardStats);

// ════════════════════════════════════════════════════
// STUDENT MANAGEMENT
// ════════════════════════════════════════════════════
router.put('/students/:id', authenticate, isTpoAdminOrCoordinator, authCtrl.updateStudentDetails);

router.get('/students', authenticate, isTpoAny, async (req, res) => {
  const { branch, section, search, page = 1, limit = 20 } = req.query;
  try {
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    let q = `
      SELECT s.id, s.scholar_no, s.branch, s.section, s.face_registered,
             u.full_name, u.login_id, u.is_active, u.id as user_id
      FROM students s JOIN users u ON s.user_id = u.id WHERE 1=1
    `;
    let countQ = `SELECT COUNT(*) as total FROM students s JOIN users u ON s.user_id = u.id WHERE 1=1`;
    const params = [];

    if (branch)  { 
      q += ' AND s.branch = ?'; 
      countQ += ' AND s.branch = ?';
      params.push(branch); 
    }
    if (section) { 
      q += ' AND s.section = ?'; 
      countQ += ' AND s.section = ?';
      params.push(section); 
    }
    if (search)  { 
      const searchStr = '%' + search + '%';
      q += ' AND (u.full_name LIKE ? OR s.scholar_no LIKE ?)'; 
      countQ += ' AND (u.full_name LIKE ? OR s.scholar_no LIKE ?)';
      params.push(searchStr, searchStr); 
    }

    q += ' ORDER BY s.branch, s.section, u.full_name LIMIT ? OFFSET ?';

    const [rows] = await require('../config/db').pool.execute(q, [...params, parseInt(limit), offset].map(String));
    const [[{ total }]] = await require('../config/db').pool.execute(countQ, params);

    res.json({ 
      success: true, 
      data: rows,
      meta: {
        totalCount: total,
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch students' });
  }
});

module.exports = router;
