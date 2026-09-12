const pool = require('../config/db');

// GET /tasks/:taskId/comments
async function listComments(req, res) {
  try {
    const result = await pool.query(
      `SELECT c.id, c.content, c.created_at, c.user_id, u.name AS author_name
       FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.task_id = $1
       ORDER BY c.created_at ASC`,
      [req.params.taskId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List comments error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// POST /tasks/:taskId/comments
async function createComment(req, res) {
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ message: 'content is required' });
  }

  try {
    const taskCheck = await pool.query('SELECT id, assignee_id, title FROM tasks WHERE id = $1', [req.params.taskId]);
    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }
    const task = taskCheck.rows[0];

    const result = await pool.query(
      `INSERT INTO comments (task_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, content, created_at, user_id`,
      [req.params.taskId, req.user.id, content.trim()]
    );

    // notify the assignee (if there is one, and they didn't just comment on their own task)
    if (task.assignee_id && task.assignee_id !== req.user.id) {
      await pool.query(
        `INSERT INTO notifications (user_id, task_id, type, message)
         VALUES ($1, $2, 'comment', $3)`,
        [task.assignee_id, task.id, `New comment on "${task.title}"`]
      );
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create comment error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// DELETE /comments/:id
async function deleteComment(req, res) {
  try {
    const result = await pool.query(
      'DELETE FROM comments WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Comment not found or not yours to delete' });
    }
    res.status(204).send();
  } catch (err) {
    console.error('Delete comment error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { listComments, createComment, deleteComment };
