const { pool } = require('./db');
require('dotenv').config();

const migrate = async () => {
  const conn = await pool.getConnection();
  try {
    console.log('🚀 Running migrations...');

    // ── Users table (all roles) ────────────────────────────────────────────────
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        login_id     VARCHAR(50)  NOT NULL UNIQUE,
        password     VARCHAR(255) NOT NULL,
        role         ENUM('student','tpo_admin','tpo_volunteer','tpo_coordinator') NOT NULL,
        full_name    VARCHAR(100) NOT NULL,
        email        VARCHAR(150) UNIQUE,
        is_active    TINYINT(1)   DEFAULT 1,
        created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        updated_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_login_id (login_id),
        INDEX idx_role (role)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // ── Students (extends users) ───────────────────────────────────────────────
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS students (
        id             INT AUTO_INCREMENT PRIMARY KEY,
        user_id        INT          NOT NULL UNIQUE,
        scholar_no     VARCHAR(20)  NOT NULL UNIQUE,
        branch         VARCHAR(50)  NOT NULL,
        section        VARCHAR(10)  NOT NULL,
        face_token     TEXT DEFAULT NULL COMMENT "dlib ResNet-34 128-dim embedding as JSON array string",
        face_registered TINYINT(1) DEFAULT 0,
        created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        updated_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_scholar_no (scholar_no),
        INDEX idx_branch_section (branch, section)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // ── OA Sessions ────────────────────────────────────────────────────────────
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS oa_sessions (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        title           VARCHAR(200) NOT NULL,
        description     TEXT,
        oa_date         DATE         NOT NULL,
        start_time      TIME         NOT NULL,
        end_time        TIME         NOT NULL,
        branches        JSON         NOT NULL COMMENT 'Array of branches e.g. ["CS","IT","ECE"]',
        status          ENUM('upcoming','active','extended','closed') DEFAULT 'upcoming',
        extended_until  DATETIME     DEFAULT NULL,
        created_by      INT          NOT NULL COMMENT 'tpo_admin user_id',
        created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        updated_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id),
        INDEX idx_oa_date (oa_date),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // ── Attendance Records ─────────────────────────────────────────────────────
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS attendance (
        id                INT AUTO_INCREMENT PRIMARY KEY,
        oa_session_id     INT          NOT NULL,
        student_id        INT          NOT NULL,
        marked_by         INT          NOT NULL COMMENT 'tpo_volunteer user_id',
        status            ENUM('present','absent') DEFAULT 'present',
        face_match_score  FLOAT        DEFAULT NULL COMMENT 'Face++ comparison confidence',
        liveness_score    FLOAT        DEFAULT NULL,
        capture_image_url VARCHAR(255) DEFAULT NULL,
        marked_at         TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        is_extended       TINYINT(1)   DEFAULT 0 COMMENT 'Marked during extended period',
        device_info       VARCHAR(255) DEFAULT NULL,
        UNIQUE KEY uq_oa_student (oa_session_id, student_id),
        FOREIGN KEY (oa_session_id) REFERENCES oa_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id)    REFERENCES students(id),
        FOREIGN KEY (marked_by)     REFERENCES users(id),
        INDEX idx_oa_session (oa_session_id),
        INDEX idx_student (student_id),
        INDEX idx_marked_at (marked_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // ── Refresh Tokens ─────────────────────────────────────────────────────────
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        user_id    INT          NOT NULL,
        token      VARCHAR(512) NOT NULL UNIQUE,
        expires_at DATETIME     NOT NULL,
        created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_token (token),
        INDEX idx_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // ── Audit Logs ─────────────────────────────────────────────────────────────
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        user_id    INT          NOT NULL,
        action     VARCHAR(100) NOT NULL,
        details    JSON         DEFAULT NULL,
        ip_address VARCHAR(45)  DEFAULT NULL,
        created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        INDEX idx_user_action (user_id, action),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log('✅ All tables created successfully');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    throw err;
  } finally {
    conn.release();
    process.exit(0);
  }
};

migrate();
