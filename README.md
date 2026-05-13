# 🎓 OA Attendance System

A web-based Online Assessment (OA) Attendance Management System with **Live Face Verification**, built with the MERN stack (MySQL instead of MongoDB), featuring PWA support for mobile use.

---

## 📐 System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  FRONTEND (React + Vite + Tailwind + DaisyUI)                │
│  PWA – installable on mobile as a standalone app             │
│  Port: 3000 / 5173                                           │
└────────────────────┬─────────────────────────────────────────┘
                     │ HTTPS / REST API
┌────────────────────▼─────────────────────────────────────────┐
│  BACKEND (Express.js)  Port: 5000                            │
│  ├── JWT Auth (Access + Refresh tokens)                      │
│  ├── Rate Limiting (express-rate-limit)                      │
│  ├── Multer (image upload)                                   │
│  └── Redis (JWT blacklist + caching)                         │
└────────┬──────────────────────┬────────────────────────────--┘
         │                      │
┌────────▼──────┐    ┌──────────▼──────────┐    ┌─────────────┐
│  MySQL DB     │    │  Redis Cache         │    │ Face++ API  │
│  (All data)   │    │  (Tokens/Cache)      │    │ (Free Tier) │
└───────────────┘    └──────────────────────┘    └─────────────┘
```

---

## 👥 User Roles

| Role | Login | Features |
|------|-------|----------|
| **Student** | login_id + password | Register face, view OA history |
| **TPO Admin** | login_id + password | Create OA sessions, manage students, full access |
| **TPO Volunteer** | login_id + password | Mark attendance with face verification, extend OA |
| **TPO Coordinator** | login_id + password | View attendance, export Excel by branch/date |

---

## 🛠️ Tech Stack

### Backend
| Component | Technology |
|-----------|-----------|
| Runtime | Node.js |
| Framework | Express.js |
| Database | MySQL 8.x (via `mysql2`) |
| Cache | Redis (via `ioredis`) |
| Auth | JWT (access 8h + refresh 7d) |
| Face API | Face++ (free tier) |
| File Upload | Multer (memory + disk) |
| Excel Export | ExcelJS |
| Security | Helmet, CORS, Rate Limiting |
| Logging | Winston |
| Validation | express-validator |

### Frontend
| Component | Technology |
|-----------|-----------|
| Framework | React 18 + Vite |
| Styling | TailwindCSS + DaisyUI |
| HTTP | Axios (with interceptors) |
| Router | React Router v6 |
| Camera | react-webcam |
| PWA | vite-plugin-pwa |
| Notifications | react-hot-toast |
| Icons | react-icons |

---

## 📊 Database Schema

```sql
users          — All roles: id, login_id, password, role, full_name, email, is_active
students       — scholar_no, branch, section, face_token (NOT image), face_registered
oa_sessions    — title, oa_date, start_time, end_time, branches[], sections[], status
attendance     — oa_session_id, student_id, marked_by, face_match_score, liveness_score
refresh_tokens — user_id, token, expires_at
audit_logs     — user_id, action, details, ip_address
```

---

## 🚀 Setup Instructions

### Prerequisites
- Node.js 18+
- MySQL 8.x
- Redis 6+
- Face++ account (free at faceplusplus.com)

### 1. Clone & Install

```bash
# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 2. Configure Environment

```bash
# Backend
cp .env.example .env
# Edit .env with your MySQL, Redis, Face++ credentials
```

### 3. Database Setup

```bash
cd backend
# Create database in MySQL
mysql -u root -p -e "CREATE DATABASE oa_attendance_db;"

# Run migration
npm run migrate
```

### 4. Redis Setup

```bash
# Ubuntu/Debian
sudo apt install redis-server
sudo systemctl start redis
```

### 5. Face++ Setup

1. Register at https://www.faceplusplus.com/ (free)
2. Create an API key pair
3. Create a FaceSet for the institution
4. Copy API key, secret, and faceset_token to `.env`

### 6. Create TPO Staff Accounts

Staff accounts (admin, volunteer, coordinator) need to be seeded directly in MySQL:

