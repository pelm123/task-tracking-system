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

// Thai government fiscal year: 1 Oct – 30 Sep, named after the Buddhist-era
// year it ENDS in (e.g. 1 Oct 2026 – 30 Sep 2027 AD is "ปีงบประมาณ 2570").
function getFiscalYearPeriod(now = new Date()) {
  const { y, m } = bangkokDateParts(now); // m is 0-indexed; October = 9
  const startYear = m >= 9 ? y : y - 1;
  const endYear = startYear + 1;
  const start = bangkokMidnightUTC(startYear, 9, 1);
  const end = bangkokMidnightUTC(endYear, 9, 1);
  const beYear = endYear + 543;
  const label = `FY${beYear} (Oct ${startYear} – Sep ${endYear})`;
  return { start, end, label, beYear };
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

// GET /dashboard/overview — consolidated, all-projects report for the
// current month and the current Thai government fiscal year.
async function getOverview(req, res) {
  try {
    const now = new Date();
    const monthPeriod = getMonthPeriod(now);
    const fyPeriod = getFiscalYearPeriod(now);

    const [totalsRow, month, fiscalYear] = await Promise.all([
      pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM projects) AS projects,
          (SELECT COUNT(*)::int FROM tasks) AS tasks,
          (SELECT COUNT(*)::int FROM tasks WHERE status = 'done') AS completed,
          (SELECT COUNT(*)::int FROM tasks WHERE due_date IS NOT NULL AND due_date < now() AND status != 'done') AS overdue
      `),
      buildPeriodReport(monthPeriod.start, monthPeriod.end),
      buildPeriodReport(fyPeriod.start, fyPeriod.end),
    ]);

    res.json({
      generatedAt: now.toISOString(),
      totals: totalsRow.rows[0],
      month: { label: monthPeriod.label, ...month },
      fiscalYear: { label: fyPeriod.label, beYear: fyPeriod.beYear, ...fiscalYear },
    });
  } catch (err) {
    console.error('Dashboard overview error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { getSummary, getOverview };
