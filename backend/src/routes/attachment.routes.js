const express = require('express');
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const { upload, MAX_FILE_SIZE_MB } = require('../middleware/upload');
const {
  listAttachments,
  uploadAttachment,
  downloadAttachment,
  previewAttachment,
  deleteAttachment,
} = require('../controllers/attachment.controller');

// Wraps upload.single('file') so a too-large file (or any other multer
// failure) comes back as a clean JSON error instead of a stack trace / the
// default Express HTML error page.
function handleUpload(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: `File is too large. The limit is ${MAX_FILE_SIZE_MB} MB.` });
    }
    console.error('Upload middleware error:', err.message);
    return res.status(400).json({ message: 'Could not upload that file.' });
  });
}

// Nested under /tasks/:taskId/attachments
const taskAttachmentRouter = express.Router({ mergeParams: true });
taskAttachmentRouter.use(authenticate);
taskAttachmentRouter.get('/', listAttachments);
taskAttachmentRouter.post('/', handleUpload, uploadAttachment);

// Top-level /attachments/:id
const attachmentByIdRouter = express.Router();
attachmentByIdRouter.use(authenticate);
attachmentByIdRouter.get('/:id/download', downloadAttachment);
attachmentByIdRouter.get('/:id/preview', previewAttachment);
attachmentByIdRouter.delete('/:id', deleteAttachment);

module.exports = { taskAttachmentRouter, attachmentByIdRouter };
