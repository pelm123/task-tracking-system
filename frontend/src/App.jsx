import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import BoardPage from './pages/BoardPage';
import DashboardPage from './pages/DashboardPage';
import AppHeader from './components/AppHeader';
import styles from './components/appHeader.module.css';

function AuthedLayout({ children }) {
  return (
    <ProtectedRoute>
      <AppHeader />
      <div className={styles.appBody}>{children}</div>
    </ProtectedRoute>
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
            path="/board"
            element={
              <AuthedLayout>
                <BoardPage />
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
          <Route path="*" element={<Navigate to="/board" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
