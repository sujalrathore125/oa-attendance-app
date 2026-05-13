import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { FiEye, FiEyeOff, FiUser, FiHash, FiLock } from 'react-icons/fi';

const BRANCHES = ['CS', 'MDS', 'ECE', 'EE', 'ME', 'Civil Eng', 'Chem Eng'];
const SECTIONS = ['1', '2', '3'];

const RegisterPage = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme(); // Maintained for your context
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [form, setForm] = useState({
    login_id: '',
    password: '',
    full_name: '',
    scholar_no: '',
    branch: '',
    section: '',
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const set = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!form.branch || !form.section) {
      toast.error('Please select branch and section');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/register', form);
      toast.success('Account created! Please login.');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || 'Registration failed');
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
          
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          /* Geometric dot pattern matching the image corners */
          .bg-dots {
            background-image: radial-gradient(rgba(255, 255, 255, 0.15) 1.5px, transparent 1.5px);
            background-size: 24px 24px;
          }

          /* Dark overlay to simulate the blurred background in the image */
          .bg-overlay {
            background: linear-gradient(135deg, #10162a 0%, #17203a 100%);
          }

          /* Custom scrollbar for dropdowns */
          select option {
            background-color: #1a233a;
            color: white;
          }
        `}
      </style>

      <div className="min-h-screen flex flex-col lg:flex-row bg-overlay text-white font-sans overflow-hidden relative">

        {/* Decorative Corner Patterns */}
        <div className="absolute top-8 right-8 w-32 h-32 bg-dots opacity-40 pointer-events-none" />
        <div className="absolute bottom-8 right-8 w-32 h-32 bg-dots opacity-40 pointer-events-none" />

        {/* Left Panel - Branding & Info */}
        <div className="w-full lg:w-1/2 p-10 lg:p-20 xl:p-28 flex flex-col justify-center relative z-10">
          <div className={`transition-all duration-1000 ${mounted ? 'animate-slide-up' : 'opacity-0'}`}>

            {/* Logo */}
            <div className="flex items-center gap-3 mb-16">
              <div className="w-8 h-8 rounded bg-[#f26644] flex items-center justify-center font-bold text-lg text-white">
                M
              </div>
              <span className="text-2xl font-bold tracking-wide">OA Track</span>
            </div>

            {/* Main Headings */}
            <h1 className="text-5xl lg:text-[4rem] font-extrabold mb-4 text-white leading-[1.1] tracking-tight">
              Create<br />New Account
            </h1>

            <p className="text-base text-gray-400 mb-8 font-medium">
              Already registered?
              <Link
                to="/login"
                className="ml-2 font-semibold text-[#f26644] hover:text-[#ff7a59] transition-colors duration-200"
              >
                Login
              </Link>
            </p>

            <div className="w-12 h-1 bg-white mb-8" />

            <p className="text-gray-400 leading-relaxed mb-10 max-w-md text-sm lg:text-base">
              Access your Online Assessment Attendance System securely and manage attendance with real-time verification.
            </p>

            {/* <button className="bg-[#f26644] hover:bg-[#e05535] text-white px-8 py-3 rounded-full font-semibold transition-all duration-300 transform hover:-translate-y-1 hover:shadow-lg w-max">
              Learn More
            </button> */}
          </div>
        </div>

        {/* Right Panel - Registration Form */}
        <div className="w-full lg:w-1/2 p-6 lg:p-12 flex items-center justify-center relative z-10">
          <div className={`w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 lg:p-10 shadow-2xl transition-all duration-1000 delay-200 ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>

            <h2 className="text-3xl font-bold text-center mb-8 text-white">Sign Up</h2>

            <form onSubmit={handleRegister} className="space-y-5">

              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-4">
                  Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g. Rahul Kumar"
                    className="w-full bg-white/10 border border-transparent text-white rounded-full py-3.5 px-5 focus:outline-none focus:border-[#f26644]/50 focus:bg-white/15 transition-all placeholder-gray-500 text-sm"
                    value={form.full_name}
                    onChange={set('full_name')}
                    required
                    minLength={2}
                  />
                </div>
              </div>

              {/* Scholar No. */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-4">
                  Scholar No.
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g. 2311201380"
                    className="w-full bg-white/10 border border-transparent text-white font-mono rounded-full py-3.5 px-5 focus:outline-none focus:border-[#f26644]/50 focus:bg-white/15 transition-all placeholder-gray-500 text-sm"
                    value={form.scholar_no}
                    onChange={set('scholar_no')}
                    required
                  />
                </div>
              </div>

              {/* Login ID */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-4">
                  Login ID
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Choose a login ID"
                    className="w-full bg-white/10 border border-transparent text-white rounded-full py-3.5 px-5 focus:outline-none focus:border-[#f26644]/50 focus:bg-white/15 transition-all placeholder-gray-500 text-sm"
                    value={form.login_id}
                    onChange={set('login_id')}
                    required
                    minLength={3}
                  />
                </div>
              </div>

              {/* Branch & Section Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-4">
                    Branch
                  </label>
                  <select
                    className="w-full bg-white/10 border border-transparent text-gray-300 rounded-full py-3.5 px-5 focus:outline-none focus:border-[#f26644]/50 focus:bg-white/15 transition-all appearance-none cursor-pointer text-sm"
                    value={form.branch}
                    onChange={set('branch')}
                    required
                  >
                    <option value="" disabled className="text-gray-500">Select</option>
                    {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-4">
                    Section
                  </label>
                  <select
                    className="w-full bg-white/10 border border-transparent text-gray-300 rounded-full py-3.5 px-5 focus:outline-none focus:border-[#f26644]/50 focus:bg-white/15 transition-all appearance-none cursor-pointer text-sm"
                    value={form.section}
                    onChange={set('section')}
                    required
                  >
                    <option value="" disabled className="text-gray-500">Select</option>
                    {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-4">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    className="w-full bg-white/10 border border-transparent text-white rounded-full py-3.5 px-5 pr-12 focus:outline-none focus:border-[#f26644]/50 focus:bg-white/15 transition-all placeholder-gray-500 text-sm"
                    value={form.password}
                    onChange={set('password')}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(p => !p)}
                    className="absolute inset-y-0 right-4 flex items-center text-gray-400 hover:text-white transition-colors"
                  >
                    {showPass ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                  </button>
                </div>
              </div>

              {/* Face Registration Notice */}
              <div className="pt-2">
                <p className="text-[11px] text-center text-gray-400 px-4">
                  *After registration, you will be prompted to register your face for attendance verification.
                </p>
              </div>

              {/* Submit Button */}
              <div className="pt-4 flex justify-center">
                <button
                  type="submit"
                  className="w-2/3 bg-[#f26644] hover:bg-[#e05535] text-white font-semibold py-3.5 rounded-full transition-all duration-300 transform hover:-translate-y-1 shadow-lg disabled:opacity-70 flex justify-center items-center"
                  disabled={loading}
                >
                  {loading ? (
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : 'Sign Up'}
                </button>
              </div>

            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default RegisterPage;