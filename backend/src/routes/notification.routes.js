const express = require('express');
const { authenticate } = require('../middleware/auth');
const { listNotifications, markAsRead, markAllAsRead } = require('../controllers/notification.controller');

const router = express.Router();

router.use(authenticate);

router.get('/', listNotifications);           // GET   /notifications
router.patch('/read-all', markAllAsRead);      // PATCH /notifications/read-all
router.patch('/:id/read', markAsRead);         // PATCH /notifications/:id/read

module.exports = router;
