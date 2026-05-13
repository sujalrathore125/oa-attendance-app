import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { FiLogOut, FiUser, FiSun, FiMoon, FiLock } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useState } from 'react';
import ChangePasswordModal from './ChangePasswordModal';

const rolePaths = {
  student:          '/student',
  tpo_admin:        '/admin',
  tpo_volunteer:    '/volunteer',
  tpo_coordinator:  '/coordinator',
};

const roleLabels = {
  student:          'Student',
  tpo_admin:        'TPO Admin',
  tpo_volunteer:    'TPO Volunteer',
  tpo_coordinator:  'TPO Coordinator',
};

const Navbar = () => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [showChangePwd, setShowChangePwd] = useState(false);

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
    navigate('/login');
  };

  return (
    <>
      <div className="navbar bg-base-100/80 backdrop-blur-xl border-b border-base-300/50 shadow-sm sticky top-0 z-50">
        <div className="navbar-start">
          <Link to={user ? rolePaths[user.role] : '/'} className="btn btn-ghost gap-2 text-lg font-bold">
            <span className="text-2xl">🎓</span>
            <span className="text-gradient hidden sm:inline">OA Attend</span>
          </Link>
        </div>

        <div className="navbar-end gap-1">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="btn btn-ghost btn-circle btn-sm"
            title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {isDark ? <FiSun size={18} className="text-warning" /> : <FiMoon size={18} className="text-base-content/60" />}
          </button>

          {user && (
            <>
              <div className="hidden sm:flex flex-col items-end text-sm mr-1">
                <span className="font-semibold text-base-content">{user.full_name}</span>
                <span className="text-base-content/50 text-xs">{roleLabels[user.role]}</span>
              </div>
              <div className="dropdown dropdown-end">
                <div tabIndex={0} role="button" className="btn btn-ghost btn-circle avatar placeholder">
                  <div className="profile-gradient text-white rounded-full w-9 h-9 flex items-center justify-center text-sm font-bold">
                    {user.full_name?.charAt(0).toUpperCase()}
                  </div>
                </div>
                <ul tabIndex={0} className="menu menu-sm dropdown-content mt-3 z-[1] p-3 shadow-xl bg-base-100 border border-base-300/50 text-base-content rounded-2xl w-56 space-y-1">
                  <li className="px-3 py-2 border-b border-base-300/50 mb-1">
                    <div className="flex flex-col items-start pointer-events-none">
                      <span className="font-bold text-sm">{user.full_name}</span>
                      <span className="text-xs opacity-50">{roleLabels[user.role]}</span>
                    </div>
                  </li>
                  <li>
                    <a onClick={() => setShowChangePwd(true)} className="flex items-center gap-2 rounded-xl">
                      <FiLock size={14} /> Change Password
                    </a>
                  </li>
                  <li>
                    <a onClick={handleLogout} className="flex items-center gap-2 rounded-xl text-error">
                      <FiLogOut size={14} /> Logout
                    </a>
                  </li>
                </ul>
              </div>
            </>
          )}
        </div>
      </div>

      {showChangePwd && <ChangePasswordModal onClose={() => setShowChangePwd(false)} />}
    </>
  );
};

export default Navbar;
