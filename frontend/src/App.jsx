import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/common/Navbar';
import ProtectedRoute from './components/common/ProtectedRoute';
import PWAInstallPrompt from './components/common/PWAInstallPrompt';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import StudentDashboard from './pages/student/StudentDashboard';
import AdminDashboard from './pages/admin/AdminDashboard';
import VolunteerDashboard from './pages/volunteer/VolunteerDashboard';
import CoordinatorDashboard from './pages/coordinator/CoordinatorDashboard';

const RoleRedirect = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const paths = { student: '/student', tpo_admin: '/admin', tpo_volunteer: '/volunteer', tpo_coordinator: '/coordinator' };
  return <Navigate to={paths[user.role] || '/login'} replace />;
};

const Layout = ({ children }) => (
  <>
    <Navbar />
    <main>{children}</main>
    <PWAInstallPrompt />
  </>
);

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-center" toastOptions={{ duration: 3500, style: { borderRadius: '10px', fontFamily: 'Inter, sans-serif' } }} />
        <Routes>
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route element={<ProtectedRoute allowedRoles={['student']} />}>
            <Route path="/student" element={<Layout><StudentDashboard /></Layout>} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['tpo_admin']} />}>
            <Route path="/admin" element={<Layout><AdminDashboard /></Layout>} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['tpo_volunteer', 'tpo_admin']} />}>
            <Route path="/volunteer" element={<Layout><VolunteerDashboard /></Layout>} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['tpo_coordinator', 'tpo_admin']} />}>
            <Route path="/coordinator" element={<Layout><CoordinatorDashboard /></Layout>} />
          </Route>

          <Route path="/unauthorized" element={
            <div className="min-h-screen flex items-center justify-center">
              <div className="text-center"><h1 className="text-4xl font-bold text-error">403</h1><p>Access Denied</p></div>
            </div>
          } />

          <Route path="/" element={<RoleRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
