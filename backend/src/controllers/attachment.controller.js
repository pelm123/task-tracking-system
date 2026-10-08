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

// Browsers send multipart filenames as UTF-8, but multer/busboy decodes the
// field as Latin-1 by default, so any non-ASCII name (Thai, emoji, accents,
// ...) comes out mangled — "à¸£à¸°à¸..." instead of "ระบบ...". Re-decoding the
// bytes as UTF-8 recovers the original text.
function fixFilenameEncoding(name) {
  return Buffer.from(name, 'latin1').toString('utf8');
}

// HTTP header VALUES are only allowed to contain Latin-1/ASCII bytes — Node
// throws ("Invalid character in header content") if you hand setHeader a
// raw Thai (or any non-Latin-1) filename. This is what broke preview/
// download right after the filename-encoding fix above started storing the
// real Thai text instead of mojibake (which, being made of accented Latin-1
// characters, had accidentally been "valid" as a header value).
//
// The fix, per RFC 6266 / 5987: send an ASCII-only fallback in `filename=`
// for older clients, plus the real UTF-8 name, percent-encoded, in
// `filename*=`. Every modern browser uses the UTF-8 one.
function contentDispositionHeader(disposition, fileName) {
  const asciiFallback = fileName.replace(/[^\x20-\x7E]/g, '_');
  const encoded = encodeURIComponent(fileName);
  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

// POST /tasks/:taskId/attachments  (multipart/form-data, field name "file")
async function uploadAttachment(req, res) {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded (expected field name "file")' });
  }

  try {
    const taskCheck = await pool.query('SELECT id, created_by FROM tasks WHERE id = $1', [req.params.taskId]);
    if (taskCheck.rows.length === 0) {
      fs.unlinkSync(req.file.path); // clean up orphaned upload
      return res.status(404).json({ message: 'Task not found' });
    }

    // A member who isn't assigned to this task AND didn't create it can't
    // upload files to it. The task's own creator can always upload, even
    // before anyone is assigned. PM/admin can upload to anything.
    if (req.user.role === 'member' && taskCheck.rows[0].created_by !== req.user.id) {
      const assignedCheck = await pool.query(
        'SELECT 1 FROM task_assignees WHERE task_id = $1 AND user_id = $2',
        [req.params.taskId, req.user.id]
      );
      if (assignedCheck.rows.length === 0) {
        fs.unlinkSync(req.file.path); // clean up the upload we're about to refuse
        return res.status(403).json({ message: 'You can only upload files to tasks you are assigned to.' });
      }
    }

    const result = await pool.query(
      `INSERT INTO attachments (task_id, uploaded_by, file_name, file_path, file_size, mime_type)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, file_name, file_size, mime_type, created_at`,
      [
        req.params.taskId,
        req.user.id,
        fixFilenameEncoding(req.file.originalname),
        req.file.filename,
        req.file.size,
        req.file.mimetype,
      ]
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
    res.setHeader('Content-Disposition', contentDispositionHeader('attachment', file_name));
    res.sendFile(fullPath);
  } catch (err) {
    console.error('Download attachment error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// GET /attachments/:id/preview — like download, but only ever serves
// images and PDFs, and sets Content-Disposition: inline so the browser
// renders it directly instead of triggering a save-as. Anything else
// (docs, spreadsheets, zips, etc.) isn't previewable, so this just 400s and
// the frontend falls back to the regular download.
function isPreviewable(mimeType) {
  return Boolean(mimeType) && (mimeType.startsWith('image/') || mimeType === 'application/pdf');
}

async function previewAttachment(req, res) {
  try {
    const result = await pool.query(
      'SELECT file_name, file_path, mime_type FROM attachments WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Attachment not found' });
    }
    const { file_name, file_path, mime_type } = result.rows[0];

    if (!isPreviewable(mime_type)) {
      return res.status(400).json({ message: 'This file type cannot be previewed.' });
    }

    const fullPath = path.join(UPLOAD_DIR, file_path);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ message: 'File missing from disk' });
    }

    res.setHeader('Content-Type', mime_type);
    res.setHeader('Content-Disposition', contentDispositionHeader('inline', file_name));
    res.sendFile(fullPath);
  } catch (err) {
    console.error('Preview attachment error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// DELETE /attachments/:id
// Who can delete a file: admin/pm (any attachment), the person who
// uploaded it (their own upload, regardless of assignment), or anyone
// assigned to / who created the task it's attached to. A member with none
// of those is blocked — mirrors the same assigned-or-creator pattern used
// for editing a task, commenting, and uploading in the first place.
async function deleteAttachment(req, res) {
  try {
    const existing = await pool.query(
      `SELECT a.file_path, a.task_id, a.uploaded_by, t.created_by
       FROM attachments a
       JOIN tasks t ON t.id = a.task_id
       WHERE a.id = $1`,
      [req.params.id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Attachment not found' });
    }
    const { file_path, task_id, uploaded_by, created_by } = existing.rows[0];

    if (req.user.role === 'member') {
      const isUploader = uploaded_by === req.user.id;
      const isTaskCreator = created_by === req.user.id;
      let isAssignee = false;
      if (!isUploader && !isTaskCreator) {
        const assignedCheck = await pool.query(
          'SELECT 1 FROM task_assignees WHERE task_id = $1 AND user_id = $2',
          [task_id, req.user.id]
        );
        isAssignee = assignedCheck.rows.length > 0;
      }
      if (!isUploader && !isTaskCreator && !isAssignee) {
        return res.status(403).json({
          message: 'You can only delete files you uploaded, or files on tasks you are assigned to.',
        });
      }
    }

    await pool.query('DELETE FROM attachments WHERE id = $1', [req.params.id]);

    const fullPath = path.join(UPLOAD_DIR, file_path);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);

    res.status(204).send();
  } catch (err) {
    console.error('Delete attachment error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { listAttachments, uploadAttachment, downloadAttachment, previewAttachment, deleteAttachment };
