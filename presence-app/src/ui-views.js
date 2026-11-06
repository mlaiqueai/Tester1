/* ============================================================
   Green Room — tab views
   ============================================================ */
const S = {
  route: 'today', sheet: null, rep: null, spar: null, drill: null, tool: null,
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
  const st = computeStats();
  $('#streakChip').innerHTML = `${icon('flame')}<span>${st.streak}</span><span class="sr"> day streak</span>`;
  const name = (Store.profile.name || '?').trim();
  $('#avatarBtn').textContent = name ? name[0].toUpperCase() : '?';
  $('#avatarBtn').setAttribute('aria-current', S.route === 'me' ? 'page' : 'false');
}

function renderView() {
  const el = $('#view');
  // Don't wipe a field the user is typing in; render when they leave it.
  const ae = document.activeElement;
  if (ae && el.contains(ae) && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) { S.pendingRender = true; return; }
  S.pendingRender = false;
  const fn = { today: viewToday, practice: viewPractice, spar: viewSpar, toolkit: viewToolkit, progress: viewProgress, me: viewMe }[S.route] || viewToday;
  el.innerHTML = fn();
  renderTabs();
  animateGauges(el);
}

function storageNote() {
  if (Store.note) return `<div class="note warn">${icon('info')}<span>${esc(Store.note)}</span></div>`;
  return '';
}
function aiOffNote(what = 'AI coaching') {
  if (AI.state !== 'off') return '';
  return `<div class="note">${icon('info')}<span>${esc(what)} uses Claude, which isn't available in this view. Everything else works, including scoring, drills and progress.</span></div>`;
}

