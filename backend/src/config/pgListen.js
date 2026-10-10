const { Client } = require('pg');

// Subscribes to Postgres NOTIFY channels on a dedicated connection (LISTEN
// can't share the pool) and reconnects by itself if the connection drops.
//
//   listen({ new_notification: (payload) => ..., task_event: (payload) => ... })
function listen(handlers, label = 'pg-listen') {
  const channels = Object.keys(handlers);
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
      const handler = handlers[msg.channel];
      if (!handler || !msg.payload) return;
      Promise.resolve(handler(msg.payload)).catch((err) =>
        console.error(`[${label}] ${msg.channel} handler error:`, err.message)
      );
    });
    client.on('error', (err) => {
      console.error(`[${label}] connection error:`, err.message);
      client.end().catch(() => {});
      scheduleRetry();
    });
    client.on('end', scheduleRetry);

    try {
      await client.connect();
      for (const ch of channels) await client.query(`LISTEN ${ch}`);
      console.log(`[${label}] listening on: ${channels.join(', ')}`);
    } catch (err) {
      console.error(`[${label}] could not start:`, err.message);
      client.end().catch(() => {});
      scheduleRetry();
    }
  }

  connect();
}

module.exports = { listen };
