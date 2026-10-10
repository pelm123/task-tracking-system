const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { normalizeLang, LANGS } = require('../config/i18n');
const { validatePassword } = require('../config/password');
const { lockedMinutes, recordFailure, clearFailures } = require('../config/loginThrottle');

const SALT_ROUNDS = 12;
const TOKEN_EXPIRY = '7d';

// Compared against when the email has no account, so a login for an unknown
// email takes as long as a wrong password and can't be used to find accounts.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', SALT_ROUNDS);

function isFilledString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

async function register(req, res) {
  const { name, email, password, confirmPassword, role } = req.body;

  if (!isFilledString(name) || !isFilledString(email) || typeof password !== 'string' || !password) {
    return res.status(400).json({ message: 'name, email, and password are required' });
  }
  // the form asks for the password twice; the server checks it too so a
  // typo can't lock someone out of a brand-new account
  if (password !== confirmPassword) {
    return res.status(400).json({ message: 'Passwords do not match' });
  }
  const passwordError = validatePassword(password, { email, name });
  if (passwordError) {
    return res.status(400).json({ message: passwordError });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const userRole = role === 'pm' ? 'pm' : 'member'; // "admin" can only be granted via the admin panel

    // Accounts start unapproved: no token is issued, and login is refused
    // until an admin approves the account from the Admin page.
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role, is_approved, language)
       VALUES ($1, $2, $3, $4, FALSE, $5)`,
      // new accounts start in the language the sign-up page was shown in
      [name.trim(), email.trim().toLowerCase(), passwordHash, userRole, normalizeLang(req.lang)]
    );

    res.status(201).json({
      pending: true,
      message: 'Account created. Please wait for an admin to approve it before logging in.',
    });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function login(req, res) {
  const { email, password } = req.body;

  if (!isFilledString(email) || typeof password !== 'string' || !password) {
    return res.status(400).json({ message: 'email and password are required' });
  }

  const minutes = lockedMinutes(email);
  if (minutes > 0) {
    return res.status(429).json({
      message: `Too many failed sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    });
  }

  try {
    const result = await pool.query(
      'SELECT id, name, email, password_hash, role, is_approved, language FROM users WHERE LOWER(email) = LOWER($1)',
      [email.trim()]
    );

    const user = result.rows[0];
    const passwordMatches = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

    if (!user || !passwordMatches) {
      recordFailure(email);
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    clearFailures(email);

    // Checked only after the password matches, so this message can't be used
    // to probe which emails have accounts.
    if (!user.is_approved) {
      return res.status(403).json({
        code: 'PENDING_APPROVAL',
        message: 'Your account is waiting for an admin to approve it. You can log in once it has been approved.',
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, language: user.language },
      token,
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// PATCH /auth/me — update own name
async function updateProfile(req, res) {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'name is required' });
  }

  try {
    const result = await pool.query(
      `UPDATE users SET name = $1 WHERE id = $2
       RETURNING id, name, email, role, language, created_at`,
      [name.trim(), req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update profile error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// PATCH /auth/me/language — save the interface language ('th' | 'en'); it is
// also the language this user's notifications and LINE messages are written in
async function updateLanguage(req, res) {
  const { language } = req.body;
  if (!LANGS.includes(language)) {
    return res.status(400).json({ message: 'language must be "th" or "en"' });
  }

  try {
    const result = await pool.query(
      'UPDATE users SET language = $1 WHERE id = $2 RETURNING language',
      [language, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ language: result.rows[0].language });
  } catch (err) {
    console.error('Update language error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// PATCH /auth/me/password — change own password
async function changePassword(req, res) {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  if (typeof currentPassword !== 'string' || !currentPassword || typeof newPassword !== 'string' || !newPassword) {
    return res.status(400).json({ message: 'currentPassword and newPassword are required' });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: 'Passwords do not match' });
  }
  if (newPassword === currentPassword) {
    return res.status(400).json({ message: 'New password must be different from the current one' });
  }

  try {
    const result = await pool.query('SELECT name, email, password_hash FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const matches = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!matches) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    const passwordError = validatePassword(newPassword, result.rows[0]);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user.id]);
    res.json({ message: 'Password updated' });
  } catch (err) {
    console.error('Change password error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { register, login, updateProfile, updateLanguage, changePassword };
