/* ============================================================
   Green Room — UI core: helpers, icons, charts, stats, shell
   ============================================================ */
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
const pad2 = (n) => String(n).padStart(2, '0');
const dkey = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const fmtSec = (s) => { s = Math.max(0, Math.round(s || 0)); return `${Math.floor(s / 60)}:${pad2(s % 60)}`; };
const fmtDate = (ts) => new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const fmtDateLong = (ts) => new Date(ts).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
const daySeed = (d = new Date()) => Math.floor(parseKey(dkey(d)).getTime() / 86400000);
const pick = (arr, seed) => arr[((seed % arr.length) + arr.length) % arr.length];
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } };
const scoreClass = (v) => (v == null ? '' : v >= 80 ? 'good' : v >= 60 ? 'warn' : 'bad');
const plural = (n, w, p) => `${n} ${n === 1 ? w : (p || w + 's')}`;

/* ---------------- Icons ---------------- */
const ICON_PATHS = {
  today: '<path d="M12 3v2.5M5.2 6.2l1.8 1.8M18.8 6.2L17 8M2.5 14H5M19 14h2.5M7 14a5 5 0 0 1 10 0"/><path d="M3 18h18M7 21h10"/>',
  mic: '<rect x="9" y="2.5" width="6" height="11.5" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
  spar: '<path d="M3.5 5.5h10a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H8.5l-3.5 3v-3H3.5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2z"/><path d="M15.5 9.5h4.5a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-1v3l-3.5-3H12a2 2 0 0 1-2-2"/>',
  toolkit: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8.5 7V5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2M3 12.5h18M10 12.5v2h4v-2"/>',
  progress: '<path d="M3 20.5h18"/><path d="M5 16l4.5-5 3.5 3 6-7"/><path d="M15 7h4v4"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  chev: '<path d="M9 5l7 7-7 7"/>',
  play: '<path d="M7.5 4.8v14.4L19 12z" fill="currentColor" stroke="none"/>',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2.5" fill="currentColor" stroke="none"/>',
  upload: '<path d="M12 15.5V4M7.5 8.5L12 4l4.5 4.5M4 15v3.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V15"/>',
  keyboard: '<rect x="2" y="6" width="20" height="12" rx="2.5"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7.5 14h9"/>',
  spark: '<path d="M11 3.5l1.7 4.8 4.8 1.7-4.8 1.7L11 16.5l-1.7-4.8L4.5 10l4.8-1.7z"/><path d="M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  yes: '<circle cx="12" cy="12" r="9"/><path d="M8 12.3l2.7 2.7L16 9.5"/>',
  partly: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>',
  no: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
  flame: '<path d="M12 2.5c.8 3.2 5.5 5.3 5.5 10.5a5.5 5.5 0 0 1-11 0c0-2.6 1.4-4.3 2.6-5.3.3 1.7 1.2 2.8 2.6 3.2-.3-3.1-.9-5.8.3-8.4z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  refresh: '<path d="M20 11.5a8 8 0 1 1-2.4-5.7"/><path d="M20 4v5h-5"/>',
  download: '<path d="M12 4v11.5M7.5 11L12 15.5 16.5 11M4 20h16"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  camera: '<path d="M3 8.5A2.5 2.5 0 0 1 5.5 6H7l2-2.5h6L17 6h1.5A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/><circle cx="12" cy="13" r="3.8"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5"/>',
  breath: '<path d="M3 9h10.5a3 3 0 1 0-3-3"/><path d="M3 15h14.5a3 3 0 1 1-3 3"/><path d="M3 12h7"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  pen: '<path d="M4 20l4.2-1L19 8.2 15.8 5 5 15.8z"/><path d="M13.8 7l3.2 3.2"/>',
  scissors: '<circle cx="6" cy="6" r="2.8"/><circle cx="6" cy="18" r="2.8"/><path d="M8.2 7.8L20 19.5M8.2 16.2L20 4.5"/>',
  bolt: '<path d="M13 2.5L4.5 14H11l-1 7.5 8.5-11.5H12z"/>',
  grad: '<path d="M2 9.5l10-5 10 5-10 5z"/><path d="M6 11.5v5c3.5 2.3 8.5 2.3 12 0v-5M22 9.5v5"/>',
  notebook: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3.5"/>',
  medal: '<circle cx="12" cy="15" r="5.5"/><path d="M8.5 3h7L14 9.8M10 9.8L8.5 3"/><path d="M12 12.5l.8 1.6 1.7.2-1.2 1.2.3 1.7-1.6-.8-1.6.8.3-1.7-1.2-1.2 1.7-.2z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  volume: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6M18.2 6.5a7.5 7.5 0 0 1 0 11"/>',
  mute: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
  send: '<path d="M4 12l16-8-5.5 16-2.8-6.2z"/><path d="M11.7 13.8L20 4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.2"/>',
  swap: '<path d="M7 3.5L3.5 7 7 10.5M3.5 7H17M17 13.5l3.5 3.5-3.5 3.5M20.5 17H7"/>',
  pace: '<path d="M2 12h3.5l2-6 3.5 12 3-9 2 5 1.5-2H22"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  file: '<path d="M14 3H6.5A2.5 2.5 0 0 0 4 5.5v13A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
};
function icon(name, cls = '') {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ''}</svg>`;
}
const BRAND_SVG = `<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="1" y="1" width="30" height="30" rx="9" fill="var(--deep)"/><path d="M8 21.5a8 8 0 0 1 16 0" fill="none" stroke="var(--brass-bright)" stroke-width="1.8" stroke-linecap="round"/><path d="M16 21.5l4.2-6.2" stroke="var(--on-deep)" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="21.5" r="1.8" fill="var(--on-deep)"/><path d="M10.2 16.3l1 .9M16 13.5v1.3M21.8 16.3l-1 .9" stroke="var(--on-deep-muted)" stroke-width="1.3" stroke-linecap="round"/></svg>`;

/* ---------------- Toast ---------------- */
let toastTimer = null;
function toast(msg, ms = 2600) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}
async function copyText(text, fallbackEl) {
  try { await navigator.clipboard.writeText(text); toast('Copied'); }
  catch (e) {
    if (fallbackEl) { const r = document.createRange(); r.selectNodeContents(fallbackEl); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast('Selected. Use your device\'s Copy.'); }
    else toast('Copy isn\'t available here.');
  }
}

/* ---------------- Gauge (VU meter) ---------------- */
function gauge(score, opts = {}) {
  const cx = 120, cy = 116, R = 96, a0 = -58, a1 = 58;
  const ang = (v) => a0 + ((a1 - a0) * A.clamp(v, 0, 100)) / 100;
  const pt = (deg, r) => [cx + r * Math.sin((deg * Math.PI) / 180), cy - r * Math.cos((deg * Math.PI) / 180)];
  const arc = (v0, v1, r) => { const [x0, y0] = pt(ang(v0), r), [x1, y1] = pt(ang(v1), r); return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
  let ticks = '';
  for (let v = 0; v <= 100; v += 5) {
    const major = v % 20 === 0;
    const [x0, y0] = pt(ang(v), R - (major ? 12 : 7)), [x1, y1] = pt(ang(v), R);
    ticks += `<line class="tick${major ? ' major' : ''}" x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" stroke-width="${major ? 1.6 : 1}"/>`;
    if (major) { const [lx, ly] = pt(ang(v), R + 11); ticks += `<text class="lbl" x="${lx.toFixed(1)}" y="${(ly + 3).toFixed(1)}" text-anchor="middle">${v}</text>`; }
  }
  const has = score != null && !isNaN(score);
  const target = has ? ang(score) : a0;
  const start = opts.animate === false ? target : a0;
  const id = 'g' + Math.random().toString(36).slice(2, 8);
  return `<svg class="gauge ${opts.dark ? 'on-deep' : ''}" viewBox="0 0 240 178" role="img" aria-label="${esc(opts.label || 'Presence score')}: ${has ? Math.round(score) : 'no score yet'}">
    <path class="arc" d="${arc(0, 100, R)}"/>
    <path class="zone-mid" d="${arc(60, 80, R + 2.5)}"/>
    <path class="zone-good" d="${arc(80, 100, R + 2.5)}"/>
    ${ticks}
    <g class="needle-g" id="${id}" data-target="${target}" style="transform: rotate(${start}deg); transform-origin: ${cx}px ${cy}px;">
      <line class="needle" x1="${cx}" y1="${cy + 8}" x2="${cx}" y2="${cy - R + 4}"/>
    </g>
    <circle class="pivot" cx="${cx}" cy="${cy}" r="5"/>
    <text class="score${has ? '' : ' empty'}" x="${cx}" y="${cy + (has ? 44 : 36)}" text-anchor="middle">${has ? Math.round(score) : 'No score yet'}</text>
    <text class="cap" x="${cx}" y="${cy + 59}" text-anchor="middle">${esc((opts.label || 'PRESENCE SCORE').toUpperCase())}</text>
  </svg>`;
}
function animateGauges(root = document) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    $$('.needle-g[data-target]', root).forEach((g) => { g.style.transform = `rotate(${g.dataset.target}deg)`; g.removeAttribute('data-target'); });
  }));
}

