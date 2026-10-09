import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import { useTheme } from '../context/ThemeContext';
import { useLang } from '../context/LanguageContext';
import styles from './appHeader.module.css';

export default function AppHeader() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { lang, toggleLang, t } = useLang();
  return (
    <div className={styles.header}>
      <div className={styles.left}>
        <NavLink to="/home" className={styles.brand} style={{ textDecoration: 'none' }}>
          {t('nav.brand')}
        </NavLink>

        <nav className={styles.nav}>
          <NavLink
            to="/home"
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
          >
            {t('nav.home')}
          </NavLink>
          <NavLink
            to="/board"
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
          >
            {t('nav.board')}
          </NavLink>
          <NavLink
            to="/calendar"
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
          >
            {t('nav.calendar')}
          </NavLink>
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
          >
            {t('nav.dashboard')}
          </NavLink>
          {['admin', 'pm'].includes(user?.role) && (
            <NavLink
              to="/admin"
              className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
            >
              {t('nav.admin')}
            </NavLink>
          )}
        </nav>
      </div>

      <div className={styles.right}>
        <button
          type="button"
          className={styles.themeBtn}
          onClick={toggleTheme}
          title={theme === 'dark' ? t('header.switchToLight') : t('header.switchToDark')}
          aria-label={theme === 'dark' ? t('header.switchToLight') : t('header.switchToDark')}
        >
          <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
          {theme === 'dark' ? t('header.lightMode') : t('header.darkMode')}
        </button>
        <button
          type="button"
          className={styles.themeBtn}
          onClick={toggleLang}
          title={t('header.switchLanguage')}
          aria-label={t('header.switchLanguage')}
        >
          <span aria-hidden="true">🌐</span>
          {lang === 'th' ? 'ไทย' : 'EN'}
        </button>
        <NotificationBell />
        <NavLink to="/profile" className={styles.userLabel} style={{ textDecoration: 'none' }}>
          {user?.name} · {t(`roles.${user?.role}`)}
        </NavLink>
        <button className="btn btn-ghost" onClick={logout}>
          {t('header.logout')}
        </button>
      </div>
    </div>
  );
}
