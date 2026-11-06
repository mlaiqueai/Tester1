/* ============================================================
   Green Room — tab views
   ============================================================ */
const S = {
  route: 'today', sheet: null, rep: null, spar: null, drill: null, tool: null, game: null,
  micBlocked: lsGet('gr.micBlocked', '0') === '1',
  practiceCat: 'all', historyN: 15, pendingRender: false,
};
const TABS = [
  ['today', 'Today', 'today'], ['practice', 'Practice', 'mic'], ['spar', 'Spar', 'spar'], ['toolkit', 'Toolkit', 'toolkit'], ['progress', 'Progress', 'progress'],
];
const ROUTES = ['today', 'practice', 'spar', 'toolkit', 'progress', 'me'];

function renderTabs() {
  const html = TABS.map(([id, label, ic]) => `<button class="tab" data-act="go" data-to="${id}" ${S.route === id ? 'aria-current="page"' : ''}>${icon(ic)}<span>${label}</span></button>`).join('');
  $('#tabsBottom').innerHTML = html;
  $('#tabsTop').innerHTML = html;
  const st = G.stats();
  $('#streakChip').innerHTML = `${icon('flame')}<span>${st.streak}</span>${st.mult > 1 ? `<span class="mult">×${st.mult}</span>` : ''}<span class="sr"> day streak</span>`;
  const name = (Store.profile.name || '').trim();
  $('#avatarBtn').textContent = name ? name[0].toUpperCase() : '';
  if (!name) $('#avatarBtn').innerHTML = icon('user');
  $('#avatarBtn').setAttribute('aria-current', S.route === 'me' ? 'page' : 'false');
}

function renderView() {
  const el = $('#view');
  if (S.deferRender) { S.deferRender = false; clearTimeout(S.renderTimer); S.renderTimer = setTimeout(renderView, 350); return; }
  const ae = document.activeElement;
  if (ae && el.contains(ae) && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) { S.pendingRender = true; return; }
  S.pendingRender = false;
  const fn = { today: viewToday, practice: viewPractice, spar: viewSpar, toolkit: viewToolkit, progress: viewProgress, me: viewMe }[S.route] || viewToday;
  el.innerHTML = fn();
  renderTabs();
  animateGauges(el);
}

function storageNote() { return Store.note ? `<div class="note warn">${icon('info')}<span>${esc(Store.note)}</span></div>` : ''; }
function aiOffNote(what = 'AI coaching') {
  if (AI.state !== 'off') return '';
  return `<div class="note">${icon('info')}<span>${esc(what)} uses Claude, which isn't available in this view. Scoring, games, drills and progress all still work.</span></div>`;
}
const areaPill = (id, on) => `<span class="pill area ${on ? 'brass' : ''}" title="${esc(C.area(id).title)}">${id}</span>`;
function levelBar(st) {
  const lo = st.level.xp, hi = st.next ? st.next.xp : st.level.xp;
  const pct = st.next ? A.clamp(Math.round(((st.xp - lo) / (hi - lo)) * 100), 0, 100) : 100;
  return `<div class="levelbar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>`;
}
function missionRow(it) {
  return `<button class="plan-item ${it.done ? 'done' : ''}" data-act="plan" data-kind="${it.kind}" data-id="${esc(it.id)}">
    <span class="ic">${icon(it.done ? 'check' : it.icon)}</span>
    <span style="min-width:0"><span class="t">${esc(it.title)}</span><span class="d" style="display:block">${esc(it.desc)}</span></span>
    <span class="meta">${it.done ? 'done' : esc(it.xp)}</span></button>`;
}

