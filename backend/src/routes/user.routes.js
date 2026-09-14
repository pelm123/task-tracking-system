const express = require('express');
const { authenticate } = require('../middleware/auth');
const { listUsers } = require('../controllers/user.controller');

const router = express.Router();

router.use(authenticate);
router.get('/', listUsers);

module.exports = router;
