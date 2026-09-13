const pool = require('../config/db');

// GET /notifications?unread=true
async function listNotifications(req, res) {
  const { unread } = req.query;
  const conditions = ['user_id = $1'];
  const values = [req.user.id];

  if (unread === 'true') {
    conditions.push('is_read = false');
  }

  try {
    const result = await pool.query(
      `SELECT id, task_id, type, message, is_read, created_at
       FROM notifications
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC`,
      values
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List notifications error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// PATCH /notifications/:id/read
async function markAsRead(req, res) {
  try {
    const result = await pool.query(
      `UPDATE notifications SET is_read = true
       WHERE id = $1 AND user_id = $2
       RETURNING id, is_read`,
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Mark notification read error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// PATCH /notifications/read-all
async function markAllAsRead(req, res) {
  try {
    await pool.query(
      `UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`,
      [req.user.id]
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('Mark all read error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { listNotifications, markAsRead, markAllAsRead };
