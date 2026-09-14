const pool = require('../config/db');

// GET /dashboard/summary
async function getSummary(req, res) {
  try {
    const [byStatus, byPriority, overdue, byAssignee] = await Promise.all([
      pool.query(`SELECT status, COUNT(*)::int AS count FROM tasks GROUP BY status`),
      pool.query(`SELECT priority, COUNT(*)::int AS count FROM tasks GROUP BY priority`),
      pool.query(
        `SELECT COUNT(*)::int AS count FROM tasks
         WHERE due_date IS NOT NULL AND due_date < now() AND status != 'done'`
      ),
      pool.query(
        `SELECT u.id, u.name, COUNT(t.id)::int AS count
         FROM users u
         LEFT JOIN tasks t ON t.assignee_id = u.id AND t.status != 'done'
         GROUP BY u.id, u.name
         ORDER BY count DESC`
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
