'use strict';

// Password hashing (bcrypt, cost 12). Isolated so the algorithm can change in
// one place. verify() never throws on malformed hashes — it returns false.

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const COST = 12;

// A valid bcrypt hash of a random value, used to equalise login timing when a
// username does not exist (prevents user-enumeration via response time).
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), COST);

async function hashPassword(plain) {
  return bcrypt.hash(plain, COST);
}

async function verifyPassword(plain, hash) {
  if (!hash) return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch (_) {
    return false;
  }
}

module.exports = { hashPassword, verifyPassword, DUMMY_HASH };
