const express = require('express');
const { authenticate } = require('../middleware/auth');
const { getSummary } = require('../controllers/dashboard.controller');

const router = express.Router();

router.use(authenticate);
router.get('/summary', getSummary);

module.exports = router;
