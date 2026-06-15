'use strict';

// Server-rendered HTML pages. Phase 1 implements the trading page only;
// auth/profile/transactions pages are added in later phases.
// req.user is populated by the auth middleware (added in Phase 2); until then
// it is undefined and the page renders in guest mode.

const express = require('express');
const { renderIndex } = require('../lib/render');

const router = express.Router();

function serveIndex(req, res) {
  res.set('Cache-Control', 'no-store');
  res.type('html').send(renderIndex(req.user || null));
}

router.get('/', serveIndex);
router.get('/index.php', serveIndex);
router.get('/index.html', serveIndex);

module.exports = router;
