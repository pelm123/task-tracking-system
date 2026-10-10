// Notification service: in-app notifications, LINE (webhook, linking,
// delivery), the due-date scheduler, and all real-time Socket.IO delivery.
const express = require('express');
const { runService } = require('./base');

runService({
  name: 'notifications',
  beforeJson(app) {
    // LINE's signature check needs the exact raw bytes, so the webhook is
    // mounted with express.raw() BEFORE express.json()
    const { handleWebhook } = require('../controllers/line.controller');
    app.post('/line/webhook', express.raw({ type: 'application/json' }), handleWebhook);
  },
  mount(app) {
    app.use('/notifications', require('../routes/notification.routes'));
    app.use('/line', require('../routes/line.routes'));
  },
  onListen(server, app) {
    const { attachRealtime } = require('../config/realtime');
    const { startNotificationPush } = require('../config/notificationPush');
    const { startTaskEventRelay } = require('../config/taskEvents');
    const { startLineDelivery } = require('../config/lineDelivery');
    const { startDueDateScheduler } = require('../jobs/dueDateCheck');

    const io = attachRealtime(server);
    app.set('io', io);
    startNotificationPush(io);
    startTaskEventRelay(io);
    startLineDelivery();
    startDueDateScheduler();
  },
});
