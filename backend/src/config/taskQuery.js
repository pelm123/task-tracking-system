const pool = require('./db');

// shared SELECT fragment: aggregates every row in task_assignees into a
// single JSON array per task, e.g. [{"id": "...", "name": "Alice"}, ...]
// so one query returns a task with all of its assignees, in any count.
const ASSIGNEES_SUBQUERY = `
  COALESCE(
    (SELECT json_agg(json_build_object('id', u.id, 'name', u.name) ORDER BY u.name)
     FROM task_assignees ta
     JOIN users u ON u.id = ta.user_id
     WHERE ta.task_id = t.id),
    '[]'
  ) AS assignees
`;

async function getEnrichedTask(id) {
  const result = await pool.query(
    `SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date,
            t.reminder_hours_before,
            t.project_id, p.name AS project_name,
            t.created_by, c.name AS creator_name,
            t.created_at, t.updated_at, t.completed_at,
            ${ASSIGNEES_SUBQUERY}
     FROM tasks t
     LEFT JOIN users c ON c.id = t.created_by
     LEFT JOIN projects p ON p.id = t.project_id
     WHERE t.id = $1`,
    [id]
  );
  return result.rows[0];
}

module.exports = { ASSIGNEES_SUBQUERY, getEnrichedTask };
