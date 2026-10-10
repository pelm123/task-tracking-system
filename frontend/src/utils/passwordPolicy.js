// Mirrors backend/src/config/password.js so the form can show which rules a
// password still misses. The server enforces the same rules (plus a check
// against common passwords), so this is only for feedback.

export const PASSWORD_MIN_LENGTH = 8;
const MAX_BYTES = 72; // bcrypt ignores anything past 72 bytes

function byteLength(value) {
  return new TextEncoder().encode(value).length;
}

// Returns [{ key, ok }] in display order; `key` is the translation key under
// "password." in the i18n dictionaries.
export function checkPassword(password, { email = '', name = '' } = {}) {
  const lower = password.toLowerCase();
  const emailUser = email.trim().toLowerCase().split('@')[0];
  const nameLower = name.trim().toLowerCase();
  const containsPersonal =
    (emailUser.length >= 3 && lower.includes(emailUser)) || (nameLower.length >= 3 && lower.includes(nameLower));

  return [
    { key: 'ruleLength', ok: password.length >= PASSWORD_MIN_LENGTH && byteLength(password) <= MAX_BYTES },
    { key: 'ruleUpper', ok: /[A-Z]/.test(password) },
    { key: 'ruleLower', ok: /[a-z]/.test(password) },
    { key: 'ruleNumber', ok: /[0-9]/.test(password) },
    { key: 'ruleSymbol', ok: /[^A-Za-z0-9]/.test(password) },
    { key: 'rulePersonal', ok: password.length > 0 && !containsPersonal && !/^\s|\s$/.test(password) },
  ];
}

export function isPasswordValid(password, personal) {
  return checkPassword(password, personal).every((rule) => rule.ok);
}
