const crypto = require('crypto');
const pool = require('../config/db');
const { verifySignature, pushToLine } = require('../config/line');

// GET /line/link-code — authenticated user gets (or reuses) a short code to
// send to the LINE bot, which links their LINE account to this app account
async function getLinkCode(req, res) {
  try {
    const existing = await pool.query(
      'SELECT line_link_code, line_user_id FROM users WHERE id = $1',
      [req.user.id]
    );

    if (existing.rows[0]?.line_user_id) {
      return res.json({ linked: true });
    }

    let code = existing.rows[0]?.line_link_code;
    if (!code) {
      code = crypto.randomBytes(4).toString('hex').toUpperCase(); // e.g. "A1B2C3D4"
      await pool.query('UPDATE users SET line_link_code = $1 WHERE id = $2', [code, req.user.id]);
    }

    res.json({ linked: false, code });
  } catch (err) {
    console.error('Get link code error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// DELETE /line/link — unlink the current user's LINE account
async function unlink(req, res) {
  try {
    await pool.query(
      'UPDATE users SET line_user_id = NULL, line_link_code = NULL WHERE id = $1',
      [req.user.id]
    );
    res.json({ linked: false });
  } catch (err) {
    console.error('Unlink LINE error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// POST /line/webhook — LINE calls this for every message/event sent to the bot.
// req.body here is the RAW buffer (see server.js — this route is mounted with
// express.raw(), not express.json(), because signature verification needs the
// exact original bytes).
async function handleWebhook(req, res) {
  const signature = req.headers['x-line-signature'];
  const rawBody = req.body; // Buffer

  if (!verifySignature(rawBody, signature)) {
    return res.status(401).send('Invalid signature');
  }

  // LINE requires a fast 200 response; process events without blocking the reply
  res.status(200).send('OK');

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch (err) {
    console.error('[line webhook] bad JSON:', err.message);
    return;
  }

  for (const event of payload.events || []) {
    if (event.type === 'message' && event.message?.type === 'text') {
      const text = event.message.text.trim().toUpperCase();
      const lineUserId = event.source?.userId;
      if (!lineUserId) continue;

      try {
        const result = await pool.query(
          `UPDATE users SET line_user_id = $1, line_link_code = NULL
           WHERE line_link_code = $2
           RETURNING id, name`,
          [lineUserId, text]
        );

        if (result.rows.length > 0) {
          await pushToLine(lineUserId, `Linked! You'll now get Task Tracker notifications here, ${result.rows[0].name}.`);
        }
        // if no match, silently ignore — likely just a random message to the bot
      } catch (err) {
        console.error('[line webhook] link error:', err.message);
      }
    }
  }
}

module.exports = { getLinkCode, unlink, handleWebhook };
