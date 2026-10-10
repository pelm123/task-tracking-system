// Password policy shared by sign-up and password change. The frontend mirrors
// these rules (frontend/src/utils/passwordPolicy.js) to show a live checklist,
// but this file is the one that is enforced.

const MIN_LENGTH = 8;
// bcrypt only hashes the first 72 bytes; anything past that would be ignored
// silently, so longer passwords are refused instead
const MAX_BYTES = 72;

// A short list of passwords that pass the character rules but are among the
// first ones an attacker tries.
const COMMON = new Set([
  'password1!', 'password123!', 'p@ssw0rd', 'p@ssword1', 'passw0rd!',
  'qwerty123!', 'welcome1!', 'welcome123!', 'admin123!', 'letmein1!',
  'abc12345!', 'iloveyou1!', 'changeme1!', 'qwerty1!', 'test1234!',
]);

// Returns an English error message (translated by the localize middleware),
// or null when the password is acceptable. `email` and `name` keep people from
// using their own details as the password.
function validatePassword(password, { email, name } = {}) {
  if (typeof password !== 'string' || password.length === 0) {
    return 'Password is required';
  }
  if (password.length < MIN_LENGTH) {
    return `Password must be at least ${MIN_LENGTH} characters`;
  }
  if (Buffer.byteLength(password, 'utf8') > MAX_BYTES) {
    return 'Password is too long';
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return 'Password must contain an uppercase letter, a lowercase letter, a number and a symbol';
  }
  if (/^\s|\s$/.test(password)) {
    return 'Password cannot start or end with a space';
  }

  const lower = password.toLowerCase();
  if (COMMON.has(lower)) {
    return 'This password is too common. Choose another one';
  }
  const emailUser = typeof email === 'string' ? email.trim().toLowerCase().split('@')[0] : '';
  const nameLower = typeof name === 'string' ? name.trim().toLowerCase() : '';
  if ((emailUser.length >= 3 && lower.includes(emailUser)) || (nameLower.length >= 3 && lower.includes(nameLower))) {
    return 'Password must not contain your name or email';
  }
  return null;
}

module.exports = { validatePassword, MIN_LENGTH };
