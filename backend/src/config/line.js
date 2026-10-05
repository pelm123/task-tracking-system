const crypto = require('crypto');
const https = require('https');
const pool = require('./db');

const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push';

// sends a push message to a specific LINE userId
function pushToLine(lineUserId, text) {
  return new Promise((resolve, reject) => {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token) {
      console.warn('[line] LINE_CHANNEL_ACCESS_TOKEN not set — skipping push');
      return resolve(null);
    }

    const payload = JSON.stringify({
      to: lineUserId,
      messages: [{ type: 'text', text: text.slice(0, 4900) }], // LINE's hard limit is 5000 chars
    });

    const req = https.request(
      LINE_PUSH_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode >= 400) {
            console.error('[line] push failed:', res.statusCode, body);
          }
          resolve({ status: res.statusCode, body });
        });
      }
    );
    req.on('error', (err) => {
      console.error('[line] push request error:', err.message);
      reject(err);
    });
    req.write(payload);
    req.end();
  });
}

// look up whether this app user has linked a LINE account, and if so push to it.
// Safe to call unconditionally — silently no-ops if not linked or not configured.
async function notifyLineIfLinked(userId, text) {
  try {
    const result = await pool.query('SELECT line_user_id FROM users WHERE id = $1', [userId]);
    const lineUserId = result.rows[0]?.line_user_id;
    if (lineUserId) {
      await pushToLine(lineUserId, text);
    }
  } catch (err) {
    console.error('[line] notifyLineIfLinked error:', err.message);
  }
}

// verifies the X-Line-Signature header against the raw request body,
// using HMAC-SHA256 with the channel secret — required by LINE for every webhook call
function verifySignature(rawBody, signature) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;
  const hash = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  return hash === signature;
}

module.exports = { pushToLine, notifyLineIfLinked, verifySignature };
