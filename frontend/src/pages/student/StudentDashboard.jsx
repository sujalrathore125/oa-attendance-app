import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import FaceCapture from '../../components/common/FaceCapture';
import Skeleton from '../../components/common/Skeleton';
import toast from 'react-hot-toast';
import { FiCheckCircle, FiAlertCircle, FiCalendar, FiClock, FiUser, FiCamera, FiList, FiSettings } from 'react-icons/fi';
import { format } from 'date-fns';

const StudentDashboard = () => {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [faceBlob, setFaceBlob] = useState(null);
  const [registeringFace, setRegisteringFace] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteForm, setDeleteForm] = useState({ scholar_no: '', password: '' });
  const [deleting, setDeleting] = useState(false);
  const [showDelPass, setShowDelPass] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [historyPage, setHistoryPage] = useState(1);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);

  useEffect(() => {
    setMounted(true);
    fetchHistory();
  }, []);

  const fetchHistory = async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.get(`/attendance/history?page=${page}&limit=10`);
      if (page === 1) {
        setHistory(res.data.data);
      } else {
        setHistory(prev => [...prev, ...res.data.data]);
      }
      setHasMoreHistory(page < res.data.meta.totalPages);
      setHistoryPage(page);
    } catch {}
    setLoading(false);
  };

  const handleFaceRegister = async () => {
    if (!faceBlob) return toast.error('Please capture your face first');
    setRegisteringFace(true);
    const formData = new FormData();
    formData.append('face_image', faceBlob, 'face.jpg');
    try {
      await api.post('/face/register', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Face registered successfully!');
      setUser(u => ({ ...u, face_registered: 1 }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Face registration failed');
    } finally {
      setRegisteringFace(false);
    }
  };

  // Removed handleDeleteAccount due to staff-only requirement

  const faceRegistered = user?.face_registered;
  const presentCount = history.filter(h => h.status === 'present').length;
  const absentCount = history.filter(h => h.status !== 'present').length;

  const tabs = [
    { id: 'home', label: 'Home', icon: <FiUser /> },
    { id: 'face', label: 'Face Setup', icon: <FiCamera /> },
    { id: 'history', label: 'History', icon: <FiList /> },
    { id: 'settings', label: 'Settings', icon: <FiSettings /> },
  ];

  return (
    <>
      <style>
        {`
          .animate-fade-in { opacity: 0; animation: fadeIn 0.6s ease-out forwards; }
          .animate-slide-up { opacity: 0; animation: slideUp 0.6s ease-out forwards; }
          .delay-100 { animation-delay: 100ms; }
          .delay-200 { animation-delay: 200ms; }
          
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          .bg-dots {
            background-image: radial-gradient(rgba(255, 255, 255, 0.1) 1.5px, transparent 1.5px);
            background-size: 24px 24px;
          }
          .bg-overlay {
            background: linear-gradient(135deg, #0d1321 0%, #17203a 100%);
          }
        `}
      </style>

      <div className="min-h-screen bg-overlay text-white font-sans relative overflow-x-hidden pb-12">
        {/* Decorative Background */}
        <div className="absolute inset-0 bg-dots opacity-40 pointer-events-none" />
        <div className="absolute top-0 right-0 w-full h-96 bg-gradient-to-b from-[#1d2d44]/50 to-transparent pointer-events-none" />

        <div className="max-w-2xl mx-auto p-4 md:p-6 relative z-10 pt-8">
          
          {/* Profile Card Header */}
          <div className={`bg-gradient-to-r from-[#f26644] to-[#c44536] rounded-3xl shadow-2xl p-6 md:p-8 text-white mb-8 transition-all duration-700 ${mounted ? 'animate-slide-up' : 'opacity-0'}`}>
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl font-extrabold shadow-inner border border-white/30">
                {user?.full_name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold truncate tracking-tight">{user?.full_name || 'Student Name'}</h2>
                <p className="text-white/80 text-sm font-medium mt-1 font-mono tracking-wide">{user?.scholar_no} <span className="font-sans mx-1">•</span> {user?.branch} - {user?.section}</p>
              </div>
              <div className="hidden sm:block">
                <span className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 border ${faceRegistered ? 'bg-white/20 text-white border-white/30' : 'bg-black/20 text-amber-300 border-amber-400/30'}`}>
                  {faceRegistered ? <><FiCheckCircle size={14} /> Face OK</> : <><FiAlertCircle size={14} /> No Face Setup</>}
                </span>
              </div>
            </div>
             {/* Mobile badge representation */}
             <div className="sm:hidden mt-4 pt-4 border-t border-white/20">
                <span className={`w-full px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border ${faceRegistered ? 'bg-white/20 text-white border-white/30' : 'bg-black/20 text-amber-300 border-amber-400/30'}`}>
                  {faceRegistered ? <><FiCheckCircle size={14} /> Face Status: OK</> : <><FiAlertCircle size={14} /> Face Status: Incomplete</>}
                </span>
              </div>
          </div>

          {/* Navigation Tabs */}
          <div className={`bg-[#1d2d44]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 flex flex-wrap sm:flex-nowrap gap-1 shadow-lg mb-8 transition-all duration-700 delay-100 ${mounted ? 'animate-slide-up' : 'opacity-0'}`}>
            {tabs.map(t => (
              <button
                key={t.id}
                className={`flex-1 flex justify-center items-center gap-2 py-3 px-2 sm:px-4 rounded-xl text-xs md:text-sm font-semibold transition-all duration-300 min-w-[45%] sm:min-w-0 ${
                  activeTab === t.id
                    ? 'bg-[#f26644] text-white shadow-md'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
                onClick={() => setActiveTab(t.id)}
              >
                {t.icon} <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content Areas */}
          <div className="animate-fade-in delay-200">
            
            {/* --- HOME TAB --- */}
            {activeTab === 'home' && (
              <div className="space-y-6">
                
                {/* Face Registration Alert */}
                {!faceRegistered && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 shadow-lg backdrop-blur-sm">
                    <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                      <FiAlertCircle size={20} className="text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-amber-400 text-sm">Face Setup Required</p>
                      <p className="text-xs text-amber-200/70 mt-1 leading-relaxed">You must register your face pattern to participate in OA attendance verification.</p>
                    </div>
                    <button 
                      className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-black font-bold px-5 py-2.5 rounded-xl text-sm transition-all shadow-lg" 
                      onClick={() => setActiveTab('face')}
                    >
                      Setup Now
                    </button>
                  </div>
                )}
                
                {/* Stats Grid */}
                <div>
                   <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest ml-2 mb-4">Attendance Overview</h3>
                  <div className="grid grid-cols-3 gap-3 md:gap-4">
                    {[
                      { label: 'Total OAs', val: history.length, color: 'text-white', bg: 'bg-white/10 border-white/10' },
                      { label: 'Present', val: presentCount, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
                      { label: 'Absent', val: absentCount, color: 'text-[#f26644]', bg: 'bg-[#f26644]/10 border-[#f26644]/20' },
                    ].map(({ label, val, color, bg }) => (
                      <div key={label} className={`backdrop-blur-xl border rounded-3xl p-5 md:p-6 text-center shadow-lg transition-transform hover:-translate-y-1 ${bg}`}>
                        <p className={`text-3xl md:text-4xl font-extrabold ${color}`}>{val}</p>
                        <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wider font-bold mt-2">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* --- FACE SETUP TAB --- */}
            {activeTab === 'face' && (
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl rounded-3xl overflow-hidden">
                <div className="p-8 text-center">
                  {faceRegistered ? (
                    <div className="space-y-4 py-8 flex flex-col items-center">
                      <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center shadow-[0_0_30px_rgba(52,211,153,0.2)]">
                        <FiCheckCircle size={40} className="text-emerald-400 drop-shadow-md" />
                      </div>
                      <h3 className="text-2xl font-bold text-white tracking-tight">Face Setup Complete</h3>
                      <p className="text-gray-400 text-sm max-w-sm leading-relaxed">
                        Your face pattern is securely stored in the system. Contact your TPO admin if you need to reset your setup.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <h3 className="text-2xl font-bold text-white mb-2">Register Your Face</h3>
                      <p className="text-sm text-gray-400 mb-8 max-w-sm">
                        Align your face in the frame and capture. Only an encrypted mathematical pattern is stored, not the image itself.
                      </p>
                      
                      {/* Face Capture Container */}
                      <div className="w-full max-w-sm rounded-3xl overflow-hidden border-2 border-white/10 bg-black/40 mb-6 shadow-xl relative">
                        <FaceCapture onCapture={(blob) => setFaceBlob(blob)} label="📸 Capture Photo" />
                      </div>

                      {faceBlob && (
                        <button 
                          className="w-full max-w-sm bg-[#f26644] hover:bg-[#e05535] text-white font-bold py-4 rounded-full transition-all duration-300 transform hover:-translate-y-1 shadow-lg flex justify-center items-center gap-2" 
                          onClick={handleFaceRegister} 
                          disabled={registeringFace}
                        >
                          {registeringFace ? (
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          ) : '✅ Save Face Profile'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* --- HISTORY TAB --- */}
            {activeTab === 'history' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest ml-2 mb-4">Past Sessions</h3>
                
                {loading && historyPage === 1 ? (
                  <div className="space-y-3">
                    <Skeleton className="w-full h-24 rounded-2xl" />
                    <Skeleton className="w-full h-24 rounded-2xl" />
                  </div>
                ) : history.length === 0 ? (
                  <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-12 text-center shadow-lg flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                      <FiCalendar size={28} className="text-gray-500" />
                    </div>
                    <p className="text-gray-400 font-medium">No OA attendance records found.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {history.map(item => (
                      <div key={item.id} className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-lg rounded-2xl p-5 hover:bg-white/10 transition-colors flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                          <p className="font-bold text-white">{item.title}</p>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 mt-2">
                            <span className="flex items-center gap-1.5"><FiCalendar size={12} className="text-gray-500"/>{format(new Date(item.oa_date), 'dd MMM yyyy')}</span>
                            <span className="text-gray-600">•</span>
                            <span className="flex items-center gap-1.5"><FiClock size={12} className="text-gray-500"/>{item.start_time?.slice(0,5)} - {item.end_time?.slice(0,5)}</span>
                          </div>
                          {item.is_extended ? <span className="inline-block mt-2 bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Extended Session</span> : null}
                        </div>
                        
                        <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto mt-2 sm:mt-0 pt-3 sm:pt-0 border-t border-white/5 sm:border-t-0">
                          <span className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border ${item.status === 'present' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-[#f26644]/10 text-[#f26644] border-[#f26644]/20'}`}>
                            {item.status === 'present' ? '✓ Present' : '✗ Absent'}
                          </span>
                          {item.face_match_score ? (
                            <p className="text-[10px] text-gray-500 mt-2 font-medium">{item.face_match_score.toFixed(0)}% Match</p>
                          ) : null}
                        </div>
                      </div>
                    ))}

                    {hasMoreHistory && history.length > 0 && (
                      <button
                        onClick={() => fetchHistory(historyPage + 1)}
                        disabled={loading}
                        className="w-full mt-4 bg-white/5 hover:bg-white/10 text-white font-medium py-2 rounded-xl transition-colors border border-white/10"
                      >
                        {loading ? 'Loading...' : 'Load More'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* --- SETTINGS TAB --- */}
            {activeTab === 'settings' && (
              <div className="space-y-6">
                
                {/* Account Info Card */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl rounded-3xl overflow-hidden p-6">
                  <h3 className="font-bold text-lg text-white mb-6 flex items-center gap-2">
                    <FiUser className="text-[#f26644]" /> Profile Details
                  </h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-[#0d1321]/50 border border-white/5 rounded-2xl p-4">
                      <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-1">Login ID</p>
                      <p className="font-semibold text-white">{user?.login_id}</p>
                    </div>
                    <div className="bg-[#0d1321]/50 border border-white/5 rounded-2xl p-4">
                      <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-1">Scholar No.</p>
                      <p className="font-semibold text-white font-mono">{user?.scholar_no}</p>
                    </div>
                    <div className="bg-[#0d1321]/50 border border-white/5 rounded-2xl p-4">
                      <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-1">Branch</p>
                      <p className="font-semibold text-white">{user?.branch}</p>
                    </div>
                    <div className="bg-[#0d1321]/50 border border-white/5 rounded-2xl p-4">
                      <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-1">Section</p>
                      <p className="font-semibold text-white">{user?.section}</p>
                    </div>
                  </div>
                </div>

                {/* Danger Zone Removed */}
              </div>
            )}
          </div>
        </div>
      </div>

    </>
  );
};

export default StudentDashboard;