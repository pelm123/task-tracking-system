const pool = require('../config/db');

// GET /users — minimal fields only, used to populate assignee dropdowns etc.
async function listUsers(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, name, email, role, created_at FROM users ORDER BY name ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List users error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// PATCH /users/:id — admin only
async function updateUserRole(req, res) {
  const { role } = req.body;
  if (!['admin', 'pm', 'member'].includes(role)) {
    return res.status(400).json({ message: 'role must be "admin", "pm", or "member"' });
  }

  try {
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

module.exports = { listUsers, updateUserRole, deleteUser };
