import { useState, useEffect } from 'react';
import api from '../../utils/api';
import FaceCapture from '../../components/common/FaceCapture';
import Skeleton from '../../components/common/Skeleton';
import toast from 'react-hot-toast';
import { FiSearch, FiCheckCircle, FiXCircle, FiClock, FiChevronDown, FiUserCheck, FiList } from 'react-icons/fi';
import { format } from 'date-fns';

const VolunteerDashboard = () => {
  const [activeSessions, setActiveSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [scholarNo, setScholarNo] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);
  const [faceBlob, setFaceBlob] = useState(null);
  const [step, setStep] = useState('select'); // select | scan | verify | confirm | done
  const [loading, setLoading] = useState(false);
  const [attendanceList, setAttendanceList] = useState([]);
  const [activeTab, setActiveTab] = useState('mark');
  const [showExtendMenu, setShowExtendMenu] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Pagination and Skeleton
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [attendancePage, setAttendancePage] = useState(1);
  const [hasMoreAttendance, setHasMoreAttendance] = useState(true);

  useEffect(() => {
    setMounted(true);
    fetchActiveSessions();
  }, []);

  const fetchActiveSessions = async () => {
    setLoadingSessions(true);
    try {
      const res = await api.get('/oa/active');
      setActiveSessions(res.data.data);
    } catch {
    } finally {
      setLoadingSessions(false);
    }
  };

  const fetchAttendance = async (sessionId, page = 1) => {
    setLoadingAttendance(true);
    try {
      const res = await api.get(`/attendance/oa/${sessionId}?page=${page}&limit=10`);
      if (page === 1) {
        setAttendanceList(res.data.data);
      } else {
        setAttendanceList(prev => [...prev, ...res.data.data]);
      }
      setHasMoreAttendance(page < res.data.meta.totalPages);
      setAttendancePage(page);
    } catch {
    } finally {
      setLoadingAttendance(false);
    }
  };

  const selectSession = (session) => {
    setSelectedSession(session);
    setStep('scan');
    fetchAttendance(session.id);
  };

  const handleFaceCapture = async (blob) => {
    setFaceBlob(blob);
    setVerifyResult(null);
    setStep('scan');
  };

  const verifyFace = async () => {
    if (!faceBlob || !scholarNo.trim()) {
      return toast.error('Enter scholar number and capture face');
    }
    setLoading(true);
    const formData = new FormData();
    formData.append('face_image', faceBlob, 'verify.jpg');
    formData.append('scholar_no', scholarNo.trim());
    try {
      const res = await api.post('/face/verify', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setVerifyResult(res.data.data);
      setStep('confirm');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const confirmAttendance = async () => {
    if (!verifyResult?.verification?.isMatch) {
      return toast.error('Face does not match. Cannot mark attendance.');
    }
    setLoading(true);
    const formData = new FormData();
    formData.append('oa_session_id', selectedSession.id);
    formData.append('scholar_no', scholarNo.trim());
    formData.append('face_match_score', verifyResult.verification.matchScore);
    formData.append('liveness_score', verifyResult.verification.livenessScore);
    if (faceBlob) formData.append('capture_image', faceBlob, 'attendance.jpg');
    try {
      await api.post('/attendance', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(`Attendance marked for ${verifyResult.student.full_name}!`);
      fetchAttendance(selectedSession.id);
      resetForm();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to mark attendance');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFaceBlob(null);
    setVerifyResult(null);
    setStep('scan');
  };

  const extendSession = async (minutes) => {
    try {
      const res = await api.patch(`/oa/${selectedSession.id}/extend`, { duration: minutes });
      toast.success(res.data.message);
      fetchActiveSessions();
      setShowExtendMenu(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Extension failed');
    }
  };

  const tabs = [
    { id: 'mark', label: 'Mark Attendance', icon: <FiUserCheck /> },
    { id: 'list', label: 'Attendance List', icon: <FiList /> },
  ];

  return (
    <>
      <style>
        {`
          .animate-fade-in { opacity: 0; animation: fadeIn 0.6s ease-out forwards; }
          .animate-slide-up { opacity: 0; animation: slideUp 0.6s ease-out forwards; }
          .delay-100 { animation-delay: 100ms; }
          
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

      {/* Adding Skeleton Component reference (Ensure it's imported or locally defined if needed. We'll inline it for safety or rely on the global one if we imported it. Actually, wait! I didn't import it!) */}

      <div className="min-h-screen bg-overlay text-white font-sans relative overflow-x-hidden pb-12">
        {/* Decorative Background */}
        <div className="absolute inset-0 bg-dots opacity-40 pointer-events-none" />
        <div className="absolute top-0 right-0 w-full h-96 bg-gradient-to-b from-[#1d2d44]/50 to-transparent pointer-events-none" />

        <div className="max-w-2xl mx-auto p-4 md:p-6 relative z-10 pt-8">
          
          {/* Header Title */}
          <div className={`mb-8 text-center transition-all duration-700 ${mounted ? 'animate-slide-up' : 'opacity-0'}`}>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">Volunteer Portal</h1>
            <p className="text-gray-400 text-sm mt-1">Manage online assessment attendance</p>
          </div>

          {/* Custom Tabs */}
          <div className={`bg-[#1d2d44]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 flex gap-1 shadow-lg mb-8 transition-all duration-700 delay-100 ${mounted ? 'animate-slide-up' : 'opacity-0'}`}>
            {tabs.map(t => (
              <button
                key={t.id}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-300 ${
                  activeTab === t.id
                    ? 'bg-[#f26644] text-white shadow-md'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
                onClick={() => setActiveTab(t.id)}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          <div className="animate-fade-in">
            {activeTab === 'mark' && (
              <>
                {/* Step 1: Select Session */}
                {step === 'select' && (
                  <div className="space-y-4">
                    <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest ml-2 mb-4">Active Sessions</h2>
                    
                    {loadingSessions ? (
                      <div className="space-y-3">
                        <Skeleton className="w-full h-24 rounded-3xl" />
                        <Skeleton className="w-full h-24 rounded-3xl" />
                      </div>
                    ) : activeSessions.length === 0 ? (
                      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-12 text-center shadow-2xl flex flex-col items-center">
                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                          <FiClock size={28} className="text-gray-500" />
                        </div>
                        <p className="text-gray-400 font-medium">No active OA sessions right now</p>
                        <button className="mt-6 bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-full text-sm font-medium transition-all" onClick={fetchActiveSessions}>
                          Refresh
                        </button>
                      </div>
                    ) : activeSessions.map(s => (
                      <div 
                        key={s.id} 
                        className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 hover:bg-white/10 hover:border-[#f26644]/50 transition-all cursor-pointer shadow-lg flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between group"
                        onClick={() => selectSession(s)}
                      >
                        <div>
                          <h3 className="font-bold text-lg text-white group-hover:text-[#f26644] transition-colors">{s.title}</h3>
                          <p className="text-sm text-gray-400 mt-1">
                            {format(new Date(s.oa_date), 'dd MMM')} <span className="mx-2">•</span> {s.start_time?.slice(0,5)} - {s.end_time?.slice(0,5)}
                          </p>
                          <p className="text-xs text-gray-500 mt-2 bg-white/5 inline-block px-3 py-1 rounded-full">{s.branches?.join(', ')}</p>
                        </div>
                        <span className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${s.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                          {s.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Step 2: Face Scan & Confirm */}
                {(step === 'scan' || step === 'confirm') && selectedSession && (
                  <div className="space-y-6 animate-fade-in">
                    
                    {/* Session Header Card */}
                    <div className="bg-gradient-to-r from-[#f26644] to-[#c44536] rounded-3xl p-5 shadow-lg flex items-center justify-between flex-wrap gap-4">
                      <div>
                        <p className="font-extrabold text-white text-lg leading-tight">{selectedSession.title}</p>
                        <p className="text-white/80 text-xs font-medium uppercase tracking-wider mt-1">{selectedSession.status}</p>
                      </div>
                      <div className="flex gap-2">
                        {/* Extend Dropdown */}
                        <div className="relative">
                          <button
                            className="bg-black/20 hover:bg-black/30 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2"
                            onClick={() => setShowExtendMenu(p => !p)}
                          >
                            <FiClock size={14} /> Extend <FiChevronDown size={14} />
                          </button>
                          {showExtendMenu && (
                            <div className="absolute right-0 top-full mt-2 bg-[#1d2d44] text-white rounded-xl shadow-2xl py-2 w-48 z-50 border border-white/10 backdrop-blur-xl">
                              <button className="w-full text-left px-5 py-3 text-sm hover:bg-white/10 transition-colors flex items-center gap-2" onClick={() => extendSession(30)}>
                                <FiClock size={14} className="text-gray-400"/> +30 Minutes
                              </button>
                              <button className="w-full text-left px-5 py-3 text-sm hover:bg-white/10 transition-colors flex items-center gap-2" onClick={() => extendSession(60)}>
                                <FiClock size={14} className="text-gray-400"/> +1 Hour
                              </button>
                            </div>
                          )}
                        </div>
                        <button
                          className="bg-black/20 hover:bg-black/30 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all"
                          onClick={() => { setStep('select'); setSelectedSession(null); setShowExtendMenu(false); }}
                        >
                          Change
                        </button>
                      </div>
                    </div>

                    {/* Main Scan Form */}
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl rounded-3xl overflow-hidden">
                      <div className="p-6 md:p-8">
                        <div className="space-y-2 mb-6">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Scholar Number</label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500">
                              <FiSearch size={18} />
                            </div>
                            <input 
                              type="text" 
                              placeholder="Enter scholar number" 
                              className="w-full bg-[#0d1321]/50 border border-white/10 text-white font-mono rounded-xl py-3.5 pl-11 pr-4 focus:outline-none focus:border-[#f26644]/50 focus:bg-[#0d1321]/80 transition-all placeholder-gray-600"
                              value={scholarNo} 
                              onChange={e => { setScholarNo(e.target.value); setStep('scan'); setVerifyResult(null); }} 
                            />
                          </div>
                        </div>

                        {/* Note: FaceCapture component should ideally have transparent/dark styling passed to it, or it will sit as-is inside this container */}
                        <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/20">
                           <FaceCapture onCapture={(blob) => handleFaceCapture(blob)} label="📸 Click to Capture" />
                        </div>

                        {step === 'scan' && faceBlob && (
                          <button 
                            className="w-full bg-[#f26644] hover:bg-[#e05535] text-white font-semibold py-4 rounded-xl transition-all duration-300 transform hover:-translate-y-1 shadow-lg mt-6 flex justify-center items-center gap-2" 
                            onClick={verifyFace} 
                            disabled={loading}
                          >
                            {loading ? (
                               <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            ) : '🔍 Verify Face'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Verification Result Card */}
                    {step === 'confirm' && verifyResult && (
                      <div className={`backdrop-blur-xl border rounded-3xl p-6 md:p-8 shadow-2xl animate-slide-up ${verifyResult.verification.isMatch ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                        <div className="flex items-center gap-4 border-b border-white/10 pb-5 mb-5">
                          {verifyResult.verification.isMatch
                            ? <FiCheckCircle size={40} className="text-emerald-400 shrink-0 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                            : <FiXCircle size={40} className="text-red-400 shrink-0 drop-shadow-[0_0_8px_rgba(248,113,113,0.5)]" />}
                          <div>
                            <p className="font-bold text-xl text-white">{verifyResult.student.full_name}</p>
                            <p className="text-sm text-gray-300 mt-1">{verifyResult.student.scholar_no} <span className="mx-2">•</span> {verifyResult.student.branch}-{verifyResult.student.section}</p>
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-4 mt-4 bg-black/20 rounded-2xl p-4 border border-white/5">
                          {[
                            { label: 'Match Score', val: `${verifyResult.verification.matchScore.toFixed(1)}%` },
                            { label: 'Liveness', val: `${verifyResult.verification.livenessScore.toFixed(1)}%` },
                            {
                              label: `Result (≥${verifyResult.verification.threshold}%)`,
                              val: verifyResult.verification.isMatch ? 'MATCH' : 'NO MATCH',
                              color: verifyResult.verification.isMatch ? 'text-emerald-400' : 'text-red-400',
                            },
                          ].map(({ label, val, color }) => (
                            <div key={label} className="text-center flex-1 min-w-[100px]">
                              <p className={`font-bold text-2xl ${color || 'text-white'}`}>{val}</p>
                              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mt-1">{label}</p>
                            </div>
                          ))}
                        </div>

                        <div className="flex gap-3 mt-6">
                          <button className="flex-1 bg-white/5 hover:bg-white/10 text-white py-3.5 rounded-xl font-medium transition-all border border-white/10" onClick={resetForm}>
                            Try Again
                          </button>
                          {verifyResult.verification.isMatch && (
                            <button className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white py-3.5 rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(52,211,153,0.3)] flex justify-center items-center" onClick={confirmAttendance} disabled={loading}>
                              {loading ? <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : '✅ Mark Present'}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Attendance List Tab */}
            {activeTab === 'list' && (
              <div className="space-y-4 animate-fade-in">
                {selectedSession ? (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="font-bold text-lg text-white">{selectedSession?.title}</h2>
                      <span className="bg-white/10 text-white px-3 py-1 rounded-full text-xs font-medium border border-white/10">
                        {attendanceList.length} Marked
                      </span>
                    </div>
                    
                    <div className="space-y-3">
                      {loadingAttendance && attendancePage === 1 ? (
                        <div className="space-y-3">
                          <Skeleton className="w-full h-20 rounded-2xl" />
                          <Skeleton className="w-full h-20 rounded-2xl" />
                        </div>
                      ) : attendanceList.map(a => (
                        <div key={a.id} className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-lg rounded-2xl p-4 flex flex-row items-center justify-between hover:bg-white/10 transition-colors">
                          <div>
                            <p className="font-bold text-white text-sm">{a.full_name}</p>
                            <p className="text-xs text-gray-400 mt-1 font-mono">{a.scholar_no} <span className="font-sans mx-1">•</span> {a.branch}-{a.section}</p>
                          </div>
                          <div className="text-right flex flex-col items-end">
                            <div className="flex gap-2">
                              {a.is_extended ? <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Extended</span> : null}
                              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Present</span>
                            </div>
                            {a.face_match_score ? <p className="text-[10px] text-gray-500 mt-1.5 font-medium">{a.face_match_score.toFixed(0)}% Match</p> : null}
                          </div>
                        </div>
                      ))}
                      
                      {!loadingAttendance && attendanceList.length === 0 && (
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-10 text-center shadow-lg">
                          <p className="text-gray-400">No attendance marked yet</p>
                        </div>
                      )}

                      {hasMoreAttendance && attendanceList.length > 0 && (
                        <button
                          onClick={() => fetchAttendance(selectedSession.id, attendancePage + 1)}
                          disabled={loadingAttendance}
                          className="w-full mt-4 bg-white/5 hover:bg-white/10 text-white font-medium py-2 rounded-xl transition-colors border border-white/10"
                        >
                          {loadingAttendance ? 'Loading...' : 'Load More'}
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-12 text-center shadow-lg flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                      <FiList size={28} className="text-gray-500" />
                    </div>
                    <p className="text-gray-400 font-medium">Select an OA session from the Mark tab to view attendance.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default VolunteerDashboard;