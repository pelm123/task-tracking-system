import { useLang } from '../context/LanguageContext';
import styles from './languageToggle.module.css';

// Floating TH / EN switch for the pages that have no app header (login,
// register).
export default function LanguageToggle() {
  const { lang, toggleLang, t } = useLang();
  return (
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
  );
}
