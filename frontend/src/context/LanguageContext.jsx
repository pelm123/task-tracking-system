import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { readStoredLang, storeLang, setCurrentLang, t as translate, getLocale } from '../i18n';

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

  const setLang = useCallback((next) => setLangState(next), []);
  const toggleLang = useCallback(() => setLangState((l) => (l === 'th' ? 'en' : 'th')), []);

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