```sql
INSERT INTO users (login_id, password, role, full_name)
VALUES ('tpo_admin', '$2a$12$<hashed_password>', 'tpo_admin', 'TPO Admin');
```

Use bcryptjs to hash passwords, or create a seed script.

### 7. Run

```bash
# Backend (port 5000)
cd backend && npm run dev

# Frontend (port 5173)
cd frontend && npm run dev
```

---

## 🔌 API Reference

### Auth
```
POST   /api/auth/register     — Student registration
POST   /api/auth/login        — All roles login
POST   /api/auth/logout       — Invalidate tokens
POST   /api/auth/refresh      — Refresh access token
GET    /api/auth/profile      — Get current user
```

### Face
```
POST   /api/face/register     — Register student face (student)
POST   /api/face/verify       — Verify face during OA (volunteer)
PATCH  /api/face/reset/:id    — Reset face registration (admin)
```

### OA Sessions
```
POST   /api/oa                — Create OA (admin)
GET    /api/oa                — List all OA (filter: date, start_date, end_date, status)
GET    /api/oa/active         — Active sessions right now
GET    /api/oa/:id            — Single session
PATCH  /api/oa/:id/status     — Update status (admin)
PATCH  /api/oa/:id/extend     — Extend by 10.5h (volunteer)
```

### Attendance
```
POST   /api/attendance                    — Mark attendance (volunteer)
GET    /api/attendance/oa/:session_id     — Get OA attendance (tpo)
GET    /api/attendance/history            — Student's own history
GET    /api/attendance/export/:session_id — Download Excel (coordinator)
GET    /api/attendance/stats/dashboard    — Stats (admin)
```

---

## 🔒 Security Features

- **JWT blacklisting** via Redis on logout (expired tokens cannot be reused)
- **bcrypt** password hashing (cost factor 12)
- **Role-based access control** on every protected route
- **Rate limiting**: 100 req/15min general, 10 req/15min on login, 20 req/min on face
- **Helmet** HTTP security headers
- **CORS** whitelist only
- **Input validation** via express-validator
- **No face images stored** — only the Face++ `face_token` (an opaque string representing the face pattern)

---

## 📱 PWA (Progressive Web App)

The frontend includes full PWA support:
- Install prompt appears automatically on mobile/desktop
- Works offline for cached pages
- Mobile-responsive design with Tailwind breakpoints
- Standalone display mode when installed
- Theme color matches brand

---

## 🌝 Face Verification Flow

```
Student registers face
    → Camera captures photo with blink instruction (liveness)
    → Sent to Face++ detect API → face_token returned
    → face_token stored in DB (NOT the photo)
    
During OA:
    Volunteer selects active OA session
    → Enters scholar_no
    → Camera captures student face with liveness check
    → Backend calls Face++ compare(stored_token, new_image)
    → Liveness score checked (≥80%)
    → Match score checked (≥75%)
    → If both pass → attendance marked in DB
    → Capture image stored on disk for audit
```

---

## 📁 Project Structure

```
oa-attendance/
├── backend/
│   ├── src/
│   │   ├── config/         — db.js, redis.js, migrate.js
│   │   ├── controllers/    — auth, face, oa, attendance
│   │   ├── middleware/     — auth.js, upload.js, errorHandler.js
│   │   ├── routes/         — index.js (all routes)
│   │   ├── services/       — faceService.js (Face++ API)
│   │   ├── utils/          — jwt.js, logger.js
│   │   └── server.js       — Express app entry
│   ├── uploads/            — attendance capture images
│   ├── logs/               — Winston log files
│   └── .env
└── frontend/
    ├── src/
    │   ├── components/
    │   │   └── common/     — Navbar, FaceCapture, ProtectedRoute, PWAInstallPrompt
    │   ├── context/        — AuthContext.jsx
    │   ├── pages/
    │   │   ├── student/    — StudentDashboard
    │   │   ├── admin/      — AdminDashboard
    │   │   ├── volunteer/  — VolunteerDashboard
    │   │   └── coordinator/— CoordinatorDashboard
    │   ├── utils/          — api.js (Axios instance)
    │   ├── App.jsx
    │   └── main.jsx
    ├── .env
    └── vite.config.js
```
