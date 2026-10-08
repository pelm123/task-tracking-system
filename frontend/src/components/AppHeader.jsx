import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ProjectSwitcher from './ProjectSwitcher';
import NotificationBell from './NotificationBell';
import styles from './appHeader.module.css';

export default function AppHeader() {
  const { user, logout } = useAuth();
  const canManageProjects = ['admin', 'pm'].includes(user?.role);

  return (
    <div className={styles.header}>
      <div className={styles.left}>
        <NavLink to="/home" className={styles.brand} style={{ textDecoration: 'none' }}>
          Task Tracker
        </NavLink>

        <ProjectSwitcher canManageProjects={canManageProjects} />

        <nav className={styles.nav}>
          <NavLink
            to="/home"
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
          >
            Home
          </NavLink>
          <NavLink
            to="/board"
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
          >
            Board
          </NavLink>
          <NavLink
            to="/calendar"
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
          >
            Calendar
          </NavLink>
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
          >
            Dashboard
          </NavLink>
          {['admin', 'pm'].includes(user?.role) && (
            <NavLink
              to="/admin"
              className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
            >
              Admin
            </NavLink>
          )}
        </nav>
      </div>

      <div className={styles.right}>
        <NotificationBell />
        <NavLink to="/profile" className={styles.userLabel} style={{ textDecoration: 'none' }}>
          {user?.name} · {user?.role}
        </NavLink>
        <button className="btn btn-ghost" onClick={logout}>
          Log out
        </button>
      </div>
    </div>
  );
}
