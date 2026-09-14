const pool = require('../config/db');

// GET /users — minimal fields only, used to populate assignee dropdowns etc.
async function listUsers(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, name, email, role FROM users ORDER BY name ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List users error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { listUsers };
