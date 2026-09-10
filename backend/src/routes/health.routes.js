const express = require('express');
const pool = require('../config/db');

const router = express.Router();

router.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS server_time');
    res.json({
      status: 'ok',
      db: 'connected',
      server_time: result.rows[0].server_time,
    });
  } catch (err) {
    console.error('Health check DB error:', err.message);
    res.status(500).json({ status: 'error', db: 'disconnected', message: err.message });
  }
});

module.exports = router;