/* ---------------- Today ---------------- */
function viewToday() {
  const p = Store.profile, st = G.stats(), ms = G.missions(), pl = G.plan(), boss = G.boss();
  const hr = new Date().getHours();
  const greet = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  const obj = C.area(p.objective || 'A');
  const doneN = ms.items.filter((i) => i.done).length;
  const curOverall = st.current ? st.current.overall : null;
  const promo = st.pending ? G.gateProgress(st.pending, st) : null;
  return `<div class="page">
    <section class="hero" aria-label="Your presence today">
      <span class="eyebrow" style="color:var(--on-deep-muted)">${esc(fmtDateLong(Date.now()))}</span>
      <h1 class="greet">${greet}${p.name ? ', ' + esc(p.name.split(' ')[0]) : ''}.</h1>
      <button class="stage-chip" data-act="go" data-to="progress"><span class="stage-n">Stage ${st.level.stage}</span>${esc(st.stage.name)} · Lv ${st.level.n} ${esc(st.level.title)}</button>
      ${levelBar(st)}
      <p class="sub">${st.pending ? `Promotion to Stage ${st.pending} is waiting on your scores. See below.` : st.next ? `${st.next.xp - st.xp} XP to ${esc(st.next.title)}` : 'Top of the ladder.'}</p>
      <div class="gauge-wrap">${gauge(curOverall, { dark: true, label: 'Presence · rolling', base: pl.overall.baseline * 10, target: pl.overall.target * 10 })}</div>
      <div class="hero-stats">
        <div class="hero-stat"><div class="v">${st.streak}${st.mult > 1 ? `<span class="hs-mult">×${st.mult}</span>` : ''}</div><div class="k">Day streak</div></div>
        <div class="hero-stat"><div class="v">${st.weekXp}</div><div class="k">XP this week</div></div>
        <div class="hero-stat"><div class="v">${doneN}<span style="font-size:15px;opacity:.7">/3</span></div><div class="k">Missions</div></div>
      </div>
    </section>
    ${storageNote()}
    ${!p.onboarded ? `<section class="card raised stack"><span class="eyebrow">Make it yours</span><h2 class="h2">Load your development plan</h2><p class="muted">Paste your executive presence plan or assessment. The coach sets your baselines, targets and tendencies, and every score is measured against them.</p><div class="actions"><button class="btn" data-act="open" data-sheet="plan">${icon('file')}Load my plan</button></div></section>` : ''}
    ${promo ? `<section class="card stack promo"><div class="row between"><span class="eyebrow">Promotion review · Stage ${st.pending}</span><span class="pill brass">${esc(C.STAGES[st.pending - 1].name)}</span></div><p class="small muted">You have the XP. Promotion needs the scores too.</p>${promo.map((g) => `<div class="crit ${g.ok ? 'yes' : 'no'}">${icon(g.ok ? 'yes' : 'partly')}<span>${esc(g.label)} <span class="mono small muted">${esc(g.have)}</span></span></div>`).join('')}</section>` : ''}
    <section class="section" aria-label="Daily missions">
      <div class="section-head"><h2 class="h2">Daily missions</h2><span class="small muted mono">${ms.allDone ? 'perfect day +25' : 'all 3: +25 XP'}</span></div>
      <div class="plan">${ms.items.map(missionRow).join('')}</div>
      ${st.mult > 1 ? `<p class="small muted">${icon('flame', 'inline-ic')} Your ${st.streak}-day streak multiplies XP ×${st.mult}.</p>` : `<p class="small muted">Practice three days running for an XP multiplier.</p>`}
    </section>
    <section class="card stack objective" aria-label="This week's objective">
      <div class="row between"><span class="eyebrow">This week's objective</span><button class="link" data-act="open" data-sheet="objective">Change</button></div>
      <div class="row nowrap" style="gap:12px;align-items:flex-start"><span class="area-badge">${obj.id}</span><div><h2 class="h2" style="font-size:20px">${esc(obj.title)}</h2>
      ${(pl.tendencies[obj.id] || []).length ? `<p class="small muted" style="margin-top:4px">Watch for: ${esc(pl.tendencies[obj.id].join('; '))}</p>` : ''}</div></div>
      <div class="stack" style="gap:6px">${obj.desired.map((d) => `<div class="crit yes">${icon('target')}<span>${esc(d)}</span></div>`).join('')}</div>
      ${p.nextAdjustment ? `<div class="note warn">${icon('notebook')}<span><b>From your last meeting:</b> ${esc(p.nextAdjustment)}</span></div>` : ''}
    </section>
    <section class="boss card stack" aria-label="Boss of the week">
      <div class="row between"><span class="eyebrow">Boss of the week</span><span class="pill ${boss.won ? 'good' : 'brass'}">${boss.won ? 'Defeated' : '+100 XP'}</span></div>
      <div class="row nowrap" style="gap:12px"><span class="boss-mark">${esc(boss.persona.name.replace(/^The /, '')[0])}</span><div style="min-width:0"><div class="h3">${esc(boss.persona.name)}</div><div class="small muted">${esc(boss.persona.role)} · Brutal · win with 8.0+</div></div></div>
      ${boss.tries ? `<div class="small muted">Best so far: <b class="mono">${s10(boss.best)}</b> in ${plural(boss.tries, 'try', 'tries')}</div>` : ''}
      <button class="btn ${boss.won ? 'secondary' : 'deep'}" data-act="boss">${icon('spar')}${boss.won ? 'Rematch' : 'Take it on'}</button>
    </section>
    <section class="grid2" aria-label="Quick play">
      <button class="tile" data-act="game" data-id="eoa"><span class="tile-ic">${icon('bolt')}</span><span class="t">Executive or Analyst?</span><span class="d">Best ${Store.profile.game.eoaBest || 0}</span></button>
      <button class="tile" data-act="open" data-sheet="hsia"><span class="tile-ic">${icon('layers')}</span><span class="t">Headline Builder</span><span class="d">H → S → I → A</span></button>
    </section>
    <section class="section" aria-label="Meeting cycle">
      <h2 class="h2">Big meeting coming up?</h2>
      <div class="cycle">
        <button class="cycle-step" data-act="open" data-sheet="prep"><span class="eyebrow">Before</span><span class="t">Prep</span><span class="d">Message, 3 points, hard questions</span></button>
        <button class="cycle-step" data-act="open" data-sheet="pregame"><span class="eyebrow">During</span><span class="t">Pre-game</span><span class="d">2-minute reset + rules</span></button>
        <button class="cycle-step" data-act="open" data-sheet="meeting"><span class="eyebrow">After</span><span class="t">Review</span><span class="d">Scorecard from the transcript</span></button>
      </div>
    </section>
    <section class="card stack" aria-label="Lesson of the day">
      <span class="eyebrow">Lesson of the day · ${ms.lesson.min} min</span>
      <h3 class="h2">${esc(ms.lesson.title)}</h3>
      <p class="muted">${esc(ms.lesson.key)}</p>
      <div><button class="btn secondary sm" data-act="lesson" data-id="${ms.lesson.id}">${icon('book')}Read · 5 XP</button></div>
    </section>
    ${aiOffNote()}
  </div>`;
}

