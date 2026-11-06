/* ============================================================
   Green Room — game layer: plan helpers, XP, stages, missions,
   weekly boss, badges and celebrations
   ============================================================ */
const G = {};
const REP_KINDS = ['scenario', 'impromptu', 'teachback', 'custom', 'question', 'spar', 'concision'];
const SCORED_REP_KINDS = ['scenario', 'impromptu', 'teachback', 'custom', 'question', 'spar'];
const f1 = (v) => (v == null || isNaN(v) ? '—' : (Math.round(Number(v) * 10) / 10).toFixed(1));
const s10 = (v) => (v == null || isNaN(v) ? '—' : (Math.round(Number(v)) / 10).toFixed(1)); // internal 0-100 → "7.8"

G.plan = function () {
  const p = (Store.profile && Store.profile.plan) || {};
  const d = C.DEFAULT_PLAN;
  return Object.assign({}, d, p, {
    baseline: Object.assign({}, d.baseline, p.baseline || {}),
    target: Object.assign({}, d.target, p.target || {}),
    overall: Object.assign({}, d.overall, p.overall || {}),
    strengths: p.strengths || [], tendencies: p.tendencies || {},
  });
};
G.scores = (s) => A.normScores(s && s.scores);
G.isoWeek = function (date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const wk = Math.ceil(((d - y0) / 86400000 + 1) / 7);
  return { key: `${d.getUTCFullYear()}-W${String(wk).padStart(2, '0')}`, n: d.getUTCFullYear() * 53 + wk };
};

/* ---------------- XP ---------------- */
G.baseXp = function (s) {
  const sc = G.scores(s), o = sc.overall;
  switch (s.kind) {
    case 'spar': return 25 + 4 * ((s.convo || []).filter((t) => t.role === 'me').length) + (s.boss && s.won ? 100 : 0);
    case 'drill': return 8;
    case 'visual': return 10;
    case 'game': return Math.min(30, Math.round((s.score || 0) / 60));
    case 'hsia': return 15 + (o ? Math.round(o / 10) : 0);
    case 'quest': return 30;
    case 'bonus': return s.xpFixed || 0;
    case 'concision': return 10 + (o ? Math.round(o / 10) : 0);
    case 'meeting': return 40 + (o >= 80 ? 20 : 0);
    default: {
      const h = s.hsia || {};
      const hits = ['headline', 'structure', 'implication', 'action'].filter((k) => h[k]).length;
      return 10 + (o ? Math.round(o / 10) : 0) + hits * 2 + (hits === 4 ? 5 : 0) + Math.min(9, (s.execPhrases || []).length * 3) + (s.coach ? 5 : 0) + (s.attempt > 1 && s.prevScore != null && o != null && o - s.prevScore >= 10 ? 10 : 0);
    }
  }
};
G.xpOf = (s) => Math.round(G.baseXp(s) * (s.mult || 1));
G.multFor = (streak) => (C.STREAK_MULT.find(([d]) => streak >= d) || [0, 1])[1];
G.multNow = function () {
  const st = G.stats();
  return G.multFor(st.days.has(dkey()) ? st.streak : st.streak + 1);
};

