/* ============================================================
   Green Room — games and collections:
   Executive or Analyst?, Headline Builder, Leadership quests, Arsenal
   ============================================================ */
const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

/* ---------------- Executive or Analyst? ---------------- */
const EOA_SEC = 10;
function openEoa() { S.game = { step: 'intro' }; Sheet.open('eoa'); }
function eoaStart() {
  const ex = shuffle(C.EOA.filter((x) => x.exec)), an = shuffle(C.EOA.filter((x) => !x.exec));
  S.game = { step: 'play', items: shuffle(ex.slice(0, 5).concat(an.slice(0, 5))), i: 0, score: 0, combo: 1, correct: 0, answered: null, misses: [], best: Store.profile.game.eoaBest || 0 };
  Sheet.render();
}
SHEETS.eoa = {
  render() {
    const g = S.game;
    if (g.step === 'intro') return { title: 'Executive or Analyst?', body: `<div class="stack-lg">
      <div class="stack"><span class="eyebrow">Quick-fire · 10 rounds · ${EOA_SEC}s each</span><h1 class="h1">Executive or Analyst?</h1><p class="muted">Each line was said in a meeting. Decide fast: does it sound like an executive, or like a strong analyst still building to the point? Fast, correct answers build a combo up to ×3.</p></div>
      <div class="grid2"><div class="card stack"><span class="eyebrow">Executive</span><span class="small">Conclusion first, a clear view, owns the next step.</span></div><div class="card stack"><span class="eyebrow">Analyst</span><span class="small">Background first, hedged, analysis without a verdict.</span></div></div>
      <div class="row between"><span class="muted">Your best</span><b class="mono">${Store.profile.game.eoaBest || 0}</b></div>
      <button class="btn block" data-act="eoa-start">${icon('play')}Play</button></div>` };
    if (g.step === 'end') {
      const acc = Math.round((g.correct / g.items.length) * 100);
      return { title: 'Executive or Analyst?', body: `<div class="stack-lg" style="align-items:stretch">
        <div class="stack" style="align-items:center;text-align:center"><span class="eyebrow">Final score</span><div class="big-score">${g.score}</div>${g.newBest ? '<span class="pill good">New best</span>' : `<span class="small muted">Best ${g.best}</span>`}</div>
        <div class="kpis"><div class="kpi ${acc >= 90 ? 'good' : acc >= 70 ? 'warn' : 'bad'}"><div class="k">Accuracy</div><div class="v">${acc}%</div><div class="s">${g.correct}/${g.items.length}</div></div><div class="kpi"><div class="k">XP</div><div class="v">+${g.xp}</div><div class="s">${g.mult > 1 ? `×${g.mult} streak` : 'max 30'}</div></div><div class="kpi"><div class="k">Best combo</div><div class="v">×${g.bestCombo || 1}</div><div class="s">max ×3</div></div></div>
        ${g.misses.length ? `<div class="card stack"><span class="eyebrow">Review your misses</span>${g.misses.map((m) => `<div class="fix"><span class="small muted">${m.exec ? 'Executive' : 'Analyst'} · ${m.a}. ${esc(C.area(m.a).title)}</span><div class="quote" style="border-left-color:${m.exec ? 'var(--good)' : 'var(--bad)'}">"${esc(m.t)}"</div>${m.exec ? `<div class="small">${esc(m.why)}</div>` : `<div class="better">${esc(m.fix)}</div>`}</div>`).join('')}</div>` : '<div class="note">' + icon('check') + '<span>A clean sweep.</span></div>'}
        <div class="actions"><button class="btn" data-act="eoa-start">${icon('refresh')}Play again</button><button class="btn secondary" data-act="sheet-close">Done</button></div></div>` };
    }
    const it = g.items[g.i], ans = g.answered;
    return { title: 'Executive or Analyst?', body: `<div class="stack-lg">
      <div class="row between"><span class="eyebrow">Round ${g.i + 1} of ${g.items.length}</span><span class="row" style="gap:8px"><span class="pill ${g.combo > 1 ? 'brass' : ''}">combo ×${g.combo}</span><b class="mono">${g.score}</b></span></div>
      <div class="timebar"><i id="eoaBar" style="width:${ans ? 0 : 100}%"></i></div>
      <div class="eoa-card ${ans ? (ans.ok ? 'ok' : 'bad') : ''}">${esc(it.t)}</div>
      ${!ans ? `<div class="eoa-btns"><button class="btn secondary eoa-btn" data-act="eoa-pick" data-v="0">Analyst</button><button class="btn deep eoa-btn" data-act="eoa-pick" data-v="1">Executive</button></div>`
        : `<div class="card stack eoa-verdict"><div class="row between"><b style="color:${ans.ok ? 'var(--good)' : 'var(--bad)'}">${ans.timeout ? 'Time\'s up' : ans.ok ? 'Correct' : 'Not quite'}${ans.ok ? ` · +${ans.pts}` : ''}</b><span class="pill">${it.exec ? 'Executive' : 'Analyst'} · ${it.a}</span></div>
          <span class="small muted">${esc(C.area(it.a).title)}</span>
          ${it.exec ? `<div>${esc(it.why)}</div>` : `<div class="small muted">Executive version</div><div class="better">${esc(it.fix)}</div>`}
          <button class="btn block" data-act="eoa-next">${g.i + 1 < g.items.length ? 'Next' : 'See results'}</button></div>`}
    </div>` };
  },
  mount() {
    const g = S.game;
    if (g.step !== 'play' || g.answered) return;
    g.t0 = performance.now();
    const iv = setInterval(() => {
      const left = EOA_SEC - (performance.now() - g.t0) / 1000;
      const el = $('#eoaBar'); if (el) el.style.width = Math.max(0, (left / EOA_SEC) * 100) + '%';
      if (left <= 0) { clearInterval(iv); eoaAnswer(null); }
    }, 100);
    g.iv = iv; addCleanup(() => clearInterval(iv));
  },
};
function eoaAnswer(choice) {
  const g = S.game; if (!g || g.answered) return;
  clearInterval(g.iv);
  const it = g.items[g.i];
  const left = Math.max(0, EOA_SEC - (performance.now() - g.t0) / 1000);
  const ok = choice !== null && choice === it.exec;
  let pts = 0;
  if (ok) { pts = Math.round((100 + left * 10) * g.combo); g.score += pts; g.correct++; g.combo = Math.min(3, g.combo + 0.5); g.bestCombo = Math.max(g.bestCombo || 1, g.combo); chime('tick'); }
  else { g.combo = 1; g.misses.push(it); }
  g.answered = { ok, pts, timeout: choice === null };
  Sheet.render(true);
}
function eoaEnd() {
  const g = S.game; g.step = 'end';
  const acc = Math.round((g.correct / g.items.length) * 100);
  const sess = Store.put('sessions', { kind: 'game', refId: 'eoa', title: 'Executive or Analyst?', score: g.score, accuracy: acc, date: dkey(), ts: Date.now() });
  g.xp = G.xpOf(sess); g.mult = sess.mult || 1;
  if (g.score > (Store.profile.game.eoaBest || 0)) { g.newBest = true; Store.saveProfile({ game: Object.assign({}, Store.profile.game, { eoaBest: g.score }) }); }
  Sheet.render();
}

