const bcrypt = require('bcryptjs');
const { pool } = require('./db');
require('dotenv').config();

// ─── Edit these staff accounts before running ─────────────────────────────────
const staff = [
  {
    login_id:  'tpo_admin',
    password:  'Admin@123',        // ← CHANGE THIS
    role:      'tpo_admin',
    full_name: 'TPO Admin',
  },
  {
    login_id:  'volunteer1',
    password:  'Volunteer@123',    // ← CHANGE THIS
    role:      'tpo_volunteer',
    full_name: 'TPO Volunteer One',
  },
  {
    login_id:  'volunteer2',
    password:  'Volunteer@123',
    role:      'tpo_volunteer',
    full_name: 'TPO Volunteer Two',
  },
  {
    login_id:  'coordinator1',
    password:  'Coord@123',        // ← CHANGE THIS
    role:      'tpo_coordinator',
    full_name: 'Faculty Coordinator',
  },
];

const seed = async () => {
  console.log('🌱 Seeding staff accounts...');
  for (const s of staff) {
    const hashed = await bcrypt.hash(s.password, 12);
    try {
      await pool.execute(
        'INSERT INTO users (login_id, password, role, full_name) VALUES (?, ?, ?, ?)',
        [s.login_id, hashed, s.role, s.full_name]
      );
      console.log(`✅ Created: ${s.login_id} (${s.role}) — password: ${s.password}`);
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') {
        console.log(`⚠️  Skip ${s.login_id}: already exists`);
      } else {
        console.error(`❌ Error creating ${s.login_id}:`, e.message);
      }
    }
  }
  console.log('\n✅ Seeding complete. Staff login credentials above.');
  process.exit(0);
};

seed();
