'use strict';

// Server-side rendering of the trading page (public/index.html).
// The client bundle is served unchanged; we only:
//   1. inject the real window.__BOOT state,
//   2. swap the header right-block for guest vs logged-in,
//   3. show the registered M-Pesa number inside the withdraw modal.

const fs = require('fs');
const path = require('path');

const INDEX_PATH = path.join(__dirname, '..', '..', 'public', 'index.html');

// Loaded once at startup; the file is static.
const TEMPLATE = fs.readFileSync(INDEX_PATH, 'utf8');

// Exact header right-block in the shipped HTML (guest version).
const GUEST_HEADER_BLOCK =
  '<a href="/login.php" class="hbtn ghost">Login</a>\n' +
  '    <a href="/register.php" class="hbtn primary">Sign Up</a>';

const WITHDRAW_NOTSET = 'Not set \u2014 update in profile';

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatKes(n) {
  return Number(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function guestHeader() {
  // Keep the original Login / Sign Up buttons. Add a hidden #headerBalance so
  // the client's per-tick updateHUD() never throws on a missing element.
  return (
    '<a href="/login.php" class="hbtn ghost">Login</a>\n' +
    '    <a href="/register.php" class="hbtn primary">Sign Up</a>\n' +
    '    <span id="headerBalance" hidden></span>'
  );
}

function userHeader(user) {
  const name = escapeHtml(user.username);
  const bal = formatKes(user.balance);
  return [
    `<span class="hbtn ghost" style="cursor:default" title="Wallet balance">KES <span id="headerBalance">${bal}</span></span>`,
    '<button class="hbtn primary" onclick="openDeposit()">Deposit</button>',
    '<button class="hbtn ghost" onclick="openWithdraw()">Withdraw</button>',
    `<a href="/profile.php" class="hbtn ghost" title="Profile">@${name}</a>`,
    '<a href="/transactions.php" class="hbtn ghost">History</a>',
    '<a href="/logout" class="hbtn ghost">Logout</a>',
  ].join('\n    ');
}

// Render the trading page for the given user (null/undefined => guest).
function renderIndex(user) {
  const loggedIn = Boolean(user);
  const boot = {
    balance: loggedIn ? Number(user.balance) : 0,
    userPhone: loggedIn ? (user.phone || '') : '',
    isLoggedIn: loggedIn,
    username: loggedIn ? user.username : 'Guest',
  };

  let html = TEMPLATE;

  // 1) __BOOT — replace the whole assignment (escape </ to keep it inside <script>).
  const bootJson = JSON.stringify(boot).replace(/</g, '\\u003c');
  html = html.replace(
    /window\.__BOOT\s*=\s*\{[^\n]*?\};/,
    `window.__BOOT = ${bootJson};`
  );

  // 2) Header right-block.
  html = html.replace(
    GUEST_HEADER_BLOCK,
    loggedIn ? userHeader(user) : guestHeader()
  );

  // 3) Withdraw modal: show the registered number when present.
  if (loggedIn && user.phone) {
    html = html.replace(WITHDRAW_NOTSET, escapeHtml(user.phone));
  }

  return html;
}

module.exports = { renderIndex, escapeHtml, formatKes };
