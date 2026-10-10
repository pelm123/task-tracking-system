const { listen } = require('./pgListen');

// Listens for the Postgres NOTIFY fired by the trigger on `notifications`
// (migration 015) and tells the recipient's browser tabs to refresh right
// away.
function startNotificationPush(io) {
  listen(
    {
      new_notification: (userId) => {
        io.to(`user:${userId}`).emit('notification:new');
      },
    },
    'notification-push'
  );
}

module.exports = { startNotificationPush };
