const pool = require('./db');

// Records one line in a task's activity log ("who did what, when"). The log
// is a nice-to-have, so a failure here is logged but never breaks the request.
async function logActivity(taskId, userId, action, detail = null) {
  try {
    await pool.query(
      'INSERT INTO task_activity (task_id, user_id, action, detail) VALUES ($1, $2, $3, $4)',
      [taskId, userId, action, detail]
    );
  } catch (err) {
    console.error('Activity log error:', err.message);
  }
}

module.exports = { logActivity };
