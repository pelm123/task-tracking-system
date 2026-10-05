const express = require('express');
const { authenticate } = require('../middleware/auth');
const { getLinkCode, unlink } = require('../controllers/line.controller');

const router = express.Router();

// NOTE: the webhook itself (POST /line/webhook) is mounted separately in
// server.js with express.raw() BEFORE the global express.json() middleware,
// since LINE's signature check needs the exact raw request bytes. This
// router only holds the authenticated account-linking endpoints.

router.get('/link-code', authenticate, getLinkCode);
router.delete('/link', authenticate, unlink);

module.exports = router;