/* ---------------- Today ---------------- */
function viewToday() {
  const p = Store.profile, st = computeStats(), plan = dailyPlan();
  const hr = new Date().getHours();
  const greet = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  const score = st.week ? st.week.overall : st.recent ? st.recent.overall : null;
  const goal = p.settings.weeklyGoalMin || 60;
  const toNext = st.next ? `${st.next.xp - st.xp} XP to ${st.next.name}` : 'Top level reached';
  const focus = (p.focus.length ? p.focus : C.STARTER_FOCUS);
  return `<div class="page">
    <section class="hero" aria-label="Your presence today">
      <span class="eyebrow" style="color:var(--on-deep-muted)">${esc(fmtDateLong(Date.now()))}</span>
      <h1 class="greet">${greet}${p.name ? ', ' + esc(p.name.split(' ')[0]) : ''}.</h1>
      <p class="sub">${esc(st.level.name)} · ${esc(toNext)}</p>
      <div class="gauge-wrap">${gauge(score, { dark: true, label: st.week ? '7-day presence score' : 'Presence score' })}</div>
      <div class="hero-stats">
        <div class="hero-stat"><div class="v">${st.streak}</div><div class="k">Day streak</div></div>
        <div class="hero-stat"><div class="v">${st.weekMin}<span style="font-size:15px;opacity:.7">/${goal}</span></div><div class="k">Min this week</div></div>
        <div class="hero-stat"><div class="v">${st.reps.length}</div><div class="k">Total reps</div></div>
      </div>
    </section>
    ${storageNote()}
    ${!p.onboarded ? `<section class="card raised stack" aria-label="Personalize">
      <span class="eyebrow">Make it yours</span>
      <h2 class="h2">Bring in your evaluation</h2>
      <p class="muted">Paste your executive presence evaluation or 360 feedback. The coach maps it to your development areas, sets your focus and builds a 4-week plan.</p>
      <div class="actions"><button class="btn" data-act="open" data-sheet="eval">${icon('file')}Import evaluation</button><button class="btn secondary" data-act="open" data-sheet="assess">Rate myself instead</button></div>
      <p class="small muted">Until then, you're on a starter focus for analytical leaders.</p>
    </section>` : ''}
    <section class="section" aria-label="Today's plan">
      <div class="section-head"><h2 class="h2">Today's plan</h2><span class="small muted mono">${plan.items.filter((i) => i.done).length}/3 done</span></div>
      <div class="plan">${plan.items.map((it) => `<button class="plan-item ${it.done ? 'done' : ''}" data-act="plan" data-kind="${it.kind}" data-id="${esc(it.id)}">
        <span class="ic">${icon(it.done ? 'check' : it.icon)}</span>
        <span style="min-width:0"><span class="t">${esc(it.title)}</span><span class="d" style="display:block">${esc(it.desc)}</span></span>
        <span class="meta">${esc(it.meta)}</span></button>`).join('')}</div>
    </section>
    <section class="section" aria-label="Your focus">
      <div class="section-head"><h2 class="h2">Your focus</h2><button class="link" data-act="open" data-sheet="focus">Edit</button></div>
      <div class="chips">${focus.map((id) => { const s = C.skill(id); const r = p.ratings[id]; return s ? `<button class="chip" data-act="open" data-sheet="assess">${esc(s.name)}${r ? `<span class="pill brass">${r}/5</span>` : ''}</button>` : ''; }).join('')}</div>
      ${p.evaluation && p.evaluation.behaviors && p.evaluation.behaviors.length ? `<div class="card stack"><span class="eyebrow">Signature behaviors</span>${p.evaluation.behaviors.map((b) => `<div class="crit yes">${icon('yes')}<span>${esc(b)}</span></div>`).join('')}</div>` : ''}
    </section>
    <section class="section" aria-label="Before a big meeting">
      <h2 class="h2">Big meeting coming up?</h2>
      <div class="grid2">
        <button class="plan-item" style="grid-template-columns:40px minmax(0,1fr)" data-act="open" data-sheet="pregame"><span class="ic" style="width:40px;height:40px">${icon('target')}</span><span><span class="t">Pre-game</span><span class="d" style="display:block">2-minute reset</span></span></button>
        <button class="plan-item" style="grid-template-columns:40px minmax(0,1fr)" data-act="open" data-sheet="prep"><span class="ic" style="width:40px;height:40px">${icon('layers')}</span><span><span class="t">Meeting prep</span><span class="d" style="display:block">Message, Q&amp;A, opener</span></span></button>
      </div>
    </section>
    <section class="card stack" aria-label="Lesson of the day">
      <span class="eyebrow">Lesson of the day · ${plan.lesson.min} min</span>
      <h3 class="h2">${esc(plan.lesson.title)}</h3>
      <p class="muted">${esc(plan.lesson.key)}</p>
      <div><button class="btn secondary sm" data-act="lesson" data-id="${plan.lesson.id}">${icon('book')}Read</button></div>
    </section>
    ${aiOffNote()}
  </div>`;
}

