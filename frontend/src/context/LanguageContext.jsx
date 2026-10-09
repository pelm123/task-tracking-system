import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { readStoredLang, storeLang, setCurrentLang, t as translate, getLocale, getLang, SUPPORTED_LANGS } from '../i18n';
import * as authApi from '../api/auth';

const LanguageContext = createContext(null);

// Thai is the default; the choice is remembered in this browser. The module
// level language (used by date helpers and other non-React code) is updated
// synchronously during render so children never see a stale language.
export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(readStoredLang);
  setCurrentLang(lang);

  useEffect(() => {
    document.documentElement.setAttribute('lang', lang);
    storeLang(lang);
  }, [lang]);

  // The language is also saved on the account, because the server writes
  // notifications and LINE messages in it. Saving is fire-and-forget: the
  // interface switches immediately and a failed save never blocks anything.
  // `sync: false` is used when adopting the language the server already has
  // (right after login).
  const setLang = useCallback((next, { sync = true } = {}) => {
    if (!SUPPORTED_LANGS.includes(next)) return;
    setCurrentLang(next); // module-level copy first, so the request below already carries the new language
    setLangState(next);
    if (!sync) return;
    try {
      if (!localStorage.getItem('token')) return;
      const stored = JSON.parse(localStorage.getItem('user') || 'null');
      if (stored) localStorage.setItem('user', JSON.stringify({ ...stored, language: next }));
    } catch (err) {
      // storage unavailable — the server copy below is what matters
    }
    authApi.updateLanguage(next).catch(() => {});
  }, []);
  const toggleLang = useCallback(() => setLang(getLang() === 'th' ? 'en' : 'th'), [setLang]);

  const value = useMemo(
    () => ({ lang, setLang, toggleLang, locale: getLocale(lang), t: translate }),
    [lang, setLang, toggleLang]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLang must be used inside LanguageProvider');
  return ctx;
}
