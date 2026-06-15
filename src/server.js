'use strict';

// Process entrypoint. Starts the HTTP server and handles graceful shutdown.

const { createApp } = require('./app');
const config = require('./config');
const db = require('./db');

const app = createApp();

const server = app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`invest_now_254 listening on :${config.port} (${config.NODE_ENV})`);
});

async function shutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(`\n${signal} received, shutting down...`);
  server.close(async () => {
    try {
      await db.close();
    } catch (_) {
      /* ignore */
    }
    process.exit(0);
  });
  // Force-exit if connections do not drain.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = server;
