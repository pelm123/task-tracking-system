import { useLang } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import styles from './authToggles.module.css';

// Floating theme and TH / EN switches for the pages that have no app header
// (login, register). Same choices as the header's buttons.
export default function AuthToggles() {
  const { lang, toggleLang, t } = useLang();
  const { theme, toggleTheme } = useTheme();
  const themeLabel = theme === 'dark' ? t('header.switchToLight') : t('header.switchToDark');

  return (
    <div className={styles.bar}>
      <button type="button" className={styles.toggle} onClick={toggleTheme} title={themeLabel} aria-label={themeLabel}>
        <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
        {theme === 'dark' ? t('header.lightMode') : t('header.darkMode')}
      </button>
      <button
        type="button"
        className={styles.toggle}
        onClick={toggleLang}
        title={t('header.switchLanguage')}
        aria-label={t('header.switchLanguage')}
      >
        <span aria-hidden="true">🌐</span>
        {lang === 'th' ? 'ไทย' : 'EN'}
      </button>
    </div>
  );
}
