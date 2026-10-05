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

module.exports = { getSummary };