/* ---------------- Stats ---------------- */
let statsCache = null, statsKey = '';
G.stats = function () {
  const ss = Store.sessions, logs = Store.logs, p = Store.profile;
  const key = `${ss.length}:${ss[0] ? ss[0].ts + ':' + (ss[0].coach ? 1 : 0) + ':' + JSON.stringify(ss[0].scores || {}).length : 0}:${logs.length}:${logs[0] ? logs[0].ts : 0}:${Store.preps.length}:${Store.reviews.length}:${(p.lessonsRead || []).length}:${dkey()}:${JSON.stringify(p.plan || {}).length}`;
  if (statsCache && key === statsKey) return statsCache;
  const days = new Set(ss.filter((s) => s.kind !== 'bonus').map((s) => s.date).concat(logs.map((l) => l.date)));
  let streak = 0;
  const d = new Date();
  if (!days.has(dkey(d))) d.setDate(d.getDate() - 1);
  while (days.has(dkey(d))) { streak++; d.setDate(d.getDate() - 1); }
  let best = 0, run = 0, prev = null;
  for (const k of [...days].sort()) { const t = parseKey(k).getTime(); run = prev != null && Math.round((t - prev) / 86400000) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = t; }
  const reps = ss.filter((s) => REP_KINDS.includes(s.kind));
  const scored = ss.filter((s) => SCORED_REP_KINDS.includes(s.kind) && G.scores(s).overall != null).slice().reverse(); // oldest first
  const meetings = logs.filter((l) => l.kind === 'meeting' && l.scores && l.scores.overall != null).slice().reverse();
  const now = new Date();
  const monday = new Date(now); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const secs = (s) => s.durationSec || (s.kind === 'drill' ? (s.minutes || 2) * 60 : 0);
  const weekSec = ss.filter((s) => s.ts >= monday.getTime()).reduce((a, s) => a + secs(s), 0);
  const all = ss.concat(logs);
  const xp = all.reduce((a, s) => a + G.xpOf(s), 0) + Store.preps.length * 15 + Store.reviews.length * 15 + (p.lessonsRead || []).length * 5;
  const weekXp = all.filter((s) => s.ts >= monday.getTime()).reduce((a, s) => a + G.xpOf(s), 0);
  // rolling dimension averages: last 10 scored reps + last 5 meetings (double weight)
  const avg = (list, wFn) => {
    const out = {};
    for (const dm of C.DIMENSIONS.concat([{ id: 'overall' }])) {
      let sw = 0, sv = 0;
      for (const s of list) { const sc = s.kind === 'meeting' ? (s.scores.dims || {}) : G.scores(s); const v = dm.id === 'overall' ? s.scores.overall : sc[dm.id]; if (v != null && !isNaN(v)) { const w = wFn ? wFn(s) : 1; sw += w; sv += v * w; } }
      out[dm.id] = sw ? sv / sw : null;
    }
    return out;
  };
  const recentList = scored.slice(-10).concat(meetings.slice(-5));
  const current = recentList.length ? avg(recentList, (s) => (s.kind === 'meeting' ? 2 : 1)) : null;
  const first = scored.length >= 12 ? avg(scored.slice(0, 10)) : null;
  const last10 = scored.slice(-10).map((s) => G.scores(s).overall);
  const roll = last10.length ? last10.reduce((a, b) => a + b, 0) / last10.length : null;
  const meetings8 = meetings.filter((m) => m.scores.overall >= 80).length;
  // levels with promotion gates
  let xpLevel = C.LEVELS[0];
  for (const L of C.LEVELS) if (xp >= L.xp) xpLevel = L;
  const gateOk = (stage) => { const g = C.GATES[stage]; if (!g) return true; return last10.length >= g.reps && roll >= g.score && (!g.meetings || meetings8 >= g.meetings); };
  let level = xpLevel, pending = null;
  if (xpLevel.stage >= 2 && !gateOk(2)) { level = C.LEVELS[2]; pending = 2; }
  else if (xpLevel.stage >= 3 && !gateOk(3)) { level = C.LEVELS[5]; pending = 3; }
  const next = C.LEVELS[level.n] || null;
  const st = {
    days, streak, best, reps, scored, meetings, weekMin: Math.round(weekSec / 60), totalMin: Math.round(ss.reduce((a, s) => a + secs(s), 0) / 60),
    xp, weekXp, level, xpLevel, next, pending, roll, last10n: last10.length, meetings8, stage: C.STAGES[level.stage - 1],
    current, first, mult: G.multFor(streak),
    today: ss.filter((s) => s.date === dkey()),
  };
  statsCache = st; statsKey = key;
  return st;
};
G.gateProgress = function (stage, st = G.stats()) {
  const g = C.GATES[stage]; if (!g) return null;
  return [
    { label: `${g.reps} scored reps`, have: `${Math.min(st.last10n, g.reps)}/${g.reps}`, ok: st.last10n >= g.reps },
    { label: `10-rep average ${s10(g.score)}+`, have: st.roll != null ? s10(st.roll) : '—', ok: st.roll != null && st.roll >= g.score },
  ].concat(g.meetings ? [{ label: `${g.meetings} real meetings at ${s10(g.meetingScore)}+`, have: `${Math.min(st.meetings8, g.meetings)}/${g.meetings}`, ok: st.meetings8 >= g.meetings }] : []);
};

