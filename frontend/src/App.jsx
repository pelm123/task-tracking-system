import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProjectProvider } from './context/ProjectContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import BoardPage from './pages/BoardPage';
import CalendarPage from './pages/CalendarPage';
import DashboardPage from './pages/DashboardPage';
import AdminPage from './pages/AdminPage';
import ProfilePage from './pages/ProfilePage';
import AppHeader from './components/AppHeader';
import { useLang } from './context/LanguageContext';
import styles from './components/appHeader.module.css';

function AuthedLayout({ children, managerOnly }) {
  const { lang } = useLang();
  // key={lang}: remount the page body when the language changes so every
  // string and date helper re-evaluates; the header and auth state stay put.
  const content = (
    <ProjectProvider>
      <div className={styles.appShell}>
        <AppHeader />
        <div key={lang} className={styles.appBody}>{children}</div>
      </div>
    </ProjectProvider>
  );
  return managerOnly ? (
    <AdminRoute>{content}</AdminRoute>
  ) : (
    <ProtectedRoute>{content}</ProtectedRoute>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/home"
            element={
              <AuthedLayout>
                <HomePage />
              </AuthedLayout>
            }
          />
          <Route
            path="/board"
            element={
              <AuthedLayout>
                <BoardPage />
              </AuthedLayout>
            }
          />
          <Route
            path="/calendar"
            element={
              <AuthedLayout>
                <CalendarPage />
              </AuthedLayout>
            }
          />
          <Route
            path="/dashboard"
            element={
              <AuthedLayout>
                <DashboardPage />
              </AuthedLayout>
            }
          />
          <Route
            path="/admin"
            element={
              <AuthedLayout managerOnly>
                <AdminPage />
              </AuthedLayout>
            }
          />
          <Route
            path="/profile"
            element={
              <AuthedLayout>
                <ProfilePage />
              </AuthedLayout>
            }
          />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
