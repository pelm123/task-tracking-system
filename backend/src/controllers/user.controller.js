const bcrypt = require('bcrypt');
const pool = require('../config/db');
const { validatePassword } = require('../config/password');

const SALT_ROUNDS = 12;

// how many approved admins exist besides `excludeId`
async function otherAdminCount(excludeId) {
  const r = await pool.query(
    "SELECT COUNT(*)::int AS n FROM users WHERE role = 'admin' AND is_approved = TRUE AND id <> $1",
    [excludeId]
  );
  return r.rows[0].n;
}

// GET /users — minimal fields only, used to populate assignee dropdowns etc.
async function listUsers(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, name, email, role, created_at FROM users WHERE is_approved = TRUE ORDER BY name ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List users error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// GET /users/pending — admin only: sign-ups still waiting for approval
async function listPendingUsers(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, name, email, role, created_at FROM users
       WHERE is_approved = FALSE ORDER BY created_at ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List pending users error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// PATCH /users/:id/approve — admin only. (Rejecting a sign-up is the existing
// DELETE /users/:id, which also frees the email to register again.)
async function approveUser(req, res) {
  try {
    const result = await pool.query(
      `UPDATE users SET is_approved = TRUE WHERE id = $1
       RETURNING id, name, email, role, created_at`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Approve user error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// PATCH /users/:id — admin only
async function updateUserRole(req, res) {
  const { role } = req.body;
  if (!['admin', 'pm', 'member'].includes(role)) {
    return res.status(400).json({ message: 'role must be "admin", "pm", or "member"' });
  }

  if (req.params.id === req.user.id) {
    return res.status(400).json({ message: "You can't change your own role" });
  }

  try {
    // never leave the system without an admin
    if (role !== 'admin') {
      const target = await pool.query('SELECT role FROM users WHERE id = $1', [req.params.id]);
      if (target.rows[0]?.role === 'admin' && (await otherAdminCount(req.params.id)) === 0) {
        return res.status(400).json({ message: 'There must always be at least one admin.' });
      }
    }

    const result = await pool.query(
      `UPDATE users SET role = $1::user_role WHERE id = $2
       RETURNING id, name, email, role, created_at`,
      [role, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update user role error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// DELETE /users/:id — manager only
async function deleteUser(req, res) {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ message: "You can't delete your own account" });
  }

  try {
    const target = await pool.query('SELECT role FROM users WHERE id = $1', [req.params.id]);
    if (target.rows[0]?.role === 'admin' && (await otherAdminCount(req.params.id)) === 0) {
      return res.status(400).json({ message: 'There must always be at least one admin.' });
    }

    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(204).send();
  } catch (err) {
    console.error('Delete user error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// PATCH /users/:id/password — admin only. Sets a new password for someone
// who has forgotten theirs (there's no email-based reset).
async function resetUserPassword(req, res) {
  const { newPassword } = req.body;
  try {
    const target = await pool.query('SELECT name, email FROM users WHERE id = $1', [req.params.id]);
    if (target.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    // same rules as sign-up, checked against the person whose password it is
    const passwordError = validatePassword(newPassword, target.rows[0]);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const result = await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id', [
      hash,
      req.params.id,
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(204).send();
  } catch (err) {
    console.error('Reset password error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { listUsers, listPendingUsers, approveUser, updateUserRole, deleteUser, resetUserPassword };
