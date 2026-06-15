'use strict';

// Profile page: update registered M-Pesa number and change password.
// Protected by requireAuthPage. PRG with coded status flags (?s=/?e=) mapped
// server-side to fixed messages (no reflected text -> no injection).

const express = require('express');
const config = require('../config');
const db = require('../db');
const { validatePhone, validatePassword } = require('../lib/validation');
const { hashPassword, verifyPassword } = require('../lib/passwords');
const { createSession } = require('../lib/session');
const { requireAuthPage } = require('../middleware/auth');
const { layout, alert } = require('../lib/pageLayout');
const { escapeHtml } = require('../lib/render');
const { setSessionCookie } = require('./auth');

const router = express.Router();

const SUCCESS = {
  phone: 'M-Pesa number updated.',
  pw: 'Password changed. Other sessions were signed out.',
};
const ERROR = {
  phone: 'Enter a valid Kenyan M-Pesa number (e.g. 0712345678).',
  pw_current: 'Current password is incorrect.',
  pw_new: 'New password must be at least 8 characters.',
  pw_match: 'New password and confirmation do not match.',
};

function profilePage(user, { success, error } = {}) {
  const phone = escapeHtml(user.phone || '');
  const phoneVal = user.phone ? `value="${phone}"` : '';
  const body = `
${alert('success', success)}
${alert('error', error)}

<div class="row-between">
  <div>
    <div style="font-size:12px;color:var(--t2)">Signed in as</div>
    <div style="font-weight:700;font-size:16px">@${escapeHtml(user.username)}</div>
  </div>
  <div class="balance">KES ${Number(user.balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
</div>

<div class="section">
  <h2>Registered M-Pesa number</h2>
  <p class="sub" style="margin-top:2px">Withdrawals are paid to this number.</p>
  <form method="post" action="/profile.php">
    <input type="hidden" name="form" value="phone">
    <label for="phone">M-Pesa number</label>
    <input id="phone" name="phone" type="tel" ${phoneVal} placeholder="0712345678" autocomplete="tel" required>
    <button class="btn" type="submit">Save number</button>
  </form>
</div>

<div class="section">
  <h2>Change password</h2>
  <form method="post" action="/profile.php">
    <input type="hidden" name="form" value="password">
    <label for="current">Current password</label>
    <input id="current" name="current" type="password" autocomplete="current-password" required>
    <label for="newpw">New password</label>
    <input id="newpw" name="newpw" type="password" autocomplete="new-password" required>
    <div class="hint">At least 8 characters</div>
    <label for="confirm">Confirm new password</label>
    <input id="confirm" name="confirm" type="password" autocomplete="new-password" required>
    <button class="btn" type="submit">Update password</button>
  </form>
</div>

<p class="alt"><a href="/">← Back to trading</a> · <a href="/transactions.php">History</a> · <a href="/logout">Log out</a></p>`;
  return layout({ title: 'Profile', heading: 'Your profile', body, wide: false });
}

router.get('/profile.php', requireAuthPage, (req, res) => {
  res.set('Cache-Control', 'no-store');
  const success = SUCCESS[req.query.s];
  const error = ERROR[req.query.e];
  return res.type('html').send(profilePage(req.user, { success, error }));
});

router.post('/profile.php', requireAuthPage, async (req, res, next) => {
  try {
    const kind = req.body.form;

    if (kind === 'phone') {
      const v = validatePhone(req.body.phone, { required: true });
      if (v.error) return res.redirect(303, '/profile.php?e=phone');
      await db.query('update app_users set phone = $1 where id = $2', [v.value, req.user.id]);
      return res.redirect(303, '/profile.php?s=phone');
    }

    if (kind === 'password') {
      const current = String(req.body.current || '');
      const newpw = String(req.body.newpw || '');
      const confirm = String(req.body.confirm || '');

      const { rows } = await db.query(
        'select password_hash from app_users where id = $1',
        [req.user.id]
      );
      if (!rows.length || !(await verifyPassword(current, rows[0].password_hash))) {
        return res.redirect(303, '/profile.php?e=pw_current');
      }
      const vP = validatePassword(newpw);
      if (vP.error) return res.redirect(303, '/profile.php?e=pw_new');
      if (newpw !== confirm) return res.redirect(303, '/profile.php?e=pw_match');

      const hash = await hashPassword(vP.value);
      await db.query('update app_users set password_hash = $1 where id = $2', [hash, req.user.id]);
      // Invalidate all sessions, then issue a fresh one for the current browser.
      await db.query('delete from app_sessions where user_id = $1', [req.user.id]);
      const { token, expiresAt } = await createSession(req.user.id);
      setSessionCookie(res, token, expiresAt);
      return res.redirect(303, '/profile.php?s=pw');
    }

    // Unknown form payload.
    return res.redirect(303, '/profile.php');
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
