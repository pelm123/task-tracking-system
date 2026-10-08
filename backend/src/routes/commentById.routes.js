const express = require('express');
const { authenticate } = require('../middleware/auth');
const { updateComment, deleteComment } = require('../controllers/comment.controller');

const router = express.Router();

router.use(authenticate);

router.patch('/:id', updateComment); // PATCH /comments/:id
router.delete('/:id', deleteComment); // DELETE /comments/:id

module.exports = router;
