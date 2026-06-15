# invest_now_254 — Backend Specification

This backend serves the **existing, unmodified** High Trade front-end
(`public/index.html` + `public/assets/app.min.js`). The contract below was
reverse-engineered from the obfuscated client bundle and is authoritative.
Every endpoint shape, field name, and formula here was verified against the
client code — nothing is assumed.

## 1. Why Node/Express serving `.php` paths

The client calls paths ending in `.php` (e.g. `/api/trade.php`). Those are just
URL strings; Express matches them exactly, so the client runs **unchanged**.
No PHP runtime is involved. Persistence is Supabase Postgres via `pg`.

## 2. Pages (server-rendered)

| Path | Purpose |
|---|---|
| `/` (also `/index.php`, `/index.html`) | Trading page. Server injects `window.__BOOT` and renders the header for guest vs logged-in. |
| `/login.php` | Login form. |
| `/register.php` | Sign-up form. |
| `/profile.php` | Set/Update registered M-Pesa number; change password. |
| `/transactions.php` | Wallet & trade history for the user. |
| `/logout` | Destroys session, clears cookie, redirects to `/`. |

`window.__BOOT` shape (read by the client): `{ balance:number, userPhone:string, isLoggedIn:boolean, username:string }`.

The client writes balance into `#headerBalance` every tick, so a `#headerBalance`
element must always exist (visible for logged-in users; hidden for guests to
avoid client console errors).

## 3. JSON API contract

### GET `/api/settings.php`
Response:
```json
{
  "graph": { "speed":int_ms, "y_max":float, "spike_frequency":float,
             "crash_frequency":float, "base_level":float, "spike_max":float,
             "crash_depth":float },
  "trade": { "duration":int_sec, "min_stake":num, "max_stake":num,
             "min_deposit":num, "max_multiplier":num, "prestart_wait":num,
             "autosell_multiplier":num }
}
```

### POST `/api/trade.php` (JSON body, `action` discriminator)
- `{ "action":"balance" }` → `{ "balance":number }`
- `{ "action":"place", "type":"buy"|"sell", "stake":number, "entry_rate":float, "duration":int }`
  → `{ "balance":number, "trade_id":string }` | `{ "error":string }`
- `{ "action":"cancel", "trade_id":string }` → `{ "balance":number }` | `{ "error":string }`
- `{ "action":"resolve", "trade_id":string, "exit_rate":float, "expired":bool }`
  → `{ "balance":number, "result":"win"|"loss", "payout":number }` | `{ "error":string }`

All require an authenticated session. Unauthenticated → `{ "error":... }` (client
also guards by redirecting guests to `/login.php`).

### POST `/api/stk-push.php` (deposit)
`{ "amount":number, "phone":string }` →
`{ "success":true, "message":string }` | `{ "success":false, "error":string }`

Initiates an M-Pesa STK push. The client then **polls** `trade.php {action:balance}`
every 3s (up to 20 times) and closes the modal once the balance increases. The
balance is credited only when the provider callback confirms payment.

### POST `/api/withdraw.php`
`{ "action":"request", "amount":number }` →
`{ "success":true, "balance":number }` | `{ "success":false, "error":string }`
Withdraws to the user's **registered** M-Pesa number (from profile). Debits balance
immediately and records a withdrawal transaction.

## 4. Trade settlement model (authoritative)

Confirmed from the client (`updateHUD`, autosell HUD, `showResult`):

- `PAYOUT (0.148)` is **dead code** — not used. Settlement is continuous, not fixed.
- Let `entry = entry_rate` (stored at place), `exit = exit_rate` (from resolve).
- Directional favourable movement:
  - `buy`  → `fav = exit - entry`
  - `sell` → `fav = entry - exit`
- **Win** iff `fav > 0`, else **loss**.
- **Payout (total returned to balance)**: `payout = min(stake * (1 + fav), stake * MAX_MULT)` on win; `0` on loss.
- Net P/L = `payout - stake` (matches client live profit `min(stake*Δ, stake*(MAX_MULT-1))`).
- `showResult` multiplier display = `payout / stake` = `1 + fav` (capped) — consistent.

Balance flow:
- **place**: validate, then `balance -= stake`; create `open` trade; ledger `trade_stake` (−stake).
- **cancel**: only within `prestart_wait` seconds of placement; `balance += stake`; mark `cancelled`; ledger `trade_refund` (+stake). Prevents the "place → watch → refund" exploit.
- **resolve**: idempotent on already-resolved; compute payout; `balance += payout`; mark `won`/`lost`; ledger `trade_payout` (+payout) on win.

## 5. Trust boundary (inherent to the original design)

The price chart is **client-generated synthetic data**. Therefore `entry_rate`
and `exit_rate` are client-supplied and cannot be independently verified by the
server — this is a property of the original product, not a defect introduced here.
Mitigations applied:
- `exit_rate`/`entry_rate` are bounded to a plausible range derived from settings
  (`0 <= rate <= y_max * RATE_SANITY_FACTOR`).
- Payout is hard-capped at `stake * MAX_MULT`.
- Stake is bounded by `min_stake`/`max_stake` and available balance.
- One open trade per user at a time.

## 6. Money & concurrency

- All money is `numeric(18,2)` (exact decimal; never floats).
- Balance mutations run inside a single SQL transaction with `SELECT ... FOR UPDATE`
  on the user row to serialise concurrent requests for the same account.

## 7. Auth & sessions

- Passwords hashed with bcrypt.
- Session = opaque random token in an `httpOnly`, `SameSite=Lax` cookie; only the
  SHA-256 hash is stored in `app_sessions`. Expiry enforced server-side.
- Usernames restricted to `[A-Za-z0-9_]{3,20}`; output is HTML-escaped.
