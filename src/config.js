'use strict';

// Centralised, validated configuration. Fail fast on missing critical values
// so we never run with an undefined database or an unsigned session secret.

require('dotenv').config();

function required(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return String(v).trim();
}

function int(name, def) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return def;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) throw new Error(`Invalid integer for ${name}: ${raw}`);
  return n;
}

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';

const mpesa = {
  env: process.env.MPESA_ENV || 'sandbox',
  consumerKey: process.env.MPESA_CONSUMER_KEY || '',
  consumerSecret: process.env.MPESA_CONSUMER_SECRET || '',
  shortcode: process.env.MPESA_SHORTCODE || '',
  passkey: process.env.MPESA_PASSKEY || '',
  publicBaseUrl: process.env.PUBLIC_BASE_URL || '',
};
// Real Daraja is used only when fully configured; otherwise the mock provider.
mpesa.enabled = Boolean(
  mpesa.consumerKey && mpesa.consumerSecret && mpesa.shortcode && mpesa.passkey
);

const config = {
  NODE_ENV,
  isProd,
  port: int('PORT', 3000),
  databaseUrl: required('DATABASE_URL'),
  sessionSecret: required('SESSION_SECRET'),
  sessionTtlDays: int('SESSION_TTL_DAYS', 30),
  cookieName: 'it254_sess',
  // exit/entry rate sanity bound = y_max * factor (see SPEC §5)
  rateSanityFactor: 1.5,
  mpesa,
};

module.exports = config;
