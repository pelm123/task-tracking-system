const cron = require('node-cron');
const pool = require('../config/db');
const { notifyLineIfLinked } = require('../config/line');

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
    // Each task carries its own reminder_hours_before (defaults to 24,
    // editable per task — see TaskDetailModal's "Remind me" field), so the
    // window and the notified-already dedup window both use that column
    // instead of one fixed constant for every task.
    const result = await pool.query(
      `SELECT t.id, t.title, t.due_date, t.priority, t.reminder_hours_before, ta.user_id AS assignee_id
       FROM tasks t
       JOIN task_assignees ta ON ta.task_id = t.id
       WHERE t.status != 'done'
         AND t.due_date IS NOT NULL
         AND t.due_date BETWEEN now() AND now() + (t.reminder_hours_before || ' hours')::interval
         AND NOT EXISTS (
           SELECT 1 FROM notifications n
           WHERE n.task_id = t.id
             AND n.user_id = ta.user_id
             AND n.type = 'due_soon'
             AND n.created_at > now() - (t.reminder_hours_before || ' hours')::interval
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
  // runs every 15 minutes rather than hourly — now that reminder windows
  // are custom per task (as short as 1 hour), an hourly check was too
  // coarse to reliably catch a short lead time within its own window
  cron.schedule('*/15 * * * *', checkDueSoonTasks);
  console.log('[due-date-check] scheduler started (runs every 15 minutes)');
}

module.exports = { startDueDateScheduler, checkDueSoonTasks };
