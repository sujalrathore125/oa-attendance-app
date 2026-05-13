import { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { FiDownload, FiFilter, FiCalendar, FiSearch, FiUsers, FiList, FiClock, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import Skeleton from '../../components/common/Skeleton';
import { format } from 'date-fns';

const BRANCHES = ['', 'CS', 'MDS', 'ECE', 'EE', 'ME', 'Civil Eng', 'Chem Eng'];

const CoordinatorDashboard = () => {
  const [activeTab, setActiveTab] = useState('sessions');
  const [sessions, setSessions] = useState([]);
  const [filters, setFilters] = useState({ start_date: '', end_date: '', date: '' });
  const [selectedSession, setSelectedSession] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exportBranch, setExportBranch] = useState('');

  // Students tab state
  const [students, setStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentBranch, setStudentBranch] = useState('');
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentPage, setStudentPage] = useState(1);
  const [hasMoreStudents, setHasMoreStudents] = useState(true);

  // Pagination states
  const [sessionPage, setSessionPage] = useState(1);
  const [hasMoreSessions, setHasMoreSessions] = useState(true);
  const [attendancePage, setAttendancePage] = useState(1);
  const [hasMoreAttendance, setHasMoreAttendance] = useState(true);
  
  const [mounted, setMounted] = useState(false);

  const statusColors = { 
    upcoming: 'bg-blue-500/10 text-blue-400 border border-blue-500/20', 
    active:   'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20', 
    extended: 'bg-amber-500/10 text-amber-400 border border-amber-500/20', 
    closed:   'bg-white/5 text-gray-400 border border-white/10' 
  };

  useEffect(() => {
    setMounted(true);
    fetchSessions(1);
  }, []);

  // FIX: Added activeFilters parameter to prevent React state race-conditions on clear
  const fetchSessions = async (page = 1, activeFilters = filters) => {
    setLoading(true);
    try {
      const params = { page, limit: 10 };
      if (activeFilters.start_date) params.start_date = activeFilters.start_date;
      if (activeFilters.end_date)   params.end_date   = activeFilters.end_date;
      if (activeFilters.date)       params.date       = activeFilters.date;
      
      const res = await api.get('/oa', { params });
      
      if (page === 1) setSessions(res.data.data);
      else setSessions(p => [...p, ...res.data.data]);
      
      setHasMoreSessions(page < res.data.meta.totalPages);
      setSessionPage(page);
    } catch {}
    setLoading(false);
  };

  const handleClearFilters = () => {
    const emptyFilters = { start_date: '', end_date: '', date: '' };
    setFilters(emptyFilters);
    fetchSessions(1, emptyFilters);
  };

  const viewAttendance = async (session, page = 1) => {
    if (page === 1) setSelectedSession(session);
    try {
      const res = await api.get(`/attendance/oa/${session.id}?page=${page}&limit=20`);
      if (page === 1) setAttendance(res.data.data);
      else setAttendance(p => [...p, ...res.data.data]);

      setHasMoreAttendance(page < res.data.meta.totalPages);
      setAttendancePage(page);
    } catch {}
  };

  const exportExcel = async () => {
    if (!selectedSession) return;
    try {
      const res = await api.get(`/attendance/export/${selectedSession.id}`, {
        params: exportBranch ? { branch: exportBranch } : {},
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `OA_${selectedSession.title}_${Date.now()}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Excel downloaded!');
    } catch (err) {
      toast.error('Export failed');
    }
  };

  // FIX: Accept overrides to allow instant fetching when dropdowns change
  const fetchStudents = async (page = 1, searchOverride = studentSearch, branchOverride = studentBranch) => {
    setLoadingStudents(true);
    try {
      const params = { page, limit: 20 };
      if (searchOverride) params.search = searchOverride;
      if (branchOverride) params.branch = branchOverride;
      
      const res = await api.get('/students', { params });
      
      if (page === 1) setStudents(res.data.data);
      else setStudents(p => [...p, ...res.data.data]);

      setHasMoreStudents(page < res.data.meta.totalPages);
      setStudentPage(page);
    } catch {}
    setLoadingStudents(false);
  };

  useEffect(() => {
    if (activeTab === 'students') fetchStudents(1);
  }, [activeTab]);

  const tabs = [
    { id: 'sessions', label: 'Sessions', icon: <FiList /> },
    { id: 'students', label: 'Students', icon: <FiUsers /> },
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
            color-scheme: dark;
          }
          
          .custom-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(242,102,68,0.5); }
        `}
      </style>

      <div className="min-h-screen bg-overlay text-white font-sans relative overflow-x-hidden pb-12">
        <div className="absolute inset-0 bg-dots opacity-40 pointer-events-none" />
        <div className="absolute top-0 right-0 w-full h-96 bg-gradient-to-b from-[#1d2d44]/50 to-transparent pointer-events-none" />

        <div className="max-w-6xl mx-auto p-4 md:p-6 relative z-10 pt-8">
          
          <div className={`mb-8 text-center md:text-left transition-all duration-700 ${mounted ? 'animate-slide-up' : 'opacity-0'}`}>
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center justify-center md:justify-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f26644] to-[#c44536] flex items-center justify-center shadow-lg shadow-[#f26644]/20">
                <FiUsers className="text-white" size={20} />
              </div>
              Coordinator Dashboard
            </h1>
            <p className="text-gray-400 text-sm mt-2">Manage sessions, view attendance, and export reports</p>
          </div>

          <div className={`bg-[#1d2d44]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 flex gap-1 shadow-lg mb-8 max-w-md transition-all duration-700 delay-100 ${mounted ? 'animate-slide-up' : 'opacity-0'}`}>
            {tabs.map(t => (
              <button
                key={t.id}
                className={`flex-1 flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-300 ${
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

          <div className="animate-fade-in delay-200">
            {activeTab === 'sessions' && (
              <div className="space-y-6">
                
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-lg rounded-3xl p-5 md:p-6">
                  <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                    <FiFilter size={16} className="text-[#f26644]" /> Filter Sessions
                  </h2>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4 items-end">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Specific Date</label>
                      <input type="date" className="w-full bg-[#0d1321]/50 border border-white/10 text-white rounded-xl py-2.5 px-4 focus:outline-none focus:border-[#f26644]/50 focus:bg-[#0d1321]/80 transition-all text-sm" 
                        value={filters.date}
                        onChange={e => setFilters(p => ({ ...p, date: e.target.value, start_date: '', end_date: '' }))} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">From Date</label>
                      <input type="date" className="w-full bg-[#0d1321]/50 border border-white/10 text-white rounded-xl py-2.5 px-4 focus:outline-none focus:border-[#f26644]/50 focus:bg-[#0d1321]/80 transition-all text-sm" 
                        value={filters.start_date}
                        onChange={e => setFilters(p => ({ ...p, start_date: e.target.value, date: '' }))} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">To Date</label>
                      <input type="date" className="w-full bg-[#0d1321]/50 border border-white/10 text-white rounded-xl py-2.5 px-4 focus:outline-none focus:border-[#f26644]/50 focus:bg-[#0d1321]/80 transition-all text-sm" 
                        value={filters.end_date}
                        onChange={e => setFilters(p => ({ ...p, end_date: e.target.value, date: '' }))} />
                    </div>
                    <div className="flex gap-2 sm:col-span-3 lg:col-span-1 pt-2 lg:pt-0">
                      {/* FIX: explicitly pass 1 instead of event object */}
                      <button className="flex-1 bg-[#f26644] hover:bg-[#e05535] text-white py-2.5 px-4 rounded-xl text-sm font-semibold transition-all shadow-lg" onClick={() => fetchSessions(1)}>
                        Apply
                      </button>
                      <button className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white py-2.5 px-4 rounded-xl text-sm font-medium transition-all" onClick={handleClearFilters}>
                        Clear
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  <div className="lg:col-span-5 space-y-4">
                    <div className="flex items-center justify-between ml-2">
                      <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Available Sessions</h2>
                      <span className="bg-white/10 text-white px-2 py-0.5 rounded-full text-xs font-bold">{sessions.length}</span>
                    </div>
                    
                    <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                      {loading && sessionPage === 1 ? (
                        <div className="space-y-3">
                          <Skeleton className="w-full h-24 rounded-2xl" />
                          <Skeleton className="w-full h-24 rounded-2xl" />
                          <Skeleton className="w-full h-24 rounded-2xl" />
                        </div>
                      ) : sessions.map(s => (
                        <div key={s.id}
                          className={`backdrop-blur-xl rounded-2xl p-4 cursor-pointer transition-all duration-200 ${selectedSession?.id === s.id ? 'bg-[#f26644]/10 border border-[#f26644]/50 shadow-[0_0_15px_rgba(242,102,68,0.15)] transform translate-x-1' : 'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20'}`}
                          onClick={() => viewAttendance(s, 1)}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className={`font-bold text-base truncate ${selectedSession?.id === s.id ? 'text-[#f26644]' : 'text-white'}`}>{s.title}</h3>
                              <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs">
                                <span className="flex items-center gap-1 text-gray-400"><FiCalendar size={10}/> {format(new Date(s.oa_date), 'dd MMM yy')}</span>
                                <span className="text-gray-600">•</span>
                                <span className="flex items-center gap-1 text-gray-400"><FiClock size={10}/> {s.start_time?.slice(0,5)}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-2.5">
                                <span className="bg-white/5 text-gray-300 px-2 py-0.5 rounded text-[10px] font-mono border border-white/5">{s.branches?.join(', ')}</span>
                                <span className="text-[10px] text-emerald-400 font-semibold">{s.attendance_count} Present</span>
                              </div>
                            </div>
                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${statusColors[s.status]}`}>
                              {s.status}
                            </span>
                          </div>
                        </div>
                      ))}
                      {!loading && sessions.length === 0 && (
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-10 text-center">
                          <FiList size={24} className="text-gray-500 mx-auto mb-2" />
                          <p className="text-gray-400 text-sm">No sessions match filters</p>
                        </div>
                      )}
                      {hasMoreSessions && sessions.length > 0 && (
                        <button
                          onClick={() => fetchSessions(sessionPage + 1)}
                          disabled={loading}
                          className="w-full bg-white/5 hover:bg-white/10 text-white font-medium py-2 rounded-xl transition-colors border border-white/10"
                        >
                          {loading ? 'Loading...' : 'Load More'}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="lg:col-span-7 space-y-4">
                    <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest ml-2 hidden lg:block">Session Details</h2>
                    
                    {selectedSession ? (
                      <div className="animate-fade-in space-y-4">
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl rounded-3xl p-5 md:p-6">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                            <div>
                              <h3 className="text-xl font-bold text-white">{selectedSession.title}</h3>
                              <p className="text-sm text-gray-400 mt-1 flex items-center gap-2"><FiCalendar size={14}/> {format(new Date(selectedSession.oa_date), 'EEEE, dd MMMM yyyy')}</p>
                            </div>
                            
                            <div className="flex gap-3 w-full sm:w-auto">
                              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-12 py-3 flex-1 sm:flex-none text-center min-w-[90px]">
                                <p className="text-2xl font-extrabold text-emerald-400">{selectedSession.attendance_count}</p>
                                <p className="text-[10px] text-emerald-400/70 uppercase font-bold tracking-wider mt-1">Present Students</p>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row items-center gap-3 bg-[#0d1321]/30 p-2 rounded-xl border border-white/5">
                            <select className="w-full sm:flex-1 bg-[#0d1321]/50 border border-white/10 text-white rounded-lg py-2.5 px-3 focus:outline-none focus:border-[#f26644]/50 transition-all text-sm appearance-none cursor-pointer"
                              value={exportBranch} onChange={e => setExportBranch(e.target.value)}>
                              <option value="">All Branches</option>
                              {BRANCHES.filter(Boolean).map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                            <button className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 text-white py-2.5 px-5 rounded-lg text-sm font-bold transition-all shadow-lg flex items-center justify-center gap-2" onClick={exportExcel}>
                              <FiDownload size={16} /> Export Excel
                            </button>
                          </div>
                        </div>

                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl rounded-3xl overflow-hidden">
                          <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                              <thead className="bg-[#0d1321]/50 text-[10px] text-gray-400 uppercase tracking-widest border-b border-white/10">
                                <tr>
                                  <th className="px-5 py-4 font-bold">Scholar No</th>
                                  <th className="px-5 py-4 font-bold">Name</th>
                                  <th className="px-5 py-4 font-bold">Branch/Sec</th>
                                  <th className="px-5 py-4 font-bold">Score</th>
                                  <th className="px-5 py-4 font-bold">Time</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5">
                                {attendance.map(a => (
                                  <tr key={a.id} className="hover:bg-white/5 transition-colors">
                                    <td className="px-5 py-3 font-mono text-gray-300">{a.scholar_no}</td>
                                    <td className="px-5 py-3 font-medium text-white">{a.full_name}</td>
                                    <td className="px-5 py-3">
                                      <span className="bg-white/10 border border-white/10 px-2 py-0.5 rounded text-xs text-gray-300">{a.branch}</span>
                                      <span className="ml-2 text-gray-500 text-xs">{a.section}</span>
                                    </td>
                                    <td className="px-5 py-3">
                                      {a.face_match_score ? (
                                        <span className={`text-xs font-bold ${a.face_match_score > 80 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                          {a.face_match_score.toFixed(0)}%
                                        </span>
                                      ) : <span className="text-gray-600">-</span>}
                                    </td>
                                    <td className="px-5 py-3 text-xs text-gray-400">
                                      {a.marked_at ? format(new Date(a.marked_at), 'HH:mm') : '-'}
                                      {a.is_extended ? <span className="ml-2 bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase">Ext</span> : null}
                                    </td>
                                  </tr>
                                ))}
                                {attendance.length === 0 && (
                                  <tr>
                                    <td colSpan="5" className="px-5 py-8 text-center text-gray-500 text-sm">
                                      No attendance recorded for this session.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                            {hasMoreAttendance && attendance.length > 0 && (
                              <button
                                onClick={() => viewAttendance(selectedSession, attendancePage + 1)}
                                className="w-full text-center bg-white/5 hover:bg-white/10 text-white font-medium py-3 transition-colors border-t border-white/10 text-xs"
                              >
                                Load More Attendance
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-16 text-center shadow-lg flex flex-col items-center h-full justify-center">
                        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6 border border-white/10">
                          <FiCalendar size={32} className="text-gray-500" />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">Select a Session</h3>
                        <p className="text-gray-400 text-sm max-w-xs">Click on any OA session from the list to view detailed attendance and export data.</p>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            )}

            {/* --- STUDENTS TAB --- */}
            {activeTab === 'students' && (
              <div className="space-y-6">
                
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-lg rounded-3xl p-5 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="w-10 h-10 rounded-full bg-[#f26644]/20 flex items-center justify-center border border-[#f26644]/30">
                      <FiUsers className="text-[#f26644]" size={18} />
                    </div>
                    <div>
                      <h2 className="font-bold text-white text-lg">Student Directory</h2>
                      <p className="text-xs text-gray-400">{students.length} Total Students</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <div className="relative w-full sm:w-64">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiSearch className="text-gray-500" />
                      </div>
                      <input
                        type="text" placeholder="Search name or scholar no..."
                        className="w-full bg-[#0d1321]/50 border border-white/10 text-white rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:border-[#f26644]/50 focus:bg-[#0d1321]/80 transition-all text-sm"
                        value={studentSearch}
                        onChange={e => setStudentSearch(e.target.value)}
                        // FIX: Pass parameters explicitly on enter key
                        onKeyDown={e => e.key === 'Enter' && fetchStudents(1, e.target.value, studentBranch)}
                      />
                    </div>
                    {/* FIX: Auto-fetch immediately when branch changes */}
                    <select className="bg-[#0d1321]/50 border border-white/10 text-white rounded-xl py-2.5 px-4 focus:outline-none focus:border-[#f26644]/50 transition-all text-sm appearance-none cursor-pointer w-full sm:w-auto"
                      value={studentBranch} 
                      onChange={e => {
                        setStudentBranch(e.target.value);
                        fetchStudents(1, studentSearch, e.target.value);
                      }}>
                      <option value="">All Branches</option>
                      {BRANCHES.filter(Boolean).map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                    {/* FIX: explicitly pass 1 instead of event object */}
                    <button className="bg-[#f26644] hover:bg-[#e05535] text-white py-2.5 px-6 rounded-xl text-sm font-semibold transition-all shadow-lg w-full sm:w-auto" onClick={() => fetchStudents(1)}>
                      Search
                    </button>
                  </div>
                </div>

                <div className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl rounded-3xl overflow-hidden">
                  {loadingStudents && studentPage === 1 ? (
                    <div className="p-6 space-y-4">
                      <Skeleton className="w-full h-12 rounded-xl" />
                      <Skeleton className="w-full h-12 rounded-xl" />
                      <Skeleton className="w-full h-12 rounded-xl" />
                    </div>
                  ) : (
                    <div className="overflow-x-auto custom-scrollbar">
                      <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-[#0d1321]/50 text-[10px] text-gray-400 uppercase tracking-widest border-b border-white/10">
                          <tr>
                            <th className="px-6 py-4 font-bold">Scholar No</th>
                            <th className="px-6 py-4 font-bold">Name</th>
                            <th className="px-6 py-4 font-bold">Branch</th>
                            <th className="px-6 py-4 font-bold">Section</th>
                            <th className="px-6 py-4 font-bold">Face Setup</th>
                            <th className="px-6 py-4 font-bold">Account Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {students.map(s => (
                            <tr key={s.id} className="hover:bg-white/5 transition-colors">
                              <td className="px-6 py-4 font-mono text-gray-300">{s.scholar_no}</td>
                              <td className="px-6 py-4 font-semibold text-white">{s.full_name}</td>
                              <td className="px-6 py-4">
                                <span className="bg-white/10 border border-white/10 px-2.5 py-1 rounded text-xs text-gray-300">{s.branch}</span>
                              </td>
                              <td className="px-6 py-4 text-gray-400">{s.section}</td>
                              <td className="px-6 py-4">
                                {s.face_registered
                                  ? <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold bg-emerald-500/10 px-2 py-1 rounded-full w-max border border-emerald-500/20"><FiCheckCircle size={12}/> OK</span>
                                  : <span className="flex items-center gap-1.5 text-amber-400 text-xs font-bold bg-amber-500/10 px-2 py-1 rounded-full w-max border border-amber-500/20"><FiXCircle size={12}/> Pending</span>}
                              </td>
                              <td className="px-6 py-4">
                                {s.is_active
                                  ? <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Active</span>
                                  : <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border bg-red-500/10 text-red-400 border-red-500/20">Inactive</span>}
                              </td>
                            </tr>
                          ))}
                          {students.length === 0 && (
                            <tr>
                              <td colSpan="6" className="px-6 py-12 text-center text-gray-500 text-sm">
                                No students found matching your search.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                      {hasMoreStudents && students.length > 0 && (
                        <button
                          onClick={() => fetchStudents(studentPage + 1)}
                          disabled={loadingStudents}
                          className="w-full text-center bg-white/5 hover:bg-white/10 text-white font-medium py-4 transition-colors border-t border-white/10 text-sm"
                        >
                          {loadingStudents ? 'Loading...' : 'Load More Students'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default CoordinatorDashboard;