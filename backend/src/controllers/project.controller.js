const pool = require('../config/db');
const { pickProjectColor, HEX_COLOR } = require('../config/projectColors');

// GET /projects
async function listProjects(req, res) {
  try {
    const result = await pool.query(
      `SELECT p.id, p.name, p.color, p.description, p.created_by, p.created_at,
              COUNT(t.id)::int AS task_count
       FROM projects p
       LEFT JOIN tasks t ON t.project_id = p.id
       GROUP BY p.id
       ORDER BY p.created_at ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List projects error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// Keep in sync with projects.name VARCHAR(500) and the form's maxLength.
const MAX_PROJECT_NAME_LENGTH = 500;

// POST /projects
async function createProject(req, res) {
  const { name, description } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'name is required' });
  }
  if (name.trim().length > MAX_PROJECT_NAME_LENGTH) {
    return res.status(400).json({
      message: `Project name is too long (${name.trim().length} characters). The limit is ${MAX_PROJECT_NAME_LENGTH}.`,
    });
  }

  try {
    const used = await pool.query('SELECT color FROM projects');
    const color = pickProjectColor(used.rows.map((r) => r.color));

    const result = await pool.query(
      `INSERT INTO projects (name, color, description, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, color, description, created_by, created_at`,
      [name.trim(), color, description || null, req.user.id]
    );
    res.status(201).json({ ...result.rows[0], task_count: 0 });
  } catch (err) {
    console.error('Create project error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// PATCH /projects/:id
async function updateProject(req, res) {
  const { name, description, color } = req.body;
  if (color !== undefined && color !== null && !HEX_COLOR.test(color)) {
    return res.status(400).json({ message: 'color must be a hex value like #4C8DFF' });
  }
  if (name !== undefined && name !== null && name.trim().length > MAX_PROJECT_NAME_LENGTH) {
    return res.status(400).json({
      message: `Project name is too long (${name.trim().length} characters). The limit is ${MAX_PROJECT_NAME_LENGTH}.`,
    });
  }

  try {
    const result = await pool.query(
      `UPDATE projects SET
         name = COALESCE($1, name),
         description = COALESCE($2, description),
         color = COALESCE($3, color)
       WHERE id = $4
       RETURNING id, name, color, description, created_by, created_at`,
      [name, description, color, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Project not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update project error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// DELETE /projects/:id — admin/pm only (also deletes all its tasks via CASCADE)
async function deleteProject(req, res) {
  try {
    const result = await pool.query('DELETE FROM projects WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Project not found' });
    }
    res.status(204).send();
  } catch (err) {
    console.error('Delete project error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// GET /projects/:id/activity
async function getActivity(req, res) {
  try {
    const result = await pool.query(
      `(SELECT 'task_created' AS type, t.title AS task_title, u.name AS actor_name, t.created_at AS at
        FROM tasks t JOIN users u ON u.id = t.created_by
        WHERE t.project_id = $1)
       UNION ALL
       (SELECT 'comment' AS type, t.title AS task_title, u.name AS actor_name, c.created_at AS at
        FROM comments c
        JOIN tasks t ON t.id = c.task_id
        JOIN users u ON u.id = c.user_id
        WHERE t.project_id = $1)
       ORDER BY at DESC
       LIMIT 15`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get activity error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { listProjects, createProject, updateProject, deleteProject, getActivity };