/* ---------------- Practice ---------------- */
function viewPractice() {
  const cats = [['all', 'All']].concat(C.SCENARIO_CATS.map((c) => [c.id, c.name.split(' ')[0]]));
  const focus = Store.profile.focus || [];
  const list = C.SCENARIOS.filter((s) => S.practiceCat === 'all' || s.cat === S.practiceCat);
  const doneIds = new Set(Store.sessions.filter((s) => s.kind === 'scenario').map((s) => s.refId));
  const dx = C.dxEstimate(new Date());
  return `<div class="page">
    <div class="stack"><h1 class="h1">Practice</h1><p class="muted">Short reps with instant scoring. Speak, dictate or upload a recording, then run it back.</p></div>
    <section class="section">
      <h2 class="h3 eyebrow">Quick reps</h2>
      <div class="list">
        <button class="list-row has-ic" data-act="quick" data-q="impromptu"><span class="ic">${icon('bolt')}</span><span><span class="t">Impromptu, 60 seconds</span><span class="d" style="display:block">A random question. Think 10 seconds, answer with a point of view.</span></span>${icon('chev', 'chev')}</button>
        ${dx ? `<button class="list-row has-ic" data-act="quick" data-q="teachback"><span class="ic">${icon('grad')}</span><span><span class="t">Teach-back: today's DX Daily lesson</span><span class="d" style="display:block">${esc(dx[2])}</span></span>${icon('chev', 'chev')}</button>` : ''}
        <button class="list-row has-ic" data-act="quick" data-q="custom"><span class="ic">${icon('pen')}</span><span><span class="t">Your own prompt</span><span class="d" style="display:block">Rehearse a real question or opening you're facing this week.</span></span>${icon('chev', 'chev')}</button>
      </div>
    </section>
    <section class="section">
      <div class="section-head"><h2 class="h2">Scenarios</h2></div>
      <div class="seg" role="group" aria-label="Filter scenarios">${cats.map(([id, n]) => `<button data-act="cat" data-id="${id}" aria-pressed="${S.practiceCat === id}">${esc(n)}</button>`).join('')}</div>
      <div class="list">${list.map((s) => {
        const hit = s.focus.filter((f) => focus.includes(f)).length;
        return `<button class="list-row" data-act="scenario" data-id="${s.id}"><span style="min-width:0"><span class="t">${esc(s.title)}</span><span class="d" style="display:block">${esc(s.audience)}</span><span class="tag-row" style="margin-top:6px"><span class="pill">${s.time}s</span>${hit ? `<span class="pill brass">Your focus</span>` : ''}${doneIds.has(s.id) ? `<span class="pill good">Done</span>` : ''}</span></span>${icon('chev', 'chev')}</button>`;
      }).join('')}</div>
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
  return `<div class="page">
    <div class="stack"><h1 class="h1">Spar</h1><p class="muted">Live role-play. Claude plays a demanding audience, follows up on what you actually say, then debriefs every answer.</p></div>
    ${AI.state === 'off' ? `<div class="note">${icon('info')}<span>Live follow-ups need Claude, which isn't available in this view. You can still practice each persona's question bank.</span></div>` : ''}
    <div class="persona-grid">${C.PERSONAS.map((p) => `<button class="persona" data-act="persona" data-id="${p.id}">
      <span class="mono-mark">${esc(p.name.replace(/^The /, '')[0])}</span>
      <span class="t">${esc(p.name)}</span><span class="d">${esc(p.role)}</span></button>`).join('')}</div>
    ${recent.length ? `<section class="section"><h2 class="h2">Recent sessions</h2><div class="list">${recent.map(sessionRow).join('')}</div></section>` : ''}
  </div>`;
}

/* ---------------- Toolkit ---------------- */
function viewToolkit() {
  const read = (Store.profile.lessonsRead || []).length;
  const tools = [
    ['prep', 'layers', 'Meeting prep', 'Key message, opener, likely tough questions and answers.'],
    ['pregame', 'target', 'Pre-game routine', 'Two minutes to arrive calm, grounded and clear.'],
    ['sharpen', 'scissors', 'Sharpen my words', 'Turn an email, update or answer into executive language.'],
    ['visual', 'camera', 'Visual presence check', 'Upload a photo or video. Get notes on posture, eye line, light and framing.'],
    ['log', 'notebook', 'Field log', 'Rate how you showed up in a real meeting and capture the lesson.'],
    ['lessons', 'book', 'Lessons', `${read} of ${C.LESSONS.length} read. Short reads on the craft.`],
  ];
  return `<div class="page">
    <div class="stack"><h1 class="h1">Toolkit</h1><p class="muted">For the real meetings: prepare, warm up, then reflect.</p></div>
    <div class="list">${tools.map(([id, ic, t, d]) => `<button class="list-row has-ic" data-act="open" data-sheet="${id}"><span class="ic">${icon(ic)}</span><span><span class="t">${t}</span><span class="d" style="display:block">${d}</span></span>${icon('chev', 'chev')}</button>`).join('')}</div>
    ${Store.preps.length ? `<section class="section"><h2 class="h2">Saved preps</h2><div class="list">${Store.preps.slice(0, 6).map((pr) => `<button class="list-row" data-act="open" data-sheet="prep" data-id="${pr.id}"><span><span class="t">${esc(pr.title)}</span><span class="d" style="display:block">${esc(fmtDate(pr.ts))} · ${esc(pr.audience || '')}</span></span>${icon('chev', 'chev')}</button>`).join('')}</div></section>` : ''}
    ${Store.logs.length ? `<section class="section"><h2 class="h2">Field log</h2><div class="list">${Store.logs.slice(0, 5).map((l) => { const avg = Math.round(((l.r.clarity + l.r.concision + l.r.confidence + l.r.composure) / 4) * 10) / 10; return `<button class="list-row" data-act="open" data-sheet="log" data-id="${l.id}"><span><span class="t">${esc(l.title)}</span><span class="d" style="display:block">${esc(fmtDate(l.ts))} · ${esc(l.stakes)} stakes</span></span><span class="pill ${avg >= 4 ? 'good' : avg >= 3 ? 'warn' : 'bad'}">${avg}/5</span></button>`; }).join('')}</div></section>` : ''}
    ${aiOffNote('Meeting prep, Sharpen and the visual check')}
  </div>`;
}

