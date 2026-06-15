'use strict';

// Authentication middleware.
//   attachUser     — populates req.user from the session cookie (guest-safe).
//   requireAuthPage — redirects browsers to /login.php when unauthenticated.
//   requireAuthApi  — returns 401 JSON for API routes when unauthenticated.

const config = require('../config');
const { resolveSession } = require('../lib/session');

async function attachUser(req, res, next) {
  try {
    const token = req.cookies ? req.cookies[config.cookieName] : null;
    const user = await resolveSession(token);
    if (user) req.user = user;
  } catch (err) {
    // Treat any lookup failure as "guest"; never block the request here.
    // eslint-disable-next-line no-console
    console.error('[auth] attachUser:', err.message);
  }
  next();
}

function requireAuthPage(req, res, next) {
  if (req.user) return next();
  const next_ = encodeURIComponent(req.originalUrl || '/');
  return res.redirect(302, `/login.php?next=${next_}`);
}

function requireAuthApi(req, res, next) {
  if (req.user) return next();
  return res.status(401).json({ error: 'Please login.' });
}

module.exports = { attachUser, requireAuthPage, requireAuthApi };
