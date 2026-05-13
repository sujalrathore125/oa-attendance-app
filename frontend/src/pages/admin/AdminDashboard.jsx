import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Users, Calendar, Clock, Trash2, UserPlus, Eye, EyeOff, X, Key, Edit,
  LayoutDashboard, ClipboardList, GraduationCap, Shield, Loader2, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import Skeleton from '../../components/common/Skeleton';
import api from '../../utils/api';

const BRANCHES = ['CS', 'MDS', 'ECE', 'EE', 'ME', 'Civil Eng', 'Chem Eng'];
const SECTIONS = ['1', '2', '3'];

const statusColors = {
  upcoming: 'bg-blue-500/20 text-blue-200 border-blue-400/30',
  active: 'bg-green-500/20 text-green-200 border-green-400/30',
  extended: 'bg-orange-500/20 text-orange-200 border-orange-400/30',
  closed: 'bg-gray-500/20 text-gray-300 border-gray-400/30',
};

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState(null);
  const [students, setStudents] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showVolunteerModal, setShowVolunteerModal] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  const [showEditStudentModal, setShowEditStudentModal] = useState(false);
  const [editStudentForm, setEditStudentForm] = useState({ id: '', full_name: '', scholar_no: '', branch: '', section: '' });

  // Pagination and detailed loaders
  const [sessionPage, setSessionPage] = useState(1);
  const [hasMoreSessions, setHasMoreSessions] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const [studentPage, setStudentPage] = useState(1);
  const [hasMoreStudents, setHasMoreStudents] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const [createForm, setCreateForm] = useState({
    title: '', description: '', oa_date: '', start_time: '', end_time: '',
    branches: [],
  });
  const [volunteerForm, setVolunteerForm] = useState({
    login_id: '', password: '', full_name: '', role: 'tpo_volunteer',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, volRes] = await Promise.all([
        api.get('/attendance/stats/dashboard'),
        api.get('/auth/staff').catch(() => ({ data: { data: [] } }))
      ]);
      setStats(statsRes.data.data);
      setVolunteers(volRes.data.data || []);
    } catch (err) {
      toast.error('Failed to load dashboard data');
    }
    setLoading(false);
    fetchSessionsList(1);
    fetchStudentsList(1);
  };

  const fetchSessionsList = async (page = 1) => {
    setLoadingSessions(true);
    try {
      const res = await api.get(`/oa?page=${page}&limit=10`);
      if (page === 1) setSessions(res.data.data);
      else setSessions(p => [...p, ...res.data.data]);
      setHasMoreSessions(page < res.data.meta.totalPages);
      setSessionPage(page);
    } catch {}
    setLoadingSessions(false);
  };

  const fetchStudentsList = async (page = 1) => {
    setLoadingStudents(true);
    try {
      const res = await api.get(`/students?page=${page}&limit=20`);
      if (page === 1) setStudents(res.data.data);
      else setStudents(p => [...p, ...res.data.data]);
      setHasMoreStudents(page < res.data.meta.totalPages);
      setStudentPage(page);
    } catch {}
    setLoadingStudents(false);
  };

  const createSession = async (e) => {
    e.preventDefault();
    if (!createForm.branches.length) {
      return toast.error('Select at least one branch');
    }
    try {
      await api.post('/oa', createForm);
      toast.success('OA session created!');
      setShowCreateModal(false);
      setCreateForm({ title: '', description: '', oa_date: '', start_time: '', end_time: '', branches: [] });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create OA');
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/oa/${id}/status`, { status });
      toast.success('Status updated');
      fetchData();
    } catch {
      toast.error('Status update failed');
    }
  };

  const createVolunteer = async (e) => {
    e.preventDefault();
    try {
      await api.post('/auth/create-staff', volunteerForm);
      toast.success('Staff account created!');
      setShowVolunteerModal(false);
      setVolunteerForm({ login_id: '', password: '', full_name: '', role: 'tpo_volunteer' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create account');
    }
  };

  const deleteVolunteer = async (userId) => {
    if (!window.confirm('Delete this staff account? This cannot be undone.')) return;
    try {
      await api.delete(`/auth/staff/${userId}`);
      toast.success('Staff account deleted');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  const deleteStudent = async (studentId) => {
    if (!window.confirm('Delete this student account entirely? This clears attendance as well.')) return;
    try {
      await api.delete(`/auth/student/${studentId}`);
      toast.success('Student account deleted');
      fetchStudentsList(1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete student');
    }
  };

  const resetStudentFace = async (studentId) => {
    if (!window.confirm('Reset face registration for this student?')) return;
    try {
      await api.patch(`/face/reset/${studentId}`);
      toast.success('Face setup reset successfully');
      fetchStudentsList(1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset face');
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/auth/user/${selectedUser.id}/password`, { new_password: newPassword });
      toast.success('Password reset successfully');
      setShowPasswordModal(false);
      setNewPassword('');
      setSelectedUser(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset password');
    }
  };

  const openPasswordModal = (user) => {
    setSelectedUser({ id: user.user_id || user.id, name: user.full_name });
    setNewPassword('');
    setShowPasswordModal(true);
  };

  const handleEditStudent = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/students/${editStudentForm.id}`, editStudentForm);
      toast.success('Student updated successfully');
      setShowEditStudentModal(false);
      fetchStudentsList(studentPage);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update student');
    }
  };

  const openEditStudentModal = (student) => {
    setEditStudentForm({ id: student.id, full_name: student.full_name, scholar_no: student.scholar_no, branch: student.branch, section: student.section });
    setShowEditStudentModal(true);
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'sessions', label: 'Sessions', icon: ClipboardList },
    { id: 'students', label: 'Students', icon: GraduationCap },
    { id: 'volunteers', label: 'Staff', icon: Shield },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#1a1f3a] via-[#2d3561] to-[#1e2749]">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ duration: 1 }}
          className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-blue-500/20 to-transparent rounded-full blur-3xl"
        />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.2 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-indigo-500/20 to-transparent rounded-full blur-3xl"
        />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-white"
        >
          <h1 className="text-3xl font-semibold mb-2">Admin Dashboard</h1>
          <p className="text-blue-200/70">Manage sessions, students, and staff</p>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-2 flex gap-2 shadow-2xl flex-wrap"
        >
          {tabs.map((t, i) => {
            const Icon = t.icon;
            return (
              <motion.button
                key={t.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.2 + i * 0.05 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`flex-1 min-w-[120px] py-3 px-4 rounded-xl font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
                  activeTab === t.id
                    ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30'
                    : 'text-blue-200 hover:bg-white/5'
                }`}
                onClick={() => setActiveTab(t.id)}
              >
                <Icon className="size-4" />
                {t.label}
              </motion.button>
            );
          })}
        </motion.div>

        {/* Loading Spinner or Content */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="size-12 text-orange-500 animate-spin" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && stats && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { icon: '👥', label: 'Total Students', val: stats.total_students, color: 'from-blue-500 to-blue-600' },
                    { icon: '📝', label: 'Total OAs', val: stats.total_oa, color: 'from-purple-500 to-purple-600' },
                    { icon: '🟢', label: 'Active OAs', val: stats.active_oa, color: 'from-green-500 to-green-600' },
                    { icon: '✅', label: 'Marked', val: stats.total_attendance_marked, color: 'from-orange-500 to-orange-600' },
                  ].map(({ icon, label, val, color }, i) => (
                    <motion.div
                      key={label}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.4, delay: i * 0.1 }}
                      whileHover={{ scale: 1.05, y: -5 }}
                      className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-6 shadow-xl"
                    >
                      <div className={`inline-flex w-12 h-12 rounded-xl bg-gradient-to-br ${color} items-center justify-center text-2xl mb-3`}>
                        {icon}
                      </div>
                      <p className="text-3xl font-bold text-white mb-1">{val}</p>
                      <p className="text-sm text-blue-200/70">{label}</p>
                    </motion.div>
                  ))}
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.4 }}
                  className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-6 shadow-xl"
                >
                  <h3 className="text-lg font-semibold text-white mb-4">Recent OA Sessions</h3>
                  <div className="space-y-3">
                    {stats.recent_oa?.map((oa, i) => (
                      <motion.div
                        key={oa.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: 0.5 + i * 0.1 }}
                        className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between hover:bg-white/10 transition-all"
                      >
                        <div>
                          <p className="font-medium text-white">{oa.title}</p>
                          <p className="text-sm text-blue-200/70">{new Date(oa.oa_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 rounded-lg text-xs font-medium border ${statusColors[oa.status] || statusColors.closed}`}>
                            {oa.status}
                          </span>
                          <span className="text-white font-medium">{oa.attendance_count}</span>
                        </div>
                      </motion.div>
                    ))}
                    {(!stats.recent_oa || stats.recent_oa.length === 0) && (
                      <p className="text-blue-200/70 text-sm">No recent sessions found.</p>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}

            {/* Sessions Tab */}
            {activeTab === 'sessions' && (
              <motion.div
                key="sessions"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="space-y-4"
              >
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-white">OA Sessions</h2>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-medium flex items-center gap-2 shadow-lg shadow-orange-500/30"
                    onClick={() => setShowCreateModal(true)}
                  >
                    <Plus className="size-4" /> New OA
                  </motion.button>
                </div>

                {loadingSessions && sessionPage === 1 ? (
                  <div className="space-y-4">
                    <Skeleton className="w-full h-32 rounded-2xl bg-white/10" />
                    <Skeleton className="w-full h-32 rounded-2xl bg-white/10" />
                  </div>
                ) : sessions.map((s, i) => (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.1 }}
                    className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-6 shadow-xl hover:bg-white/15 transition-all"
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1">
                        <h3 className="font-semibold text-white text-lg mb-2">{s.title}</h3>
                        <div className="flex flex-wrap gap-3 text-sm text-blue-200/70">
                          <span className="flex items-center gap-1">
                            <Calendar className="size-4" />
                            {new Date(s.oa_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="size-4" />
                            {s.start_time?.slice(0,5)} - {s.end_time?.slice(0,5)}
                          </span>
                          <span>📚 {s.branches?.join(', ')}</span>
                          <span>👥 {s.attendance_count} present</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-lg text-xs font-medium border ${statusColors[s.status] || statusColors.closed}`}>
                          {s.status}
                        </span>
                        <select
                          className="bg-white/10 border border-white/20 text-white rounded-lg px-3 py-1 text-sm outline-none backdrop-blur-sm"
                          value={s.status}
                          onChange={e => updateStatus(s.id, e.target.value)}
                        >
                          {['upcoming', 'active', 'extended', 'closed'].map(st => (
                            <option key={st} value={st} className="bg-[#2d3561]">{st}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </motion.div>
                ))}
                
                {hasMoreSessions && sessions.length > 0 && (
                  <button
                    onClick={() => fetchSessionsList(sessionPage + 1)}
                    disabled={loadingSessions}
                    className="w-full py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl transition border border-white/10"
                  >
                    {loadingSessions ? 'Loading...' : 'Load More Sessions'}
                  </button>
                )}
                {sessions.length === 0 && (
                  <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-10 text-center">
                    <p className="text-blue-200/70">No OA sessions yet. Create one!</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Students Tab */}
            {activeTab === 'students' && (
              <motion.div
                key="students"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="space-y-4"
              >
                <h2 className="text-xl font-semibold text-white">Students ({students.length})</h2>
                <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-white/5 border-b border-white/10">
                        <tr>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-blue-200">Scholar No</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-blue-200">Name</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-blue-200">Branch</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-blue-200">Section</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-blue-200">Face</th>
                          <th className="px-6 py-4 text-right text-sm font-semibold text-blue-200">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loadingStudents && studentPage === 1 ? (
                          <tr>
                            <td colSpan="6" className="px-6 py-4">
                              <div className="space-y-3">
                                <Skeleton className="w-full h-10 bg-white/10 rounded" />
                                <Skeleton className="w-full h-10 bg-white/10 rounded" />
                              </div>
                            </td>
                          </tr>
                        ) : students.map((s, i) => (
                          <motion.tr
                            key={s.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3, delay: i * 0.05 }}
                            className="border-b border-white/5 hover:bg-white/5 transition-colors group"
                          >
                            <td className="px-6 py-4 text-white/90 font-mono text-sm">{s.scholar_no}</td>
                            <td className="px-6 py-4 text-white hover:text-orange-400 transition-colors">{s.full_name}</td>
                            <td className="px-6 py-4">
                              <span className="px-3 py-1 bg-white/10 border border-white/20 rounded-lg text-xs text-blue-200">
                                {s.branch}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-white/90">{s.section}</td>
                            <td className="px-6 py-4">
                              {s.face_registered ? (
                                <span className="text-green-400 text-xs font-semibold">✓ Registered</span>
                              ) : (
                                <span className="text-red-400 text-xs">✗ Pending</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="flex gap-2 justify-end">
                                <button className="p-1.5 tooltip-trigger rounded bg-blue-500/20 text-blue-300 hover:bg-blue-500/40 transition-colors" title="Reset Face" onClick={() => resetStudentFace(s.id)}>
                                  <RefreshCw className="size-4" />
                                </button>
                                <button className="p-1.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/40 transition-colors" title="Delete Student" onClick={() => deleteStudent(s.id)}>
                                  <Trash2 className="size-4" />
                                </button>
                              </div>
                            </td>
                          </motion.tr>
                        ))}
                        {!loadingStudents && students.length === 0 && (
                          <tr>
                            <td colSpan="6" className="px-6 py-12 text-center text-blue-200/70">
                              No students found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                    
                    {hasMoreStudents && students.length > 0 && (
                      <button
                        onClick={() => fetchStudentsList(studentPage + 1)}
                        disabled={loadingStudents}
                        className="w-full py-4 text-sm bg-white/5 hover:bg-white/10 text-white transition border-t border-white/10"
                      >
                        {loadingStudents ? 'Loading...' : 'Load More Students'}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Volunteers/Staff Tab */}
            {activeTab === 'volunteers' && (
              <motion.div
                key="volunteers"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="space-y-4"
              >
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-white">Staff Accounts</h2>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-medium flex items-center gap-2 shadow-lg shadow-orange-500/30"
                    onClick={() => setShowVolunteerModal(true)}
                  >
                    <UserPlus className="size-4" /> Add Staff
                  </motion.button>
                </div>

                {volunteers.map((v, i) => (
                  <motion.div
                    key={v.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.1 }}
                    className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-6 shadow-xl hover:bg-white/15 transition-all flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                        {v.full_name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-white">{v.full_name}</p>
                        <p className="text-sm text-blue-200/70">
                          {v.login_id} · <span className="px-2 py-0.5 bg-white/10 border border-white/20 rounded text-xs">{v.role}</span>
                        </p>
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="w-10 h-10 rounded-full bg-red-500/20 border border-red-400/30 flex items-center justify-center text-red-400 hover:bg-red-500/30 transition-colors"
                      onClick={() => deleteVolunteer(v.id)}
                      title="Delete staff account"
                    >
                      <Trash2 className="size-4" />
                    </motion.button>
                  </motion.div>
                ))}
                {volunteers.length === 0 && (
                  <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-10 text-center">
                    <p className="text-blue-200/70">No staff accounts found.</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Create OA Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="w-full max-w-2xl backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-8 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-semibold text-white">Create New OA Session</h3>
                <button
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                  onClick={() => setShowCreateModal(false)}
                >
                  <X className="size-4" />
                </button>
              </div>

              <form onSubmit={createSession} className="space-y-5">
                <div>
                  <label className="block text-sm text-blue-200 mb-2 font-medium">Title</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder:text-blue-300/40 outline-none transition-all duration-300 focus:border-white/30 focus:bg-white/10"
                    placeholder="e.g. Infosys OA - Round 1"
                    value={createForm.title}
                    onChange={e => setCreateForm(p => ({ ...p, title: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-blue-200 mb-2 font-medium">Description (optional)</label>
                  <textarea
                    className="w-full px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder:text-blue-300/40 outline-none transition-all duration-300 focus:border-white/30 focus:bg-white/10 resize-none"
                    rows={2}
                    value={createForm.description}
                    onChange={e => setCreateForm(p => ({ ...p, description: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-blue-200 mb-2 font-medium">Date</label>
                    <input
                      type="date"
                      className="w-full px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white outline-none transition-all duration-300 focus:border-white/30 focus:bg-white/10"
                      value={createForm.oa_date}
                      onChange={e => setCreateForm(p => ({ ...p, oa_date: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-blue-200 mb-2 font-medium">Start Time</label>
                    <input
                      type="time"
                      className="w-full px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white outline-none transition-all duration-300 focus:border-white/30 focus:bg-white/10"
                      value={createForm.start_time}
                      onChange={e => setCreateForm(p => ({ ...p, start_time: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-blue-200 mb-2 font-medium">End Time</label>
                    <input
                      type="time"
                      className="w-full px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white outline-none transition-all duration-300 focus:border-white/30 focus:bg-white/10"
                      value={createForm.end_time}
                      onChange={e => setCreateForm(p => ({ ...p, end_time: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div>
                  <p className="text-sm text-blue-200 mb-3 font-medium">Branches</p>
                  <div className="flex flex-wrap gap-2">
                    {BRANCHES.map(b => (
                      <label key={b} className="cursor-pointer">
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={createForm.branches.includes(b)}
                          onChange={() => setCreateForm(p => ({
                            ...p,
                            branches: p.branches.includes(b) ? p.branches.filter(x => x !== b) : [...p.branches, b]
                          }))}
                        />
                        <span className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                          createForm.branches.includes(b)
                            ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white border-orange-400 shadow-lg shadow-orange-500/30'
                            : 'bg-white/5 border-white/20 text-blue-200 hover:bg-white/10'
                        }`}>
                          {b}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    className="flex-1 py-3 bg-white/10 border border-white/20 text-white rounded-xl font-medium hover:bg-white/20 transition-all"
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-medium shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 transition-all"
                  >
                    Create OA
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Staff Modal */}
      <AnimatePresence>
        {showVolunteerModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowVolunteerModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="w-full max-w-md backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-8 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg">
                  <UserPlus className="size-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Add Staff Account</h3>
                  <p className="text-sm text-blue-200/70">Create volunteer or coordinator</p>
                </div>
              </div>

              <form onSubmit={createVolunteer} className="space-y-4">
                <div>
                  <label className="block text-sm text-blue-200 mb-2 font-medium">Full Name</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder:text-blue-300/40 outline-none transition-all duration-300 focus:border-white/30 focus:bg-white/10"
                    placeholder="Staff member name"
                    value={volunteerForm.full_name}
                    onChange={e => setVolunteerForm(p => ({ ...p, full_name: e.target.value }))}
                    required
                    minLength={2}
                  />
                </div>

                <div>
                  <label className="block text-sm text-blue-200 mb-2 font-medium">Login ID</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder:text-blue-300/40 outline-none transition-all duration-300 focus:border-white/30 focus:bg-white/10"
                    placeholder="Choose a login ID"
                    value={volunteerForm.login_id}
                    onChange={e => setVolunteerForm(p => ({ ...p, login_id: e.target.value }))}
                    required
                    minLength={3}
                  />
                </div>

                <div>
                  <label className="block text-sm text-blue-200 mb-2 font-medium">Password</label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      className="w-full px-4 py-3 pr-12 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder:text-blue-300/40 outline-none transition-all duration-300 focus:border-white/30 focus:bg-white/10"
                      placeholder="Min 6 characters"
                      value={volunteerForm.password}
                      onChange={e => setVolunteerForm(p => ({ ...p, password: e.target.value }))}
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(p => !p)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-200/70 hover:text-white transition-colors"
                    >
                      {showPass ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-blue-200 mb-2 font-medium">Role</label>
                  <select
                    className="w-full px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white outline-none transition-all duration-300 focus:border-white/30 focus:bg-white/10"
                    value={volunteerForm.role}
                    onChange={e => setVolunteerForm(p => ({ ...p, role: e.target.value }))}
                  >
                    <option value="tpo_volunteer" className="bg-[#2d3561]">TPO Volunteer</option>
                    <option value="tpo_coordinator" className="bg-[#2d3561]">TPO Coordinator</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    className="flex-1 py-3 bg-white/10 border border-white/20 text-white rounded-xl font-medium hover:bg-white/20 transition-all"
                    onClick={() => setShowVolunteerModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-medium shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 transition-all"
                  >
                    Create Account
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}