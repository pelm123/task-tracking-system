const path = require('path');
const fs = require('fs');
const pool = require('../config/db');
const { UPLOAD_DIR } = require('../middleware/upload');

// GET /tasks/:taskId/attachments
async function listAttachments(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, file_name, file_size, mime_type, uploaded_by, created_at
       FROM attachments
       WHERE task_id = $1
       ORDER BY created_at DESC`,
      [req.params.taskId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List attachments error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// POST /tasks/:taskId/attachments  (multipart/form-data, field name "file")
async function uploadAttachment(req, res) {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded (expected field name "file")' });
  }

  try {
    const taskCheck = await pool.query('SELECT id FROM tasks WHERE id = $1', [req.params.taskId]);
    if (taskCheck.rows.length === 0) {
      fs.unlinkSync(req.file.path); // clean up orphaned upload
      return res.status(404).json({ message: 'Task not found' });
    }

    const result = await pool.query(
      `INSERT INTO attachments (task_id, uploaded_by, file_name, file_path, file_size, mime_type)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, file_name, file_size, mime_type, created_at`,
      [req.params.taskId, req.user.id, req.file.originalname, req.file.filename, req.file.size, req.file.mimetype]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Upload attachment error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// GET /attachments/:id/download
async function downloadAttachment(req, res) {
  try {
    const result = await pool.query(
      'SELECT file_name, file_path, mime_type FROM attachments WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Attachment not found' });
    }
    const { file_name, file_path, mime_type } = result.rows[0];
    const fullPath = path.join(UPLOAD_DIR, file_path);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ message: 'File missing from disk' });
    }

    res.setHeader('Content-Type', mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${file_name}"`);
    res.sendFile(fullPath);
  } catch (err) {
    console.error('Download attachment error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// DELETE /attachments/:id
async function deleteAttachment(req, res) {
  try {
    const result = await pool.query(
      'DELETE FROM attachments WHERE id = $1 RETURNING file_path',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Attachment not found' });
    }

    const fullPath = path.join(UPLOAD_DIR, result.rows[0].file_path);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);

    res.status(204).send();
  } catch (err) {
    console.error('Delete attachment error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { listAttachments, uploadAttachment, downloadAttachment, deleteAttachment };
