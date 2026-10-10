const pool = require('./db');
const { listen } = require('./pgListen');
const { notifyLineIfLinked } = require('./line');

// LINE outbox consumer (migration 017). Notifications that want a LINE push
// have `line_emoji` set; the trigger announces their id and this sends it,
// honouring the user's LINE preferences. Runs in the Notification service
// (and in the single-process dev server).
function startLineDelivery() {
  listen(
    {
      line_outbox: async (id) => {
        const { rows } = await pool.query(
          'SELECT user_id, type, message, line_emoji FROM notifications WHERE id = $1',
          [id]
        );
        const n = rows[0];
        if (!n || !n.line_emoji) return;
        await notifyLineIfLinked(n.user_id, `${n.line_emoji} ${n.message}`, n.type);
      },
    },
    'line-delivery'
  );
}

module.exports = { startLineDelivery };
