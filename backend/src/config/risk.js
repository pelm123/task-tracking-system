// Rule-based due-date risk scoring for open tasks. Pure functions (no DB, no
// clock) so they are easy to test. Each task gets a score, a level
// (low / medium / high) and a list of reasons. Reasons are { code, params }
// so the frontend can show them in the user's language.

const HOUR = 3600 * 1000;
const DEFAULT_DURATION_DAYS = 3; // assumed typical task length until enough tasks have finished
const MIN_HISTORY = 3;           // finished tasks needed before history is trusted

// Share of a task's typical duration that is still ahead of it, by status.
const REMAINING_SHARE = { todo: 1, in_progress: 0.6, review: 0.2 };

const HIGH_AT = 60;
const MEDIUM_AT = 30;

function levelFor(score) {
  if (score >= HIGH_AT) return 'high';
  if (score >= MEDIUM_AT) return 'medium';
  return 'low';
}

// task: { status, priority, due_date, assignees: [{id}] }
// ctx:  { openLoad: Map(userId -> open task count), medianDays: number|null }
function scoreTask(task, ctx = {}, nowMs = Date.now()) {
  if (!task || task.status === 'done') return null;

  const reasons = [];
  let score = 0;
  const add = (points, code, params = {}) => {
    score += points;
    reasons.push({ code, params });
  };

  if (task.due_date) {
    const hoursLeft = (new Date(task.due_date).getTime() - nowMs) / HOUR;

    if (hoursLeft < 0) {
      add(60, 'overdue', { days: Math.max(1, Math.round(-hoursLeft / 24)) });
    } else {
      const medianDays = ctx.medianDays != null ? ctx.medianDays : DEFAULT_DURATION_DAYS;
      const neededHours = medianDays * 24 * (REMAINING_SHARE[task.status] ?? 1);
      const ratio = hoursLeft > 0 ? neededHours / hoursLeft : Infinity;

      if (ratio >= 1) {
        add(40, 'timeTight', { days: Math.round(medianDays * 10) / 10, hours: Math.round(hoursLeft) });
      } else if (ratio >= 0.5) {
        add(25, 'timeGettingTight', { hours: Math.round(hoursLeft) });
      }
      if (task.status === 'todo' && hoursLeft <= 48) {
        add(30, 'notStarted', { hours: Math.round(hoursLeft) });
      }
    }
  }

  const assignees = task.assignees || [];
  if (assignees.length === 0) {
    if (task.due_date && new Date(task.due_date).getTime() - nowMs <= 72 * HOUR) {
      add(10, 'unassigned');
    }
  } else if (ctx.openLoad) {
    const worst = Math.max(...assignees.map((a) => ctx.openLoad.get(a.id) || 0));
    if (worst >= 8) add(20, 'overloaded', { n: worst });
    else if (worst >= 5) add(10, 'busy', { n: worst });
  }

  if (task.priority === 'high' && score > 0) add(10, 'highPriority');

  return { score, level: levelFor(score), reasons };
}

module.exports = { scoreTask, levelFor, MIN_HISTORY, DEFAULT_DURATION_DAYS };
