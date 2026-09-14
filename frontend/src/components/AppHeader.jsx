import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './appHeader.module.css';

export default function AppHeader() {
  const { user, logout } = useAuth();

  return (
    <div className={styles.header}>
      <div className={styles.left}>
        <span className={styles.brand}>Task Tracker</span>
        <nav className={styles.nav}>
          <NavLink
            to="/board"
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
            }
          >
            Board
          </NavLink>
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
            }
          >
            Dashboard
          </NavLink>
        </nav>
      </div>
      <div className={styles.right}>
        <span className={styles.userLabel}>
          {user?.name} · {user?.role}
        </span>
        <button className={styles.iconBtn} onClick={logout}>
          Log out
        </button>
      </div>
    </div>
  );
}
