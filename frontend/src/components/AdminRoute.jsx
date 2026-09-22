import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Admin: full access. PM: allowed in (task management), but AdminPage itself
// hides/blocks the Users tab for anyone who isn't "admin".
export default function AdminRoute({ children }) {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!['admin', 'pm'].includes(user.role)) {
    return <Navigate to="/board" replace />;
  }
  return children;
}
