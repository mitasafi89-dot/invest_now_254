'use strict';

// Server-side session store. The cookie carries a high-entropy opaque token;
// only its SHA-256 hash is persisted. Expiry is enforced server-side and
// expired rows are pruned lazily on resolve.

const crypto = require('crypto');
const db = require('../db');
const config = require('../config');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + config.sessionTtlDays * 86400000);
  await db.query(
    'insert into app_sessions (user_id, token_hash, expires_at) values ($1, $2, $3)',
    [userId, tokenHash, expiresAt]
  );
  return { token, expiresAt };
}

// Returns the authenticated user ({id, username, phone, balance}) or null.
async function resolveSession(token) {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const { rows } = await db.query(
    `select s.id as sid, s.expires_at,
            u.id, u.username, u.phone, u.balance
       from app_sessions s
       join app_users u on u.id = s.user_id
      where s.token_hash = $1`,
    [tokenHash]
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await db.query('delete from app_sessions where id = $1', [row.sid]);
    return null;
  }
  // Best-effort last-seen update; failures must not block the request.
  db.query('update app_sessions set last_seen_at = now() where id = $1', [row.sid]).catch(
    () => {}
  );
  return { id: row.id, username: row.username, phone: row.phone, balance: row.balance };
}

async function destroySession(token) {
  if (!token) return;
  await db.query('delete from app_sessions where token_hash = $1', [hashToken(token)]);
}

module.exports = { createSession, resolveSession, destroySession, hashToken };