/* ---------------- Missions & boss ---------------- */
G.boss = function (date = new Date()) {
  const wk = G.isoWeek(date);
  const id = C.BOSS_ROTATION[wk.n % C.BOSS_ROTATION.length];
  const persona = C.PERSONAS.find((x) => x.id === id) || C.PERSONAS[0];
  const tries = Store.sessions.filter((s) => s.kind === 'spar' && s.boss && s.bossWeek === wk.key);
  const won = tries.some((s) => s.won);
  const best = tries.reduce((m, s) => Math.max(m, G.scores(s).overall || 0), 0);
  return { persona, week: wk.key, won, tries: tries.length, best };
};
const AREA_WARMUP = { A: 'eoa', B: 'concision', C: 'eoa', D: 'swaps', E: 'eoa' };
G.missions = function (date = new Date()) {
  const seed = daySeed(date);
  const p = Store.profile;
  const obj = p.objective || 'A';
  const dow = date.getDay();
  const warmKind = (seed % 2 === 0) ? AREA_WARMUP[obj] : ['pause-ladder', 'inflection', 'pace', 'swaps', 'concision'][seed % 5];
  const warm = warmKind === 'eoa'
    ? { kind: 'game', id: 'eoa', title: 'Executive or Analyst?', desc: 'Ten quick calls. Spot the executive line, build the reflex.', icon: 'bolt', xp: '~15 XP' }
    : (() => { const w = C.WARMUPS.find((x) => x.id === warmKind) || C.WARMUPS[0]; return { kind: 'drill', id: w.id, title: w.name, desc: w.why, icon: drillIcon(w.id), xp: '8 XP' }; })();
  let pool = C.SCENARIOS.filter((s) => s.areas.includes(obj));
  if (!pool.length) pool = C.SCENARIOS;
  const scen = pick(pool, seed + Math.floor(seed / 7));
  const core = { kind: 'scenario', id: scen.id, title: scen.title, desc: `Objective ${obj}: ${C.area(obj).title}.`, icon: 'mic', xp: '20–35 XP' };
  let stretch;
  const boss = G.boss(date);
  if (dow === 2 || dow === 4) stretch = boss.won
    ? (() => { const per = pick(C.PERSONAS.filter((x) => x.areas.includes(obj)).concat(C.PERSONAS), seed); return { kind: 'spar', id: per.id, title: `Spar: ${per.name}`, desc: per.role, icon: 'spar', xp: '~45 XP' }; })()
    : { kind: 'boss', id: boss.persona.id, title: `Boss: ${boss.persona.name}`, desc: 'Brutal difficulty. Score 8.0+ to win.', icon: 'medal', xp: '145+ XP' };
  else if (dow === 1) { const k = pick(C.HSIA_CASES, seed); stretch = { kind: 'hsia', id: k.id, title: `Headline Builder: ${k.title}`, desc: 'Turn raw notes into Headline, Structure, Implication, Action.', icon: 'layers', xp: '~25 XP' }; }
  else if (dow === 3) { const dx = C.dxEstimate(date); stretch = dx ? { kind: 'teachback', id: dx[0], title: `Teach-back: ${dx[2]}`, desc: 'Explain today\'s DX Daily lesson to a non-expert board member in 60 seconds.', icon: 'grad', xp: '20–35 XP' } : null; }
  else if (dow === 6) stretch = { kind: 'meeting', id: 'meeting', title: 'Review a real meeting', desc: 'Paste a transcript or notes. Get your scorecard.', icon: 'notebook', xp: '40–60 XP' };
  else if (dow === 0) stretch = { kind: 'review', id: 'week', title: 'Weekly review', desc: 'Patterns, wins and next week\'s objective.', icon: 'calendar', xp: '15 XP' };
  if (!stretch) { const q = pick(C.IMPROMPTU, seed); stretch = { kind: 'impromptu', id: String(C.IMPROMPTU.indexOf(q)), title: 'Impromptu: 60 seconds', desc: q, icon: 'bolt', xp: '20–35 XP' }; }
  const items = [warm, core, stretch];
  const today = Store.sessions.filter((s) => s.date === dkey(date));
  for (const it of items) {
    if (it.kind === 'review') it.done = Store.reviews.some((r) => r.date === dkey(date));
    else if (it.kind === 'meeting') it.done = Store.logs.some((l) => l.date === dkey(date) && l.kind === 'meeting');
    else if (it.kind === 'spar' || it.kind === 'boss') it.done = today.some((s) => s.kind === 'spar');
    else if (it.kind === 'game') it.done = today.some((s) => s.kind === 'game');
    else if (it.kind === 'hsia') it.done = today.some((s) => s.kind === 'hsia');
    else it.done = today.some((s) => s.kind === it.kind && String(s.refId) === String(it.id));
  }
  const lessonPool = C.LESSONS.filter((l) => ({ A: ['bluf', 'three', 'altitude'], B: ['concision', 'three', 'pauses'], C: ['dont-know', 'altitude', 'hedges'], D: ['hedges', 'inflection', 'disagree', 'tough-q'], E: ['listening', 'disagree', 'pregame'] }[obj] || []).includes(l.id));
  return { items, lesson: pick(lessonPool.length ? lessonPool : C.LESSONS, seed), allDone: items.every((i) => i.done) };
};
function drillIcon(id) { return { breath: 'breath', vocal: 'volume', enunciation: 'pen', 'pause-ladder': 'pace', inflection: 'pace', swaps: 'swap', pace: 'clock', concision: 'scissors', pregame: 'target' }[id] || 'target'; }