/* ---------------- Practice ---------------- */
function viewPractice() {
  const cats = [['all', 'All']].concat(C.AREAS.map((a) => [a.id, `${a.id} · ${a.short}`]));
  const obj = Store.profile.objective;
  const list = C.SCENARIOS.filter((s) => S.practiceCat === 'all' || s.areas.includes(S.practiceCat));
  const doneIds = new Set(Store.sessions.filter((s) => s.kind === 'scenario').map((s) => s.refId));
  const best = (id) => Store.sessions.filter((s) => s.kind === 'scenario' && s.refId === id).reduce((m, s) => Math.max(m, G.scores(s).overall || 0), 0);
  const dx = C.dxEstimate(new Date());
  return `<div class="page">
    <div class="stack"><h1 class="h1">Practice</h1><p class="muted">Short reps scored against your plan. Every rep checks Headline, Structure, Implication and Action.</p></div>
    <section class="grid2">
      <button class="tile" data-act="game" data-id="eoa"><span class="tile-ic">${icon('bolt')}</span><span class="t">Executive or Analyst?</span><span class="d">Quick-fire · best ${Store.profile.game.eoaBest || 0}</span></button>
      <button class="tile" data-act="open" data-sheet="hsia"><span class="tile-ic">${icon('layers')}</span><span class="t">Headline Builder</span><span class="d">Notes → H · S · I · A</span></button>
    </section>
    <section class="section">
      <h2 class="eyebrow">Quick reps</h2>
      <div class="list">
        <button class="list-row has-ic" data-act="quick" data-q="impromptu"><span class="ic">${icon('bolt')}</span><span><span class="t">Impromptu, 60 seconds</span><span class="d" style="display:block">A random question. Take a position in the first sentence.</span></span>${icon('chev', 'chev')}</button>
        ${dx ? `<button class="list-row has-ic" data-act="quick" data-q="teachback"><span class="ic">${icon('grad')}</span><span><span class="t">Teach-back: today's DX Daily lesson</span><span class="d" style="display:block">${esc(dx[2])}</span></span>${icon('chev', 'chev')}</button>` : ''}
        <button class="list-row has-ic" data-act="quick" data-q="custom"><span class="ic">${icon('pen')}</span><span><span class="t">Your own prompt</span><span class="d" style="display:block">Rehearse a real question or opening you face this week.</span></span>${icon('chev', 'chev')}</button>
      </div>
    </section>
    <section class="section">
      <div class="section-head"><h2 class="h2">Scenarios</h2></div>
      <div class="seg" role="group" aria-label="Filter by development area">${cats.map(([id, n]) => `<button data-act="cat" data-id="${id}" aria-pressed="${S.practiceCat === id}">${esc(n)}</button>`).join('')}</div>
      <div class="list">${list.map((s) => { const b = best(s.id); return `<button class="list-row" data-act="scenario" data-id="${s.id}"><span style="min-width:0"><span class="t">${esc(s.title)}</span><span class="d" style="display:block">${esc(s.audience)}</span><span class="tag-row" style="margin-top:6px"><span class="pill">${s.time}s</span>${s.areas.map((a) => areaPill(a, a === obj)).join('')}${b ? `<span class="pill ${b >= 85 ? 'good' : b >= 70 ? 'warn' : 'bad'}">best ${s10(b)}</span>` : doneIds.has(s.id) ? '<span class="pill good">done</span>' : ''}</span></span>${icon('chev', 'chev')}</button>`; }).join('')}</div>
    </section>
    <section class="section">
      <h2 class="h2">Articulation drills</h2>
      <div class="list">${C.WARMUPS.map((w) => `<button class="list-row has-ic" data-act="drill" data-id="${w.id}"><span class="ic">${icon(drillIcon(w.id))}</span><span><span class="t">${esc(w.name)}</span><span class="d" style="display:block">${esc(w.why)}</span></span><span class="pill">${w.minutes} min</span></button>`).join('')}</div>
    </section>
  </div>`;
}

/* ---------------- Spar ---------------- */
function viewSpar() {
  const recent = Store.sessions.filter((s) => s.kind === 'spar').slice(0, 5);
  const boss = G.boss();
  return `<div class="page">
    <div class="stack"><h1 class="h1">Spar</h1><p class="muted">Live role-play. Claude plays a demanding audience, reacts to what you actually say, then debriefs every answer against your plan.</p></div>
    ${AI.state === 'off' ? `<div class="note">${icon('info')}<span>Live follow-ups need Claude, which isn't available in this view. You can still practice each persona's question bank.</span></div>` : ''}
    <section class="boss card stack"><div class="row between"><span class="eyebrow">Boss of the week · ${esc(boss.week)}</span><span class="pill ${boss.won ? 'good' : 'brass'}">${boss.won ? 'Defeated' : '+100 XP'}</span></div>
      <div class="row nowrap" style="gap:12px"><span class="boss-mark">${esc(boss.persona.name.replace(/^The /, '')[0])}</span><div><div class="h3">${esc(boss.persona.name)}</div><div class="small muted">Brutal difficulty, five questions. Score 8.0+ to win.</div></div></div>
      <button class="btn ${boss.won ? 'secondary' : 'deep'}" data-act="boss">${icon('spar')}${boss.won ? 'Rematch' : 'Take it on'}</button></section>
    <div class="persona-grid">${C.PERSONAS.map((p) => `<button class="persona" data-act="persona" data-id="${p.id}">
      <span class="mono-mark">${esc(p.name.replace(/^The /, '')[0])}</span>
      <span class="t">${esc(p.name)}</span><span class="d">${esc(p.role)}</span><span class="tag-row">${p.areas.map((a) => areaPill(a, a === Store.profile.objective)).join('')}</span></button>`).join('')}</div>
    ${recent.length ? `<section class="section"><h2 class="h2">Recent sessions</h2><div class="list">${recent.map(sessionRow).join('')}</div></section>` : ''}
  </div>`;
}

/* ---------------- Toolkit ---------------- */
function viewToolkit() {
  const read = (Store.profile.lessonsRead || []).length;
  const wk = G.isoWeek().key;
  const questsDone = Store.sessions.filter((s) => s.kind === 'quest' && s.week === wk).length;
  const used = new Set(); Store.sessions.forEach((s) => (s.execPhrases || []).forEach((x) => used.add(x)));
  const tools = [
    ['quests', 'target', 'Leadership quests', `${questsDone}/3 this week. Real-world challenges, 30 XP each.`],
    ['arsenal', 'swap', 'Executive language', `${used.size}/${C.EXEC_PHRASES.length} phrases used in reps. Collect them all.`],
    ['sharpen', 'scissors', 'Sharpen my words', 'Turn an email, update or answer into Headline → Action.'],
    ['visual', 'camera', 'Visual presence check', 'Photo or video: posture, eye line, light, framing.'],
    ['lessons', 'book', 'Lessons', `${read} of ${C.LESSONS.length} read. 5 XP each.`],
  ];
  const reviews = Store.logs.filter((l) => l.kind === 'meeting');
  return `<div class="page">
    <div class="stack"><h1 class="h1">Toolkit</h1><p class="muted">For real meetings, following your operating model: before, during, after.</p></div>
    <div class="cycle">
      <button class="cycle-step" data-act="open" data-sheet="prep"><span class="eyebrow">Before</span><span class="t">Meeting prep</span><span class="d">Outcome, message, 3 points, hard questions, the decision</span></button>
      <button class="cycle-step" data-act="open" data-sheet="pregame"><span class="eyebrow">During</span><span class="t">Pre-game</span><span class="d">Lead with the conclusion. Close the loop.</span></button>
      <button class="cycle-step" data-act="open" data-sheet="meeting"><span class="eyebrow">After</span><span class="t">Meeting review</span><span class="d">9-category scorecard, one adjustment</span></button>
    </div>
    <div class="list">${tools.map(([id, ic, t, d]) => `<button class="list-row has-ic" data-act="open" data-sheet="${id}"><span class="ic">${icon(ic)}</span><span><span class="t">${t}</span><span class="d" style="display:block">${d}</span></span>${icon('chev', 'chev')}</button>`).join('')}</div>
    ${reviews.length ? `<section class="section"><h2 class="h2">Meeting reviews</h2><div class="list">${reviews.slice(0, 5).map(meetingRow).join('')}</div></section>` : ''}
    ${Store.preps.length ? `<section class="section"><h2 class="h2">Saved preps</h2><div class="list">${Store.preps.slice(0, 6).map((pr) => `<button class="list-row" data-act="open" data-sheet="prep" data-id="${pr.id}"><span><span class="t">${esc(pr.title)}</span><span class="d" style="display:block">${esc(fmtDate(pr.ts))} · ${esc(pr.audience || '')}</span></span>${icon('chev', 'chev')}</button>`).join('')}</div></section>` : ''}
    ${aiOffNote('Meeting review, prep, Sharpen and the visual check')}
  </div>`;
}
function meetingRow(l) {
  const o = l.scores && l.scores.overall;
  return `<button class="list-row" data-act="open" data-sheet="meeting" data-id="${l.id}"><span style="min-width:0"><span class="t">${esc(l.title)}</span><span class="d" style="display:block">${esc(fmtDate(l.ts))} · ${esc(C.mtype(l.type).name)}${l.self ? ' · self-scored' : ''}</span></span>${o != null ? `<span class="pill ${o >= 85 ? 'good' : o >= 70 ? 'warn' : 'bad'}">${s10(o)}</span>` : icon('chev', 'chev')}</button>`;
}

/* ---------------- Progress ---------------- */
function sessionRow(s) {
  const sc = G.scores(s).overall;
  const kindName = { scenario: 'Scenario', impromptu: 'Impromptu', teachback: 'Teach-back', custom: 'Own prompt', question: 'Question', spar: s.boss ? 'Boss' : 'Spar', drill: 'Drill', concision: 'Concision', visual: 'Visual check', game: 'Game', hsia: 'Headline Builder', quest: 'Quest', bonus: 'Bonus' }[s.kind] || 'Rep';
  const right = s.kind === 'game' ? `<span class="pill brass">${s.score}</span>` : sc != null ? `<span class="pill ${sc >= 85 ? 'good' : sc >= 70 ? 'warn' : 'bad'}">${s10(sc)}</span>` : `<span class="pill">+${G.xpOf(s)}</span>`;
  return `<button class="list-row" data-act="session" data-id="${s.id}"><span style="min-width:0"><span class="t">${esc(s.title)}</span><span class="d" style="display:block">${esc(fmtDate(s.ts))} · ${kindName}${s.attempt > 1 ? ` · try ${s.attempt}` : ''}${s.durationSec ? ' · ' + fmtSec(s.durationSec) : ''} · +${G.xpOf(s)} XP</span></span>${right}</button>`;
}
function journey(st) {
  return `<div class="journey">${C.STAGES.map((sg) => {
    const lv = C.LEVELS.filter((l) => l.stage === sg.id);
    const state = st.level.stage > sg.id ? 'past' : st.level.stage === sg.id ? 'now' : 'next';
    return `<div class="stage ${state}"><div class="stage-top"><span class="stage-num">${sg.id}</span><span class="stage-name">${esc(sg.name)}</span></div>
      <div class="dots">${lv.map((l) => `<i class="${st.level.n >= l.n ? 'on' : ''} ${st.level.n === l.n ? 'cur' : ''}" title="${esc(l.title)} · ${l.xp} XP"></i>`).join('')}</div>
      <p class="small muted">${esc(sg.blurb)}</p>
      ${C.GATES[sg.id] && state === 'next' ? `<p class="small"><b>Gate:</b> ${esc(C.GATES[sg.id].text)}</p>` : ''}</div>`;
  }).join('')}</div>`;
}
function viewProgress() {
  const st = G.stats(), p = Store.profile, pl = G.plan();
  const scored = st.scored, last30 = scored.slice(-30);
  const earned = G.badges(st);
  const agg = (key) => { const m = {}; for (const s of st.reps.slice(0, 30)) for (const x of ((s.metrics || {})[key] || [])) m[x.label] = (m[x.label] || 0) + x.n; return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5); };
  const fillers = agg('fillerTypes'), hedges = agg('hedgeTypes');
  const fixes = {}; for (const s of st.reps.slice(0, 30)) for (const f of ((s.coach || {}).fixes || [])) { const k = String(f.issue || '').toLowerCase().trim(); if (k) fixes[k] = (fixes[k] || 0) + 1; }
  const topFixes = Object.entries(fixes).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const areaHits = {}; for (const s of st.reps.slice(0, 30)) for (const n of (s.notes || [])) if (n.area) areaHits[n.area] = (areaHits[n.area] || 0) + 1;
  const cur = st.current;
  const ob = pl.overall.baseline * 10, ot = pl.overall.target * 10;
  const gap = cur && cur.overall != null ? Math.round(A.clamp((cur.overall - ob) / Math.max(1, ot - ob), -1, 1.5) * 100) : null;
  const end = new Date(); end.setHours(12, 0, 0, 0);
  const start = new Date(end); start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - 7 * 11);
  const xpByDay = {}; for (const s of Store.sessions.concat(Store.logs)) xpByDay[s.date] = (xpByDay[s.date] || 0) + G.xpOf(s);
  let cells = '';
  for (let i = 0; i < 84; i++) { const d = new Date(start); d.setDate(start.getDate() + i); const k = dkey(d), x = xpByDay[k] || 0; const lvl = d > end || !x ? '' : x < 25 ? 'l1' : x < 60 ? 'l2' : 'l3'; cells += `<i class="${lvl}${k === dkey() ? ' today' : ''}" title="${k}: ${x} XP"></i>`; }
  const byType = C.MEETING_TYPES.map((t) => { const ms = st.meetings.filter((m) => m.type === t.id); return { t, n: ms.length, last: ms.length ? ms[ms.length - 1].scores.overall : null, prev: ms.length > 1 ? ms[ms.length - 2].scores.overall : null }; });
  const used = {}; Store.sessions.forEach((s) => (s.execPhrases || []).forEach((x) => { used[x] = (used[x] || 0) + 1; }));
  const vis = st.reps.slice(0, S.historyN);
  const other = Store.sessions.filter((s) => !REP_KINDS.includes(s.kind));
  return `<div class="page">
    <div class="stack"><h1 class="h1">Progress</h1></div>
    <section class="hero" style="gap:10px">
      <div class="row between"><span class="eyebrow" style="color:var(--on-deep-muted)">Stage ${st.level.stage} · Level ${st.level.n}</span><span class="mono small" style="color:var(--on-deep-muted)">${st.xp} XP</span></div>
      <div class="greet">${esc(st.level.title)}</div>
      ${levelBar(st)}
      <p class="sub">${st.pending ? `Promotion to ${esc(C.STAGES[st.pending - 1].name)} waits on your scores.` : st.next ? `${st.next.xp - st.xp} XP to ${esc(st.next.title)}` : 'Top of the ladder.'}</p>
    </section>
    <section class="section"><h2 class="h2">The path</h2>${journey(st)}</section>
    <section class="card stack">
      <div class="section-head"><h2 class="h3">Overall executive presence</h2><span class="small muted">rolling</span></div>
      <div class="overall-row"><div><div class="k">Baseline</div><div class="v">${f1(pl.overall.baseline)}</div></div><div class="arrow">→</div><div><div class="k">Now</div><div class="v now">${cur && cur.overall != null ? s10(cur.overall) : '—'}</div></div><div class="arrow">→</div><div><div class="k">Target</div><div class="v">${f1(pl.overall.target)}</div></div></div>
      ${gap != null ? `<div class="gapbar"><i style="width:${A.clamp(gap, 0, 100)}%"></i></div><p class="small muted">${gap >= 100 ? 'Target reached. Hold it in real meetings.' : gap >= 0 ? `${gap}% of the gap to target closed.` : 'Below your baseline on recent reps. Short, deliberate reps fix this fast.'}</p>` : '<p class="small muted">Your rolling score appears after your first scored rep.</p>'}
    </section>
    <section class="card stack">
      <div class="section-head"><h2 class="h3">Dimensions vs target</h2><span class="small muted">last 10 reps + meetings</span></div>
      ${cur ? bars(cur, C.DIMENSIONS, { plan: true }) : `<div class="stack">${C.DIMENSIONS.map((d) => `<div class="row between small"><span>${esc(d.name)}</span><span class="mono muted">${f1(pl.baseline[d.id])} → ${f1(pl.target[d.id])}</span></div>`).join('')}</div>`}
      ${cur ? `<p class="small muted">Stakeholder management and commercial judgment are scored by the coach and in meeting reviews.</p>` : ''}
    </section>
    ${cur && C.DIMENSIONS.filter((d) => cur[d.id] != null).length >= 5 ? `<section class="card stack"><div class="section-head"><h2 class="h3">Profile</h2></div>${radarChart(cur, [[Object.fromEntries(C.DIMENSIONS.map((d) => [d.id, pl.target[d.id] * 10])), 'radar-target'], [Object.fromEntries(C.DIMENSIONS.map((d) => [d.id, pl.baseline[d.id] * 10])), 'radar-then']], C.DIMENSIONS)}<div class="legend"><span><i style="background:var(--brass)"></i>Now</span><span><i style="background:transparent;border:1.5px dashed var(--muted)"></i>Baseline</span><span><i style="background:transparent;border:1.5px solid var(--good)"></i>Target</span></div></section>` : ''}
    <section class="card stack">
      <div class="section-head"><h2 class="h3">Presence score per rep</h2><span class="small muted">last ${last30.length}</span></div>
      ${last30.length >= 2 ? lineChart(last30.map((s) => G.scores(s).overall / 10), { min: 4, max: 10, ticks: [5, 7, 8.5, 10], band: [pl.overall.target, 10], avg: 5, area: true, fmt: (v) => v.toFixed(1), label: 'Presence score per rep', xlabels: [fmtDate(last30[0].ts), fmtDate(last30[last30.length - 1].ts)] }) + '<p class="small muted">Green band: your target zone. Dashed: five-rep average.</p>'
        : `<div class="empty">${icon('progress')}<span class="t">Your trend appears after two reps</span><button class="btn sm" data-act="go" data-to="today">Today's missions</button></div>`}
    </section>
    <section class="card stack">
      <div class="section-head"><h2 class="h3">Meeting tracker</h2><button class="link" data-act="open" data-sheet="meeting">${icon('plus')}Review a meeting</button></div>
      ${st.meetings.length ? `<div class="stack">${byType.filter((x) => x.n).map((x) => `<div class="row between"><span>${esc(x.t.name)} <span class="small muted">×${x.n}</span></span><span class="row" style="gap:6px">${x.prev != null ? `<span class="delta ${x.last >= x.prev ? 'up' : 'down'}">${x.last >= x.prev ? '+' : ''}${((x.last - x.prev) / 10).toFixed(1)}</span>` : ''}<span class="pill ${x.last >= 85 ? 'good' : x.last >= 70 ? 'warn' : 'bad'}">${s10(x.last)}</span></span></div>`).join('')}</div>
        ${st.meetings.length >= 2 ? lineChart(st.meetings.slice(-20).map((m) => m.scores.overall / 10), { min: 4, max: 10, ticks: [5, 7, 8.5, 10], band: [pl.overall.target, 10], area: false, h: 120, fmt: (v) => v.toFixed(1), label: 'Meeting scores over time' }) : ''}
        <div class="list">${Store.logs.filter((l) => l.kind === 'meeting').slice(0, 5).map(meetingRow).join('')}</div>`
        : '<p class="small muted">Real meetings are the real test. Paste a transcript after an IC, a negotiation or a leadership meeting to get your 9-category scorecard and track it here by meeting type.</p>'}
    </section>
    <section class="card stack">
      <div class="section-head"><h2 class="h3">Executive language</h2><button class="link" data-act="open" data-sheet="arsenal">Open</button></div>
      <div class="arsenal-mini">${C.EXEC_PHRASES.map((ph) => `<span class="${used[ph.id] ? 'on' : ''}" title="${esc(ph.say)}">${used[ph.id] ? icon('check') : icon('lock')}</span>`).join('')}</div>
      <p class="small muted">${Object.keys(used).length}/${C.EXEC_PHRASES.length} phrases used in reps.</p>
    </section>
    <section class="card stack">
      <div class="section-head"><h2 class="h3">Practice calendar</h2><span class="small muted">XP per day, 12 weeks</span></div>
      <div class="heat" aria-label="XP by day">${cells}</div>
    </section>
    ${fillers.length || hedges.length || topFixes.length || Object.keys(areaHits).length ? `<section class="card stack"><h2 class="h3">Recurring habits</h2><p class="small muted">From your last 30 reps.</p>
      ${Object.keys(areaHits).length ? `<div><div class="eyebrow">Flags by development area</div><div class="stack" style="margin-top:6px">${C.AREAS.filter((a) => areaHits[a.id]).sort((a, b) => areaHits[b.id] - areaHits[a.id]).map((a) => `<div class="row between"><span>${areaPill(a.id)} ${esc(a.title)}</span><span class="pill">${areaHits[a.id]}×</span></div>`).join('')}</div></div>` : ''}
      ${hedges.length ? `<div><div class="eyebrow">Top hedges</div><div class="chips" style="margin-top:6px">${hedges.map(([l, n]) => `<span class="chip">${esc(l)} <span class="pill warn">${n}</span></span>`).join('')}</div></div>` : ''}
      ${fillers.length ? `<div><div class="eyebrow">Top fillers</div><div class="chips" style="margin-top:6px">${fillers.map(([l, n]) => `<span class="chip">${esc(l)} <span class="pill bad">${n}</span></span>`).join('')}</div></div>` : ''}
      ${topFixes.length ? `<div><div class="eyebrow">Coach keeps flagging</div><div class="stack" style="margin-top:6px">${topFixes.map(([l, n]) => `<div class="row between"><span>${esc(l[0].toUpperCase() + l.slice(1))}</span><span class="pill">${n}×</span></div>`).join('')}</div></div>` : ''}
    </section>` : ''}
    <section class="section"><div class="section-head"><h2 class="h2">Badges</h2><span class="small muted mono">${earned.size}/${C.BADGES.length}</span></div>
      <div class="badges">${C.BADGES.map((b) => `<div class="badge-tile ${earned.has(b.id) ? '' : 'locked'}" title="${esc(b.desc)}"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="${earned.has(b.id) ? 'var(--deep)' : 'var(--surface-2)'}"/><circle cx="20" cy="20" r="13" fill="none" stroke="var(--brass-bright)" stroke-width="1.5"/><path d="M20 12.5l2.2 4.6 5 .6-3.7 3.4 1 5-4.5-2.5-4.5 2.5 1-5-3.7-3.4 5-.6z" fill="var(--brass-bright)"/></svg><span class="t">${esc(b.name)}</span><span class="muted">${esc(b.desc)}</span></div>`).join('')}</div>
    </section>
    <section class="section"><div class="section-head"><h2 class="h2">Weekly review</h2><button class="link" data-act="open" data-sheet="review">${Store.reviews.length ? 'New review' : 'Run it'}</button></div>
      ${Store.reviews.length ? `<div class="list">${Store.reviews.slice(0, 4).map((r) => `<button class="list-row" data-act="open" data-sheet="review" data-id="${r.id}"><span><span class="t">${esc(r.headline || 'Weekly review')}</span><span class="d" style="display:block">${esc(fmtDate(r.ts))}</span></span>${icon('chev', 'chev')}</button>`).join('')}</div>` : '<p class="muted small">Sunday is review day: patterns, wins and next week\'s objective.</p>'}
    </section>
    <section class="section"><h2 class="h2">History</h2>
      ${vis.length ? `<div class="list">${vis.map(sessionRow).join('')}</div>${st.reps.length > S.historyN ? `<button class="btn secondary" data-act="more">Show more</button>` : ''}` : `<div class="card empty">${icon('mic')}<span class="t">No reps yet</span><span class="small">Your sessions, scores and coach notes collect here.</span></div>`}
      ${other.length ? `<details class="fold"><summary>Games, drills, quests and bonuses (${other.length})${icon('chev')}</summary><div class="fold-body"><div class="list">${other.slice(0, 40).map(sessionRow).join('')}</div></div></details>` : ''}
    </section>
  </div>`;
}

/* ---------------- Me ---------------- */
function viewMe() {
  const p = Store.profile, s = p.settings, pl = G.plan();
  const cloud = Store.mode === 'cloud';
  return `<div class="page">
    <div class="stack"><h1 class="h1">You</h1></div>
    <div class="note">${icon(cloud ? 'lock' : 'info')}<span>${cloud ? 'Your plan and practice are saved privately to this page in your Claude account and follow you across devices. Only you can see them.' : 'Your practice is saved in this browser only. Open this page from your Claude account to keep it across devices.'}</span></div>
    ${storageNote()}
    <section class="card stack">
      <h2 class="h3">Profile</h2>
      <label class="field">Name<input class="input" id="pf-name" data-pf="name" value="${esc(p.name)}" autocomplete="given-name"></label>
      <label class="field">Role<input class="input" id="pf-role" data-pf="role" value="${esc(p.role)}"></label>
      <label class="field">Audiences you face<textarea class="input" id="pf-aud" data-pf="audiences" rows="2" style="min-height:70px">${esc(p.audiences)}</textarea></label>
    </section>
    <section class="card stack">
      <div class="section-head"><h2 class="h3">Development plan</h2><button class="link" data-act="open" data-sheet="plan">Update</button></div>
      <p class="prose"><b>North Star.</b> ${esc(pl.north)}</p>
      <p class="small muted">${esc(pl.goal)}</p>
      <div class="plan-table"><div class="ph"><span>Dimension</span><span>Baseline</span><span>Target</span></div>
        ${C.DIMENSIONS.map((d) => `<div class="pr"><span>${esc(d.name)}</span><input class="input sm-num" type="number" min="1" max="10" step="0.5" inputmode="decimal" data-plan="baseline" data-dim="${d.id}" value="${pl.baseline[d.id]}" aria-label="${esc(d.name)} baseline"><input class="input sm-num" type="number" min="1" max="10" step="0.5" inputmode="decimal" data-plan="target" data-dim="${d.id}" value="${pl.target[d.id]}" aria-label="${esc(d.name)} target"></div>`).join('')}
        <div class="pr total"><span>Overall</span><input class="input sm-num" type="number" min="1" max="10" step="0.25" inputmode="decimal" data-plan="overall" data-dim="baseline" value="${pl.overall.baseline}" aria-label="Overall baseline"><input class="input sm-num" type="number" min="1" max="10" step="0.25" inputmode="decimal" data-plan="overall" data-dim="target" value="${pl.overall.target}" aria-label="Overall target"></div></div>
      ${pl.note ? `<p class="small muted">${esc(pl.note)}</p>` : ''}
      ${pl.strengths.length ? `<details class="fold"><summary>Established strengths${icon('chev')}</summary><div class="fold-body stack">${pl.strengths.map((x) => `<div><div class="h3">${esc(x.title)}</div><ul class="ul">${(x.points || []).map((pt) => `<li>${esc(pt)}</li>`).join('')}</ul></div>`).join('')}</div></details>` : ''}
      <details class="fold"><summary>Development areas A–E${icon('chev')}</summary><div class="fold-body stack">${C.AREAS.map((a) => `<div><div class="h3">${a.id}. ${esc(a.title)}</div>${(pl.tendencies[a.id] || []).length ? `<div class="small muted" style="margin-top:2px">Current tendency</div><ul class="ul">${pl.tendencies[a.id].map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}<div class="small muted">Desired behavior</div><ul class="ul">${a.desired.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>`).join('')}</div></details>
    </section>
    <section class="card stack">
      <div class="section-head"><h2 class="h3">This week's objective</h2></div>
      <div class="seg full" role="group">${C.AREAS.map((a) => `<button data-act="set-objective" data-id="${a.id}" aria-pressed="${p.objective === a.id}">${a.id}</button>`).join('')}</div>
      <p class="small">${esc(C.area(p.objective).title)}</p>
      <div><button class="btn secondary sm" data-act="open" data-sheet="assess">Self-rating (${Object.keys(p.ratings).length}/${C.DIMENSIONS.length})</button></div>
    </section>
    <section class="card stack">
      <h2 class="h3">Settings</h2>
      <label class="field">Target pace<select class="input" id="set-pace" data-set="pace">${[[120, 150], [130, 160], [140, 170]].map(([a, b]) => `<option value="${a}-${b}" ${s.paceLo === a ? 'selected' : ''}>${a}–${b} words a minute${a === 130 ? ' (recommended)' : ''}</option>`).join('')}</select></label>
      <label class="field">Thinking time before a rep<select class="input" id="set-think" data-set="thinkTime">${[0, 10, 20, 30].map((m) => `<option value="${m}" ${s.thinkTime === m ? 'selected' : ''}>${m ? m + ' seconds' : 'None'}</option>`).join('')}</select></label>
      <label class="check"><input type="checkbox" id="set-auto" data-set="autoCoach" ${s.autoCoach ? 'checked' : ''}> Coach feedback automatically after each rep</label>
      <label class="check"><input type="checkbox" id="set-voice" data-set="voice" ${s.voice ? 'checked' : ''}> Read sparring questions aloud</label>
      <label class="check"><input type="checkbox" id="set-sound" data-set="sound" ${s.sound ? 'checked' : ''}> Sound effects for wins</label>
      <label class="field">Extra filler words to catch (comma-separated)<input class="input" id="set-fill" data-set="customFillers" value="${esc((s.customFillers || []).join(', '))}" placeholder="e.g. right, okay so"></label>
    </section>
    <section class="card stack">
      <h2 class="h3">Your data</h2>
      <div class="actions"><button class="btn secondary" data-act="export" data-fmt="json">${icon('download')}Back up (JSON)</button><button class="btn secondary" data-act="export" data-fmt="csv">${icon('download')}Sessions (CSV)</button></div>
      <label class="btn secondary" style="cursor:pointer">${icon('upload')}Restore a backup<input type="file" accept=".json,application/json" id="importFile" class="sr" data-act-change="import"></label>
      <div id="resetZone"><button class="btn danger" data-act="reset1">${icon('trash')}Erase all practice data</button></div>
    </section>
    <details class="fold"><summary>How scoring and XP work${icon('chev')}</summary><div class="fold-body prose small">
      <p>Every rep is scored 1–10 on your plan's dimensions. <b>Strategic framing</b> credits the implication, numbers and "the fundamental issue" language. <b>Clarity</b> checks that the first sentence is the conclusion and the structure is signposted. <b>Conciseness</b> penalizes long sentences, repetition, more than three points and running over time. <b>Assertiveness</b> counts hedges and your old phrases ("I think maybe…"). <b>Executive confidence</b> uses pace, fillers and, with a recording, pauses, pitch range and rising endings. <b>Decision leadership</b> credits a recommendation, an explicit next action, trade-offs and "what would change my mind". Stakeholder management and commercial judgment come from the coach and meeting reviews. When the coach reviews a rep, its judgment is blended in (70% coach, 30% measured).</p>
      <p><b>XP:</b> reps earn 10 plus their score, +2 per framework element hit (+5 for all four), +3 per executive phrase, +5 for coach review, +10 for a retry that improves by 1.0. Spars earn 25+, bosses +100, meeting reviews 40 (+20 at 8.0+), quests 30. Streaks multiply XP: ×1.1 at 3 days, ×1.25 at 7, ×1.5 at 14, ×2 at 30. Moving up a stage needs the scores as well as the XP.</p>
    </div></details>
  </div>`;
}
