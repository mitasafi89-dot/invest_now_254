'use strict';

// Shared chrome for server-rendered pages (login, register, profile,
// transactions). On-brand with the trading client (dark theme, green accent,
// Plus Jakarta Sans). Inline CSS is intentional: these are self-contained
// server pages, independent of the trading SPA bundle.

const { escapeHtml } = require('./render');

const STYLE = `
:root{--bg0:#07090f;--bg1:#0d1117;--bg2:#161b22;--bd:rgba(255,255,255,.09);
--bd2:rgba(255,255,255,.16);--t1:#e6edf3;--t2:#8b949e;--t3:#6e7681;
--green:#3fb950;--green-d:#2ea043;--red:#f85149;--gold:#e3b341;--blue:#58a6ff}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Plus Jakarta Sans',system-ui,sans-serif;background:
radial-gradient(1200px 600px at 50% -10%,rgba(63,185,80,.06),transparent),var(--bg0);
color:var(--t1);min-height:100vh;display:flex;flex-direction:column;
align-items:center;justify-content:flex-start;padding:32px 16px;line-height:1.5}
a{color:var(--blue);text-decoration:none}a:hover{text-decoration:underline}
.brand{display:flex;align-items:center;gap:9px;font-weight:800;font-size:18px;
color:var(--t1);margin-bottom:22px}
.brand:hover{text-decoration:none}
.logo{display:grid;place-items:center;width:30px;height:30px;border-radius:8px;
background:linear-gradient(135deg,var(--green),var(--green-d));color:#04130a;font-weight:800}
.card{width:100%;max-width:420px;background:var(--bg2);border:1px solid var(--bd);
border-radius:16px;padding:26px 24px;box-shadow:0 18px 50px rgba(0,0,0,.45)}
.card.wide{max-width:760px}
h1{font-size:21px;font-weight:700;margin-bottom:4px}
.sub{color:var(--t2);font-size:13px;margin-bottom:18px}
label{display:block;font-size:12.5px;font-weight:600;color:var(--t2);margin:14px 0 6px}
input[type=text],input[type=password],input[type=tel]{width:100%;background:var(--bg0);
border:1px solid var(--bd2);border-radius:10px;color:var(--t1);font-size:15px;
padding:11px 13px;font-family:inherit;transition:border-color .15s,box-shadow .15s}
input:focus{outline:none;border-color:var(--green);box-shadow:0 0 0 3px rgba(63,185,80,.18)}
.btn{width:100%;margin-top:20px;background:linear-gradient(135deg,var(--green),var(--green-d));
color:#04130a;font-weight:700;font-size:15px;border:none;border-radius:10px;
padding:12px;cursor:pointer;font-family:inherit}
.btn:hover{filter:brightness(1.06)}
.btn.ghost{background:transparent;color:var(--t1);border:1px solid var(--bd2)}
.alt{margin-top:18px;font-size:13.5px;color:var(--t2);text-align:center}
.hint{font-size:11.5px;color:var(--t3);margin-top:5px}
.alert{border-radius:10px;padding:10px 13px;font-size:13.5px;margin-bottom:4px}
.alert.error{background:rgba(248,81,73,.12);border:1px solid rgba(248,81,73,.4);color:#ffb4af}
.alert.success{background:rgba(63,185,80,.12);border:1px solid rgba(63,185,80,.4);color:#a6f0b0}
.section{border-top:1px solid var(--bd);margin-top:24px;padding-top:20px}
.section h2{font-size:15px;font-weight:700;margin-bottom:2px}
.row-between{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
table{width:100%;border-collapse:collapse;font-size:13.5px;margin-top:8px}
th,td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--bd)}
th{color:var(--t2);font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.4px}
td.num{font-family:ui-monospace,monospace;text-align:right}
.pos{color:var(--green)}.neg{color:var(--red)}
.pill{display:inline-block;font-size:11px;padding:2px 8px;border-radius:20px;border:1px solid var(--bd2);color:var(--t2)}
.empty{color:var(--t3);text-align:center;padding:26px 10px;font-size:14px}
.balance{font-family:ui-monospace,monospace;font-weight:700;color:var(--green)}
.topbar{width:100%;max-width:760px;display:flex;justify-content:flex-end;margin-bottom:-8px}
`;

function alert(type, msg) {
  if (!msg) return '';
  return `<div class="alert ${type}">${escapeHtml(msg)}</div>`;
}

function layout({ title, heading, sub, body, wide = false }) {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} — High Trade</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>${STYLE}</style>
</head><body>
<a class="brand" href="/"><span class="logo">H</span> High Trade</a>
<div class="card${wide ? ' wide' : ''}">
  <h1>${escapeHtml(heading)}</h1>
  ${sub ? `<p class="sub">${escapeHtml(sub)}</p>` : ''}
  ${body}
</div>
</body></html>`;
}

module.exports = { layout, alert };
