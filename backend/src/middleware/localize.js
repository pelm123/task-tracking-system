const { langFromHeader, translateMessage } = require('../config/i18n');

// Translates the `message` field of JSON responses when the browser asks for
// Thai (the frontend sends an Accept-Language header on every request).
// Controllers keep returning plain English messages; anything without a
// translation simply stays in English.
function localize(req, res, next) {
  const lang = langFromHeader(req.headers['accept-language']);
  req.lang = lang;

  if (lang === 'th') {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (body && typeof body === 'object' && !Array.isArray(body) && typeof body.message === 'string') {
        body = { ...body, message: translateMessage(lang, body.message) };
      }
      return originalJson(body);
    };
  }
  next();
}

module.exports = localize;
