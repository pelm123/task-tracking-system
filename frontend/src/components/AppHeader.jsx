import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import { useTheme } from '../context/ThemeContext';
import styles from './appHeader.module.css';

export default function AppHeader() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  return (
    <div className={styles.header}>
      <div className={styles.left}>
        <NavLink to="/home" className={styles.brand} style={{ textDecoration: 'none' }}>
          Task Tracker
        </NavLink>

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
        <button
          type="button"
          className={styles.themeBtn}
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
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