/* ---------------- Headline Builder ---------------- */
function openHsia(caseId) {
  const k = C.HSIA_CASES.find((x) => x.id === caseId) || C.HSIA_CASES[Math.floor(Math.random() * C.HSIA_CASES.length)];
  S.game = { kase: k, f: { headline: '', structure: ['', '', ''], implication: '', action: '' }, res: null, ai: null, busy: false, err: '' };
  Sheet.open('hsia');
}
const HB = {
  headline(t) {
    const w = A.wordList(t).length; let sc = 0, msg = [];
    if (!w) return { sc: 0, msg: 'Your central point, in one sentence.' };
    if (w >= 4 && w <= 25) sc += 10; else msg.push(w > 25 ? `${w} words: cut to 25 or fewer` : 'Too short to carry the point');
    if (/\b(recommend|should|propose|pass|invest|approve|decline|proceed|decision|bottom line|is not|isn't|will|need|prioriti[sz]e|must|extend|exit|partner|build|hire)\b/i.test(t)) sc += 10; else msg.push('State a position or recommendation');
    if (!/^\s*(background|context|so\b|well\b|first\b|before|let me|as you know|I think)/i.test(t)) sc += 5; else msg.push('Don\'t open with set-up');
    return { sc, msg: msg.join(' · ') || 'Clear headline' };
  },
  structure(arr) {
    const pts = arr.map((x) => x.trim()).filter(Boolean);
    if (!pts.length) return { sc: 0, msg: 'Two or three supporting arguments.' };
    let sc = pts.length >= 2 ? 15 : 7; const msg = [];
    if (pts.length < 2) msg.push('Add a second point');
    const long = pts.filter((x) => A.wordList(x).length > 15).length;
    sc += Math.round(10 * (1 - long / pts.length)); if (long) msg.push(`${long} point${long > 1 ? 's' : ''} over 15 words`);
    return { sc, msg: msg.join(' · ') || `${pts.length} tight points` };
  },
  implication(t) {
    const w = A.wordList(t).length; let sc = 0; const msg = [];
    if (!w) return { sc: 0, msg: 'Why does this matter?' };
    sc += 8;
    if (/\b(means|implication|matters|so that|result|risk|value|position|strategic|cost|return|lose|gain|advantage|default|first|ahead|behind)\b/i.test(t)) sc += 10; else msg.push('Say what it means for the organization');
    if (w <= 30) sc += 7; else msg.push('Keep it to one sentence');
    return { sc, msg: msg.join(' · ') || 'Clear implication' };
  },
  action(t) {
    const w = A.wordList(t).length; let sc = 0; const msg = [];
    if (!w) return { sc: 0, msg: 'What should happen next?' };
    sc += 8;
    if (/\b(approve|fund|decide|sign|launch|assign|send|schedule|reconvene|move|proceed|start|stop|hire|authorize|commit|own|agree|extend|exit|pass|counter|bring)\b/i.test(t)) sc += 9; else msg.push('Use an action verb');
    if (/\b(I|we|[A-Z][a-z]+) (will|'ll|owns?|to)\b|\bby\b|\btoday\b|\btomorrow\b|this week|next week|monday|tuesday|wednesday|thursday|friday|\bq[1-4]\b|\d/i.test(t)) sc += 8; else msg.push('Add an owner or a date');
    return { sc, msg: msg.join(' · ') || 'Explicit next action' };
  },
};
function hbScore(f) {
  const parts = { headline: HB.headline(f.headline), structure: HB.structure(f.structure), implication: HB.implication(f.implication), action: HB.action(f.action) };
  const total = Object.values(parts).reduce((a, p) => a + p.sc, 0);
  return { parts, total };
}
SHEETS.hsia = {
  render() {
    const g = S.game, k = g.kase, f = g.f;
    const sc = hbScore(f);
    const field = (id, label, q, html) => `<div class="hb-field"><div class="row nowrap" style="gap:10px"><span class="hb-letter">${label[0]}</span><div><div class="h3">${label}</div><div class="small muted">${q}</div></div></div>${html}<div class="hb-chk small ${sc.parts[id].sc >= 18 ? 'ok' : ''}" id="chk-${id}">${esc(sc.parts[id].msg)}</div></div>`;
    return { title: 'Headline Builder', body: `<div class="stack-lg">
      <div class="stack"><span class="eyebrow">Headline Builder · ${esc(k.audience)}</span><h1 class="h2">${esc(k.title)}</h1></div>
      <div class="card stack"><span class="eyebrow">Your raw notes</span><ul class="ul">${k.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>
      <div class="chips">${C.HSIA_RULES.map((r) => `<span class="chip">${esc(r)}</span>`).join('')}</div>
      ${field('headline', 'Headline', 'What is your central point?', `<textarea class="input" rows="2" style="min-height:64px" data-hb="headline" placeholder="My recommendation is…">${esc(f.headline)}</textarea>`)}
      ${field('structure', 'Structure', 'Two or three supporting arguments.', [0, 1, 2].map((i) => `<input class="input" data-hb="structure" data-i="${i}" value="${esc(f.structure[i])}" placeholder="${['First', 'Second', 'Third (optional)'][i]}">`).join(''))}
      ${field('implication', 'Implication', 'Why does this matter?', `<textarea class="input" rows="2" style="min-height:64px" data-hb="implication" placeholder="The strategic implication is…">${esc(f.implication)}</textarea>`)}
      ${field('action', 'Action', 'What should happen next?', `<textarea class="input" rows="2" style="min-height:64px" data-hb="action" placeholder="The decision we need today is… / I'll own…">${esc(f.action)}</textarea>`)}
      <div class="row between"><span class="muted">Live score</span><b class="mono" id="hbTotal">${s10(sc.total)}</b></div>
      ${g.res ? hbResult(g) : `<button class="btn block" data-act="hb-score">${icon('check')}Lock it in</button>`}
      <div class="actions"><button class="btn secondary" data-act="hb-new">${icon('refresh')}Another case</button></div>
    </div>` };
  },
  mount() {
    $$('[data-hb]').forEach((el) => el.addEventListener('input', () => {
      const g = S.game; const k = el.dataset.hb;
      if (k === 'structure') g.f.structure[Number(el.dataset.i)] = el.value; else g.f[k] = el.value;
      const sc = hbScore(g.f);
      for (const id of ['headline', 'structure', 'implication', 'action']) { const c = $('#chk-' + id); if (c) { c.textContent = sc.parts[id].msg; c.classList.toggle('ok', sc.parts[id].sc >= 18); } }
      const t = $('#hbTotal'); if (t) t.textContent = s10(sc.total);
    }));
  },
};
function hbResult(g) {
  const r = g.res, ai = g.ai;
  const lights = { headline: r.parts.headline.sc >= 18, structure: r.parts.structure.sc >= 18, implication: r.parts.implication.sc >= 18, action: r.parts.action.sc >= 18 };
  return `${hsiaLights(ai ? Object.fromEntries(C.HSIA.map((x) => [x.id, (ai.parts[x.id] || {}).score >= 7])) : lights)}
    <div class="card raised stack" style="align-items:center"><span class="eyebrow">Score</span><div class="big-score">${s10(g.session ? G.scores(g.session).overall : r.total)}</div><span class="xp-pop">+${g.session ? G.xpOf(g.session) : 0} XP</span></div>
    ${ai ? `<div class="card coach stack-lg"><div class="coach-head"><span class="badge">${icon('spark')}</span><span class="eyebrow">Coach's read</span></div><p class="headline">${esc(ai.verdict)}</p>
      ${C.HSIA.map((x) => ai.parts[x.id] ? `<div class="crit ${ai.parts[x.id].score >= 7 ? 'yes' : 'partly'}">${icon(ai.parts[x.id].score >= 7 ? 'yes' : 'partly')}<span><b>${x.name} ${f1(ai.parts[x.id].score)}.</b> ${esc(ai.parts[x.id].note)}</span></div>` : '').join('')}
      ${ai.model ? `<div class="stack"><span class="eyebrow">Model answer</span><div class="better"><b>${esc(ai.model.headline)}</b><br>${(ai.model.structure || []).map((x) => '• ' + esc(x)).join('<br>')}<br>${esc(ai.model.implication)}<br><b>${esc(ai.model.action)}</b></div></div>` : ''}
      ${ai.summary2 ? `<div class="stack"><span class="eyebrow">Two-sentence executive summary</span><div class="better">${esc(ai.summary2)}</div></div>` : ''}</div>`
      : AI.ready ? (g.busy ? `<div class="thinking"><span class="dotpulse"><i></i><i></i><i></i></span>The coach is reading your answer…</div>` : `<button class="btn deep block" data-act="hb-coach">${icon('spark')}Get the coach's read</button>`) : ''}
    ${g.err ? `<div class="note warn">${icon('info')}<span>${esc(g.err)}</span></div>` : ''}
    <button class="btn block" data-act="hb-say">${icon('mic')}Now say it out loud</button>`;
}
function hbLock() {
  const g = S.game;
  if (!g.f.headline.trim()) { toast('Write your headline first.'); return; }
  g.res = hbScore(g.f);
  const lights = Object.fromEntries(Object.entries(g.res.parts).map(([k, v]) => [k, v.sc >= 18]));
  g.session = Store.put('sessions', { kind: 'hsia', refId: g.kase.id, title: `Headline Builder: ${g.kase.title}`, date: dkey(), ts: Date.now(), answer: JSON.parse(JSON.stringify(g.f)), hsia: lights, scores: { v: 2, overall: g.res.total } });
  if (Object.values(lights).every(Boolean)) Celebrate.push({ kind: 'full', title: 'Full house', sub: 'All four parts landed.' });
  Sheet.render(true);
}
async function hbCoach() {
  const g = S.game; g.busy = true; g.err = ''; Sheet.render(true);
  try {
    const res = await AI.json(AI.hsiaPrompt(Store.profile, g.kase, g.f), { modelTier: 'default' });
    const parts = {}; for (const x of C.HSIA) { const v = (res.parts || {})[x.id]; if (v) parts[x.id] = { score: A.clamp(Number(v.score) || 0, 0, 10), note: String(v.note || '') }; }
    g.ai = { score: A.clamp(Number(res.score) || 0, 0, 10), verdict: String(res.verdict || ''), parts, model: res.model || null, summary2: String(res.summary2 || '') };
    if (g.session) { g.session.coach = { headline: g.ai.verdict, model: g.ai.model, summary2: g.ai.summary2 }; g.session.hsia = Object.fromEntries(C.HSIA.map((x) => [x.id, (parts[x.id] || {}).score >= 7])); g.session.scores = { v: 2, overall: Math.round(0.3 * g.res.total + 0.7 * g.ai.score * 10) }; g.session = Store.put('sessions', g.session); }
  } catch (e) { g.err = AI.errorText(e); }
  g.busy = false;
  if (S.sheet && S.sheet.type === 'hsia') Sheet.render(true);
}
function hbSay() {
  const g = S.game, f = g.f;
  const script = [f.headline, f.structure.filter(Boolean).join(' '), f.implication, f.action].filter(Boolean).join(' ');
  openRep(customSpec({ title: `Deliver: ${g.kase.title}`, audience: g.kase.audience, situation: 'You built this in the Headline Builder. Now say it, without reading it word for word.', prompt: `Deliver your Headline → Structure → Implication → Action in under 45 seconds. Your draft: "${script.slice(0, 700)}"`, time: 45, areas: ['A', 'B'] }));
}

/* ---------------- Leadership quests ---------------- */
function weekQuests() {
  const wk = G.isoWeek();
  const cats = [...new Set(C.QUESTS.map((q) => q.cat))];
  return [0, 2, 4].map((o) => { const cat = cats[(wk.n + o) % cats.length]; const qs = C.QUESTS.filter((q) => q.cat === cat); return qs[wk.n % qs.length]; });
}
SHEETS.quests = {
  render() {
    const wk = G.isoWeek().key;
    const done = new Map(Store.sessions.filter((s) => s.kind === 'quest').map((s) => [s.refId + '|' + s.week, s]));
    const t = S.tool || (S.tool = {});
    const card = (q, mine) => { const d = done.get(q.id + '|' + wk); return `<div class="card stack quest ${d ? 'done' : ''}"><div class="row between"><span class="eyebrow">${esc(q.cat)}</span><span class="pill ${d ? 'good' : 'brass'}">${d ? 'Done' : '+30 XP'}</span></div><div class="h3" style="font-weight:500">${esc(q.text)}</div>
      ${d ? (d.note ? `<div class="small muted">${esc(d.note)}</div>` : '') : t.open === q.id ? `<textarea class="input" id="qnote" rows="2" style="min-height:64px" placeholder="What happened? (optional)"></textarea><button class="btn sm" data-act="quest-save" data-id="${q.id}">${icon('check')}Log it</button>` : `<div><button class="btn secondary sm" data-act="quest-open" data-id="${q.id}">I did this</button></div>`}</div>`; };
    const mine = weekQuests();
    return { title: 'Leadership quests', body: `<div class="stack-lg">
      <div class="stack"><h1 class="h1">Leadership quests</h1><p class="muted">Executive presence shows up beyond communication: ownership, decisions, managing up, influence, delegation and judgment. Three real-world quests a week.</p></div>
      <section class="section"><h2 class="eyebrow">This week · ${esc(wk)}</h2>${mine.map((q) => card(q, true)).join('')}</section>
      <details class="fold"><summary>All quests${icon('chev')}</summary><div class="fold-body stack">${C.QUESTS.filter((q) => !mine.includes(q)).map((q) => card(q)).join('')}</div></details>
    </div>` };
  },
};

/* ---------------- Executive language arsenal ---------------- */
const PHRASE_EX = {
  recommend: 'My recommendation is to proceed, conditional on a payer milestone.',
  fundamental: 'The fundamental issue is who pays for the test, not whether it works.',
  two: 'There are two considerations here: speed to market and control of the data.',
  implication: 'The strategic implication is that we become the default validation partner.',
  distinguish: 'I would distinguish between scientific merit and investment merit.',
  decision: 'The decision we need to make today is whether to fund diligence.',
  prioritize: 'I would prioritize the payer strategy over the second indication.',
  risk: 'The risk I would focus on is execution: the team has never scaled a lab.',
  changemind: 'What would change my mind is a signed commercial payer contract.',
  summary: 'Let me summarize: we agree on the goal and disagree on timing.',
};
SHEETS.arsenal = {
  render() {
    const used = {}; const weak = {};
    Store.sessions.forEach((s) => { (s.execPhrases || []).forEach((x) => { used[x] = (used[x] || 0) + 1; }); (s.weakPhrases || []).forEach((x) => { weak[x] = (weak[x] || 0) + 1; }); });
    const n = Object.keys(used).length;
    return { title: 'Executive language', body: `<div class="stack-lg">
      <div class="stack"><h1 class="h1">Executive language</h1><p class="muted">The objective is not to sound rehearsed. It is to communicate with precision. Use a phrase in any rep to collect it.</p><span class="pill brass" style="align-self:flex-start">${n} / ${C.EXEC_PHRASES.length} collected</span></div>
      <div class="phrase-grid">${C.EXEC_PHRASES.map((ph) => `<div class="phrase ${used[ph.id] ? 'on' : ''}"><div class="row between"><span class="ph-ic">${icon(used[ph.id] ? 'check' : 'lock')}</span>${used[ph.id] ? `<span class="pill good">×${used[ph.id]}</span>` : ''}</div><div class="ph-say">${esc(ph.say)}</div><div class="small muted">${esc(PHRASE_EX[ph.id] || '')}</div></div>`).join('')}</div>
      <div class="card stack"><span class="eyebrow">Retiring</span>${C.WEAK_PHRASES.map((w) => `<div class="row between"><span class="from" style="color:var(--muted);text-decoration:line-through;text-decoration-color:var(--bad)">${esc(w.say)}</span><span class="pill ${weak[w.say] ? 'bad' : 'good'}">${weak[w.say] ? `spotted ×${weak[w.say]}` : 'clean'}</span></div>`).join('')}</div>
      <div class="actions"><button class="btn" data-act="drill" data-id="swaps">${icon('swap')}Word swap drill</button><button class="btn secondary" data-act="arsenal-rep">${icon('mic')}Use them in a rep</button></div>
    </div>` };
  },
};