/* ---------------- Progress ---------------- */
function sessionRow(s) {
  const sc = s.scores && s.scores.overall;
  const kindName = { scenario: 'Scenario', impromptu: 'Impromptu', teachback: 'Teach-back', custom: 'Own prompt', question: 'Question', spar: 'Spar', drill: 'Drill', concision: 'Concision', visual: 'Visual check' }[s.kind] || 'Rep';
  return `<button class="list-row" data-act="session" data-id="${s.id}"><span style="min-width:0"><span class="t">${esc(s.title)}</span><span class="d" style="display:block">${esc(fmtDate(s.ts))} · ${kindName}${s.attempt > 1 ? ` · try ${s.attempt}` : ''}${s.durationSec ? ' · ' + fmtSec(s.durationSec) : ''}</span></span>${sc != null ? `<span class="pill ${scoreClass(sc)}">${Math.round(sc)}</span>` : icon('chev', 'chev')}</button>`;
}
function viewProgress() {
  const st = computeStats(), p = Store.profile;
  const scored = st.scored;
  const last30 = scored.slice(-30);
  const earned = earnedBadges(st);
  const lvlPct = st.next ? Math.round(((st.xp - st.level.xp) / (st.next.xp - st.level.xp)) * 100) : 100;
  // pattern aggregation over last 30 reps
  const agg = (key) => { const m = {}; for (const s of st.reps.slice(0, 30)) for (const x of ((s.metrics || {})[key] || [])) m[x.label] = (m[x.label] || 0) + x.n; return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5); };
  const fillers = agg('fillerTypes'), hedges = agg('hedgeTypes');
  const fixes = {}; for (const s of st.reps.slice(0, 30)) for (const f of ((s.coach || {}).fixes || [])) { const k = String(f.issue || '').toLowerCase().trim(); if (k) fixes[k] = (fixes[k] || 0) + 1; }
  const topFixes = Object.entries(fixes).sort((a, b) => b[1] - a[1]).slice(0, 4);
  // heatmap: 12 weeks ending this week
  const end = new Date(); end.setHours(12, 0, 0, 0);
  const start = new Date(end); start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - 7 * 11);
  const minsByDay = {};
  for (const s of Store.sessions) minsByDay[s.date] = (minsByDay[s.date] || 0) + (s.durationSec || (s.kind === 'drill' ? (s.minutes || 2) * 60 : 60)) / 60;
  for (const l of Store.logs) minsByDay[l.date] = (minsByDay[l.date] || 0) + 3;
  let cells = '';
  for (let i = 0; i < 84; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const k = dkey(d), m = minsByDay[k] || 0;
    const lvl = d > end ? '' : m === 0 ? '' : m < 5 ? 'l1' : m < 15 ? 'l2' : 'l3';
    cells += `<i class="${lvl}${k === dkey() ? ' today' : ''}" title="${k}: ${Math.round(m)} min"></i>`;
  }
  const wpmVals = st.reps.slice(0, 30).reverse().map((s) => s.metrics && s.metrics.wpm).filter((v) => v);
  const fpm = st.reps.slice(0, 30).reverse().filter((s) => s.metrics && s.metrics.fillersPerMin != null).map((s) => s.metrics.fillersPerMin);
  const hp = st.reps.slice(0, 30).reverse().filter((s) => s.metrics && s.metrics.words >= 20).map((s) => s.metrics.hedgesPer100);
  const dimsShown = C.DIMENSIONS.filter((d) => st.recent && st.recent[d.id] != null);
  const vis = st.reps.slice(0, S.historyN);
  const all = Store.sessions.filter((s) => !REP_KINDS.includes(s.kind));
  return `<div class="page">
    <div class="stack"><h1 class="h1">Progress</h1></div>
    <section class="hero" style="gap:10px">
      <div class="row between"><span class="eyebrow" style="color:var(--on-deep-muted)">Level</span><span class="mono small" style="color:var(--on-deep-muted)">${st.xp} XP</span></div>
      <div class="greet">${esc(st.level.name)}</div>
      <div class="levelbar" role="progressbar" aria-valuenow="${lvlPct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${lvlPct}%"></i></div>
      <p class="sub">${st.next ? `${st.next.xp - st.xp} XP to ${esc(st.next.name)}` : 'You\'ve reached the top.'}</p>
    </section>
    <div class="kpis">
      <div class="kpi"><div class="k">Reps</div><div class="v">${st.reps.length}</div><div class="s">${Store.sessions.filter((s) => s.kind === 'drill').length} drills</div></div>
      <div class="kpi"><div class="k">Minutes</div><div class="v">${st.totalMin}</div><div class="s">${st.weekMin} this week</div></div>
      <div class="kpi"><div class="k">Streak</div><div class="v">${st.streak}</div><div class="s">Best ${st.best}</div></div>
    </div>
    <section class="card stack">
      <div class="section-head"><h2 class="h3">Presence score</h2><span class="small muted">last ${last30.length} reps</span></div>
      ${last30.length >= 2 ? lineChart(last30.map((s) => s.scores.overall), { min: 0, max: 100, ticks: [40, 60, 80, 100], avg: 5, label: 'Presence score per rep', xlabels: [fmtDate(last30[0].ts), fmtDate(last30[last30.length - 1].ts)] }) + '<p class="small muted">Solid line: each rep. Dashed: five-rep average.</p>'
        : `<div class="empty">${icon('progress')}<span class="t">Your trend appears after two reps</span><span class="small">Each rep adds a point. Start with today's plan.</span><button class="btn sm" data-act="go" data-to="today">Go to today's plan</button></div>`}
    </section>
    ${dimsShown.length >= 4 ? `<section class="card stack"><div class="section-head"><h2 class="h3">Your profile</h2><span class="small muted">${st.first ? 'last 10 vs first 10' : 'last 10 reps'}</span></div>${radarChart(st.recent, st.first, dimsShown)}${st.first ? '<p class="small muted">Filled: your last 10 reps. Dashed: your first 10.</p>' : ''}</section>` : ''}
    ${wpmVals.length >= 2 || fpm.length >= 2 ? `<section class="card stack"><h2 class="h3">Delivery</h2>
      ${wpmVals.length >= 2 ? `<div><div class="small muted">Pace (words a minute). Band: your ${p.settings.paceLo}–${p.settings.paceHi} target</div>${lineChart(wpmVals, { band: [p.settings.paceLo, p.settings.paceHi], area: false, h: 120, label: 'Pace trend' })}</div>` : ''}
      <div class="grid2">
        ${fpm.length >= 2 ? `<div style="min-width:0"><div class="small muted">Fillers a minute</div>${lineChart(fpm, { min: 0, area: false, h: 100, w: 170, fmt: (v) => v.toFixed(1), label: 'Fillers per minute' })}</div>` : ''}
        ${hp.length >= 2 ? `<div style="min-width:0"><div class="small muted">Hedges per 100 words</div>${lineChart(hp, { min: 0, area: false, h: 100, w: 170, fmt: (v) => v.toFixed(1), label: 'Hedges per 100 words' })}</div>` : ''}
      </div></section>` : ''}
    <section class="card stack">
      <div class="section-head"><h2 class="h3">Practice calendar</h2><span class="small muted">12 weeks</span></div>
      <div class="row nowrap" style="align-items:stretch;gap:8px"><div class="heat" style="flex:1" aria-label="Practice minutes by day">${cells}</div></div>
      <div class="legend"><span><i style="background:var(--surface-2)"></i>None</span><span><i style="background:color-mix(in srgb,var(--brass) 30%,var(--surface-2))"></i>Under 5 min</span><span><i style="background:color-mix(in srgb,var(--brass) 60%,var(--surface-2))"></i>5–15</span><span><i style="background:var(--brass)"></i>15+</span></div>
    </section>
    ${fillers.length || hedges.length || topFixes.length ? `<section class="card stack"><h2 class="h3">Your patterns</h2><p class="small muted">From your last 30 reps.</p>
      ${fillers.length ? `<div><div class="eyebrow">Top fillers</div><div class="chips" style="margin-top:6px">${fillers.map(([l, n]) => `<span class="chip">${esc(l)} <span class="pill bad">${n}</span></span>`).join('')}</div></div>` : ''}
      ${hedges.length ? `<div><div class="eyebrow">Top hedges</div><div class="chips" style="margin-top:6px">${hedges.map(([l, n]) => `<span class="chip">${esc(l)} <span class="pill warn">${n}</span></span>`).join('')}</div></div>` : ''}
      ${topFixes.length ? `<div><div class="eyebrow">Coach keeps flagging</div><div class="stack" style="margin-top:6px">${topFixes.map(([l, n]) => `<div class="row between"><span>${esc(l[0].toUpperCase() + l.slice(1))}</span><span class="pill">${n}×</span></div>`).join('')}</div></div>` : ''}
    </section>` : ''}
    <section class="section"><div class="section-head"><h2 class="h2">Badges</h2><span class="small muted mono">${earned.size}/${C.BADGES.length}</span></div>
      <div class="badges">${C.BADGES.map((b) => `<div class="badge-tile ${earned.has(b.id) ? '' : 'locked'}" title="${esc(b.desc)}"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="${earned.has(b.id) ? 'var(--deep)' : 'var(--surface-2)'}"/><circle cx="20" cy="20" r="13" fill="none" stroke="var(--brass-bright)" stroke-width="1.5"/><path d="M20 12.5l2.2 4.6 5 .6-3.7 3.4 1 5-4.5-2.5-4.5 2.5 1-5-3.7-3.4 5-.6z" fill="var(--brass-bright)"/></svg><span class="t">${esc(b.name)}</span><span class="muted">${esc(b.desc)}</span></div>`).join('')}</div>
    </section>
    <section class="section"><div class="section-head"><h2 class="h2">Weekly review</h2><button class="link" data-act="open" data-sheet="review">${Store.reviews.length ? 'New review' : 'Run it'}</button></div>
      ${Store.reviews.length ? `<div class="list">${Store.reviews.slice(0, 4).map((r) => `<button class="list-row" data-act="open" data-sheet="review" data-id="${r.id}"><span><span class="t">${esc(r.headline || 'Weekly review')}</span><span class="d" style="display:block">${esc(fmtDate(r.ts))}</span></span>${icon('chev', 'chev')}</button>`).join('')}</div>` : '<p class="muted small">Sunday is review day: your patterns, wins and one focus for the week ahead.</p>'}
    </section>
    <section class="section"><h2 class="h2">History</h2>
      ${vis.length ? `<div class="list">${vis.map(sessionRow).join('')}</div>${st.reps.length > S.historyN ? `<button class="btn secondary" data-act="more">Show more</button>` : ''}` : `<div class="card empty">${icon('mic')}<span class="t">No reps yet</span><span class="small">Your sessions, scores and coach notes will collect here.</span></div>`}
      ${all.length ? `<details class="fold"><summary>Drills and checks (${all.length})${icon('chev')}</summary><div class="fold-body"><div class="list">${all.slice(0, 30).map(sessionRow).join('')}</div></div></details>` : ''}
    </section>
  </div>`;
}

