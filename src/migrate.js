'use strict';

// Idempotent migration runner. Applies migrations/*.sql in lexical order,
// each inside its own transaction, recording applied files in app_migrations.
// Re-running is safe: already-applied files are skipped.

const fs = require('fs');
const path = require('path');
const { pool, close } = require('./db');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

async function ensureRegistry(client) {
  await client.query(`
    create table if not exists app_migrations (
      filename   text primary key,
      applied_at timestamptz not null default now()
    )
  `);
}

async function appliedSet(client) {
  const { rows } = await client.query('select filename from app_migrations');
  return new Set(rows.map((r) => r.filename));
}

async function run() {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const client = await pool.connect();
  try {
    await ensureRegistry(client);
    const done = await appliedSet(client);

    let appliedCount = 0;
    for (const file of files) {
      if (done.has(file)) {
        console.log(`= skip   ${file}`);
        continue;
      }
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      console.log(`+ apply  ${file}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('insert into app_migrations (filename) values ($1)', [file]);
        await client.query('COMMIT');
        appliedCount += 1;
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${err.message}`);
      }
    }
    console.log(`Done. ${appliedCount} migration(s) applied, ${files.length} total.`);
  } finally {
    client.release();
  }
}

run()
  .then(() => close())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error('Migration error:', err.message);
    try { await close(); } catch (_) { /* ignore */ }
    process.exit(1);
  });
