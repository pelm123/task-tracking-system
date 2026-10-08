const cron = require('node-cron');
const pool = require('../config/db');
const { notifyLineIfLinked } = require('../config/line');

function formatDueDate(dueDate) {
  // Without an explicit timeZone, toLocaleString renders in the SERVER's
  // local time (often UTC), not the user's — so a 6:00 PM Bangkok due date
  // showed up in the LINE message as 11:00 AM. Pin it to Bangkok time so the
  // notification always matches what the app shows in the browser.
  return new Date(dueDate).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok',
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
      notifyLineIfLinked(task.assignee_id, `⏰ ${message}`, 'due_soon');
    }

    if (result.rows.length > 0) {
      console.log(`[due-date-check] created ${result.rows.length} due_soon notification(s)`);
    }
  } catch (err) {
    console.error('[due-date-check] error:', err.message);
  }
}

function startDueDateScheduler() {
  // Runs every minute. Reminder windows are custom per task (as short as
  // 1 hour), and people expect a reminder to show up right away once it's
  // "due" for notifying — a 15-minute tick meant waiting up to 15 minutes
  // for something that should feel close to instant. The query is cheap
  // (filtered to tasks due within their own reminder window, with the
  // NOT EXISTS de-dup check), so running it every minute is fine at this
  // scale.
  cron.schedule('* * * * *', checkDueSoonTasks);
  console.log('[due-date-check] scheduler started (runs every minute)');
}

module.exports = { startDueDateScheduler, checkDueSoonTasks };
