const pool = require('./db');
const { forLang, normalizeLang } = require('./i18n');

// Looks up each person's language in one query.
async function getLanguages(userIds) {
  const ids = [...new Set(userIds.filter(Boolean))];
  const map = new Map();
  if (ids.length === 0) return map;
  const result = await pool.query('SELECT id, language FROM users WHERE id = ANY($1::uuid[])', [ids]);
  for (const row of result.rows) map.set(row.id, normalizeLang(row.language));
  return map;
}

async function getUserLanguage(userId) {
  if (!userId) return normalizeLang();
  const map = await getLanguages([userId]);
  return map.get(userId) || normalizeLang();
}

// Creates one in-app notification for `userId`, written in THEIR language,
// and (when `line` is given) pushes the same text to their LINE account.
//
//   build(L) → message text; L = { tr, status, priority, due, lang }
//   emoji    → prefix for the LINE push only; omit to skip LINE entirely
//              (task_updated is deliberately in-app only)
//
// `lang` may be passed when the caller already knows it (saves a query).
async function notify(userId, { taskId, type, emoji, build, lang }) {
  const L = forLang(lang || (await getUserLanguage(userId)));
  const message = build(L);
  // `line_emoji` marks the row for LINE delivery; the Notification service
  // picks it up via the line_outbox trigger (migration 017)
  await pool.query(
    `INSERT INTO notifications (user_id, task_id, type, message, line_emoji)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, taskId, type, message, emoji || null]
  );
}

// Same, for several people at once (languages fetched in a single query).
async function notifyMany(userIds, opts) {
  const langs = await getLanguages(userIds);
  for (const userId of userIds) {
    try {
      await notify(userId, { ...opts, lang: langs.get(userId) });
    } catch (err) {
      console.error('notify error:', err.message);
    }
  }
}

module.exports = { notify, notifyMany, getUserLanguage, getLanguages };
