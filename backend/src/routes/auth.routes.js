const express = require('express');
const { register, login } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const pool = require('../config/db');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);

// quick sanity-check route to confirm the JWT middleware works end to end
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Me error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
