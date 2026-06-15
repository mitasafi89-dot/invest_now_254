'use strict';

// Pure input validation & normalisation. No I/O. Each function returns either a
// normalised value or a clear error string so callers can render messages.

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

function validateUsername(input) {
  const v = String(input == null ? '' : input).trim();
  if (!v) return { error: 'Username is required.' };
  if (!USERNAME_RE.test(v)) {
    return { error: 'Username must be 3–20 characters: letters, numbers, or underscore.' };
  }
  return { value: v };
}

function validatePassword(input) {
  const v = String(input == null ? '' : input);
  if (!v) return { error: 'Password is required.' };
  if (v.length < 8) return { error: 'Password must be at least 8 characters.' };
  if (v.length > 128) return { error: 'Password must be at most 128 characters.' };
  return { value: v };
}

// Normalise a Kenyan mobile number to MSISDN form 2547######## / 2541########.
// Accepts 07.., 01.., 7.., 1.., +254.., 254.. and assorted spacing/punctuation.
function normalizePhone(input) {
  if (input == null) return null;
  let d = String(input).replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('0') && d.length === 10) d = '254' + d.slice(1);
  else if ((d.startsWith('7') || d.startsWith('1')) && d.length === 9) d = '254' + d;
  // already 254########## handled by the test below
  return /^254(7|1)\d{8}$/.test(d) ? d : null;
}

function validatePhone(input, { required = false } = {}) {
  const raw = String(input == null ? '' : input).trim();
  if (!raw) {
    return required ? { error: 'Phone number is required.' } : { value: null };
  }
  const norm = normalizePhone(raw);
  if (!norm) return { error: 'Enter a valid Kenyan M-Pesa number (e.g. 0712345678).' };
  return { value: norm };
}

module.exports = { validateUsername, validatePassword, normalizePhone, validatePhone };
