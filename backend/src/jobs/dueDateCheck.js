const cron = require('node-cron');
const pool = require('../config/db');

const DUE_SOON_WINDOW_HOURS = 24;

async function checkDueSoonTasks() {
  try {
    // Tasks due within the next 24h, not done, that don't already have
    // a due_soon notification created in the last 24h (avoid spamming).
    const result = await pool.query(
      `SELECT t.id, t.title, t.due_date, t.assignee_id
       FROM tasks t
       WHERE t.status != 'done'
         AND t.assignee_id IS NOT NULL
         AND t.due_date IS NOT NULL
         AND t.due_date BETWEEN now() AND now() + interval '${DUE_SOON_WINDOW_HOURS} hours'
         AND NOT EXISTS (
           SELECT 1 FROM notifications n
           WHERE n.task_id = t.id
             AND n.type = 'due_soon'
             AND n.created_at > now() - interval '${DUE_SOON_WINDOW_HOURS} hours'
         )`
    );

    for (const task of result.rows) {
      await pool.query(
        `INSERT INTO notifications (user_id, task_id, type, message)
         VALUES ($1, $2, 'due_soon', $3)`,
        [task.assignee_id, task.id, `Task "${task.title}" is due soon`]
      );
    }

    if (result.rows.length > 0) {
      console.log(`[due-date-check] created ${result.rows.length} due_soon notification(s)`);
    }
  } catch (err) {
    console.error('[due-date-check] error:', err.message);
  }
}

function startDueDateScheduler() {
  // runs every hour, on the hour
  cron.schedule('0 * * * *', checkDueSoonTasks);
  console.log('[due-date-check] scheduler started (runs hourly)');
}

module.exports = { startDueDateScheduler, checkDueSoonTasks };
