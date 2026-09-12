const express = require('express');
const { authenticate } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const {
  listAttachments,
  uploadAttachment,
  downloadAttachment,
  deleteAttachment,
} = require('../controllers/attachment.controller');

// Nested under /tasks/:taskId/attachments
const taskAttachmentRouter = express.Router({ mergeParams: true });
taskAttachmentRouter.use(authenticate);
taskAttachmentRouter.get('/', listAttachments);
taskAttachmentRouter.post('/', upload.single('file'), uploadAttachment);

// Top-level /attachments/:id
const attachmentByIdRouter = express.Router();
attachmentByIdRouter.use(authenticate);
attachmentByIdRouter.get('/:id/download', downloadAttachment);
attachmentByIdRouter.delete('/:id', deleteAttachment);

module.exports = { taskAttachmentRouter, attachmentByIdRouter };
