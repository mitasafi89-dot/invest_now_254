-- 001_init.sql — full data foundation for invest_now_254.
-- Tables are prefixed app_ to avoid collisions with Supabase-managed objects.
-- Money is numeric(18,2) (exact decimal; never float).

-- ── Users ──────────────────────────────────────────────────────────────────
create table if not exists app_users (
  id             uuid primary key default gen_random_uuid(),
  username       text not null,
  username_lower text not null unique,
  phone          text,
  password_hash  text not null,
  balance        numeric(18,2) not null default 0 check (balance >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ── Sessions (token hash only; raw token lives in the cookie) ───────────────
create table if not exists app_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references app_users(id) on delete cascade,
  token_hash   text not null unique,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  last_seen_at timestamptz not null default now()
);
create index if not exists idx_sessions_user    on app_sessions(user_id);
create index if not exists idx_sessions_expires  on app_sessions(expires_at);

-- ── Settings (single row, id = 1) ───────────────────────────────────────────
create table if not exists app_settings (
  id         int primary key default 1 check (id = 1),
  graph      jsonb not null,
  trade      jsonb not null,
  updated_at timestamptz not null default now()
);

-- ── Trades ──────────────────────────────────────────────────────────────────
create table if not exists app_trades (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references app_users(id) on delete cascade,
  type        text not null check (type in ('buy','sell')),
  stake       numeric(18,2) not null check (stake > 0),
  entry_rate  double precision not null,
  exit_rate   double precision,
  duration    int not null,
  status      text not null default 'open' check (status in ('open','won','lost','cancelled')),
  payout      numeric(18,2) not null default 0 check (payout >= 0),
  expired     boolean,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists idx_trades_user on app_trades(user_id, status);
-- At most one open trade per user (enforced at the DB level).
create unique index if not exists uniq_open_trade_per_user
  on app_trades(user_id) where status = 'open';

-- ── Transactions ledger ─────────────────────────────────────────────────────
create table if not exists app_transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references app_users(id) on delete cascade,
  kind          text not null check (kind in
                  ('deposit','withdrawal','trade_stake','trade_payout','trade_refund')),
  amount        numeric(18,2) not null,        -- signed delta applied to balance
  balance_after numeric(18,2) not null,
  status        text not null default 'completed' check (status in ('pending','completed','failed')),
  reference     text,
  meta          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists idx_tx_user on app_transactions(user_id, created_at desc);

-- ── M-Pesa STK-push deposit requests ────────────────────────────────────────
create table if not exists app_mpesa_deposits (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references app_users(id) on delete cascade,
  amount              numeric(18,2) not null check (amount > 0),
  phone               text not null,
  checkout_request_id text unique,
  merchant_request_id text,
  status              text not null default 'pending'
                        check (status in ('pending','success','failed','cancelled')),
  mpesa_receipt       text,
  result_desc         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_dep_user     on app_mpesa_deposits(user_id, created_at desc);
create index if not exists idx_dep_checkout  on app_mpesa_deposits(checkout_request_id);

-- ── updated_at touch trigger ────────────────────────────────────────────────
create or replace function app_touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_users_touch on app_users;
create trigger trg_users_touch before update on app_users
  for each row execute function app_touch_updated_at();

drop trigger if exists trg_dep_touch on app_mpesa_deposits;
create trigger trg_dep_touch before update on app_mpesa_deposits
  for each row execute function app_touch_updated_at();

-- ── Seed default settings (matches the client's built-in CFG defaults) ──────
insert into app_settings (id, graph, trade) values (
  1,
  '{"speed":350,"y_max":0.12,"spike_frequency":0.08,"crash_frequency":0.01,"base_level":0.025,"spike_max":0.105,"crash_depth":-0.17}'::jsonb,
  '{"duration":60,"min_stake":10,"max_stake":50000,"min_deposit":50,"max_multiplier":5,"prestart_wait":5,"autosell_multiplier":3}'::jsonb
)
on conflict (id) do nothing;
