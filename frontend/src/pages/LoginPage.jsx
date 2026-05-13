import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';
import { FiLock, FiUser, FiEye, FiEyeOff } from 'react-icons/fi';
 
const rolePaths = {
  student:         '/student',
  tpo_admin:       '/admin',
  tpo_volunteer:   '/volunteer',
  tpo_coordinator: '/coordinator',
};

const LoginPage = () => {
  const { login } = useAuth();
  const { isDark } = useTheme(); // Kept for context, though this design defaults to dark theme visuals
  const navigate = useNavigate();
  const [form, setForm] = useState({ login_id: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Trigger entry animations on mount
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(form);
      toast.success(`Welcome, ${user.full_name}!`);
      navigate(rolePaths[user.role] || '/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>
        {`
          .animate-fade-in { opacity: 0; animation: fadeIn 0.8s ease-out forwards; }
          .animate-slide-up { opacity: 0; animation: slideUp 0.8s ease-out forwards; }
          .delay-100 { animation-delay: 100ms; }
          .delay-200 { animation-delay: 200ms; }
          .delay-300 { animation-delay: 300ms; }
          
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          /* Abstract background patterns */
          .bg-pattern {
            background-image: radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px);
            background-size: 20px 20px;
          }
        `}
      </style>

      <div className="min-h-screen flex flex-col md:flex-row bg-[#0d1321] text-white font-sans overflow-hidden relative">
        
        {/* Decorative Background Elements */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-[#1d2d44]/50 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-pattern opacity-30 pointer-events-none" />
        
        {/* Left Panel - Branding & Info */}
        <div className="w-full md:w-1/2 p-8 md:p-16 lg:p-24 flex flex-col justify-center relative z-10 border-b md:border-b-0 md:border-r border-white/10">
          <div className={`transition-all duration-1000 ${mounted ? 'animate-slide-up' : 'opacity-0'}`}>
            {/* Logo area */}
            <div className="flex items-center gap-3 mb-16">
              <div className="w-8 h-8 rounded bg-gradient-to-br from-[#ff6b6b] to-[#c44536] flex items-center justify-center font-bold text-lg shadow-lg shadow-[#ff6b6b]/30">
                M
              </div>
              <span className="text-2xl font-semibold tracking-wide">AttendMate</span>
            </div>

            <h1 className="text-5xl md:text-6xl font-bold mb-4 text-white">Login</h1>
            <p className="text-xl text-gray-400 mb-8 font-light">Sign in to continue</p>
            
            <div className="w-16 h-1 bg-white/20 mb-8 rounded-full" />
            
            <p className="text-gray-400 leading-relaxed mb-10 max-w-md text-sm md:text-base">
              Access your Online Assessment Attendance System securely and manage attendance with real-time verification.
            </p>

            <p className="text-base text-gray-400 mb-8 font-medium">
              New Student?
              <Link
                to="/register"
                className="ml-2 font-semibold text-[#f26644] hover:text-[#ff7a59] transition-colors duration-200"
              >
                Register
              </Link>
            </p>

            {/* <button className="bg-[#ff6b6b] hover:bg-[#ff5252] text-white px-8 py-3 rounded-lg font-medium transition-all duration-300 transform hover:-translate-y-1 hover:shadow-[0_10px_20px_-10px_rgba(255,107,107,0.6)] w-max">
              Learn More
            </button> */}
          </div>
        </div>

        {/* Right Panel - Login Form */}
        <div className="w-full md:w-1/2 p-8 md:p-16 flex items-center justify-center relative z-10">
          <div className={`w-full max-w-md bg-[#1d2d44]/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-10 shadow-2xl transition-all duration-1000 delay-200 ${mounted ? 'animate-slide-up' : 'opacity-0'}`}>
            
            <h2 className="text-3xl font-bold text-center mb-8 text-white">Sign in</h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Login ID Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                  Email / Login ID
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-[#ff6b6b] transition-colors">
                    <FiUser size={18} />
                  </div>
                  <input
                    type="text"
                    placeholder="2311XXXXXX@stu.manit.ac.in"
                    className="w-full bg-[#0d1321]/50 border border-white/10 text-white rounded-xl py-3 pl-11 pr-4 focus:outline-none focus:border-[#ff6b6b] focus:ring-1 focus:ring-[#ff6b6b] transition-all placeholder-gray-600"
                    value={form.login_id}
                    onChange={e => setForm(p => ({ ...p, login_id: e.target.value }))}
                    required
                    autoComplete="username"
                    id="login-id-input"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                  Password
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-[#ff6b6b] transition-colors">
                    <FiLock size={18} />
                  </div>
                  <input
                    type={showPass ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    className="w-full bg-[#0d1321]/50 border border-white/10 text-white rounded-xl py-3 pl-11 pr-12 focus:outline-none focus:border-[#ff6b6b] focus:ring-1 focus:ring-[#ff6b6b] transition-all placeholder-gray-600"
                    value={form.password}
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    required
                    autoComplete="current-password"
                    id="login-password-input"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPass(p => !p)} 
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-white transition-colors"
                  >
                    {showPass ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button 
                type="submit" 
                className="w-full bg-[#ff6b6b] hover:bg-[#ff5252] text-white font-semibold py-3.5 rounded-xl transition-all duration-300 transform hover:-translate-y-1 hover:shadow-[0_10px_20px_-10px_rgba(255,107,107,0.6)] flex justify-center items-center mt-4" 
                disabled={loading} 
                id="login-submit-btn"
              >
                {loading ? (
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : 'Login'}
              </button>
            </form>

            {/* Registration Divider & Link */}
            <div className="mt-8 pt-6 border-t border-white/10 text-center">
              <p className="text-sm text-gray-400 mb-4">New student?</p>
              <Link 
                to="/register" 
                className="block w-full border border-[#ff6b6b] text-[#ff6b6b] hover:bg-[#ff6b6b] hover:text-white font-medium py-3 rounded-xl transition-all duration-300 text-center" 
                id="register-link-btn"
              >
                Create Account
              </Link>
            </div>
            
          </div>
        </div>
        
        {/* Footer Copyright */}
        <div className="absolute bottom-4 left-0 w-full text-center text-xs text-gray-600 z-0">
          © {new Date().getFullYear()} OA Attendance System
        </div>
        
      </div>
    </>
  );
};

export default LoginPage;