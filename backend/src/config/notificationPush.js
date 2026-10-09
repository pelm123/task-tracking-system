const { Client } = require('pg');

// Listens for the Postgres NOTIFY fired by the trigger on `notifications`
// (migration 015) and tells the recipient's browser tabs to refresh right
// away. Uses its own dedicated connection (LISTEN can't share the pool) and
// reconnects by itself if the database connection drops.
function startNotificationPush(io) {
  let retryTimer = null;

  async function connect() {
    const client = new Client({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.POSTGRES_DB || 'task_tracker',
      user: process.env.POSTGRES_USER || 'app',
      password: process.env.POSTGRES_PASSWORD || 'changeme',
    });

    function scheduleRetry() {
      if (retryTimer) return;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        connect();
      }, 5000);
    }

    client.on('notification', (msg) => {
      if (msg.channel === 'new_notification' && msg.payload) {
        io.to(`user:${msg.payload}`).emit('notification:new');
      }
    });
    client.on('error', (err) => {
      console.error('Notification push connection error:', err.message);
      client.end().catch(() => {});
      scheduleRetry();
    });
    client.on('end', scheduleRetry);

    try {
      await client.connect();
      await client.query('LISTEN new_notification');
      console.log('Instant notifications: listening');
    } catch (err) {
      console.error('Notification push could not start:', err.message);
      client.end().catch(() => {});
      scheduleRetry();
    }
  }

  connect();
}

module.exports = { startNotificationPush };