/* ---------------- Charts ---------------- */
function lineChart(values, opts = {}) {
  const W = opts.w || 340, H = opts.h || 150, padL = 28, padR = 34, padT = 12, padB = 20;
  const vals = values.map((v) => (v == null ? null : Number(v)));
  const pts = vals.map((v, i) => [i, v]).filter(([, v]) => v != null);
  if (pts.length < 2) return '';
  let min = opts.min != null ? opts.min : Math.min(...pts.map((p) => p[1]));
  let max = opts.max != null ? opts.max : Math.max(...pts.map((p) => p[1]));
  if (opts.band) { min = Math.min(min, opts.band[0] - 10); max = Math.max(max, opts.band[1] + 10); }
  if (max - min < 1) { max += 1; min -= 1; }
  const n = vals.length;
  const x = (i) => padL + ((W - padL - padR) * i) / Math.max(1, n - 1);
  const y = (v) => padT + (H - padT - padB) * (1 - (v - min) / (max - min));
  const ticks = opts.ticks || [min, (min + max) / 2, max].map((t) => Math.round(t));
  let g = '<g class="grid">' + ticks.map((t) => `<line x1="${padL}" x2="${W - padR}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}"/>`).join('') + '</g>';
  g += ticks.map((t) => `<text class="axis" x="${padL - 6}" y="${(y(t) + 3).toFixed(1)}" text-anchor="end">${t}</text>`).join('');
  if (opts.band) g += `<rect class="band" x="${padL}" width="${W - padL - padR}" y="${y(opts.band[1]).toFixed(1)}" height="${(y(opts.band[0]) - y(opts.band[1])).toFixed(1)}"/>`;
  const d = pts.map(([i, v], k) => `${k ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  if (opts.area !== false) g += `<path class="area" d="${d} L${x(pts[pts.length - 1][0]).toFixed(1)} ${H - padB} L${x(pts[0][0]).toFixed(1)} ${H - padB} Z"/>`;
  g += `<path class="line" d="${d}"/>`;
  if (opts.avg && pts.length >= 4) {
    const k = opts.avg; const ma = [];
    for (let j = 0; j < pts.length; j++) { const w = pts.slice(Math.max(0, j - k + 1), j + 1).map((p) => p[1]); ma.push([pts[j][0], w.reduce((a, b) => a + b, 0) / w.length]); }
    g += `<path class="line avg" d="${ma.map(([i, v], j) => `${j ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')}"/>`;
  }
  if (pts.length <= 40) g += pts.slice(0, -1).map(([i, v]) => `<circle class="dot" cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="2"/>`).join('');
  const [li, lv] = pts[pts.length - 1];
  g += `<circle class="dot end" cx="${x(li).toFixed(1)}" cy="${y(lv).toFixed(1)}" r="4.5"/>`;
  g += `<text class="endlbl" x="${(x(li) + 8).toFixed(1)}" y="${(y(lv) + 4).toFixed(1)}">${esc(opts.fmt ? opts.fmt(lv) : Math.round(lv))}</text>`;
  if (opts.xlabels) g += `<text class="axis" x="${padL}" y="${H - 4}">${esc(opts.xlabels[0])}</text><text class="axis" x="${W - padR}" y="${H - 4}" text-anchor="end">${esc(opts.xlabels[1])}</text>`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || 'Trend chart')}">${g}</svg>`;
}

function radarChart(now, then, dims) {
  const W = 320, H = 250, cx = 160, cy = 126, R = 82;
  const n = dims.length;
  const p = (i, r) => { const a = (-90 + (360 / n) * i) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  let g = '';
  for (const lv of [0.25, 0.5, 0.75, 1]) g += `<polygon class="radar-grid" points="${dims.map((_, i) => p(i, R * lv).map((v) => v.toFixed(1)).join(',')).join(' ')}"/>`;
  dims.forEach((_, i) => { const [x, y] = p(i, R); g += `<line class="radar-grid" x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--line)"/>`; });
  const poly = (vals, cls) => `<polygon class="${cls}" points="${dims.map((dm, i) => p(i, R * A.clamp((vals[dm.id] || 0) / 100, 0, 1)).map((v) => v.toFixed(1)).join(',')).join(' ')}"/>`;
  if (then) g += poly(then, 'radar-then');
  g += poly(now, 'radar-now');
  dims.forEach((dm, i) => {
    const [x, y] = p(i, R + 20);
    const anchor = Math.abs(x - cx) < 10 ? 'middle' : x > cx ? 'start' : 'end';
    const yy = y < cy - R ? y - 2 : y;
    g += `<text class="radar-lbl" x="${x.toFixed(1)}" y="${yy.toFixed(1)}" text-anchor="${anchor}">${esc(dm.name.replace('Executive ', ''))}</text>`;
    g += `<text class="radar-val" x="${x.toFixed(1)}" y="${(yy + 12).toFixed(1)}" text-anchor="${anchor}">${now[dm.id] != null ? Math.round(now[dm.id]) : '—'}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Score profile by dimension">${g}</svg>`;
}

function waveSvg(wave) {
  if (!wave || !wave.length) return '';
  const W = 320, H = 56, n = wave.length, bw = W / n;
  return `<svg class="wave" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${wave.map((v, i) => { const h = Math.max(1.5, v * (H - 4)); return `<rect x="${(i * bw).toFixed(2)}" y="${((H - h) / 2).toFixed(2)}" width="${Math.max(0.8, bw - 0.6).toFixed(2)}" height="${h.toFixed(2)}" rx="0.6"/>`; }).join('')}</svg>`;
}

function bars(scores, dims = C.DIMENSIONS) {
  return `<div class="bars">${dims.filter((d) => scores[d.id] != null).map((d) => {
    const v = Math.round(scores[d.id]);
    return `<div class="bar"><span>${esc(d.name)}</span><span class="track"><span class="fill ${scoreClass(v)}" style="width:${v}%"></span></span><span class="val">${v}</span></div>`;
  }).join('')}</div>`;
}

/* ---------------- Stats ---------------- */
const REP_KINDS = ['scenario', 'impromptu', 'teachback', 'custom', 'question', 'spar', 'concision'];
function sessionXp(s) {
  if (s.kind === 'spar') return 25 + 3 * ((s.convo || []).filter((t) => t.role === 'me').length);
  if (s.kind === 'drill') return 6;
  if (s.kind === 'visual') return 10;
  const sc = s.scores && s.scores.overall;
  return 10 + (sc ? Math.round(sc / 10) : 0) + (s.coach ? 5 : 0) + (s.attempt > 1 ? 3 : 0);
}
function computeStats() {
  const ss = Store.sessions, logs = Store.logs;
  const days = new Set(ss.map((s) => s.date).concat(logs.map((l) => l.date)));
  let streak = 0;
  const d = new Date();
  if (!days.has(dkey(d))) d.setDate(d.getDate() - 1);
  while (days.has(dkey(d))) { streak++; d.setDate(d.getDate() - 1); }
  let best = 0, run = 0, prev = null;
  for (const k of [...days].sort()) {
    const t = parseKey(k).getTime();
    run = prev != null && Math.round((t - prev) / 86400000) === 1 ? run + 1 : 1;
    best = Math.max(best, run); prev = t;
  }
  const reps = ss.filter((s) => REP_KINDS.includes(s.kind));
  const scored = reps.filter((s) => s.scores && s.scores.overall != null).slice().reverse(); // oldest first
  const now = new Date();
  const monday = new Date(now); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const secs = (s) => s.durationSec || (s.kind === 'drill' ? (s.minutes || 2) * 60 : 0);
  const weekSec = ss.filter((s) => s.ts >= monday.getTime()).reduce((a, s) => a + secs(s), 0);
  const totalSec = ss.reduce((a, s) => a + secs(s), 0);
  const p = Store.profile || {};
  const xp = ss.reduce((a, s) => a + sessionXp(s), 0) + logs.length * 15 + Store.preps.length * 10 + Store.reviews.length * 10 + (p.lessonsRead || []).length * 4;
  let lvl = C.LEVELS[0], next = null;
  for (let i = 0; i < C.LEVELS.length; i++) if (xp >= C.LEVELS[i].xp) { lvl = C.LEVELS[i]; next = C.LEVELS[i + 1] || null; }
  const avgDims = (list) => {
    const out = {};
    for (const dm of C.DIMENSIONS) { const v = list.map((s) => s.scores && s.scores[dm.id]).filter((x) => x != null); out[dm.id] = v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; }
    const o = list.map((s) => s.scores.overall).filter((x) => x != null); out.overall = o.length ? o.reduce((a, b) => a + b, 0) / o.length : null;
    return out;
  };
  const last7 = scored.filter((s) => s.ts >= Date.now() - 7 * 86400000);
  return {
    days, streak, best, reps, scored, weekMin: Math.round(weekSec / 60), totalMin: Math.round(totalSec / 60), xp, level: lvl, next,
    recent: scored.length ? avgDims(scored.slice(-10)) : null,
    first: scored.length >= 12 ? avgDims(scored.slice(0, 10)) : null,
    week: last7.length ? avgDims(last7) : null,
    today: ss.filter((s) => s.date === dkey()),
  };
}
function earnedBadges(st) {
  const ss = Store.sessions, e = new Set();
  const reps = st.reps;
  if (reps.length) e.add('first');
  if (st.best >= 3) e.add('streak3'); if (st.best >= 7) e.add('streak7'); if (st.best >= 30) e.add('streak30');
  if (reps.filter((s) => s.metrics && s.metrics.bluf === true).length >= 5) e.add('bluf5');
  if (reps.some((s) => s.metrics && s.source !== 'typed' && (s.durationSec || 0) >= 60 && s.metrics.fillers === 0 && s.source !== 'dictation')) e.add('clean60');
  if (reps.some((s) => s.metrics && s.metrics.words >= 80 && s.metrics.hedges === 0)) e.add('nohedge');
  const p = Store.profile.settings;
  if (reps.filter((s) => s.metrics && s.metrics.wpm && s.metrics.wpm >= p.paceLo && s.metrics.wpm <= p.paceHi).length >= 5) e.add('pocket5');
  const spars = ss.filter((s) => s.kind === 'spar');
  if (spars.length >= 1) e.add('spar1'); if (spars.length >= 5) e.add('spar5');
  if (reps.some((s) => s.attempt > 1 && s.prevScore != null && s.scores && s.scores.overall - s.prevScore >= 10)) e.add('runback');
  if (reps.some((s) => s.scores && s.scores.overall >= 85)) e.add('score85');
  if (reps.length >= 25) e.add('reps25'); if (reps.length >= 100) e.add('reps100');
  if (Store.logs.length >= 5) e.add('field5');
  if (ss.some((s) => s.kind === 'visual')) e.add('camera');
  if (Store.preps.length >= 3) e.add('prep3');
  return e;
}

/* ---------------- Daily plan ---------------- */
const SKILL_WARMUP = { pauses: 'pause-ladder', fillers: 'pause-ladder', vocal_variety: 'inflection', enunciation: 'enunciation', pace: 'pace', concision: 'concision', hedging: 'swaps', ownership: 'swaps', precision: 'swaps', composure: 'breath', qa: 'breath', conviction: 'inflection' };
function focusOrder() {
  const p = Store.profile;
  const focus = (p.focus && p.focus.length ? p.focus : C.STARTER_FOCUS).slice();
  const st = computeStats();
  return focus.map((id, i) => {
    const r = p.ratings[id] || 3;
    const dim = C.SKILL_DIM[id];
    const recent = st.recent && st.recent[dim] != null ? st.recent[dim] : 70;
    const evPri = p.evaluation && p.evaluation.areas ? (p.evaluation.areas.find((a) => a.skill === id) || {}).priority : null;
    return { id, w: (6 - r) * 10 + (100 - recent) * 0.4 + (evPri ? (4 - evPri) * 6 : 0) - i };
  }).sort((a, b) => b.w - a.w).map((x) => x.id);
}
function dailyPlan(date = new Date()) {
  const seed = daySeed(date);
  const order = focusOrder();
  const target = order[seed % Math.max(1, Math.min(3, order.length))] || 'bluf';
  const warmId = SKILL_WARMUP[order[(seed + 1) % order.length]] || pick(C.WARMUPS, seed).id;
  const warm = C.WARMUPS.find((w) => w.id === warmId) || C.WARMUPS[0];
  let matches = C.SCENARIOS.filter((s) => s.focus.includes(target));
  if (!matches.length) matches = C.SCENARIOS;
  const scen = pick(matches, Math.floor(seed / 3) + seed);
  const dow = date.getDay();
  let stretch;
  if (dow === 2 || dow === 4) { const per = pick(C.PERSONAS.filter((x) => x.focus.some((f) => order.includes(f))).concat(C.PERSONAS), seed); stretch = { kind: 'spar', id: per.id, title: `Spar with ${per.name}`, desc: `${per.role}. Five live questions, then a debrief.`, icon: 'spar', meta: '8 min' }; }
  else if (dow === 3) { const dx = C.dxEstimate(date); stretch = dx ? { kind: 'teachback', id: dx[0], title: `Teach-back: ${dx[2]}`, desc: 'Explain today\'s DX Daily lesson to a non-expert board member in 60 seconds.', icon: 'grad', meta: '3 min' } : null; }
  else if (dow === 0) stretch = { kind: 'review', id: 'week', title: 'Weekly review', desc: 'See your patterns and set next week\'s focus.', icon: 'calendar', meta: '3 min' };
  else if (dow === 6) stretch = { kind: 'log', id: 'log', title: 'Log a real meeting', desc: 'Rate how you showed up this week and capture one lesson.', icon: 'notebook', meta: '3 min' };
  if (!stretch) { const q = pick(C.IMPROMPTU, seed); stretch = { kind: 'impromptu', id: String(C.IMPROMPTU.indexOf(q)), title: 'Impromptu: 60 seconds', desc: q, icon: 'bolt', meta: '2 min' }; }
  const items = [
    { kind: 'drill', id: warm.id, title: warm.name, desc: warm.why, icon: drillIcon(warm.id), meta: `${warm.minutes} min` },
    { kind: 'scenario', id: scen.id, title: scen.title, desc: `Focus: ${(C.skill(target) || {}).name || ''}. ${scen.audience}`, icon: 'mic', meta: `${scen.time}s rep` },
    stretch,
  ];
  const today = Store.sessions.filter((s) => s.date === dkey(date));
  for (const it of items) {
    if (it.kind === 'review') it.done = Store.reviews.some((r) => r.date === dkey(date));
    else if (it.kind === 'log') it.done = Store.logs.some((l) => l.date === dkey(date));
    else if (it.kind === 'spar') it.done = today.some((s) => s.kind === 'spar');
    else it.done = today.some((s) => s.kind === it.kind && String(s.refId) === String(it.id));
  }
  return { items, target, lesson: pick(C.LESSONS.filter((l) => order.slice(0, 3).some((id) => (C.skill(id) || {}).pillar === l.pillar)).concat(C.LESSONS), seed) };
}
function drillIcon(id) { return { breath: 'breath', vocal: 'volume', enunciation: 'pen', 'pause-ladder': 'pace', inflection: 'pace', swaps: 'swap', pace: 'clock', concision: 'scissors', pregame: 'target' }[id] || 'target'; }
