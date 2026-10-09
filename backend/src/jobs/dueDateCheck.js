const cron = require('node-cron');
const pool = require('../config/db');
const { notify } = require('../config/notify');

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
      await notify(task.assignee_id, {
        taskId: task.id,
        type: 'due_soon',
        emoji: '⏰',
        build: (L) =>
          L.tr('n.dueSoon', { title: task.title, due: L.due(task.due_date), priority: L.priority(task.priority) }),
      });
    }

    if (result.rows.length > 0) {
      console.log(`[due-date-check] created ${result.rows.length} due_soon notification(s)`);
    }
  } catch (err) {
    console.error('[due-date-check] error:', err.message);
  }
}

// Tells people when a task has slipped past its due date. Runs on the same
// every-minute tick as the due-soon reminders.
//
// Who hears about it: everyone assigned to the task, plus whoever created it
// (usually the PM who is chasing it). Each person is told ONCE per due date:
// the de-dup looks for an 'overdue' notification created after the task's
// current due_date, so if the due date is pushed back and then missed again,
// they're notified again — but they aren't re-notified every minute.
//
// Note: the first run after deploying also catches up on tasks that were
// already overdue, so people get one notification for each of those.
async function checkOverdueTasks() {
  try {
    const result = await pool.query(
      `SELECT t.id, t.title, t.due_date, t.priority, r.user_id
       FROM tasks t
       JOIN LATERAL (
         SELECT user_id FROM task_assignees WHERE task_id = t.id
         UNION
         SELECT t.created_by
       ) r ON r.user_id IS NOT NULL
       JOIN users u ON u.id = r.user_id AND u.is_approved = TRUE
       WHERE t.status != 'done'
         AND t.due_date IS NOT NULL
         AND t.due_date < now()
         AND NOT EXISTS (
           SELECT 1 FROM notifications n
           WHERE n.task_id = t.id
             AND n.user_id = r.user_id
             AND n.type = 'overdue'
             AND n.created_at > t.due_date
         )`
    );

    for (const task of result.rows) {
      await notify(task.user_id, {
        taskId: task.id,
        type: 'overdue',
        emoji: '🚨',
        build: (L) =>
          L.tr('n.overdue', { title: task.title, due: L.due(task.due_date), priority: L.priority(task.priority) }),
      });
    }

    if (result.rows.length > 0) {
      console.log(`[overdue-check] created ${result.rows.length} overdue notification(s)`);
    }
  } catch (err) {
    console.error('[overdue-check] error:', err.message);
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
  cron.schedule('* * * * *', async () => {
    await checkDueSoonTasks();
    await checkOverdueTasks();
  });
  console.log('[due-date-check] scheduler started (runs every minute)');
}

module.exports = { startDueDateScheduler, checkDueSoonTasks, checkOverdueTasks };
