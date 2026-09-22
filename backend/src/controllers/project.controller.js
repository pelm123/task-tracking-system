const pool = require('../config/db');

// GET /projects
async function listProjects(req, res) {
  try {
    const result = await pool.query(
      `SELECT p.id, p.name, p.description, p.created_by, p.created_at,
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

// POST /projects
async function createProject(req, res) {
  const { name, description } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'name is required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO projects (name, description, created_by)
       VALUES ($1, $2, $3)
       RETURNING id, name, description, created_by, created_at`,
      [name.trim(), description || null, req.user.id]
    );
    res.status(201).json({ ...result.rows[0], task_count: 0 });
  } catch (err) {
    console.error('Create project error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// PATCH /projects/:id
async function updateProject(req, res) {
  const { name, description } = req.body;

  try {
    const result = await pool.query(
      `UPDATE projects SET
         name = COALESCE($1, name),
         description = COALESCE($2, description)
       WHERE id = $3
       RETURNING id, name, description, created_by, created_at`,
      [name, description, req.params.id]
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

module.exports = { listProjects, createProject, updateProject, deleteProject };
