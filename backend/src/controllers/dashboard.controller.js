const pool = require('../config/db');

// GET /dashboard/summary?project_id=...
async function getSummary(req, res) {
  const { project_id } = req.query;
  const projectFilter = project_id ? `WHERE t.project_id = $1` : '';
  const projectFilterAnd = project_id ? `AND t.project_id = $1` : '';
  const params = project_id ? [project_id] : [];

  try {
    const [byStatus, byPriority, overdue, byAssignee] = await Promise.all([
      pool.query(`SELECT t.status, COUNT(*)::int AS count FROM tasks t ${projectFilter} GROUP BY t.status`, params),
      pool.query(`SELECT t.priority, COUNT(*)::int AS count FROM tasks t ${projectFilter} GROUP BY t.priority`, params),
      pool.query(
        `SELECT COUNT(*)::int AS count FROM tasks t
         WHERE t.due_date IS NOT NULL AND t.due_date < now() AND t.status != 'done' ${projectFilterAnd}`,
        params
      ),
      pool.query(
        `SELECT u.id, u.name, COUNT(t.id)::int AS count
         FROM users u
         LEFT JOIN task_assignees ta ON ta.user_id = u.id
         LEFT JOIN tasks t ON t.id = ta.task_id AND t.status != 'done' ${project_id ? 'AND t.project_id = $1' : ''}
         WHERE u.is_approved = TRUE
         GROUP BY u.id, u.name
         ORDER BY count DESC`,
        params
      ),
    ]);

    // normalize status/priority into fixed shapes so the frontend always
    // gets all four/three keys even if a bucket currently has zero tasks
    const statusCounts = { todo: 0, in_progress: 0, review: 0, done: 0 };
    byStatus.rows.forEach((r) => { statusCounts[r.status] = r.count; });

    const priorityCounts = { low: 0, medium: 0, high: 0 };
    byPriority.rows.forEach((r) => { priorityCounts[r.priority] = r.count; });

    res.json({
      totalTasks: Object.values(statusCounts).reduce((a, b) => a + b, 0),
      byStatus: statusCounts,
      byPriority: priorityCounts,
      overdueCount: overdue.rows[0].count,
      byAssignee: byAssignee.rows,
    });
  } catch (err) {
    console.error('Dashboard summary error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

// "What Y/M/D is it right now, in Bangkok" — independent of the server's
// own local timezone (the server generally runs in UTC; see the
// due-date-reminder timezone fix for the same pattern elsewhere).
function bangkokDateParts(date = new Date()) {
  const shifted = new Date(date.getTime() + BANGKOK_OFFSET_MS);
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth(), d: shifted.getUTCDate() };
}

// Builds the real UTC instant for Bangkok-local midnight on the given
// (year, month, day) — month is 0-indexed, and day/month can overflow
// (month 12, day 0, etc.) the same way `new Date(...)` normally allows.
function bangkokMidnightUTC(y, m, d) {
  return new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - BANGKOK_OFFSET_MS);
}

function getMonthPeriod(now = new Date()) {
  const { y, m } = bangkokDateParts(now);
  const start = bangkokMidnightUTC(y, m, 1);
  const end = bangkokMidnightUTC(y, m + 1, 1);
  const label = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' });
  return { start, end, label };
}

// One period's full report, aggregated across every project. "Period tasks"
// are whichever tasks belong to this stretch of time: due within it, or
// (for tasks with no due date at all) created within it — so ad hoc work
// without a due date still shows up somewhere instead of disappearing from
// every period-scoped breakdown.
async function buildPeriodReport(start, end) {
  const periodCTE = `
    WITH period_tasks AS (
      SELECT t.* FROM tasks t
      WHERE (t.due_date >= $1 AND t.due_date < $2)
         OR (t.due_date IS NULL AND t.created_at >= $1 AND t.created_at < $2)
    )
  `;
  const params = [start, end];

  const [created, completed, byStatus, byPriority, overdue, byProject, byAssignee] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS count FROM tasks WHERE created_at >= $1 AND created_at < $2`, params),
    pool.query(`SELECT COUNT(*)::int AS count FROM tasks WHERE completed_at >= $1 AND completed_at < $2`, params),
    pool.query(`${periodCTE} SELECT status, COUNT(*)::int AS count FROM period_tasks GROUP BY status`, params),
    pool.query(`${periodCTE} SELECT priority, COUNT(*)::int AS count FROM period_tasks GROUP BY priority`, params),
    pool.query(
      `${periodCTE} SELECT COUNT(*)::int AS count FROM period_tasks WHERE due_date < now() AND status != 'done'`,
      params
    ),
    pool.query(
      `${periodCTE}
       SELECT pt.project_id, p.name AS project_name,
              COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE pt.status = 'done')::int AS completed
       FROM period_tasks pt
       JOIN projects p ON p.id = pt.project_id
       GROUP BY pt.project_id, p.name
       ORDER BY total DESC`,
      params
    ),
    pool.query(
      `${periodCTE}
       SELECT u.id, u.name,
              COUNT(pt.id)::int AS total,
              COUNT(*) FILTER (WHERE pt.due_date < now() AND pt.status != 'done')::int AS overdue
       FROM period_tasks pt
       JOIN task_assignees ta ON ta.task_id = pt.id
       JOIN users u ON u.id = ta.user_id
       GROUP BY u.id, u.name
       ORDER BY total DESC
       LIMIT 12`,
      params
    ),
  ]);

  const statusCounts = { todo: 0, in_progress: 0, review: 0, done: 0 };
  byStatus.rows.forEach((r) => { statusCounts[r.status] = r.count; });

  const priorityCounts = { low: 0, medium: 0, high: 0 };
  byPriority.rows.forEach((r) => { priorityCounts[r.priority] = r.count; });

  return {
    start,
    end,
    totalCreated: created.rows[0].count,
    totalCompleted: completed.rows[0].count,
    overdueCount: overdue.rows[0].count,
    byStatus: statusCounts,
    byPriority: priorityCounts,
    byProject: byProject.rows,
    byAssignee: byAssignee.rows,
  };
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_RANGE_DAYS = 366 * 5;

// 'YYYY-MM-DD' → { y, m (0-indexed), d } or null when it isn't a real date
function parseDateParam(value) {
  const match = DATE_RE.exec(value || '');
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]) - 1;
  const d = Number(match[3]);
  const check = new Date(Date.UTC(y, m, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m || check.getUTCDate() !== d) return null;
  return { y, m, d };
}

function formatRangeLabel(from, to) {
  const fmt = (p) =>
    new Date(Date.UTC(p.y, p.m, p.d)).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  return from.y === to.y && from.m === to.m && from.d === to.d ? fmt(from) : `${fmt(from)} – ${fmt(to)}`;
}

// GET /dashboard/overview?from=YYYY-MM-DD&to=YYYY-MM-DD — consolidated,
// all-projects report for the chosen date range (both days included, in
// Bangkok time). With no range it defaults to the current month.
async function getOverview(req, res) {
  try {
    const now = new Date();
    let start;
    let end;
    let label;
    let fromStr;
    let toStr;

    if (req.query.from || req.query.to) {
      const from = parseDateParam(req.query.from);
      const to = parseDateParam(req.query.to);
      if (!from || !to) {
        return res.status(400).json({ message: 'from and to must both be dates in YYYY-MM-DD format.' });
      }
      start = bangkokMidnightUTC(from.y, from.m, from.d);
      end = bangkokMidnightUTC(to.y, to.m, to.d + 1); // end is exclusive
      if (end <= start) {
        return res.status(400).json({ message: 'The end date cannot be before the start date.' });
      }
      if ((end - start) / 86400000 > MAX_RANGE_DAYS) {
        return res.status(400).json({ message: 'Please choose a range of 5 years or less.' });
      }
      label = formatRangeLabel(from, to);
      fromStr = req.query.from;
      toStr = req.query.to;
    } else {
      const month = getMonthPeriod(now);
      start = month.start;
      end = month.end;
      label = month.label;
      const { y, m } = bangkokDateParts(now);
      const pad = (n) => String(n).padStart(2, '0');
      fromStr = `${y}-${pad(m + 1)}-01`;
      toStr = `${y}-${pad(m + 1)}-${pad(new Date(Date.UTC(y, m + 1, 0)).getUTCDate())}`;
    }

    const [totalsRow, period] = await Promise.all([
      pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM projects) AS projects,
          (SELECT COUNT(*)::int FROM tasks) AS tasks,
          (SELECT COUNT(*)::int FROM tasks WHERE status = 'done') AS completed,
          (SELECT COUNT(*)::int FROM tasks WHERE due_date IS NOT NULL AND due_date < now() AND status != 'done') AS overdue
      `),
      buildPeriodReport(start, end),
    ]);

    res.json({
      generatedAt: now.toISOString(),
      totals: totalsRow.rows[0],
      period: { label, from: fromStr, to: toStr, ...period },
    });
  } catch (err) {
    console.error('Dashboard overview error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { getSummary, getOverview };
