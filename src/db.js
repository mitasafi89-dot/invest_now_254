'use strict';

// Postgres access layer (Supabase Transaction Pooler over SSL).
//
// Exposes:
//   query(text, params)          -> runs a single statement on the pool
//   tx(async (client) => {...})  -> runs the callback inside BEGIN/COMMIT,
//                                   auto-ROLLBACK on throw, always releases.
//
// All callers use parameterised queries ($1, $2, ...) — never string concat.

const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool({
  connectionString: config.databaseUrl,
  // Supabase requires TLS; the pooler presents a cert chain that is valid but
  // we do not pin it here. rejectUnauthorized:false is the documented setting
  // for connecting to Supabase from generic clients.
  ssl: { rejectUnauthorized: false },
  max: 8,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 15_000,
  // pgBouncer transaction mode does not keep session state between checkouts.
  keepAlive: true,
});

pool.on('error', (err) => {
  // Background idle-client errors must not crash the process.
  // eslint-disable-next-line no-console
  console.error('[db] idle client error:', err.message);
});

async function query(text, params) {
  return pool.query(text, params);
}

async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rbErr) {
      // eslint-disable-next-line no-console
      console.error('[db] rollback failed:', rbErr.message);
    }
    throw err;
  } finally {
    client.release();
  }
}

async function close() {
  await pool.end();
}

module.exports = { pool, query, tx, close };
