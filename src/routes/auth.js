'use strict';

// Authentication routes: register, login, logout. Forms post same-origin
// (SameSite=Lax cookie => CSRF-protected). PRG pattern: successful POSTs
// redirect (303) so refresh does not re-submit.

const express = require('express');
const config = require('../config');
const db = require('../db');
const { validateUsername, validatePassword, validatePhone } = require('../lib/validation');
const { hashPassword, verifyPassword, DUMMY_HASH } = require('../lib/passwords');
const { createSession, destroySession } = require('../lib/session');
const { layout, alert } = require('../lib/pageLayout');
const { escapeHtml } = require('../lib/render');

const router = express.Router();

function setSessionCookie(res, token, expiresAt) {
  res.cookie(config.cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    path: '/',
    expires: expiresAt,
  });
}

function clearSessionCookie(res) {
  res.clearCookie(config.cookieName, { path: '/' });
}

// Only allow same-origin absolute paths as post-login redirects.
function safeNext(value) {
  if (typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')) {
    return value;
  }
  return '/';
}

// ── Register ────────────────────────────────────────────────────────────────
function registerForm({ error, values = {} } = {}) {
  const u = escapeHtml(values.username || '');
  const p = escapeHtml(values.phone || '');
  const body = `
${alert('error', error)}
<form method="post" action="/register.php" autocomplete="on">
  <label for="username">Username</label>
  <input id="username" name="username" type="text" value="${u}" autocomplete="username" required>
  <div class="hint">3–20 characters · letters, numbers, underscore</div>
  <label for="phone">M-Pesa number <span style="color:var(--t3)">(optional)</span></label>
  <input id="phone" name="phone" type="tel" value="${p}" placeholder="0712345678" autocomplete="tel">
  <label for="password">Password</label>
  <input id="password" name="password" type="password" autocomplete="new-password" required>
  <div class="hint">At least 8 characters</div>
  <button class="btn" type="submit">Create account</button>
</form>
<p class="alt">Already have an account? <a href="/login.php">Log in</a></p>`;
  return layout({ title: 'Sign Up', heading: 'Create your account', sub: 'Trade smart, earn big.', body });
}

router.get('/register.php', (req, res) => {
  if (req.user) return res.redirect(302, '/');
  return res.type('html').send(registerForm());
});

router.post('/register.php', async (req, res, next) => {
  try {
    const vU = validateUsername(req.body.username);
    const vPhone = validatePhone(req.body.phone, { required: false });
    const vP = validatePassword(req.body.password);
    const values = { username: req.body.username, phone: req.body.phone };

    const firstErr = vU.error || vPhone.error || vP.error;
    if (firstErr) {
      return res.status(400).type('html').send(registerForm({ error: firstErr, values }));
    }

    const hash = await hashPassword(vP.value);
    let user;
    try {
      const { rows } = await db.query(
        `insert into app_users (username, username_lower, phone, password_hash)
         values ($1, $2, $3, $4)
         returning id`,
        [vU.value, vU.value.toLowerCase(), vPhone.value, hash]
      );
      user = rows[0];
    } catch (e) {
      if (e.code === '23505') {
        return res
          .status(409)
          .type('html')
          .send(registerForm({ error: 'That username is already taken.', values }));
      }
      throw e;
    }

    const { token, expiresAt } = await createSession(user.id);
    setSessionCookie(res, token, expiresAt);
    return res.redirect(303, '/');
  } catch (err) {
    return next(err);
  }
});

// ── Login ─────────────────────────────────────────────────────────────────--
function loginForm({ error, values = {}, next: nextPath = '/' } = {}) {
  const u = escapeHtml(values.username || '');
  const n = escapeHtml(nextPath || '/');
  const body = `
${alert('error', error)}
<form method="post" action="/login.php" autocomplete="on">
  <input type="hidden" name="next" value="${n}">
  <label for="username">Username</label>
  <input id="username" name="username" type="text" value="${u}" autocomplete="username" required>
  <label for="password">Password</label>
  <input id="password" name="password" type="password" autocomplete="current-password" required>
  <button class="btn" type="submit">Log in</button>
</form>
<p class="alt">New here? <a href="/register.php">Create an account</a></p>`;
  return layout({ title: 'Login', heading: 'Welcome back', sub: 'Log in to continue trading.', body });
}

router.get('/login.php', (req, res) => {
  if (req.user) return res.redirect(302, '/');
  return res.type('html').send(loginForm({ next: safeNext(req.query.next) }));
});

router.post('/login.php', async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    const nextPath = safeNext(req.body.next);

    const { rows } = await db.query(
      'select id, password_hash from app_users where username_lower = $1',
      [username.toLowerCase()]
    );
    // Always run a bcrypt compare to keep timing constant.
    const hash = rows.length ? rows[0].password_hash : DUMMY_HASH;
    const valid = await verifyPassword(password, hash);

    if (!rows.length || !valid) {
      return res
        .status(401)
        .type('html')
        .send(loginForm({ error: 'Invalid username or password.', values: { username }, next: nextPath }));
    }

    const { token, expiresAt } = await createSession(rows[0].id);
    setSessionCookie(res, token, expiresAt);
    return res.redirect(303, nextPath);
  } catch (err) {
    return next(err);
  }
});

// ── Logout ────────────────────────────────────────────────────────────────--
async function doLogout(req, res, next) {
  try {
    const token = req.cookies ? req.cookies[config.cookieName] : null;
    await destroySession(token);
    clearSessionCookie(res);
    return res.redirect(303, '/');
  } catch (err) {
    return next(err);
  }
}
router.get('/logout', doLogout);
router.post('/logout', doLogout);

module.exports = { router, setSessionCookie, clearSessionCookie };
