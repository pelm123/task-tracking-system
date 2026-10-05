const cron = require('node-cron');
const pool = require('../config/db');
const { notifyLineIfLinked } = require('../config/line');

const DUE_SOON_WINDOW_HOURS = 24;

function formatDueDate(dueDate) {
  return new Date(dueDate).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

async function checkDueSoonTasks() {
  try {
    const result = await pool.query(
      `SELECT t.id, t.title, t.due_date, t.priority, t.assignee_id
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
      const priorityLabel = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);
      const message = `"${task.title}" is due ${formatDueDate(task.due_date)} (${priorityLabel} priority)`;
      await pool.query(
        `INSERT INTO notifications (user_id, task_id, type, message)
         VALUES ($1, $2, 'due_soon', $3)`,
        [task.assignee_id, task.id, message]
      );
      notifyLineIfLinked(task.assignee_id, `⏰ ${message}`);
    }

    if (result.rows.length > 0) {
      console.log(`[due-date-check] created ${result.rows.length} due_soon notification(s)`);
    }
  } catch (err) {
    console.error('[due-date-check] error:', err.message);
  }
}

function startDueDateScheduler() {
  cron.schedule('0 * * * *', checkDueSoonTasks);
  console.log('[due-date-check] scheduler started (runs hourly)');
}

module.exports = { startDueDateScheduler, checkDueSoonTasks };
