const express = require('express');
const { authenticate } = require('../middleware/auth');
const { getSummary, getOverview } = require('../controllers/dashboard.controller');

const router = express.Router();

router.use(authenticate);
router.get('/summary', getSummary);
router.get('/overview', getOverview);

module.exports = router;
