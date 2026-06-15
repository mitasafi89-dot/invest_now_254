'use strict';

// Transaction & trade history for the authenticated user. Populated by the
// wallet (Phase 3) and trade engine (Phase 4); renders empty states until then.

const express = require('express');
const db = require('../db');
const { requireAuthPage } = require('../middleware/auth');
const { layout } = require('../lib/pageLayout');
const { escapeHtml } = require('../lib/render');

const router = express.Router();

function kes(n) {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtTime(ts) {
  const d = new Date(ts);
  return d.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
}

const TX_LABEL = {
  deposit: 'Deposit',
  withdrawal: 'Withdrawal',
  trade_stake: 'Trade stake',
  trade_payout: 'Trade payout',
  trade_refund: 'Trade refund',
};

function txTable(rows) {
  if (!rows.length) return '<div class="empty">No wallet activity yet.</div>';
  const body = rows
    .map((r) => {
      const amt = Number(r.amount);
      const cls = amt >= 0 ? 'pos' : 'neg';
      const sign = amt >= 0 ? '+' : '−';
      return `<tr>
        <td>${escapeHtml(fmtTime(r.created_at))}</td>
        <td>${escapeHtml(TX_LABEL[r.kind] || r.kind)}</td>
        <td class="num ${cls}">${sign} KES ${kes(Math.abs(amt))}</td>
        <td class="num">KES ${kes(r.balance_after)}</td>
        <td><span class="pill">${escapeHtml(r.status)}</span></td>
      </tr>`;
    })
    .join('');
  return `<table>
    <thead><tr><th>Time</th><th>Type</th><th>Amount</th><th>Balance</th><th>Status</th></tr></thead>
    <tbody>${body}</tbody></table>`;
}

function tradeTable(rows) {
  if (!rows.length) return '<div class="empty">No trades yet.</div>';
  const body = rows
    .map((r) => {
      const won = r.status === 'won';
      const mult = won && Number(r.stake) > 0 ? (Number(r.payout) / Number(r.stake)).toFixed(2) : '—';
      const resultCls = won ? 'pos' : r.status === 'lost' ? 'neg' : '';
      return `<tr>
        <td>${escapeHtml(fmtTime(r.created_at))}</td>
        <td>${escapeHtml(r.type.toUpperCase())}</td>
        <td class="num">KES ${kes(r.stake)}</td>
        <td class="num ${resultCls}">${escapeHtml(r.status)}</td>
        <td class="num">×${mult}</td>
        <td class="num ${won ? 'pos' : ''}">${won ? 'KES ' + kes(r.payout) : '—'}</td>
      </tr>`;
    })
    .join('');
  return `<table>
    <thead><tr><th>Time</th><th>Type</th><th>Stake</th><th>Result</th><th>Mult.</th><th>Payout</th></tr></thead>
    <tbody>${body}</tbody></table>`;
}

router.get('/transactions.php', requireAuthPage, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    const [tx, tr] = await Promise.all([
      db.query(
        `select created_at, kind, amount, balance_after, status
           from app_transactions where user_id = $1
          order by created_at desc limit 100`,
        [req.user.id]
      ),
      db.query(
        `select created_at, type, stake, status, payout
           from app_trades where user_id = $1
          order by created_at desc limit 100`,
        [req.user.id]
      ),
    ]);

    const body = `
<div class="row-between">
  <div style="font-weight:700;font-size:16px">@${escapeHtml(req.user.username)}</div>
  <div class="balance">KES ${kes(req.user.balance)}</div>
</div>
<div class="section"><h2>Wallet</h2>${txTable(tx.rows)}</div>
<div class="section"><h2>Trades</h2>${tradeTable(tr.rows)}</div>
<p class="alt"><a href="/">← Back to trading</a> · <a href="/profile.php">Profile</a> · <a href="/logout">Log out</a></p>`;

    return res.type('html').send(layout({ title: 'History', heading: 'History', body, wide: true }));
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
