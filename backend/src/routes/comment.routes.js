const express = require('express');
const { authenticate } = require('../middleware/auth');
const { listComments, createComment } = require('../controllers/comment.controller');

// mergeParams so this router can read :taskId from the parent mount
const router = express.Router({ mergeParams: true });

router.use(authenticate);

router.get('/', listComments);       // GET  /tasks/:taskId/comments
router.post('/', createComment);     // POST /tasks/:taskId/comments

module.exports = router;