/* ---------------- Me ---------------- */
function viewMe() {
  const p = Store.profile, s = p.settings, ev = p.evaluation;
  const cloud = Store.mode === 'cloud';
  return `<div class="page">
    <div class="stack"><h1 class="h1">You</h1></div>
    <div class="note">${icon(cloud ? 'lock' : 'info')}<span>${cloud ? 'Your practice is saved privately to this page in your Claude account, so it follows you across devices. Only you can see it.' : 'Your practice is saved in this browser only. Open this page from your Claude account to keep it across devices.'}</span></div>
    ${storageNote()}
    <section class="card stack">
      <h2 class="h3">Profile</h2>
      <label class="field">Name<input class="input" id="pf-name" data-pf="name" value="${esc(p.name)}" autocomplete="given-name"></label>
      <label class="field">Role<input class="input" id="pf-role" data-pf="role" value="${esc(p.role)}"></label>
      <label class="field">Audiences you face<textarea class="input" id="pf-aud" data-pf="audiences" rows="2" style="min-height:70px">${esc(p.audiences)}</textarea></label>
      <label class="field">Your presence goal<textarea class="input" id="pf-goal" data-pf="goal" rows="2" style="min-height:70px">${esc(p.goal)}</textarea></label>
      <p class="small muted">The coach uses this to tailor feedback and role-plays.</p>
    </section>
    <section class="card stack">
      <div class="section-head"><h2 class="h3">Executive presence evaluation</h2>${ev ? `<button class="link" data-act="open" data-sheet="eval">Update</button>` : ''}</div>
      ${ev ? evaluationSummary(ev) : `<p class="muted">Paste your evaluation, 360 feedback or coach's notes. Green Room turns it into focus areas and a 4-week plan.</p><div><button class="btn" data-act="open" data-sheet="eval">${icon('file')}Import evaluation</button></div>`}
    </section>
    <section class="card stack">
      <div class="section-head"><h2 class="h3">Focus areas</h2><button class="link" data-act="open" data-sheet="focus">Edit</button></div>
      <div class="chips">${p.focus.map((id) => `<span class="chip on">${esc((C.skill(id) || {}).name || id)}</span>`).join('')}</div>
      <div><button class="btn secondary sm" data-act="open" data-sheet="assess">Self-assessment (${Object.keys(p.ratings).length}/${C.SKILLS.length} rated)</button></div>
    </section>
    <section class="card stack">
      <h2 class="h3">Settings</h2>
      <label class="field">Target pace
        <select class="input" id="set-pace" data-set="pace">${[[120, 150], [130, 160], [140, 170]].map(([a, b]) => `<option value="${a}-${b}" ${s.paceLo === a ? 'selected' : ''}>${a}–${b} words a minute${a === 130 ? ' (recommended)' : ''}</option>`).join('')}</select></label>
      <label class="field">Weekly practice goal
        <select class="input" id="set-goal" data-set="weeklyGoalMin">${[30, 60, 90, 120].map((m) => `<option value="${m}" ${s.weeklyGoalMin === m ? 'selected' : ''}>${m} minutes</option>`).join('')}</select></label>
      <label class="field">Thinking time before a rep
        <select class="input" id="set-think" data-set="thinkTime">${[0, 10, 20, 30].map((m) => `<option value="${m}" ${s.thinkTime === m ? 'selected' : ''}>${m ? m + ' seconds' : 'None'}</option>`).join('')}</select></label>
      <label class="check"><input type="checkbox" id="set-auto" data-set="autoCoach" ${s.autoCoach ? 'checked' : ''}> Get coach feedback automatically after each rep</label>
      <label class="check"><input type="checkbox" id="set-voice" data-set="voice" ${s.voice ? 'checked' : ''}> Read sparring questions aloud</label>
      <label class="field">Extra filler words to catch (comma-separated)<input class="input" id="set-fill" data-set="customFillers" value="${esc((s.customFillers || []).join(', '))}" placeholder="e.g. right, okay so, kind of like"></label>
    </section>
    <section class="card stack">
      <h2 class="h3">Your data</h2>
      <div class="actions"><button class="btn secondary" data-act="export" data-fmt="json">${icon('download')}Back up (JSON)</button><button class="btn secondary" data-act="export" data-fmt="csv">${icon('download')}Sessions (CSV)</button></div>
      <label class="btn secondary" style="cursor:pointer">${icon('upload')}Restore a backup<input type="file" accept=".json,application/json" id="importFile" class="sr" data-act-change="import"></label>
      <div id="resetZone"><button class="btn danger" data-act="reset1">${icon('trash')}Erase all practice data</button></div>
    </section>
    <details class="fold"><summary>How scoring works${icon('chev')}</summary><div class="fold-body prose small">
      <p><b>Clarity</b> checks whether your first sentence carries the answer, whether you signpost, and how long your sentences run. <b>Concision</b> penalizes long sentences, repetition, filler and hedge density, and running over time. <b>Confidence</b> counts hedges ("I think", "kind of", "just"), apologies and weak endings, and credits ownership language. <b>Delivery</b> uses pace against your target band and fillers per minute, plus pauses, pitch range and rising endings when there's a recording. <b>Executive impact</b> credits numbers, business stakes and a clear ask.</p>
      <p>When the AI coach reviews a rep, its judgment is blended in (70% coach, 30% measured) and composure is added for pressure scenarios. Phone dictation removes most "um"s, so filler counts from dictation are a floor. Upload a recording for the fullest delivery analysis.</p>
    </div></details>
  </div>`;
}
function evaluationSummary(ev) {
  return `<p>${esc(ev.summary || '')}</p>
    ${ev.strengths && ev.strengths.length ? `<div><div class="eyebrow">Strengths</div><ul style="margin:6px 0 0;padding-left:18px">${ev.strengths.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
    ${ev.areas && ev.areas.length ? `<div class="stack"><div class="eyebrow">Development areas</div>${ev.areas.slice().sort((a, b) => (a.priority || 3) - (b.priority || 3)).map((a) => `<div class="fix" style="border-top:0;padding-top:0"><div class="row"><span class="issue">${esc((C.skill(a.skill) || {}).name || a.skill)}</span><span class="pill ${a.priority === 1 ? 'bad' : a.priority === 2 ? 'warn' : ''}">P${a.priority || 3}</span></div>${a.evidence ? `<div class="quote" style="border-left-color:var(--line)">${esc(a.evidence)}</div>` : ''}${a.target ? `<div class="small">Good looks like: ${esc(a.target)}</div>` : ''}</div>`).join('')}</div>` : ''}
    ${ev.plan && ev.plan.length ? `<details class="fold"><summary>Your 4-week plan${icon('chev')}</summary><div class="fold-body stack">${ev.plan.map((w) => `<div><div class="h3">Week ${esc(w.week)}: ${esc(w.theme)}</div><ul style="margin:4px 0 0;padding-left:18px">${(w.commitments || []).map((c) => `<li>${esc(c)}</li>`).join('')}</ul></div>`).join('')}</div></details>` : ''}`;
}
