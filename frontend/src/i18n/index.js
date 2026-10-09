import en from './en.json';
import th from './th.json';

// Plain (non-React) i18n core. Components use useLang() from
// context/LanguageContext; utilities and non-React code can import
// `t` / `getLocale` from here directly.

export const SUPPORTED_LANGS = ['th', 'en'];
export const DEFAULT_LANG = 'th';
const STORAGE_KEY = 'lang';

const DICTS = { en, th };

// BCP-47 locale for Intl / toLocale*String. The Thai locale is forced to the
// Gregorian calendar so years read 2026, not 2569 (Buddhist era).
const LOCALES = { en: 'en-GB', th: 'th-TH-u-ca-gregory' };

export function readStoredLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return SUPPORTED_LANGS.includes(saved) ? saved : DEFAULT_LANG;
  } catch (err) {
    return DEFAULT_LANG;
  }
}

export function storeLang(lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch (err) {
    // storage blocked — the choice just won't persist
  }
}

let currentLang = readStoredLang();

export function getLang() {
  return currentLang;
}

export function setCurrentLang(lang) {
  if (SUPPORTED_LANGS.includes(lang)) currentLang = lang;
}

export function getLocale(lang = currentLang) {
  return LOCALES[lang] || LOCALES.en;
}

function lookup(dict, key) {
  return key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), dict);
}

// t('dates.dueIn', { text: '3d' }). Falls back to English, then to the key
// itself, so a missing Thai string never renders blank.
export function t(key, params) {
  let str = lookup(DICTS[currentLang], key);
  if (typeof str !== 'string') str = lookup(DICTS.en, key);
  if (typeof str !== 'string') return key;
  if (params) {
    str = str.replace(/\{(\w+)\}/g, (m, name) => (params[name] != null ? String(params[name]) : m));
  }
  return str;
}
