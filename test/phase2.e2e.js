'use strict';

// Phase 2 E2E: registration, login, logout, sessions, profile, guards.

const assert = require('assert');
const crypto = require('crypto');
const { createApp } = require('../src/app');
const db = require('../src/db');

let server, base;
const U = 'e2e_' + crypto.randomBytes(4).toString('hex'); // <=20 chars
const PW = 'sup3rSecret!';
const PW2 = 'newSecret!234';

function url(p) { return `${base}${p}`; }
function form(obj) { return new URLSearchParams(obj).toString(); }
const H_FORM = { 'content-type': 'application/x-www-form-urlencoded' };

function getCookie(res, name = 'it254_sess') {
  const all = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const c of all) {
    const m = c.match(new RegExp(`^${name}=([^;]*)`));
    if (m) return m[1]; // may be '' on clear
  }
  return undefined;
}

async function main() {
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; r(); }); });

  // ── Register ──
  let res = await fetch(url('/register.php'), { method: 'POST', headers: H_FORM, redirect: 'manual',
    body: form({ username: U, password: PW, phone: '' }) });
  assert.strictEqual(res.status, 303, 'register redirects');
  assert.strictEqual(res.headers.get('location'), '/', 'register -> /');
  const cookieA = getCookie(res);
  assert.ok(cookieA && cookieA.length > 20, 'register sets session cookie');

  // ── Logged-in index render ──
  res = await fetch(url('/'), { headers: { cookie: `it254_sess=${cookieA}` } });
  let html = await res.text();
  assert.ok(/"isLoggedIn":true/.test(html), 'BOOT logged in');
  assert.ok(html.includes(`"username":"${U}"`), 'BOOT username');
  assert.ok(html.includes('<span id="headerBalance">'), 'visible headerBalance');
  assert.ok(!html.includes('<span id="headerBalance" hidden>'), 'not hidden balance');
  assert.ok(html.includes('openWithdraw()'), 'withdraw trigger present');
  assert.ok(html.includes(`@${U}`), 'username in header');
  assert.ok(!html.includes('href="/login.php"'), 'no login link when authed');

  // ── Duplicate username ──
  res = await fetch(url('/register.php'), { method: 'POST', headers: H_FORM, redirect: 'manual',
    body: form({ username: U, password: PW }) });
  assert.strictEqual(res.status, 409, 'duplicate username -> 409');

  // ── Weak password ──
  res = await fetch(url('/register.php'), { method: 'POST', headers: H_FORM, redirect: 'manual',
    body: form({ username: 'e2e_' + crypto.randomBytes(3).toString('hex'), password: 'short' }) });
  assert.strictEqual(res.status, 400, 'weak password -> 400');

  // ── Profile requires auth ──
  res = await fetch(url('/profile.php'), { redirect: 'manual' });
  assert.strictEqual(res.status, 302, 'profile guard redirects');
  assert.ok((res.headers.get('location') || '').startsWith('/login.php'), 'guard -> login');

  // ── Update phone ──
  res = await fetch(url('/profile.php'), { method: 'POST', headers: { ...H_FORM, cookie: `it254_sess=${cookieA}` },
    redirect: 'manual', body: form({ form: 'phone', phone: '0712345678' }) });
  assert.strictEqual(res.headers.get('location'), '/profile.php?s=phone', 'phone saved');

  res = await fetch(url('/'), { headers: { cookie: `it254_sess=${cookieA}` } });
  html = await res.text();
  assert.ok(html.includes('"userPhone":"254712345678"'), 'BOOT userPhone normalised');
  assert.ok(html.includes('254712345678'), 'withdraw modal shows number');

  // ── Invalid phone ──
  res = await fetch(url('/profile.php'), { method: 'POST', headers: { ...H_FORM, cookie: `it254_sess=${cookieA}` },
    redirect: 'manual', body: form({ form: 'phone', phone: '12345' }) });
  assert.strictEqual(res.headers.get('location'), '/profile.php?e=phone', 'invalid phone flagged');

  // ── Second session B, then change password via A invalidates B ──
  res = await fetch(url('/login.php'), { method: 'POST', headers: H_FORM, redirect: 'manual',
    body: form({ username: U, password: PW }) });
  const cookieB = getCookie(res);
  assert.ok(cookieB && cookieB !== cookieA, 'second login distinct session');

  // wrong current password
  res = await fetch(url('/profile.php'), { method: 'POST', headers: { ...H_FORM, cookie: `it254_sess=${cookieA}` },
    redirect: 'manual', body: form({ form: 'password', current: 'wrong', newpw: PW2, confirm: PW2 }) });
  assert.strictEqual(res.headers.get('location'), '/profile.php?e=pw_current', 'wrong current pw flagged');

  // correct change via A -> rotates, deletes all sessions
  res = await fetch(url('/profile.php'), { method: 'POST', headers: { ...H_FORM, cookie: `it254_sess=${cookieA}` },
    redirect: 'manual', body: form({ form: 'password', current: PW, newpw: PW2, confirm: PW2 }) });
  assert.strictEqual(res.headers.get('location'), '/profile.php?s=pw', 'password changed');
  const cookieA2 = getCookie(res);
  assert.ok(cookieA2 && cookieA2 !== cookieA, 'session rotated on pw change');

  // old session B must now be invalid
  res = await fetch(url('/'), { headers: { cookie: `it254_sess=${cookieB}` } });
  assert.ok(/"isLoggedIn":false/.test(await res.text()), 'old session invalidated after pw change');
  // new rotated session valid
  res = await fetch(url('/'), { headers: { cookie: `it254_sess=${cookieA2}` } });
  assert.ok(/"isLoggedIn":true/.test(await res.text()), 'rotated session valid');

  // ── Login with OLD password now fails ──
  res = await fetch(url('/login.php'), { method: 'POST', headers: H_FORM, redirect: 'manual',
    body: form({ username: U, password: PW }) });
  assert.strictEqual(res.status, 401, 'old password rejected');

  // ── Login with new password ──
  res = await fetch(url('/login.php'), { method: 'POST', headers: H_FORM, redirect: 'manual',
    body: form({ username: U, password: PW2 }) });
  assert.strictEqual(res.status, 303, 'login ok');
  const cookieC = getCookie(res);

  // ── Logged-in users bounced from /login.php and /register.php ──
  for (const p of ['/login.php', '/register.php']) {
    res = await fetch(url(p), { headers: { cookie: `it254_sess=${cookieC}` }, redirect: 'manual' });
    assert.strictEqual(res.status, 302, `${p} redirects when authed`);
  }

  // ── Transactions page (empty states) ──
  res = await fetch(url('/transactions.php'), { headers: { cookie: `it254_sess=${cookieC}` } });
  assert.strictEqual(res.status, 200, 'transactions 200');
  html = await res.text();
  assert.ok(html.includes('No wallet activity yet.'), 'empty wallet state');
  assert.ok(html.includes('No trades yet.'), 'empty trades state');

  // ── Logout clears cookie ──
  res = await fetch(url('/logout'), { headers: { cookie: `it254_sess=${cookieC}` }, redirect: 'manual' });
  assert.strictEqual(res.status, 303, 'logout redirects');
  const cleared = getCookie(res);
  assert.strictEqual(cleared, '', 'cookie cleared on logout');
  res = await fetch(url('/'), { headers: { cookie: `it254_sess=${cookieC}` } });
  assert.ok(/"isLoggedIn":false/.test(await res.text()), 'session destroyed on logout');

  console.log('PHASE 2 E2E: ALL PASSED');
}

main()
  .then(async () => {
    await db.query("delete from app_users where username_lower like 'e2e\\_%'");
    server && server.close(); await db.close(); process.exit(0);
  })
  .catch(async (err) => {
    console.error('PHASE 2 E2E FAILED:', err.stack || err.message);
    try { await db.query("delete from app_users where username_lower like 'e2e\\_%'"); server && server.close(); await db.close(); } catch (_) {}
    process.exit(1);
  });
