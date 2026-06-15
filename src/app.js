'use strict';

// Express application assembly. Exported without listening so tests can mount it.

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const config = require('./config');

const { attachUser } = require('./middleware/auth');
const settingsRoutes = require('./routes/settings');
const { router: authRoutes } = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const transactionsRoutes = require('./routes/transactions');
const pagesRoutes = require('./routes/pages');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Security headers. CSP is disabled because the client bundle uses inline
  // scripts/styles and connects to external origins (Google Fonts, Binance WS);
  // locking it down would break the unmodified front-end.
  app.use(helmet({ contentSecurityPolicy: false }));

  app.use(express.json({ limit: '64kb' }));
  app.use(express.urlencoded({ extended: false, limit: '64kb' }));
  app.use(cookieParser(config.sessionSecret));

  // Static assets only (never serve index.html raw — it is server-rendered).
  // Placed before attachUser so asset requests skip the session lookup.
  app.use(
    '/assets',
    express.static(path.join(__dirname, '..', 'public', 'assets'), {
      maxAge: '1h',
      index: false,
    })
  );

  // Liveness probe (no auth, no DB).
  app.get('/healthz', (req, res) => res.json({ ok: true }));

  // Populate req.user from the session cookie for everything below.
  app.use(attachUser);

  // Feature routes.
  app.use(settingsRoutes);
  app.use(authRoutes);
  app.use(profileRoutes);
  app.use(transactionsRoutes);
  app.use(pagesRoutes);

  // 404.
  app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'Not found' });
    }
    return res.status(404).type('html').send('<h1>404 — Not found</h1>');
  });

  // Centralised error handler.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    // eslint-disable-next-line no-console
    console.error('[error]', req.method, req.path, '-', err.message);
    const body = config.isProd
      ? { error: 'Internal server error' }
      : { error: 'Internal server error', detail: err.message };
    if (req.path.startsWith('/api/')) return res.status(500).json(body);
    return res.status(500).type('html').send('<h1>500 — Server error</h1>');
  });

  return app;
}

module.exports = { createApp };
