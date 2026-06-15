'use strict';

// GET /api/settings.php — public. Returns graph + trade config consumed by the
// client on boot. Shape verified against the client's settings handler.

const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/api/settings.php', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'select graph, trade from app_settings where id = 1'
    );
    if (rows.length === 0) {
      // Should never happen (seeded by migration), but never 500 the client boot.
      return res.json({ graph: {}, trade: {} });
    }
    return res.json({ graph: rows[0].graph, trade: rows[0].trade });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
