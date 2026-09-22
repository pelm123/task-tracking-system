const pool = require('../config/db');

const VALID_STATUSES = ['todo', 'in_progress', 'review', 'done'];
const VALID_PRIORITIES = ['low', 'medium', 'high'];

// GET /tasks?status=todo&assignee_id=...
async function listTasks(req, res) {
  const { status, assignee_id } = req.query;
  const conditions = [];
  const values = [];

  if (status) {
    values.push(status);
    conditions.push(`status = $${values.length}`);
  }
  if (assignee_id) {
    values.push(assignee_id);
    conditions.push(`assignee_id = $${values.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const result = await pool.query(
      `SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date,
              t.assignee_id, a.name AS assignee_name,
              t.created_by, c.name AS creator_name,
              t.created_at, t.updated_at
       FROM tasks t
       LEFT JOIN users a ON a.id = t.assignee_id
       LEFT JOIN users c ON c.id = t.created_by
       ${whereClause}
       ORDER BY t.created_at DESC`,
      values
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List tasks error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// GET /tasks/:id
async function getTask(req, res) {
  try {
    const result = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get task error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// POST /tasks
async function createTask(req, res) {
  const { title, description, priority, due_date, assignee_id } = req.body;

  if (!title) {
    return res.status(400).json({ message: 'title is required' });
  }
  if (priority && !VALID_PRIORITIES.includes(priority)) {
    return res.status(400).json({ message: `priority must be one of ${VALID_PRIORITIES.join(', ')}` });
  }

  try {
    const result = await pool.query(
      `INSERT INTO tasks (title, description, priority, due_date, assignee_id, created_by)
       VALUES ($1, $2, COALESCE($3::task_priority, 'medium'), $4, $5, $6)
       RETURNING *`,
      [title, description || null, priority, due_date || null, assignee_id || null, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create task error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// PATCH /tasks/:id  (general edit: title, description, priority, due_date, assignee_id)
async function updateTask(req, res) {
  const { title, description, priority, due_date, assignee_id } = req.body;

  if (priority && !VALID_PRIORITIES.includes(priority)) {
    return res.status(400).json({ message: `priority must be one of ${VALID_PRIORITIES.join(', ')}` });
  }

  try {
    const result = await pool.query(
      `UPDATE tasks SET
         title = COALESCE($1, title),
         description = COALESCE($2, description),
         priority = COALESCE($3::task_priority, priority),
         due_date = COALESCE($4, due_date),
         assignee_id = COALESCE($5, assignee_id)
       WHERE id = $6
       RETURNING *`,
      [title, description, priority, due_date, assignee_id, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update task error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// PATCH /tasks/:id/status  (dedicated endpoint for Kanban drag-and-drop)
async function updateTaskStatus(req, res) {
  const { status } = req.body;

  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ message: `status must be one of ${VALID_STATUSES.join(', ')}` });
  }

  try {
    const result = await pool.query(
      `UPDATE tasks SET status = $1::task_status WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Insert a status_change notification for the assignee (if any)
    const task = result.rows[0];
    if (task.assignee_id) {
      await pool.query(
        `INSERT INTO notifications (user_id, task_id, type, message)
         VALUES ($1, $2, 'status_change', $3)`,
        [task.assignee_id, task.id, `Task "${task.title}" moved to ${status}`]
      );
    }

    res.json(task);
  } catch (err) {
    console.error('Update task status error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// DELETE /tasks/:id — admin/pm, or the task's own creator
async function deleteTask(req, res) {
  try {
    const existing = await pool.query('SELECT created_by FROM tasks WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const isPrivileged = ['admin', 'pm'].includes(req.user.role);
    const isOwner = existing.rows[0].created_by === req.user.id;
    if (!isPrivileged && !isOwner) {
      return res.status(403).json({ message: 'Only an admin, PM, or the task creator can delete this task' });
    }

    await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
    res.status(204).send();
  } catch (err) {
    console.error('Delete task error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { listTasks, getTask, createTask, updateTask, updateTaskStatus, deleteTask };
