# invest_now_254

Backend for the **High Trade** binary-options trading front-end. The original
client (`public/index.html` + `public/assets/app.min.js`) is served **unmodified**;
this repo implements the server it talks to.

- **Runtime:** Node.js + Express (serves the client's `.php` API paths directly).
- **Database:** Supabase Postgres via `pg`.
- **Spec:** see [`docs/SPEC.md`](docs/SPEC.md) for the full reverse-engineered API
  contract and the trade settlement model.

## Setup

```bash
npm install
cp .env.example .env      # then fill in DATABASE_URL and SESSION_SECRET
npm run migrate           # create schema + seed settings (idempotent)
npm start                 # serve on $PORT (default 3000)
```

`DATABASE_URL` must be the Supabase **Transaction Pooler** URI (IPv4), with the
password percent-encoded. See `.env.example` for the exact shape.

## Project layout

```
src/
  config.js        validated env config (fail-fast)
  db.js            pg pool + tx() transaction helper
  migrate.js       idempotent migration runner
  app.js           express assembly (security, routes, errors)
  server.js        entrypoint + graceful shutdown
  routes/          settings, pages (+ auth, wallet, trade in later phases)
  lib/             render (BOOT injection / header), helpers
migrations/        SQL migrations (001_init.sql = full schema + seed)
public/            the unmodified client (index.html, assets/)
test/              per-phase E2E suites
docs/SPEC.md       authoritative API + settlement spec
```

## Build phases

1. **Foundation** — schema, migrations, settings endpoint, page rendering. ✅
2. Authentication & sessions (register / login / logout / profile).
3. Wallet — M-Pesa deposits (STK push) & withdrawals, ledger.
4. Trading engine — place / cancel / resolve with atomic settlement.
5. Hardening — rate limiting, validation, docs, deploy notes.

Each phase is E2E-tested and committed before the next begins.
