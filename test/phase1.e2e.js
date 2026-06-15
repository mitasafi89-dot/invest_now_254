'use strict';

// Phase 1 E2E: foundation, settings endpoint, and guest trading-page render.
// Run with DATABASE_URL + SESSION_SECRET in the environment.

const assert = require('assert');
const { createApp } = require('../src/app');
const db = require('../src/db');

let server;
let base;

function url(p) { return `${base}${p}`; }

async function main() {
  const app = createApp();
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      base = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });

  // 1) Schema + seed present.
  const t = await db.query(`
    select count(*)::int as n from information_schema.tables
    where table_schema='public' and table_name in
    ('app_users','app_sessions','app_settings','app_trades','app_transactions','app_mpesa_deposits')
  `);
  assert.strictEqual(t.rows[0].n, 6, 'all 6 app tables must exist');

  const s = await db.query('select graph, trade from app_settings where id=1');
  assert.strictEqual(s.rows.length, 1, 'settings row seeded');

  // 2) Health.
  const h = await (await fetch(url('/healthz'))).json();
  assert.deepStrictEqual(h, { ok: true }, 'healthz ok');

  // 3) Settings endpoint shape + values.
  const cfg = await (await fetch(url('/api/settings.php'))).json();
  assert.strictEqual(cfg.graph.speed, 350, 'graph.speed seeded');
  assert.strictEqual(cfg.trade.duration, 60, 'trade.duration seeded');
  assert.strictEqual(cfg.trade.min_stake, 10, 'trade.min_stake seeded');
  assert.strictEqual(cfg.trade.max_multiplier, 5, 'trade.max_multiplier seeded');
  for (const k of ['y_max', 'spike_frequency', 'crash_frequency', 'base_level', 'spike_max', 'crash_depth']) {
    assert.ok(typeof cfg.graph[k] === 'number', `graph.${k} present`);
  }

  // 4) Guest index render.
  const res = await fetch(url('/'));
  assert.strictEqual(res.status, 200, 'index 200');
  const html = await res.text();
  assert.ok(/window\.__BOOT = \{/.test(html), 'BOOT injected');
  assert.ok(/"isLoggedIn":false/.test(html), 'guest not logged in');
  assert.ok(/"username":"Guest"/.test(html), 'guest username');
  assert.ok(html.includes('href="/login.php"'), 'login link present');
  assert.ok(html.includes('href="/register.php"'), 'register link present');
  assert.ok(html.includes('<span id="headerBalance" hidden>'), 'hidden headerBalance for guest');
  assert.ok(html.includes('src="assets/app.min.js"'), 'client bundle referenced');

  // 5) Static asset served.
  const js = await fetch(url('/assets/app.min.js'));
  assert.strictEqual(js.status, 200, 'app.min.js served');
  assert.ok((await js.text()).length > 1000, 'app.min.js has content');

  console.log('PHASE 1 E2E: ALL PASSED');
}

main()
  .then(async () => { server && server.close(); await db.close(); process.exit(0); })
  .catch(async (err) => {
    console.error('PHASE 1 E2E FAILED:', err.message);
    try { server && server.close(); await db.close(); } catch (_) {}
    process.exit(1);
  });