/* ---------------- Badges ---------------- */
G.badges = function (st = G.stats()) {
  const ss = Store.sessions, e = new Set();
  const reps = ss.filter((s) => SCORED_REP_KINDS.includes(s.kind) && s.kind !== 'spar');
  if (st.reps.length) e.add('first');
  if (st.best >= 3) e.add('streak3'); if (st.best >= 7) e.add('streak7'); if (st.best >= 30) e.add('streak30');
  const full = reps.filter((s) => s.hsia && s.hsia.headline && s.hsia.structure && s.hsia.implication && s.hsia.action).length;
  if (full >= 1) e.add('fullhouse'); if (full >= 10) e.add('fullhouse10');
  if (reps.filter((s) => s.hsia && s.hsia.headline).length >= 10) e.add('headline10');
  if (reps.some((s) => s.metrics && s.metrics.words >= 80 && s.metrics.hedges === 0)) e.add('nohedge');
  const used = new Set(); reps.forEach((s) => (s.execPhrases || []).forEach((x) => used.add(x)));
  if (used.size >= 5) e.add('arsenal5'); if (used.size >= C.EXEC_PHRASES.length) e.add('arsenal10');
  if (ss.some((s) => s.kind === 'game' && s.refId === 'eoa' && s.accuracy >= 90)) e.add('eoa90');
  if (ss.some((s) => s.kind === 'hsia' && G.scores(s).overall >= 80)) e.add('hsia8');
  const spars = ss.filter((s) => s.kind === 'spar');
  if (spars.length) e.add('spar1');
  const wins = new Set(spars.filter((s) => s.boss && s.won).map((s) => s.bossWeek));
  if (wins.size >= 1) e.add('boss1'); if (wins.size >= 4) e.add('boss4');
  if (spars.some((s) => s.refId === 'divided-room' && G.scores(s).overall >= 80)) e.add('room');
  if (st.meetings.length >= 1) e.add('meeting1'); if (st.meetings.length >= 5) e.add('meeting5'); if (st.meetings8 >= 1) e.add('meeting8');
  if (ss.filter((s) => s.kind === 'quest').length >= 3) e.add('quest3');
  if (reps.some((s) => s.attempt > 1 && s.prevScore != null && G.scores(s).overall - s.prevScore >= 10)) e.add('runback');
  if (reps.some((s) => G.scores(s).overall >= 85)) e.add('score85');
  const perfect = ss.filter((s) => s.kind === 'bonus' && s.refId === 'perfect').length;
  if (perfect >= 1) e.add('perfect'); if (perfect >= 7) e.add('perfect7');
  if (st.level.stage >= 2) e.add('stage2'); if (st.level.stage >= 3) e.add('stage3');
  return e;
};

/* ---------------- Progress checks & celebrations ---------------- */
let checkTimer = null;
G.check = function () { clearTimeout(checkTimer); checkTimer = setTimeout(G.checkNow, 400); };
G.checkNow = function () {
  if (Store.status === 'syncing') return; // wait for the real data before judging what's new
  const p = Store.profile; const g = Object.assign({}, p.game);
  const st = G.stats();
  const earned = [...G.badges(st)];
  if (g.seenBadges == null || g.level == null) { // first run: remember silently
    Store.saveProfile({ game: Object.assign(g, { seenBadges: earned, level: st.level.n, stage: st.level.stage }) });
    return;
  }
  const ms = G.missions();
  if (ms.allDone && !Store.sessions.some((s) => s.kind === 'bonus' && s.refId === 'perfect' && s.date === dkey())) {
    Store.put('sessions', { kind: 'bonus', refId: 'perfect', title: 'Perfect day', date: dkey(), ts: Date.now(), xpFixed: 25, mult: 1 });
    Celebrate.push({ kind: 'perfect', title: 'Perfect day', sub: 'All three missions done.', xp: 25 });
  }
  let changed = false;
  if (st.level.n > g.level) {
    const stageUp = st.level.stage > (g.stage || 1);
    Celebrate.push(stageUp
      ? { kind: 'stage', title: `Stage ${st.level.stage}: ${st.stage.name}`, sub: st.stage.blurb }
      : { kind: 'level', title: `Level ${st.level.n}: ${st.level.title}`, sub: st.next ? `${st.next.xp - st.xp} XP to ${st.next.title}` : 'Top of the ladder.' });
    g.level = st.level.n; g.stage = st.level.stage; changed = true;
  }
  const fresh = earned.filter((id) => !g.seenBadges.includes(id));
  for (const id of fresh) { const b = C.BADGES.find((x) => x.id === id); if (b) Celebrate.push({ kind: 'badge', title: b.name, sub: b.desc }); }
  if (fresh.length) { g.seenBadges = g.seenBadges.concat(fresh); changed = true; }
  if (changed) Store.saveProfile({ game: g });
};

