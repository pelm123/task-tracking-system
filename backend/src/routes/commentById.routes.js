const express = require('express');
const { authenticate } = require('../middleware/auth');
const { deleteComment } = require('../controllers/comment.controller');

const router = express.Router();

router.use(authenticate);

router.delete('/:id', deleteComment); // DELETE /comments/:id

module.exports = router;