const Celebrate = {
  queue: [], showing: false,
  push(c) { this.queue.push(c); if (!this.showing) setTimeout(() => this.next(), 350); },
  next() {
    const el = $('#celebrate');
    const c = this.queue.shift();
    if (!c || !el) { this.showing = false; if (el) el.hidden = true; return; }
    this.showing = true;
    const art = c.kind === 'stage' ? 'medal' : c.kind === 'level' ? 'progress' : c.kind === 'boss' ? 'medal' : c.kind === 'perfect' ? 'check' : c.kind === 'full' ? 'layers' : 'medal';
    const label = { stage: 'Promotion', level: 'Level up', badge: 'Badge unlocked', boss: 'Boss defeated', perfect: 'Bonus', full: 'Full house' }[c.kind] || 'Nice';
    el.innerHTML = `<canvas id="confetti" aria-hidden="true"></canvas><div class="cel-card" role="alertdialog" aria-label="${esc(label)}">
      <div class="cel-ring">${icon(art)}</div>
      <span class="eyebrow" style="color:var(--brass)">${esc(label)}</span>
      <h2 class="h1" style="text-align:center">${esc(c.title)}</h2>
      ${c.sub ? `<p class="muted" style="text-align:center">${esc(c.sub)}</p>` : ''}
      ${c.xp ? `<div class="xp-pop" style="font-size:18px">+${c.xp} XP</div>` : ''}
      <button class="btn block" data-act="cel-next">${this.queue.length ? 'Next' : 'Continue'}</button></div>`;
    el.hidden = false;
    confetti($('#confetti'), c.kind === 'stage' || c.kind === 'boss' ? 160 : 90);
    chime(c.kind === 'stage' || c.kind === 'boss' ? 'big' : 'small');
  },
};
function confetti(cv, n) {
  if (!cv || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const W = (cv.width = cv.offsetWidth || innerWidth), H = (cv.height = cv.offsetHeight || innerHeight);
  const ctx = cv.getContext('2d');
  const cs = getComputedStyle(document.documentElement);
  const cols = ['--brass-bright', '--good', '--brass', '--on-deep'].map((v) => cs.getPropertyValue(v).trim() || '#C79A3C');
  const ps = Array.from({ length: n }, () => ({ x: W / 2 + (Math.random() - 0.5) * 80, y: H * 0.42, vx: (Math.random() - 0.5) * 11, vy: -Math.random() * 12 - 4, r: Math.random() * 6 + 3, a: Math.random() * 6, va: (Math.random() - 0.5) * 0.4, c: cols[Math.floor(Math.random() * cols.length)] }));
  let t = 0;
  const step = () => {
    if (!cv.isConnected || t++ > 150) return;
    ctx.clearRect(0, 0, W, H);
    for (const p of ps) { p.vy += 0.32; p.x += p.vx; p.y += p.vy; p.a += p.va; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.globalAlpha = Math.max(0, 1 - t / 150); ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); ctx.restore(); }
    requestAnimationFrame(step);
  };
  step();
}
let audioCtx = null;
function chime(kind) {
  if (!Store.profile.settings.sound) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    audioCtx = audioCtx || new AC();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const notes = kind === 'big' ? [523.25, 659.25, 783.99, 1046.5] : kind === 'tick' ? [880] : [659.25, 987.77];
    notes.forEach((f, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      const t0 = audioCtx.currentTime + i * (kind === 'tick' ? 0 : 0.09);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(kind === 'tick' ? 0.05 : 0.09, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + (kind === 'tick' ? 0.12 : 0.5));
      o.connect(g); g.connect(audioCtx.destination); o.start(t0); o.stop(t0 + 0.6);
    });
  } catch (e) { /* sound is optional */ }
}
