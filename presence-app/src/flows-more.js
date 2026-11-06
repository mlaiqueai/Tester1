/* ============================================================
   Green Room — sparring, drills, toolkit sheets, actions, boot
   ============================================================ */

/* ---------------- Spar ---------------- */
function openSpar(personaId, preset = {}) {
  const persona = C.PERSONAS.find((p) => p.id === personaId) || C.PERSONAS[0];
  S.spar = { persona, ctx: preset.ctx || persona.defaultContext, difficulty: preset.boss ? 'brutal' : preset.difficulty || 'tough', rounds: preset.boss ? 5 : preset.rounds || 5, boss: !!preset.boss, bossWeek: preset.boss ? G.isoWeek().key : null, step: 'setup', convo: [], waiting: false, err: '', offline: !AI.ready, debrief: null, session: null, voice: Store.profile.settings.voice };
  Sheet.open('spar');
}
function speak(text) {
  const sp = S.spar;
  if (!sp || !sp.voice || !window.speechSynthesis) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/\[END\]/g, ''));
    const voices = speechSynthesis.getVoices();
    const v = voices.find((x) => /en[-_](US|GB)/i.test(x.lang) && /Daniel|Alex|Google UK English Male|Arthur|Aaron/i.test(x.name)) || voices.find((x) => /^en/i.test(x.lang));
    if (v) u.voice = v;
    u.rate = 1.02; u.pitch = 0.95;
    speechSynthesis.speak(u);
  } catch (e) { /* speech not available */ }
}
SHEETS.spar = {
  render() {
    const sp = S.spar;
    if (!sp) return { title: '', body: '' };
    const p = sp.persona;
    const right = sp.step === 'chat' ? `<button class="icon-btn plain" data-act="spar-voice" aria-label="${sp.voice ? 'Mute questions' : 'Read questions aloud'}">${icon(sp.voice ? 'volume' : 'mute')}</button>` : '';
    if (sp.step === 'setup') return { title: sp.boss ? `Boss: ${p.name}` : p.name, body: sparSetup(sp) };
    if (sp.step === 'chat') return { title: p.name, right, body: sparChat(sp) };
    return { title: `Debrief: ${p.name}`, body: sp.session ? sparDebriefBody(sp.session) + `<div class="actions" style="margin-top:18px"><button class="btn" data-act="spar-again">${icon('refresh')}Spar again</button><button class="btn secondary" data-act="sheet-close">Done</button></div>` : sparDebriefLoading(sp) };
  },
  mount() {
    const sp = S.spar;
    if (sp && sp.step === 'chat') {
      const box = $('#sparBox');
      if (sp.dict && sp.dict.stop) sp.dict.stop();
      if (box) { sp.dict = trackDictation(box, (st) => { const el = $('#sparT'); if (el) el.textContent = st.t0 ? fmtSec((performance.now() - st.t0) / 1000) : '0:00'; }); }
      const el = $('#sheet'); el.scrollTop = el.scrollHeight;
    }
  },
};
function sparSetup(sp) {
  const p = sp.persona;
  return `<div class="stack-lg">
    <div class="row nowrap" style="gap:14px"><span class="mono-mark" style="width:52px;height:52px;border-radius:50%;background:var(--deep);color:var(--brass-bright);font-family:var(--font-display);font-weight:700;font-size:22px;display:grid;place-items:center;flex:none">${esc(p.name.replace(/^The /, '')[0])}</span><div><h1 class="h2">${esc(p.name)}</h1><div class="muted">${esc(p.role)}</div></div></div>
    ${sp.boss ? `<div class="note warn">${icon('medal')}<span><b>Boss of the week.</b> Brutal difficulty, five questions. Score 8.0 or better to win +100 XP.</span></div>` : ''}
    <p>${esc(p.style)}</p>
    <label class="field">The situation<textarea class="input" id="sparCtx" rows="4">${esc(sp.ctx)}</textarea></label>
    ${sp.boss ? '' : `<div class="stack"><span class="eyebrow">Difficulty</span><div class="seg full" role="group">${['warm', 'tough', 'brutal'].map((d) => `<button data-act="spar-diff" data-v="${d}" aria-pressed="${sp.difficulty === d}">${d[0].toUpperCase() + d.slice(1)}</button>`).join('')}</div><p class="small muted">${esc(C.DIFFICULTY[sp.difficulty])}</p></div>
    <div class="stack"><span class="eyebrow">Questions</span><div class="seg full" role="group">${[3, 5, 7].map((n) => `<button data-act="spar-rounds" data-v="${n}" aria-pressed="${sp.rounds === n}">${n}</button>`).join('')}</div></div>`}
    ${sp.offline ? `<div class="note">${icon('info')}<span>Claude isn't available in this view, so you'll get ${esc(p.name)}'s question bank without live follow-ups. Your answers are still scored.</span></div>` : `<div class="note">${icon('volume')}<span>Questions are read aloud${window.speechSynthesis ? '' : ' where your browser supports it'}. Answer out loud with your keyboard's dictation, or type.</span></div>`}
    <button class="btn block" data-act="spar-start">${icon('play')}Start</button>
  </div>`;
}
function sparChat(sp) {
  const asked = sp.convo.filter((t) => t.role === 'them').length;
  const answered = sp.convo.filter((t) => t.role === 'me').length;
  const bubbles = sp.convo.map((t) => t.role === 'them'
    ? `<div class="bubble them"><span class="who">${esc(sp.persona.name)}</span>${esc(t.content)}</div>`
    : `<div class="bubble me"><span class="who">You</span>${esc(t.content)}<div class="m">${t.metrics.secs ? `<span class="pill">${fmtSec(t.metrics.secs)}</span>` : ''}<span class="pill">${t.metrics.words} words</span><span class="pill ${t.metrics.fillers ? 'warn' : 'good'}">${t.metrics.fillers} fillers</span><span class="pill ${t.metrics.hedges ? 'warn' : 'good'}">${t.metrics.hedges} hedges</span></div></div>`).join('');
  const waiting = sp.waiting ? `<div class="bubble them"><span class="who">${esc(sp.persona.name)}</span><span class="dotpulse"><i></i><i></i><i></i></span></div>` : '';
  const err = sp.err ? `<div class="note warn">${icon('info')}<span>${esc(sp.err)} <button class="link" data-act="spar-retry">Retry</button></span></div>` : '';
  const canAnswer = !sp.waiting && !sp.err && sp.convo.length && sp.convo[sp.convo.length - 1].role === 'them';
  return `<div class="stack-lg">
    <div class="row between"><span class="eyebrow">Question ${Math.min(asked, sp.rounds)} of ${sp.rounds}</span>${answered ? `<button class="link" data-act="spar-end">End and debrief</button>` : ''}</div>
    <div class="chat">${bubbles}${waiting}</div>${err}
    ${canAnswer ? `<div class="card stack" style="position:sticky;bottom:8px;box-shadow:var(--shadow)">
      <div class="row between"><span class="mono small" id="sparT">0:00</span><span class="small muted">Dictate with your keyboard's mic, or type</span></div>
      <textarea class="input" id="sparBox" rows="4" placeholder="Your answer…"></textarea>
      <button class="btn block" data-act="spar-send">${icon('send')}Answer</button>
    </div>` : ''}
  </div>`;
}
async function sparAsk() {
  const sp = S.spar;
  if (!sp) return;
  const answered = sp.convo.filter((t) => t.role === 'me').length;
  const isLast = answered >= sp.rounds;
  if (sp.offline) {
    if (isLast) return sparDebrief();
    const bank = C.QBANK[sp.persona.id] || C.QBANK['ic-chair'];
    const q = bank[answered % bank.length];
    sp.convo.push({ role: 'them', content: q }); Sheet.render(); speak(q); return;
  }
  sp.waiting = true; sp.err = ''; Sheet.render();
  const ctl = new AbortController(); addCleanup(() => ctl.abort());
  try {
    const rules = AI.sparRules(Store.profile, sp.persona, sp.ctx, sp.difficulty, sp.rounds);
    const res = await AI.text(AI.sparTurns(rules, sp.convo, isLast), { modelTier: 'quick', cache: false, signal: ctl.signal });
    if (!S.spar) return;
    let txt = String(res.text || '').trim();
    const ended = /\[END\]/.test(txt);
    txt = txt.replace(/\[END\]/g, '').trim();
    sp.waiting = false;
    if (txt) { sp.convo.push({ role: 'them', content: txt }); speak(txt); }
    if (ended || isLast) { Sheet.render(); setTimeout(() => S.spar && sparDebrief(), txt ? 1800 : 0); return; }
    Sheet.render();
  } catch (e) {
    if (!S.spar) return;
    sp.waiting = false;
    if (e && e.code === 'cancelled') return;
    if (AI.state === 'off') { sp.offline = true; sp.err = ''; toast('Switched to the offline question bank.'); return sparAsk(); }
    sp.err = AI.errorText(e); Sheet.render();
  }
}
function sparSend() {
  const sp = S.spar, box = $('#sparBox');
  const txt = (box && box.value || '').trim();
  if (!txt) { toast('Answer first: dictate or type your reply.'); return; }
  const typed = sp.dict && sp.dict.looksTyped();
  const secs = typed ? null : Math.round(sp.dict ? sp.dict.seconds() : 0) || null;
  const ta = A.analyzeText(txt, { source: typed ? 'typed' : 'dictation', durationSec: secs });
  sp.convo.push({ role: 'me', content: txt, metrics: { secs, words: ta.words, fillers: ta.fillers.total, hedges: ta.hedges.total, bluf: ta.bluf, typed: !!typed } });
  try { speechSynthesis.cancel(); } catch (e) { /* ignore */ }
  sparAsk();
}
async function sparDebrief() {
  const sp = S.spar;
  if (!sp) return;
  try { speechSynthesis.cancel(); } catch (e) { /* ignore */ }
  sp.step = 'debrief'; sp.err = ''; Sheet.render();
  const answers = sp.convo.filter((t) => t.role === 'me');
  const all = answers.map((t) => t.content).join('\n');
  const secs = answers.reduce((a, t) => a + (t.metrics.secs || 0), 0);
  const typedAll = answers.every((t) => t.metrics.typed);
  const ta = A.analyzeText(all, { source: typedAll ? 'typed' : 'dictation', durationSec: secs || null });
  const sc = A.score(ta, null, { paceLo: Store.profile.settings.paceLo, paceHi: Store.profile.settings.paceHi });
  const auto = Object.assign({ v: 2 }, ...C.DIMENSIONS.map((d) => ({ [d.id]: sc[d.id] != null ? sc[d.id] : null })));
  let coach = null;
  if (!sp.offline && AI.ready) {
    try {
      const res = await AI.json(AI.debriefPrompt(Store.profile, sp.persona, sp.ctx, sp.convo), { modelTier: 'default' });
      coach = normalizeDebrief(res);
    } catch (e) { sp.err = AI.errorText(e); }
  }
  if (!S.spar) return;
  const sess = {
    ts: Date.now(), date: dkey(), kind: 'spar', refId: sp.persona.id, title: `Spar: ${sp.persona.name}`,
    v: 2, persona: sp.persona.id, difficulty: sp.difficulty, context: sp.ctx, convo: sp.convo, boss: sp.boss, bossWeek: sp.bossWeek, source: typedAll ? 'typed' : 'dictation', durationSec: secs || null,
    transcript: all.slice(0, 20000),
    metrics: { words: ta.words, wpm: sc.wpm, fillers: ta.fillers.total, fillersPerMin: ta.fillers.perMin, fillerTypes: ta.fillers.byType.slice(0, 6), hedges: ta.hedges.total, hedgesPer100: ta.hedges.per100, hedgeTypes: ta.hedges.byType.slice(0, 6), bluf: null, numbers: ta.numbers, avgSentence: ta.avgSentence },
    autoScores: auto, coach, notes: sc.notes,
  };
  sess.scores = blendScores(auto, coach && coach.scores);
  if (sp.boss) sess.won = sess.scores.overall != null && sess.scores.overall >= 80;
  sp.session = Store.put('sessions', sess);
  Sheet.render();
  if (sp.boss && sess.won) Celebrate.push({ kind: 'boss', title: `${sp.persona.name} defeated`, sub: `You scored ${s10(sess.scores.overall)} at Brutal difficulty.`, xp: 100 });
  else if (sp.boss) toast(`Boss scored ${s10(sess.scores.overall)}. You need 8.0. Rematch any time this week.`, 4200);
}
function normalizeDebrief(res) {
  const base = normalizeCoach(res);
  base.moments = (Array.isArray(res.moments) ? res.moments : []).slice(0, 10).map((m) => ({ question: String(m.question || ''), verdict: String(m.verdict || 'ok'), note: String(m.note || ''), better: String(m.better || '') }));
  base.patterns = (Array.isArray(res.patterns) ? res.patterns : []).slice(0, 3).map(String);
  base.next_focus = String(res.next_focus || '');
  return base;
}
function sparDebriefLoading(sp) {
  return `<div class="stack-lg" style="align-items:center;text-align:center;padding-top:40px"><div class="thinking"><span class="dotpulse"><i></i><i></i><i></i></span>${sp.offline ? 'Scoring your answers…' : 'The coach is reviewing every answer…'}</div><p class="small muted">This takes up to a minute.</p></div>`;
}
function sparDebriefBody(s) {
  const c = s.coach;
  const persona = C.PERSONAS.find((p) => p.id === s.persona) || { name: 'Interviewer' };
  const answers = (s.convo || []).filter((t) => t.role === 'me');
  return `<div class="stack-lg">
    <div class="stack" style="gap:4px"><span class="eyebrow">${s.boss ? 'Boss fight' : 'Spar'} · ${esc(s.difficulty || '')} · ${esc(fmtDate(s.ts))}</span><h1 class="h2">${esc(persona.name)}</h1></div>
    ${s.boss ? `<div class="note ${s.won ? '' : 'warn'}">${icon('medal')}<span>${s.won ? '<b>Boss defeated.</b> +100 XP.' : '<b>Not this time.</b> You need 8.0 to win. Rematch any time this week.'}</span></div>` : ''}
    <div class="card raised stack" style="align-items:center"><div style="width:100%;max-width:320px">${gauge(G.scores(s).overall, { label: s.boss ? 'Boss score' : 'Spar score', base: G.plan().overall.baseline * 10, target: 80 })}</div>${c && c.stage ? `<span class="pill brass">Sounded like Stage ${c.stage}: ${esc(C.STAGES[c.stage - 1].name)}</span>` : ''}<div style="width:100%">${bars(G.scores(s), C.DIMENSIONS, { plan: true })}</div></div>
    ${c ? `<div class="card coach stack-lg"><div class="coach-head"><span class="badge">${icon('spark')}</span><span class="eyebrow">Debrief</span></div>
      ${c.headline ? `<p class="headline">${esc(c.headline)}</p>` : ''}
      ${c.strengths && c.strengths.length ? `<div class="stack"><span class="eyebrow">Keep</span>${c.strengths.map((x) => `<div class="better">${esc(x)}</div>`).join('')}</div>` : ''}
      ${c.patterns && c.patterns.length ? `<div class="stack"><span class="eyebrow">Patterns</span>${c.patterns.map((x) => `<div class="crit partly">${icon('target')}<span>${esc(x)}</span></div>`).join('')}</div>` : ''}
      ${c.next_focus ? `<div class="note warn">${icon('target')}<span><b>Practice next:</b> ${esc(c.next_focus)}</span></div>` : ''}
    </div>` : `<div class="note">${icon('info')}<span>${AI.ready ? 'The coach debrief didn\'t come through. Your measured scores are saved.' : 'Scored on measurements only. With Claude available, you also get a debrief of every answer.'}</span></div>`}
    <div class="section"><h2 class="h3">Answer by answer</h2>
      ${(s.convo || []).filter((t) => t.role === 'them').map((q, i) => {
        const a = answers[i]; const m = c && c.moments ? c.moments[i] : null;
        if (!a) return '';
        const v = m ? m.verdict : null;
        return `<details class="fold" ${i === 0 ? 'open' : ''}><summary><span style="min-width:0">${esc(q.content.length > 90 ? q.content.slice(0, 88) + '…' : q.content)}</span>${v ? `<span class="pill ${v === 'strong' ? 'good' : v === 'ok' ? 'warn' : 'bad'}">${esc(v)}</span>` : icon('chev')}</summary><div class="fold-body stack">
          <div class="small muted">You said</div><div>${esc(a.content)}</div>
          <div class="tag-row">${a.metrics.secs ? `<span class="pill">${fmtSec(a.metrics.secs)}</span>` : ''}<span class="pill">${a.metrics.words} words</span><span class="pill ${a.metrics.fillers ? 'warn' : 'good'}">${a.metrics.fillers} fillers</span><span class="pill ${a.metrics.hedges ? 'warn' : 'good'}">${a.metrics.hedges} hedges</span>${a.metrics.bluf === true ? '<span class="pill good">answer first</span>' : a.metrics.bluf === false ? '<span class="pill bad">buried answer</span>' : ''}</div>
          ${m && m.note ? `<div>${esc(m.note)}</div>` : ''}${m && m.better ? `<div class="small muted">Stronger</div><div class="better">${esc(m.better)}</div>` : ''}
          <div><button class="btn secondary sm" data-act="spar-q" data-q="${esc(q.content)}" data-aud="${esc(persona.role || '')}">Practice this question</button></div>
        </div></details>`;
      }).join('')}
    </div>
  </div>`;
}

/* ---------------- Drills ---------------- */
function openDrill(id) { S.drill = { id, i: 0, running: false, set: 0, passage: 0, wpm: 140, revealed: false, done: false }; Sheet.open('drill'); }
function logDrill(id, minutes) {
  const w = C.WARMUPS.find((x) => x.id === id) || { name: id === 'pregame' ? 'Pre-game routine' : 'Drill', minutes: minutes || 2 };
  Store.put('sessions', { ts: Date.now(), date: dkey(), kind: 'drill', refId: id, title: w.name, minutes: minutes || w.minutes });
  toast(`Logged · +6 XP`);
}
SHEETS.drill = {
  render() {
    const d = S.drill; if (!d) return { title: '', body: '' };
    const w = C.WARMUPS.find((x) => x.id === d.id) || { name: 'Pre-game routine', why: 'Arrive calm, grounded and clear.' };
    const head = `<div class="stack" style="gap:4px"><span class="eyebrow">Drill</span><h1 class="h1">${esc(w.name)}</h1><p class="muted">${esc(w.why)}</p></div>`;
    const body = ({ breath: drillBreath, vocal: drillSteps, pregame: drillSteps, enunciation: drillEnunciation, 'pause-ladder': drillLines, inflection: drillLines, swaps: drillSwaps, pace: drillPace, concision: drillConcision }[d.id] || (() => ''))(d);
    const during = d.id === 'pregame' ? `<div class="card stack"><span class="eyebrow">During the meeting</span>${C.OPERATING.during.map((x) => `<div class="crit yes">${icon('target')}<span>${esc(x)}</span></div>`).join('')}<span class="eyebrow" style="margin-top:6px">Have these ready</span><div class="chips">${['recommend', 'decision', 'summary'].map((id) => `<span class="chip">${esc(C.EXEC_PHRASES.find((x) => x.id === id).say)}</span>`).join('')}</div></div>` : '';
    return { title: w.name, body: `<div class="stack-lg">${head}${body}${during}</div>` };
  },
  mount() { const d = S.drill; if (d && d.id === 'concision') mountConcision(); },
};
function finishBtn(d) { return d.done ? `<div class="note">${icon('check')}<span>Done and logged. Nice work.</span></div><button class="btn secondary block" data-act="sheet-close">Close</button>` : `<button class="btn secondary block" data-act="drill-finish">${icon('check')}Finish and log it</button>`; }
function drillBreath(d) {
  return `<div class="breath" aria-live="polite"><div class="sq"></div><div class="orb" id="orb"></div><div class="lbl" id="breathLbl">${d.running ? '' : 'Ready'}</div></div>
    <p class="muted" style="text-align:center" id="breathSub">Four rounds: in for 4, hold 4, out 4, hold 4.</p>
    ${d.running ? `<button class="btn secondary block" data-act="breath-stop">Stop</button>` : d.done ? finishBtn(d) : `<button class="btn block" data-act="breath-go">${icon('play')}Begin</button>`}`;
}
function runBreath(onDone, rounds = 4) {
  const phases = ['Breathe in', 'Hold', 'Breathe out', 'Hold'];
  let k = 0;
  const step = () => {
    const orb = $('#orb'), lbl = $('#breathLbl'), sub = $('#breathSub');
    if (!orb) return;
    if (k >= rounds * 4) { lbl.textContent = 'Done'; orb.style.transform = 'scale(1)'; onDone && onDone(); return; }
    const ph = k % 4;
    lbl.textContent = phases[ph];
    if (sub) sub.textContent = `Round ${Math.floor(k / 4) + 1} of ${rounds}`;
    orb.style.transform = ph === 0 ? 'scale(2.6)' : ph === 2 ? 'scale(1)' : orb.style.transform;
    k++;
  };
  step();
  const iv = setInterval(step, 4000);
  addCleanup(() => clearInterval(iv));
  return () => clearInterval(iv);
}
function drillSteps(d) {
  const steps = d.id === 'pregame' ? C.PREGAME : C.VOCAL_STEPS;
  const st = steps[d.i];
  if (d.done) return finishBtn(d);
  return `<div class="step-dots">${steps.map((_, i) => `<i class="${i <= d.i ? 'on' : ''}"></i>`).join('')}</div>
    ${d.id === 'pregame' && d.i === 0 ? `<div class="breath"><div class="sq"></div><div class="orb" id="orb"></div><div class="lbl" id="breathLbl">Ready</div></div><p class="muted" style="text-align:center" id="breathSub"></p>` : ''}
    <div class="card stack" style="text-align:center"><div class="big-line">${esc(st.t)}</div><div class="timer" id="stepT" style="font-size:32px">${fmtSec(st.s)}</div></div>
    <div class="actions">${d.running ? `<button class="btn secondary" data-act="step-next">${d.i < steps.length - 1 ? 'Next' : 'Finish'}</button>` : `<button class="btn" data-act="step-go">${icon('play')}${d.i ? 'Continue' : 'Begin'}</button>`}</div>`;
}
function startSteps() {
  const d = S.drill; const steps = d.id === 'pregame' ? C.PREGAME : C.VOCAL_STEPS;
  d.running = true; Sheet.render(true);
  let left = steps[d.i].s;
  if (d.id === 'pregame' && d.i === 0) runBreath(null, 4);
  const iv = setInterval(() => {
    left--; const el = $('#stepT'); if (el) el.textContent = fmtSec(left);
    if (left <= 0) { clearInterval(iv); nextStep(); }
  }, 1000);
  addCleanup(() => clearInterval(iv));
}
function nextStep() {
  const d = S.drill; const steps = d.id === 'pregame' ? C.PREGAME : C.VOCAL_STEPS;
  runCleanups();
  if (d.i < steps.length - 1) { d.i++; d.running = false; Sheet.render(true); startSteps(); }
  else { d.done = true; d.running = false; logDrill(d.id, d.id === 'pregame' ? 3 : 3); Sheet.render(true); }
}
function drillEnunciation(d) {
  const set = C.ENUNCIATION[d.set], line = set.lines[d.i];
  return `<div class="seg" role="group">${C.ENUNCIATION.map((s, i) => `<button data-act="enun-set" data-v="${i}" aria-pressed="${d.set === i}">${esc(s.set)}</button>`).join('')}</div>
    <div class="note">${icon('info')}<span>Say each line three times: slow and exaggerated, then natural, then quick and clean. Finish every final consonant.</span></div>
    <div class="card" style="min-height:140px;display:grid;place-items:center;text-align:center"><div class="big-line">${esc(line)}</div></div>
    <div class="row between"><span class="small muted mono">${d.i + 1} / ${set.lines.length}</span><div class="row"><button class="btn secondary sm" data-act="line-prev" ${d.i ? '' : 'disabled'}>Back</button><button class="btn sm" data-act="line-next" data-n="${set.lines.length}">${d.i < set.lines.length - 1 ? 'Next line' : 'Next set'}</button></div></div>
    ${finishBtn(d)}`;
}
function drillLines(d) {
  const lines = d.id === 'pause-ladder' ? C.PAUSE_LADDER : C.INFLECTION;
  const line = lines[d.i % lines.length];
  const html = d.id === 'pause-ladder' ? esc(line).split(' / ').join(' <span style="color:var(--brass);font-family:var(--font-mono);font-size:.8em">‖</span> ') : esc(line);
  const tip = d.id === 'pause-ladder' ? 'Pause a full beat at every ‖. Let the silence sit. It feels long to you and confident to them.' : 'Say it twice: first rising at the end, like a question. Then falling, like a decision. Keep the falling version and hold eye contact for a beat after.';
  return `<div class="note">${icon('info')}<span>${tip}</span></div>
    <div class="card" style="min-height:150px;display:grid;place-items:center;text-align:center"><div class="big-line">${html}${d.id === 'inflection' ? '<div style="margin-top:8px;color:var(--brass);font-family:var(--font-mono);font-size:15px">↘ land it down</div>' : ''}</div></div>
    <div class="row between"><span class="small muted mono">${(d.i % lines.length) + 1} / ${lines.length}</span><div class="row"><button class="btn secondary sm" data-act="line-prev" ${d.i ? '' : 'disabled'}>Back</button><button class="btn sm" data-act="line-next" data-n="${lines.length}">Next</button></div></div>
    ${finishBtn(d)}`;
}
function drillSwaps(d) {
  const [weak, strong] = C.WORD_SWAPS[d.i % C.WORD_SWAPS.length];
  return `<div class="note">${icon('info')}<span>Read the weak version, say the strong version out loud before you reveal it, then compare.</span></div>
    <div class="card stack" style="min-height:180px"><span class="eyebrow">Instead of</span><div class="flash cmp"><span class="from">${esc(weak)}</span></div>
    ${d.revealed ? `<span class="eyebrow">Say</span><div class="flash" style="color:var(--good)">${esc(strong)}</div>` : `<button class="btn secondary" data-act="swap-reveal">Reveal</button>`}</div>
    <div class="row between"><span class="small muted mono">${(d.i % C.WORD_SWAPS.length) + 1} / ${C.WORD_SWAPS.length}</span><button class="btn sm" data-act="swap-next">Next card</button></div>
    ${finishBtn(d)}`;
}
function drillPace(d) {
  const ps = C.PACE_PASSAGES[d.passage];
  const words = ps.text.split(/\s+/);
  return `<div class="seg" role="group">${C.PACE_PASSAGES.map((p, i) => `<button data-act="pace-pass" data-v="${i}" aria-pressed="${d.passage === i}">${esc(p.title)}</button>`).join('')}</div>
    <div class="row"><span class="small muted">Target</span><div class="seg" role="group">${[130, 140, 150, 160].map((v) => `<button data-act="pace-wpm" data-v="${v}" aria-pressed="${d.wpm === v}">${v}</button>`).join('')}</div><span class="small muted">wpm</span></div>
    <div class="note">${icon('info')}<span>Read aloud with the highlight. It pauses at commas and full stops, the way a confident speaker would.</span></div>
    <div class="card"><p class="reader" id="reader">${words.map((w) => `<span>${esc(w)}</span>`).join(' ')}</p></div>
    ${d.running ? `<button class="btn secondary block" data-act="pace-stop">Stop</button>` : `<button class="btn block" data-act="pace-go">${icon('play')}Start reading</button>`}
    ${finishBtn(d)}`;
}
function runPace() {
  const d = S.drill; d.running = true; Sheet.render(true);
  const spans = $$('#reader span'); const base = 60000 / d.wpm;
  let i = 0, tm = null;
  const step = () => {
    if (!S.drill || !S.drill.running) return;
    if (i > 0) { spans[i - 1].classList.remove('cur'); spans[i - 1].classList.add('done'); }
    if (i >= spans.length) { d.running = false; d.done = true; logDrill('pace', 3); Sheet.render(true); return; }
    spans[i].classList.add('cur');
    const w = spans[i].textContent;
    const extra = /[.!?]$/.test(w) ? 650 : /[,;:]$/.test(w) ? 280 : 0;
    i++;
    tm = setTimeout(step, base + extra);
  };
  step();
  addCleanup(() => clearTimeout(tm));
}
function drillConcision(d) {
  const ex = C.CONCISION_GYM[d.i % C.CONCISION_GYM.length];
  const n = A.wordList(ex.long).length;
  return `<div class="card stack"><div class="row between"><span class="eyebrow">The wordy version</span><span class="pill bad">${n} words</span></div><p class="muted" style="font-size:15.5px;line-height:1.6">${esc(ex.long)}</p></div>
    <div class="note">${icon('scissors')}<span>Say it in <b>${ex.budget} words or fewer</b>: answer first, no hedges, nothing lost that matters.</span></div>
    <textarea class="input" id="conBox" placeholder="Dictate or type your version">${esc(d.text || '')}</textarea>
    <div class="row between"><span class="pill" id="conCount">0 / ${ex.budget}</span><div class="row"><button class="btn secondary sm" data-act="con-next">Another</button><button class="btn sm" data-act="con-check">Check it</button></div></div>
    <div id="conOut">${d.out || ''}</div>`;
}
function mountConcision() {
  const box = $('#conBox'), ex = C.CONCISION_GYM[S.drill.i % C.CONCISION_GYM.length];
  const upd = () => { const n = A.wordList(box.value).length; const el = $('#conCount'); el.textContent = `${n} / ${ex.budget}`; el.className = 'pill ' + (n === 0 ? '' : n <= ex.budget ? 'good' : 'bad'); S.drill.text = box.value; };
  box.addEventListener('input', upd); upd();
}
async function concisionCheck() {
  const d = S.drill, ex = C.CONCISION_GYM[d.i % C.CONCISION_GYM.length];
  const txt = ($('#conBox').value || '').trim();
  if (!txt) { toast('Write or dictate your version first.'); return; }
  const ta = A.analyzeText(txt, { source: 'typed' });
  const n = ta.words, ok = n <= ex.budget;
  const sc = A.score(ta, null, {});
  const concision = Math.round(A.clamp(100 - Math.max(0, n - ex.budget) * 3 - ta.hedges.total * 6 - ta.fillers.total * 6, 20, 100));
  const scores = { v: 2, clarity: sc.clarity, concision, assertive: sc.assertive, framing: sc.framing };
  const v = ['clarity', 'concision', 'assertive', 'framing'].map((k) => scores[k]).filter((x) => x != null); scores.overall = Math.round(v.reduce((a, b) => a + b, 0) / v.length);
  Store.put('sessions', { ts: Date.now(), date: dkey(), kind: 'concision', refId: String(d.i % C.CONCISION_GYM.length), title: 'Concision gym', prompt: ex.long, transcript: txt, source: 'typed', metrics: { words: n, fillers: ta.fillers.total, fillerTypes: ta.fillers.byType, hedges: ta.hedges.total, hedgesPer100: ta.hedges.per100, hedgeTypes: ta.hedges.byType, bluf: ta.bluf, numbers: ta.numbers, avgSentence: ta.avgSentence }, scores, autoScores: scores, notes: sc.notes });
  d.out = `<div class="card stack"><div class="row between"><span class="eyebrow">Result</span><span class="pill ${scoreClass(scores.overall)}">${s10(scores.overall)}</span></div>
    <div>${ok ? `${icon('check')} ${n} words: inside the budget.` : `${n} words: ${n - ex.budget} over. Cut again.`}</div>
    <div class="small muted">${ta.bluf === true ? 'Leads with the answer.' : 'Try putting the answer in the first sentence.'} ${ta.hedges.total ? `${ta.hedges.total} hedge${ta.hedges.total > 1 ? 's' : ''} left.` : 'No hedges.'}</div>
    <div class="transcript">${A.highlight(ta)}</div></div>`;
  Sheet.render(true);
}

/* ---------------- Lessons ---------------- */
SHEETS.lessons = {
  render() {
    const read = new Set(Store.profile.lessonsRead || []);
    return { title: 'Lessons', body: `<div class="stack-lg"><div class="stack"><h1 class="h1">Lessons</h1><p class="muted">Two- and three-minute reads on the craft. Each ends with a rep to try it.</p></div>
      ${C.PILLARS.map((pl) => { const ls = C.LESSONS.filter((l) => l.pillar === pl.id); if (!ls.length) return ''; return `<section class="section"><h2 class="eyebrow">${esc(pl.name)}</h2><div class="list">${ls.map((l) => `<button class="list-row" data-act="lesson" data-id="${l.id}"><span><span class="t">${esc(l.title)}</span><span class="d" style="display:block">${esc(l.key)}</span></span>${read.has(l.id) ? `<span class="pill good">Read</span>` : `<span class="pill">${l.min} min</span>`}</button>`).join('')}</div></section>`; }).join('')}</div>` };
  },
};
SHEETS.lesson = {
  render(sh) {
    const l = C.LESSONS.find((x) => x.id === sh.id);
    const pl = C.PILLARS.find((p) => p.id === l.pillar);
    const t = l.tryIt;
    const tryLabel = t.kind === 'scenario' ? `Try it: ${(C.SCENARIOS.find((s) => s.id === t.id) || {}).title}` : t.kind === 'drill' ? `Try it: ${(C.WARMUPS.find((w) => w.id === t.id) || {}).name}` : t.kind === 'spar' ? 'Try it in a spar' : 'Try it';
    return { title: l.title, back: !!sh.fromList, body: `<article class="stack-lg prose" style="max-width:none">
      <div class="stack" style="gap:6px"><span class="eyebrow">${esc(pl.name)} · ${l.min} min read</span><h1 class="h1">${esc(l.title)}</h1></div>
      <div class="prompt-box" style="font-size:19px">${esc(l.key)}</div>
      <div class="prose" style="font-size:16px;line-height:1.65">${l.body.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
      <button class="btn block" data-act="try" data-kind="${t.kind}" data-id="${t.id}">${icon('play')}${esc(tryLabel)}</button></article>` };
  },
  mount(sh) {
    const read = Store.profile.lessonsRead || [];
    if (!read.includes(sh.id)) Store.saveProfile({ lessonsRead: read.concat(sh.id) });
  },
};

/* ---------------- Meeting prep ---------------- */
const PREP_AUDIENCES = ['Investment committee', 'Board of directors', 'CEO / executive team', 'CFO / finance', 'Physician leaders', 'LPs / investors', 'Hiring panel', 'Founders / partners', 'My team'];
SHEETS.prep = {
  render(sh) {
    const pr = sh.id ? Store.preps.find((x) => x.id === sh.id) : null;
    if (pr && !sh.edit) return { title: pr.title, body: prepView(pr) };
    const f = pr || sh.draft || {};
    return { title: 'Meeting prep', body: `<div class="stack-lg">
      <div class="stack"><h1 class="h1">Meeting prep</h1><p class="muted">Walk in with a headline, an opener you've said out loud, and answers to the questions you're dreading.</p></div>
      <label class="field">Meeting<input class="input" id="pr-title" value="${esc(f.title || '')}" placeholder="e.g. IC: Series B in transplant diagnostics"></label>
      <label class="field">Audience<select class="input" id="pr-aud">${PREP_AUDIENCES.map((a) => `<option ${f.audience === a ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
      <label class="field">Time you'll have<select class="input" id="pr-time">${['5 minutes', '10 minutes', '15 minutes', '30 minutes', '60 minutes'].map((a) => `<option ${f.time === a ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
      <label class="field">Intended outcome: what should they decide or do?<textarea class="input" id="pr-obj" rows="2" style="min-height:70px" placeholder="e.g. Approve $15M at a $120M pre-money">${esc(f.objective || '')}</textarea></label>
      <label class="field">Key facts and numbers<textarea class="input" id="pr-facts" placeholder="Revenue, growth, coverage status, risks, comparables…">${esc(f.facts || '')}</textarea></label>
      <label class="field">What worries you?<textarea class="input" id="pr-worry" rows="2" style="min-height:70px" placeholder="e.g. They'll say the valuation is rich">${esc(f.worries || '')}</textarea></label>
      ${S.tool && S.tool.err ? `<div class="note warn">${icon('info')}<span>${esc(S.tool.err)}</span></div>` : ''}
      ${S.tool && S.tool.busy ? `<div class="thinking"><span class="dotpulse"><i></i><i></i><i></i></span>Building your prep…</div>` : `<button class="btn block" data-act="prep-go" data-id="${pr ? pr.id : ''}">${icon('spark')}${AI.ready ? 'Build my prep' : 'Save as a template'}</button>`}
    </div>` };
  },
};
function prepView(pr) {
  const r = pr.result || {};
  return `<div class="stack-lg">
    <div class="stack" style="gap:4px"><span class="eyebrow">${esc(pr.audience)} · ${esc(pr.time || '')}</span><h1 class="h2">${esc(pr.title)}</h1></div>
    ${r.key_message ? `<div class="prompt-box"><span class="eyebrow">Central message</span>${esc(r.key_message)}</div>` : ''}
    ${r.summary2 ? `<div class="card stack"><span class="eyebrow">Two-sentence executive summary</span><div class="better" style="font-size:16px">${esc(r.summary2)}</div></div>` : ''}
    ${r.opening ? `<div class="card stack"><span class="eyebrow">Open with</span><div class="better" style="font-size:16px">${esc(r.opening)}</div><div><button class="btn sm" data-act="prep-open" data-id="${pr.id}">${icon('mic')}Rehearse the opening</button></div></div>` : ''}
    ${r.points && r.points.length ? `<div class="card stack"><span class="eyebrow">Three supporting points</span>${r.points.map((p, i) => `<div class="fix" ${i ? '' : 'style="border-top:0;padding-top:0"'}><span class="issue">${esc(p.point)}</span><span class="small muted">${esc(p.proof)}</span></div>`).join('')}${r.implication ? `<span class="eyebrow">Implication</span><div>${esc(r.implication)}</div>` : ''}</div>` : ''}
    ${r.questions && r.questions.length ? `<div class="section"><h2 class="h3">Tough questions</h2>${r.questions.map((q, i) => `<details class="fold"><summary><span>${esc(q.q)}</span>${icon('chev')}</summary><div class="fold-body stack"><div class="better">${esc(q.a)}</div><div><button class="btn secondary sm" data-act="prep-q" data-id="${pr.id}" data-i="${i}">${icon('mic')}Practice answering</button></div></div></details>`).join('')}</div>` : ''}
    ${r.ask ? `<div class="card stack"><span class="eyebrow">The decision required</span><div>${esc(r.ask)}</div>${r.close ? `<span class="eyebrow">Close</span><div>${esc(r.close)}</div>` : ''}</div>` : ''}
    ${r.watch_outs && r.watch_outs.length ? `<div class="note warn">${icon('target')}<span>${r.watch_outs.map(esc).join('<br>')}</span></div>` : ''}
    ${!pr.result ? `<div class="note">${icon('info')}<span>Saved as a template. Rehearse your objective as an opening, and use the Spar tab to drill likely questions.</span></div><button class="btn" data-act="prep-open" data-id="${pr.id}">${icon('mic')}Rehearse your opening</button>` : ''}
    <div class="actions"><button class="btn deep" data-act="prep-spar" data-id="${pr.id}">${icon('spar')}Spar on this meeting</button><button class="btn secondary" data-act="prep-edit" data-id="${pr.id}">Edit</button></div>
    <div class="actions"><button class="btn secondary" data-act="open" data-sheet="pregame">${icon('target')}Pre-game routine</button><span id="delZone" style="display:contents"><button class="btn danger" data-act="prep-del1" data-id="${pr.id}">${icon('trash')}Delete</button></span></div>
  </div>`;
}
async function prepGo(id) {
  const f = { title: $('#pr-title').value.trim(), audience: $('#pr-aud').value, time: $('#pr-time').value, objective: $('#pr-obj').value.trim(), facts: $('#pr-facts').value.trim(), worries: $('#pr-worry').value.trim() };
  if (!f.title || !f.objective) { toast('Add the meeting and what you want them to decide.'); return; }
  const prev = id ? Store.preps.find((x) => x.id === id) : null;
  const item = Object.assign(prev || {}, f, { ts: (prev && prev.ts) || Date.now(), date: (prev && prev.date) || dkey() });
  S.tool = { busy: AI.ready, err: '' };
  S.sheet.draft = f;
  if (!AI.ready) { const saved = Store.put('preps', item); S.tool = null; Sheet.open('prep', { id: saved.id }); return; }
  Sheet.render(true);
  try {
    const res = await AI.json(AI.prepPrompt(Store.profile, f), { modelTier: 'default' });
    const arr = (a) => (Array.isArray(a) ? a : []);
    item.result = { key_message: String(res.key_message || ''), summary2: String(res.summary2 || ''), implication: String(res.implication || ''), opening: String(res.opening || ''), points: arr(res.points).slice(0, 3).map((p) => ({ point: String(p.point || ''), proof: String(p.proof || '') })), questions: arr(res.questions).slice(0, 5).map((q) => ({ q: String(q.q || ''), a: String(q.a || '') })), ask: String(res.ask || ''), close: String(res.close || ''), watch_outs: arr(res.watch_outs).slice(0, 3).map(String) };
    const saved = Store.put('preps', item);
    S.tool = null;
    if (S.sheet && S.sheet.type === 'prep') Sheet.open('prep', { id: saved.id });
  } catch (e) {
    S.tool = { busy: false, err: AI.errorText(e) };
    if (S.sheet && S.sheet.type === 'prep') Sheet.render(true);
  }
}
function personaForAudience(a) {
  a = String(a || '').toLowerCase();
  if (/invest/.test(a)) return 'ic-chair';
  if (/board/.test(a)) return 'board-member';
  if (/cfo|finance/.test(a)) return 'cfo';
  if (/lp|investor/.test(a)) return 'lp';
  if (/hiring|interview/.test(a)) return 'hiring-partner';
  if (/ceo|exec/.test(a)) return 'ceo';
  return 'ceo';
}

/* ---------------- Sharpen ---------------- */
SHEETS.sharpen = {
  render() {
    const t = S.tool || {};
    const res = t.res;
    return { title: 'Sharpen my words', body: `<div class="stack-lg">
      <div class="stack"><h1 class="h1">Sharpen</h1><p class="muted">Paste an email, talking points or an answer. Get the executive version: answer first, no hedges, nothing invented.</p></div>
      <textarea class="input tall" id="shIn" placeholder="Paste or dictate the text">${esc(t.text || '')}</textarea>
      <label class="field">For<select class="input" id="shAud">${PREP_AUDIENCES.map((a) => `<option ${t.aud === a ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
      <div class="seg full" role="group"><button data-act="sh-mode" data-v="spoken" aria-pressed="${(t.mode || 'spoken') === 'spoken'}">To say out loud</button><button data-act="sh-mode" data-v="written" aria-pressed="${t.mode === 'written'}">To write</button></div>
      ${t.busy ? `<div class="thinking"><span class="dotpulse"><i></i><i></i><i></i></span>Sharpening…</div>` : `<button class="btn block" data-act="sh-go">${icon('scissors')}${AI.ready ? 'Sharpen it' : 'Check it'}</button>`}
      ${t.err ? `<div class="note warn">${icon('info')}<span>${esc(t.err)}</span></div>` : ''}
      ${t.ta ? `<div class="card stack"><div class="row between"><span class="eyebrow">Your version</span><span class="pill">${t.ta.words} words</span></div><div class="transcript">${A.highlight(t.ta)}</div><div class="small muted">${t.ta.hedges.total} hedges · ${t.ta.fillers.total} fillers · ${t.ta.bluf === true ? 'answer first' : 'answer not first'}</div></div>` : ''}
      ${res ? `<div class="card coach stack"><div class="row between"><span class="eyebrow">Sharpened</span><span class="pill good">${A.wordList(res.sharpened).length} words</span></div><div class="better" id="shOut" style="font-size:16px;line-height:1.6;white-space:pre-wrap">${esc(res.sharpened)}</div>
        ${res.summary2 ? `<span class="eyebrow">Two-sentence version</span><div class="better">${esc(res.summary2)}</div>` : ''}
        ${res.changes && res.changes.length ? `<div class="stack">${res.changes.map((c) => `<div class="crit yes">${icon('yes')}<span>${esc(c)}</span></div>`).join('')}</div>` : ''}
        <div class="actions"><button class="btn secondary" data-act="sh-copy">${icon('copy')}Copy</button><button class="btn" data-act="sh-rehearse">${icon('mic')}Rehearse it</button></div></div>` : ''}
    </div>` };
  },
};
async function sharpenGo() {
  const text = $('#shIn').value.trim();
  if (!text) { toast('Paste some text first.'); return; }
  const t = S.tool = Object.assign(S.tool || {}, { text, aud: $('#shAud').value, mode: (S.tool && S.tool.mode) || 'spoken', err: '', res: null });
  t.ta = A.analyzeText(text, { source: 'typed' });
  if (!AI.ready) { Sheet.render(true); return; }
  t.busy = true; Sheet.render(true);
  try {
    const res = await AI.json(AI.sharpenPrompt(Store.profile, text, t.aud, t.mode), { modelTier: 'default' });
    t.res = { sharpened: String(res.sharpened || ''), summary2: String(res.summary2 || ''), changes: (Array.isArray(res.changes) ? res.changes : []).slice(0, 3).map(String) };
  } catch (e) { t.err = AI.errorText(e); }
  t.busy = false;
  if (S.sheet && S.sheet.type === 'sharpen') Sheet.render(true);
}

/* ---------------- Visual check ---------------- */
SHEETS.visual = {
  render() {
    const t = S.tool || (S.tool = { ctx: 'Video call', frames: [] });
    return { title: 'Visual presence check', body: `<div class="stack-lg">
      <div class="stack"><h1 class="h1">Visual check</h1><p class="muted">How do you come across before you say a word? Upload a photo of your setup, a headshot, or a short video of you presenting.</p></div>
      <div class="seg full" role="group">${['Video call', 'Presenting in person', 'Headshot'].map((c) => `<button data-act="vis-ctx" data-v="${c}" aria-pressed="${t.ctx === c}">${c}</button>`).join('')}</div>
      <label class="dropzone" for="visFile">${icon('camera')}<span class="h3">${t.frames.length ? 'Choose a different file' : 'Choose a photo or video'}</span><span class="small muted">Images and frames stay in this conversation with Claude and aren't saved.</span><input type="file" id="visFile" accept="image/*,video/*" class="sr" data-act-change="vis-file"></label>
      ${t.loading ? `<div class="thinking"><span class="dotpulse"><i></i><i></i><i></i></span>Reading the file…</div>` : ''}
      ${t.frames.length ? `<div class="grid3">${t.frames.map((f) => `<img src="${f.url}" alt="Frame for review" style="border-radius:10px;aspect-ratio:3/4;object-fit:cover;width:100%;max-width:100%">`).join('')}</div>` : ''}
      ${t.err ? `<div class="note warn">${icon('info')}<span>${esc(t.err)}</span></div>` : ''}
      ${!AI.ready || !AI.imagesOk ? visualChecklist() : t.busy ? `<div class="thinking"><span class="dotpulse"><i></i><i></i><i></i></span>Reviewing how you come across…</div>` : `<button class="btn block" data-act="vis-go" ${t.frames.length ? '' : 'disabled'}>${icon('eye')}Review my presence</button>`}
      ${t.res ? visualResultBody(t.res) : ''}
    </div>` };
  },
};
function visualChecklist() {
  const items = ['Camera lens at eye level, about an arm\'s length away', 'Main light in front of you, not behind', 'Framed from mid-chest up, a little space above your head', 'Clean, quiet background; nothing distracting at head height', 'Sit forward, shoulders down, hands visible and still', 'Look at the lens when you make your key point'];
  return `<div class="card stack"><span class="eyebrow">Self-check</span>${AI.ready ? '' : '<p class="small muted">The photo review needs Claude, which isn\'t available here. Use this checklist instead.</p>'}${items.map((x) => `<label class="check"><input type="checkbox">${esc(x)}</label>`).join('')}</div>`;
}
function visualResultBody(res, sess) {
  if (!res) return '';
  const dims = [['posture', 'Posture'], ['eye_line', 'Eye line'], ['framing', 'Framing'], ['lighting', 'Lighting'], ['expression', 'Expression'], ['polish', 'Polish']];
  const sc = {}; dims.forEach(([k]) => { if (res.scores && res.scores[k] != null) sc[k] = res.scores[k] * 10; });
  return `<div class="card coach stack-lg">
    ${sess ? `<span class="eyebrow">${esc(sess.context || '')} · ${esc(fmtDate(sess.ts))}</span>` : ''}
    <div class="coach-head"><span class="badge">${icon('eye')}</span><span class="eyebrow">Visual read</span></div>
    ${res.headline ? `<p class="headline">${esc(res.headline)}</p>` : ''}
    ${bars(sc, dims.map(([id, name]) => ({ id, name })))}
    ${res.keep && res.keep.length ? `<div class="stack"><span class="eyebrow">Keep</span>${res.keep.map((x) => `<div class="better">${esc(x)}</div>`).join('')}</div>` : ''}
    ${res.fixes && res.fixes.length ? `<div class="stack"><span class="eyebrow">Change</span>${res.fixes.map((f) => `<div class="fix"><span class="issue">${esc(f.issue)}</span><div class="better">${esc(f.try)}</div></div>`).join('')}</div>` : ''}
  </div>`;
}
async function visFile(input) {
  const f = input.files && input.files[0]; if (!f) return;
  const t = S.tool; t.err = ''; t.res = null; t.frames = []; t.loading = true; Sheet.render(true);
  try {
    if (/^video\//.test(f.type)) t.frames = (await A.videoFrames(f, 3)).frames;
    else t.frames = [await A.shrinkImage(f)];
  } catch (e) { t.err = e.message || 'That file couldn\'t be read.'; }
  t.loading = false;
  if (S.sheet && S.sheet.type === 'visual') Sheet.render(true);
}
async function visGo() {
  const t = S.tool; if (!t.frames.length) return;
  t.busy = true; t.err = ''; Sheet.render(true);
  try {
    const res = await AI.json(AI.visualPrompt(Store.profile, t.ctx, t.frames.length), { images: t.frames.map((f) => f.blob), modelTier: 'default' });
    const num = (v) => A.clamp(Math.round(Number(v) || 0), 0, 10);
    const s = res.scores || {};
    t.res = { headline: String(res.headline || ''), scores: { posture: num(s.posture), eye_line: num(s.eye_line), framing: num(s.framing), lighting: num(s.lighting), expression: num(s.expression), polish: num(s.polish) }, keep: (res.keep || []).slice(0, 2).map(String), fixes: (res.fixes || []).slice(0, 4).map((f) => ({ issue: String(f.issue || ''), try: String(f.try || '') })) };
    Store.put('sessions', { ts: Date.now(), date: dkey(), kind: 'visual', refId: t.ctx, title: `Visual check: ${t.ctx}`, context: t.ctx, coach: t.res });
  } catch (e) { t.err = AI.errorText(e); }
  t.busy = false;
  if (S.sheet && S.sheet.type === 'visual') Sheet.render(true);
}

/* ---------------- Meeting review (After) ---------------- */
SHEETS.meeting = {
  render(sh) {
    const l = sh.id ? Store.logs.find((x) => x.id === sh.id) : null;
    if (l) return { title: l.title, body: meetingView(l) };
    const t = S.tool || (S.tool = { type: 'internal', sc: Object.fromEntries(C.SCORECARD.map((c) => [c.id, 7])) });
    return { title: 'Meeting review', body: `<div class="stack-lg">
      <div class="stack"><h1 class="h1">Meeting review</h1><p class="muted">Your "After" routine: review the transcript, score your presence on the 9-category scorecard, compare with previous meetings and set one adjustment.</p></div>
      <label class="field">Meeting type<select class="input" id="mt-type">${C.MEETING_TYPES.map((m) => `<option value="${m.id}" ${t.type === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label>
      <label class="field">Meeting<input class="input" id="mt-title" value="${esc(t.title || '')}" placeholder="e.g. IC: Series B transplant diagnostics"></label>
      <label class="field">What did you want from it?<input class="input" id="mt-goal" value="${esc(t.goal || '')}" placeholder="e.g. Approval for diligence budget"></label>
      <label class="field">Transcript or notes<textarea class="input tall" id="mt-text" placeholder="Paste the meeting transcript (Zoom, Teams, Otter) or your notes on what you said.">${esc(t.text || '')}</textarea></label>
      <label class="btn secondary" style="cursor:pointer">${icon('file')}Or choose a transcript file (.txt, .vtt, .srt, .md)<input type="file" accept=".txt,.vtt,.srt,.md,text/plain,text/vtt" class="sr" data-act-change="mt-file"></label>
      ${t.err ? `<div class="note warn">${icon('info')}<span>${esc(t.err)}</span></div>` : ''}
      ${AI.ready ? (t.busy ? `<div class="thinking"><span class="dotpulse"><i></i><i></i><i></i></span>Scoring the meeting against your scorecard. Long transcripts take a minute.</div>` : `<button class="btn block" data-act="mt-go">${icon('spark')}Score it with the coach</button>`) : ''}
      <details class="fold" ${AI.ready ? '' : 'open'}><summary>Score it myself${icon('chev')}</summary><div class="fold-body stack">
        ${C.SCORECARD.map((c) => `<div class="range-row"><span><span style="font-weight:600">${esc(c.name)}</span><span class="small muted" style="display:block">${esc(c.q)}</span></span><span class="row nowrap"><input type="range" min="1" max="10" step="1" value="${t.sc[c.id]}" data-sc="${c.id}" aria-label="${esc(c.name)}"><b class="mono" id="scv-${c.id}">${t.sc[c.id]}</b></span></div>`).join('')}
        <label class="field">One behavioral adjustment for next time<input class="input" id="mt-adj" placeholder="e.g. Open with the recommendation, not the history"></label>
        <button class="btn secondary block" data-act="mt-self">${icon('check')}Save my scores</button>
      </div></details>
    </div>` };
  },
};
function prevMeeting(type, beforeTs) { return Store.logs.filter((l) => l.kind === 'meeting' && l.type === type && l.ts < beforeTs && l.scores).sort((a, b) => b.ts - a.ts)[0] || null; }
function meetingForm() { return { type: $('#mt-type').value, title: ($('#mt-title').value || '').trim(), goal: ($('#mt-goal').value || '').trim(), text: ($('#mt-text').value || '').trim() }; }
async function meetingGo() {
  const f = meetingForm();
  const t = Object.assign(S.tool, f, { err: '' });
  if (!f.title) { toast('Name the meeting first.'); return; }
  if (A.wordList(f.text).length < 40) { t.err = 'Paste more of the transcript or your notes: at least a paragraph of what you said.'; Sheet.render(true); return; }
  t.busy = true; Sheet.render(true);
  try {
    const prev = prevMeeting(f.type, Date.now());
    const res = await AI.json(AI.meetingPrompt(Store.profile, { type: f.type, title: f.title, goal: f.goal, transcript: f.text }, prev ? { overall: prev.scores.overall, adjustment: prev.adjustment } : null), { modelTier: 'default' });
    const n10 = (v) => (v == null || isNaN(Number(v)) ? null : A.clamp(Math.round(Number(v) * 10), 0, 100));
    const arr = (a) => (Array.isArray(a) ? a : []);
    const scorecard = {}; for (const c of C.SCORECARD) scorecard[c.id] = n10((res.scorecard || {})[c.id]);
    const dims = {}; for (const d of C.DIMENSIONS) dims[d.id] = n10((res.dims || {})[d.id]);
    const sv = Object.values(scorecard).filter((x) => x != null);
    const overall = n10(res.overall) != null ? n10(res.overall) : sv.length ? Math.round(sv.reduce((a, b) => a + b, 0) / sv.length) : null;
    const item = Store.put('logs', {
      kind: 'meeting', type: f.type, title: f.title, goal: f.goal, transcript: f.text.slice(0, 30000), date: dkey(), ts: Date.now(),
      scores: { overall, scorecard, dims }, stage: [1, 2, 3].includes(Number(res.stage)) ? Number(res.stage) : null,
      assessment: String(res.assessment || ''), worked: arr(res.worked).slice(0, 3).map(String), didnt: arr(res.didnt).slice(0, 3).map(String),
      examples: arr(res.examples).slice(0, 4).map((e) => ({ quote: String(e.quote || ''), issue: String(e.issue || ''), executive: String(e.executive || '') })),
      executive_version: String(res.executive_version || ''), patterns: arr(res.patterns).slice(0, 3).map(String),
      adjustment: String(res.adjustment || ''), objective_area: /^[A-E]$/.test(res.objective_area) ? res.objective_area : null,
    });
    S.tool = null;
    if (S.sheet && S.sheet.type === 'meeting') Sheet.open('meeting', { id: item.id });
  } catch (e) { t.busy = false; t.err = AI.errorText(e); if (S.sheet && S.sheet.type === 'meeting') Sheet.render(true); }
}
function meetingSelf() {
  const f = meetingForm();
  if (!f.title) { toast('Name the meeting first.'); return; }
  const sc = {}; $$('[data-sc]').forEach((el) => { sc[el.dataset.sc] = Number(el.value) * 10; });
  const v = Object.values(sc);
  const item = Store.put('logs', { kind: 'meeting', self: true, type: f.type, title: f.title, goal: f.goal, transcript: f.text.slice(0, 30000), date: dkey(), ts: Date.now(),
    scores: { overall: Math.round(v.reduce((a, b) => a + b, 0) / v.length), scorecard: sc, dims: {} }, adjustment: ($('#mt-adj').value || '').trim() });
  S.tool = null; Sheet.open('meeting', { id: item.id });
}
function meetingView(l) {
  const sc = l.scores || {}, pl = G.plan();
  const prev = prevMeeting(l.type, l.ts);
  const d = prev && sc.overall != null ? sc.overall - prev.scores.overall : null;
  const stage = l.stage ? C.STAGES[l.stage - 1] : null;
  const isObjective = Store.profile.nextAdjustment && Store.profile.nextAdjustment === l.adjustment;
  return `<div class="stack-lg">
    <div class="stack" style="gap:4px"><span class="eyebrow">${esc(C.mtype(l.type).name)} · ${esc(fmtDate(l.ts))}${l.self ? ' · self-scored' : ''}</span><h1 class="h2">${esc(l.title)}</h1>${l.goal ? `<p class="small muted">Wanted: ${esc(l.goal)}</p>` : ''}</div>
    <div class="card raised stack" style="align-items:center">
      <div style="width:100%;max-width:320px">${gauge(sc.overall, { label: 'Meeting score', base: pl.overall.baseline * 10, target: pl.overall.target * 10 })}</div>
      <div class="row" style="justify-content:center;gap:8px">${d != null ? `<span class="delta ${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '+' : ''}${(d / 10).toFixed(1)} vs last ${esc(C.mtype(l.type).name.toLowerCase())}</span>` : ''}${stage ? `<span class="pill brass">Stage ${stage.id}: ${esc(stage.name)}</span>` : ''}</div>
    </div>
    ${l.assessment ? `<div class="card coach stack"><div class="coach-head"><span class="badge">${icon('spark')}</span><span class="eyebrow">Overall assessment</span></div><p class="headline" style="font-size:18px">${esc(l.assessment)}</p></div>` : ''}
    <div class="card stack"><span class="eyebrow">Scorecard</span>${bars(sc.scorecard || {}, C.SCORECARD)}</div>
    ${sc.dims && Object.values(sc.dims).some((x) => x != null) ? `<div class="card stack"><span class="eyebrow">Your dimensions in this meeting</span>${bars(sc.dims, C.DIMENSIONS, { plan: true })}</div>` : ''}
    ${(l.worked || []).length || (l.didnt || []).length ? `<div class="card stack">${(l.worked || []).length ? `<span class="eyebrow">What worked</span>${l.worked.map((x) => `<div class="crit yes">${icon('yes')}<span>${esc(x)}</span></div>`).join('')}` : ''}${(l.didnt || []).length ? `<span class="eyebrow">What didn't</span>${l.didnt.map((x) => `<div class="crit no">${icon('no')}<span>${esc(x)}</span></div>`).join('')}` : ''}</div>` : ''}
    ${(l.examples || []).length ? `<div class="card stack"><span class="eyebrow">From the transcript</span>${l.examples.map((e) => `<div class="fix"><div class="quote">"${esc(e.quote)}"</div>${e.issue ? `<div class="small muted">${esc(e.issue)}</div>` : ''}${e.executive ? `<div class="better">${esc(e.executive)}</div>` : ''}</div>`).join('')}</div>` : ''}
    ${l.executive_version ? `<div class="card stack"><span class="eyebrow">What an executive version sounds like</span><div class="better" style="font-size:15.5px;line-height:1.6">${esc(l.executive_version)}</div><div><button class="btn secondary sm" data-act="mt-rehearse" data-id="${l.id}">${icon('mic')}Rehearse it out loud</button></div></div>` : ''}
    ${(l.patterns || []).length ? `<div class="card stack"><span class="eyebrow">Patterns</span>${l.patterns.map((x) => `<div class="crit partly">${icon('target')}<span>${esc(x)}</span></div>`).join('')}</div>` : ''}
    ${l.adjustment ? `<div class="prompt-box"><span class="eyebrow">One adjustment for the next meeting</span>${esc(l.adjustment)}</div>
      ${isObjective ? `<p class="small" style="color:var(--good);font-weight:600">${icon('check', 'inline-ic')} Pinned to your Today screen.</p>` : `<button class="btn" data-act="mt-pin" data-id="${l.id}">${icon('target')}Pin to Today${l.objective_area ? ` and set objective ${l.objective_area}` : ''}</button>`}` : ''}
    <p class="small muted xp-line"><span class="xp-pop">+${G.xpOf(l)} XP</span></p>
    <div class="actions"><span id="delZone" style="display:contents"><button class="btn danger" data-act="mt-del1" data-id="${l.id}">${icon('trash')}Delete</button></span></div>
  </div>`;
}

/* ---------------- Weekly review ---------------- */
function weekSummaryText() {
  const now = Date.now(), wk = 7 * 86400000;
  const block = (from, to) => {
    const ss = Store.sessions.filter((s) => s.ts >= from && s.ts < to);
    const reps = ss.filter((s) => REP_KINDS.includes(s.kind));
    const sc = reps.map((s) => G.scores(s).overall).filter((x) => x != null);
    const dims = {}; for (const d of C.DIMENSIONS) { const v = reps.map((s) => G.scores(s)[d.id]).filter((x) => x != null); if (v.length) dims[d.id] = Math.round(v.reduce((a, b) => a + b, 0) / v.length); }
    const h = {}; for (const s of reps) for (const x of ((s.metrics || {}).hedgeTypes || [])) h[x.label] = (h[x.label] || 0) + x.n;
    const areas = {}; for (const s of reps) for (const n of (s.notes || [])) if (n.area) areas[n.area] = (areas[n.area] || 0) + 1;
    const hsiaFull = reps.filter((s) => s.hsia && s.hsia.headline && s.hsia.structure && s.hsia.implication && s.hsia.action).length;
    const fixes = reps.flatMap((s) => ((s.coach || {}).fixes || []).map((x) => `${x.area || ''} ${x.issue}`)).filter(Boolean);
    const meetings = Store.logs.filter((l) => l.kind === 'meeting' && l.ts >= from && l.ts < to).map((l) => ({ type: l.type, overall: l.scores && l.scores.overall, adjustment: l.adjustment }));
    return { reps: reps.length, spars: ss.filter((s) => s.kind === 'spar').length, games: ss.filter((s) => s.kind === 'game' || s.kind === 'hsia').length, quests: ss.filter((s) => s.kind === 'quest').length, days: new Set(ss.map((s) => s.date)).size, avg: sc.length ? Math.round(sc.reduce((a, b) => a + b, 0) / sc.length) : null, dims, hedges: h, areaFlags: areas, fullHouseReps: hsiaFull, fixes: fixes.slice(0, 12), meetings };
  };
  const a = block(now - wk, now + 1), b = block(now - 2 * wk, now - wk);
  return { a, b, text: `Current objective: ${Store.profile.objective}\nLAST 7 DAYS: ${JSON.stringify(a)}\nPREVIOUS 7 DAYS: ${JSON.stringify(b)}` };
}
SHEETS.review = {
  render(sh) {
    const rv = sh.id ? Store.reviews.find((x) => x.id === sh.id) : null;
    const t = S.tool || {};
    if (!rv) {
      return { title: 'Weekly review', body: `<div class="stack-lg"><div class="stack"><h1 class="h1">Weekly review</h1><p class="muted">Your last 7 days against the week before: reps, scores by dimension, framework hits, hedges, meeting reviews. Ends with one objective.</p></div>
        ${t.busy ? `<div class="thinking"><span class="dotpulse"><i></i><i></i><i></i></span>Reading your week…</div>` : `<button class="btn block" data-act="review-go">${icon('calendar')}Review my week · 15 XP</button>`}
        ${t.err ? `<div class="note warn">${icon('info')}<span>${esc(t.err)}</span></div>` : ''}</div>` };
    }
    const ar = rv.focus && C.area(rv.focus.area);
    return { title: 'Weekly review', body: `<div class="stack-lg">
      <div class="stack" style="gap:4px"><span class="eyebrow">Week ending ${esc(fmtDate(rv.ts))}</span><h1 class="h2">${esc(rv.headline || '')}</h1></div>
      <div class="kpis"><div class="kpi"><div class="k">Reps</div><div class="v">${rv.stats.a.reps}</div><div class="s">${rv.stats.b.reps} week before</div></div><div class="kpi"><div class="k">Avg score</div><div class="v">${s10(rv.stats.a.avg)}</div><div class="s">${s10(rv.stats.b.avg)} before</div></div><div class="kpi"><div class="k">Days</div><div class="v">${rv.stats.a.days}</div><div class="s">of 7</div></div></div>
      ${rv.wins && rv.wins.length ? `<div class="card stack"><span class="eyebrow">Wins</span>${rv.wins.map((x) => `<div class="crit yes">${icon('yes')}<span>${esc(x)}</span></div>`).join('')}</div>` : ''}
      ${rv.patterns && rv.patterns.length ? `<div class="card stack"><span class="eyebrow">Patterns</span>${rv.patterns.map((x) => `<div class="crit partly">${icon('target')}<span>${esc(x)}</span></div>`).join('')}</div>` : ''}
      ${ar ? `<div class="prompt-box"><span class="eyebrow">Next week's objective: ${ar.id}. ${esc(ar.title)}</span>${esc(rv.focus.why || '')}</div>${rv.focus.drill ? `<div class="note">${icon('clock')}<span><b>Daily drill:</b> ${esc(rv.focus.drill)}</span></div>` : ''}${Store.profile.objective !== ar.id ? `<button class="btn" data-act="set-objective" data-id="${ar.id}">Make ${ar.id} this week's objective</button>` : `<p class="small" style="color:var(--good);font-weight:600">${icon('check', 'inline-ic')} Set as this week's objective.</p>`}` : ''}
      ${rv.challenge ? `<div class="note warn">${icon('bolt')}<span><b>Real-world challenge:</b> ${esc(rv.challenge)}</span></div>` : ''}
      ${rv.stage_note ? `<p class="muted">${esc(rv.stage_note)}</p>` : ''}
    </div>` };
  },
};
async function reviewGo() {
  const sum = weekSummaryText();
  S.tool = { busy: true }; Sheet.render(true);
  const rv = { ts: Date.now(), date: dkey(), stats: { a: { reps: sum.a.reps, avg: sum.a.avg, days: sum.a.days }, b: { reps: sum.b.reps, avg: sum.b.avg } } };
  const weakestArea = () => { const f = Object.entries(sum.a.areaFlags).sort((x, y) => y[1] - x[1])[0]; return f ? f[0] : Store.profile.objective; };
  if (AI.ready) {
    try {
      const res = await AI.json(AI.reviewPrompt(Store.profile, sum.text), { modelTier: 'default' });
      Object.assign(rv, { headline: String(res.headline || ''), wins: (res.wins || []).slice(0, 3).map(String), patterns: (res.patterns || []).slice(0, 3).map(String), focus: res.focus ? { area: /^[A-E]$/.test(res.focus.area) ? res.focus.area : weakestArea(), why: String(res.focus.why || ''), drill: String(res.focus.drill || '') } : null, challenge: String(res.challenge || ''), stage_note: String(res.stage_note || '') });
    } catch (e) { S.tool = { busy: false, err: AI.errorText(e) }; if (S.sheet && S.sheet.type === 'review') Sheet.render(true); return; }
  } else {
    const ar = C.area(weakestArea());
    rv.headline = sum.a.reps ? `${sum.a.reps} reps over ${sum.a.days} days${sum.a.avg != null ? `, averaging ${s10(sum.a.avg)}` : ''}.` : 'A quiet week. Consistency beats intensity: one rep a day.';
    rv.wins = sum.a.avg != null && sum.b.avg != null && sum.a.avg > sum.b.avg ? [`Average up ${((sum.a.avg - sum.b.avg) / 10).toFixed(1)} on the week before.`] : sum.a.fullHouseReps ? [`${sum.a.fullHouseReps} full-house reps (all four framework elements).`] : [];
    rv.patterns = Object.entries(sum.a.areaFlags).sort((x, y) => y[1] - x[1]).slice(0, 2).map(([k, n]) => `${C.area(k).title}: flagged ${n} times.`);
    rv.focus = { area: ar.id, why: `Most flags this week were in ${ar.title.toLowerCase()}.`, drill: 'One 60-second scenario a day for this area, then run it back once.' };
    rv.challenge = 'Open your next meeting with "The decision we need to make is…"';
  }
  const saved = Store.put('reviews', rv);
  S.tool = null;
  if (S.sheet && S.sheet.type === 'review') Sheet.open('review', { id: saved.id });
}

/* ---------------- Plan, objective, self-rating ---------------- */
SHEETS.plan = {
  render() {
    const t = S.tool || (S.tool = {});
    if (t.res) return { title: 'Update your plan', body: planPreview(t) };
    return { title: 'Your development plan', body: `<div class="stack-lg">
      <div class="stack"><h1 class="h1">Update your plan</h1><p class="muted">Paste a new assessment, coaching notes or an updated plan. ${AI.ready ? 'The coach updates your baselines, strengths and current tendencies.' : 'Claude isn\'t available here, so edit your baseline and target numbers directly on the You tab.'}</p></div>
      <textarea class="input tall" id="plText" placeholder="Paste the text here">${esc(t.text || '')}</textarea>
      <label class="btn secondary" style="cursor:pointer">${icon('file')}Or choose a text file (.txt, .md)<input type="file" accept=".txt,.md,.markdown,text/plain,text/markdown" class="sr" data-act-change="pl-file"></label>
      ${t.err ? `<div class="note warn">${icon('info')}<span>${esc(t.err)}</span></div>` : ''}
      ${AI.ready ? (t.busy ? `<div class="thinking"><span class="dotpulse"><i></i><i></i><i></i></span>Reading it…</div>` : `<button class="btn block" data-act="pl-go">${icon('spark')}Update my plan</button>`) : `<button class="btn secondary block" data-act="go" data-to="me">Edit numbers on the You tab</button>`}
    </div>` };
  },
};
function planPreview(t) {
  const r = t.res, pl = G.plan();
  return `<div class="stack-lg">
    <div class="stack"><span class="eyebrow">What changes</span><h1 class="h2">${esc(r.summary || '')}</h1></div>
    <div class="card stack"><span class="eyebrow">Baselines</span>${C.DIMENSIONS.map((d) => { const n = r.baseline[d.id]; return `<div class="row between"><span>${esc(d.name)}</span><span class="mono">${f1(pl.baseline[d.id])}${n != null && n !== pl.baseline[d.id] ? ` → <b>${f1(n)}</b>` : ''}</span></div>`; }).join('')}
      ${r.overall != null ? `<div class="row between"><b>Overall</b><span class="mono">${f1(pl.overall.baseline)} → <b>${f1(r.overall)}</b></span></div>` : ''}</div>
    ${r.strengths.length ? `<div class="card stack"><span class="eyebrow">Strengths</span>${r.strengths.map((x) => `<div><b>${esc(x.title)}</b><ul class="ul">${x.points.map((pt) => `<li>${esc(pt)}</li>`).join('')}</ul></div>`).join('')}</div>` : ''}
    <div class="card stack"><span class="eyebrow">Current tendencies</span>${C.AREAS.filter((a) => (r.tendencies[a.id] || []).length).map((a) => `<div><b>${a.id}. ${esc(a.title)}</b><ul class="ul">${r.tendencies[a.id].map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('') || '<p class="small muted">No changes.</p>'}</div>
    <button class="btn block" data-act="pl-apply">${icon('check')}Apply to my plan</button><button class="btn ghost" data-act="pl-back">Edit the text</button></div>`;
}
async function planGo() {
  const t = S.tool; t.text = ($('#plText').value || '').trim(); t.err = '';
  if (t.text.length < 60) { t.err = 'Paste a bit more: a paragraph or two at least.'; Sheet.render(true); return; }
  t.busy = true; Sheet.render(true);
  try {
    const res = await AI.json(AI.planPrompt(Store.profile, t.text), { modelTier: 'default' });
    const num = (v) => (v == null || isNaN(Number(v)) ? null : A.clamp(Math.round(Number(v) * 2) / 2, 1, 10));
    const baseline = {}; for (const d of C.DIMENSIONS) baseline[d.id] = num((res.baseline || {})[d.id]);
    const tend = {}; for (const a of C.AREAS) tend[a.id] = (Array.isArray((res.tendencies || {})[a.id]) ? res.tendencies[a.id] : []).slice(0, 4).map(String);
    t.res = { summary: String(res.summary || ''), baseline, overall: res.overall != null ? A.clamp(Math.round(Number(res.overall) * 4) / 4, 1, 10) : null, strengths: (Array.isArray(res.strengths) ? res.strengths : []).slice(0, 5).map((x) => ({ title: String(x.title || ''), points: (Array.isArray(x.points) ? x.points : []).slice(0, 4).map(String) })), tendencies: tend, objective: /^[A-E]$/.test(res.objective_area) ? res.objective_area : null };
  } catch (e) { t.err = AI.errorText(e); }
  t.busy = false;
  if (S.sheet && S.sheet.type === 'plan') Sheet.render();
}
function planApply() {
  const r = S.tool.res, pl = G.plan();
  const cur = Object.assign({}, Store.profile.plan || {});
  cur.baseline = Object.assign({}, pl.baseline); for (const d of C.DIMENSIONS) if (r.baseline[d.id] != null) cur.baseline[d.id] = r.baseline[d.id];
  cur.target = Object.assign({}, pl.target);
  if (r.overall != null) cur.overall = Object.assign({}, pl.overall, { baseline: r.overall });
  if (r.strengths.length) cur.strengths = r.strengths;
  const tend = Object.assign({}, pl.tendencies); for (const a of C.AREAS) if (r.tendencies[a.id].length) tend[a.id] = r.tendencies[a.id];
  cur.tendencies = tend;
  cur.updatedAt = Date.now();
  Store.saveProfile(Object.assign({ plan: cur, onboarded: true }, r.objective ? { objective: r.objective } : {}));
  toast('Plan updated'); Sheet.close();
}
SHEETS.objective = {
  render() {
    const cur = Store.profile.objective, pl = G.plan();
    return { title: 'This week\'s objective', body: `<div class="stack-lg"><div class="stack"><h1 class="h1">One objective</h1><p class="muted">Your operating model: one improvement objective at a time. Missions, scenarios and the coach lean toward it.</p></div>
      ${C.AREAS.map((a) => `<button class="card stack objective-pick ${cur === a.id ? 'on' : ''}" data-act="set-objective" data-id="${a.id}" data-close="1"><div class="row nowrap" style="gap:12px"><span class="area-badge">${a.id}</span><span class="h3">${esc(a.title)}</span>${cur === a.id ? '<span class="pill good" style="margin-left:auto">Current</span>' : ''}</div>${(pl.tendencies[a.id] || []).length ? `<span class="small muted">Watch for: ${esc(pl.tendencies[a.id].join('; '))}</span>` : ''}<span class="small">${esc(a.desired.join(' · '))}</span></button>`).join('')}</div>` };
  },
};
SHEETS.assess = {
  render() {
    const pl = G.plan();
    const r = S.tool && S.tool.r ? S.tool.r : (S.tool = { r: Object.assign({}, Store.profile.ratings) }).r;
    return { title: 'Self-rating', body: `<div class="stack-lg">
      <div class="stack"><h1 class="h1">Self-rating</h1><p class="muted">How do you think you're showing up right now, 1–10? Compare it with your measured scores on Progress. Redo it monthly.</p></div>
      <div class="card">${C.DIMENSIONS.map((d) => `<div class="range-row"><span><span style="font-weight:600">${esc(d.name)}</span><span class="small muted" style="display:block">baseline ${f1(pl.baseline[d.id])} · target ${f1(pl.target[d.id])}</span></span><span class="row nowrap"><input type="range" min="1" max="10" step="0.5" value="${r[d.id] || pl.baseline[d.id]}" data-rate="${d.id}" aria-label="${esc(d.name)}"><b class="mono" id="rv-${d.id}">${f1(r[d.id] || pl.baseline[d.id])}</b></span></div>`).join('')}</div>
      <button class="btn block" data-act="assess-save">${icon('check')}Save</button>
    </div>` };
  },
};
SHEETS.pregame = { render() { return SHEETS.drill.render(); }, mount() {} };
SHEETS.export = {
  render(sh) {
    return { title: 'Your data', body: `<div class="stack-lg"><p class="muted">Downloads aren't available in this view. Copy this and save it somewhere safe.</p><textarea class="input tall" id="exportText" readonly>${esc(sh.data)}</textarea><button class="btn" data-act="export-copy">${icon('copy')}Copy</button></div>` };
  },
};

/* ---------------- Export / import ---------------- */
function sessionsCsv() {
  const cols = ['date', 'kind', 'title', 'attempt', 'source', 'durationSec', 'overall'].concat(C.DIMENSIONS.map((d) => d.id), ['headline', 'structure', 'implication', 'action', 'exec_phrases', 'words', 'wpm', 'fillers', 'hedges', 'xp', 'coach_headline']);
  const q = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const d10 = (v) => (v == null ? '' : (v / 10).toFixed(1));
  const all = Store.sessions.concat(Store.logs.map((l) => Object.assign({}, l, { kind: 'meeting' })));
  const rows = all.map((s) => { const sc = s.kind === 'meeting' ? Object.assign({ overall: s.scores && s.scores.overall }, (s.scores || {}).dims || {}) : G.scores(s), m = s.metrics || {}, h = s.hsia || {}; return [s.date, s.kind, s.title, s.attempt || '', s.source || '', s.durationSec || '', d10(sc.overall)].concat(C.DIMENSIONS.map((d) => d10(sc[d.id])), [h.headline ? 1 : '', h.structure ? 1 : '', h.implication ? 1 : '', h.action ? 1 : '', (s.execPhrases || []).join(' '), m.words, m.wpm, m.fillers, m.hedges, G.xpOf(s), (s.coach && s.coach.headline) || s.assessment || '']).map(q).join(','); });
  return [cols.join(',')].concat(rows).join('\n');
}
async function exportData(fmt) {
  const data = fmt === 'csv' ? sessionsCsv() : JSON.stringify(Store.exportAll(), null, 2);
  const filename = `green-room-${fmt === 'csv' ? 'sessions' : 'backup'}-${dkey()}.${fmt}`;
  let dl = null;
  try { if (window.claude && window.claude.use) dl = await window.claude.use('downloads'); } catch (e) { dl = null; }
  if (dl) {
    try { await dl.save({ filename, data }); toast('Saved'); return; }
    catch (e) { if (e && e.code === 'declined') return; if (e && e.code === 'rate_limited') { toast('A save is already open. Try again in a moment.'); return; } }
  }
  Sheet.open('export', { data });
}

/* ---------------- Plan & navigation helpers ---------------- */
function openPlanItem(kind, id) {
  if (kind === 'drill') return openDrill(id);
  if (kind === 'scenario') return openRep(scenarioSpec(id));
  if (kind === 'spar') return openSpar(id);
  if (kind === 'teachback') return openRep(teachbackSpec(C.DX.find((x) => x[0] === id)));
  if (kind === 'impromptu') return openRep(impromptuSpec(id));
  if (kind === 'review') { S.tool = null; return Sheet.open('review'); }
  if (kind === 'meeting' || kind === 'log') { S.tool = null; return Sheet.open('meeting'); }
  if (kind === 'game') return openEoa();
  if (kind === 'hsia') return openHsia(id);
  if (kind === 'boss') return openSpar(id, { boss: true });
}
function go(route) {
  if (!ROUTES.includes(route)) route = 'today';
  if (location.hash !== '#' + route) { try { location.hash = route; } catch (e) { /* ignore */ } }
  S.route = route; S.pendingRender = false;
  const ae = document.activeElement; if (ae && ae.blur) ae.blur();
  renderView(); window.scrollTo(0, 0);
}

/* Keep what the user typed in an editable brief across re-renders */
function keepCustomFields(r) {
  if (!r || r.step !== 'brief' || !r.spec.editable) return;
  const p = $('#cPrompt'), a = $('#cAud'), t = $('#cTime');
  if (p) r.spec.prompt = p.value;
  if (a) r.spec.audience = a.value;
  if (t) r.spec.time = Number(t.value) || r.spec.time;
}

/* ---------------- Actions ---------------- */
const ACT = {
  go: (el) => go(el.dataset.to),
  'sheet-close': () => Sheet.close(),
  'sheet-back': () => { S.tool = null; Sheet.open('lessons'); },
  open: (el) => {
    let t = el.dataset.sheet; S.tool = null;
    if (t === 'log') t = 'meeting';
    if (t === 'pregame') { S.drill = { id: 'pregame', i: 0, running: false }; return Sheet.open('drill'); }
    if (t === 'hsia') return openHsia(el.dataset.id);
    Sheet.open(t, el.dataset.id ? { id: el.dataset.id } : {});
  },
  plan: (el) => openPlanItem(el.dataset.kind, el.dataset.id),
  lesson: (el) => Sheet.open('lesson', { id: el.dataset.id, fromList: S.sheet && S.sheet.type === 'lessons' }),
  try: (el) => {
    const k = el.dataset.kind, id = el.dataset.id;
    if (k === 'scenario') openRep(scenarioSpec(id)); else if (k === 'drill') openDrill(id); else if (k === 'spar') openSpar(id);
    else if (k === 'tool') { S.tool = null; if (id === 'pregame') { S.drill = { id: 'pregame', i: 0 }; Sheet.open('drill'); } else Sheet.open(id); }
  },
  cat: (el) => { S.practiceCat = el.dataset.id; renderView(); },
  scenario: (el) => openRep(scenarioSpec(el.dataset.id)),
  quick: (el) => { const q = el.dataset.q; openRep(q === 'impromptu' ? impromptuSpec() : q === 'teachback' ? teachbackSpec() : customSpec()); },
  drill: (el) => openDrill(el.dataset.id),
  persona: (el) => openSpar(el.dataset.id),
  more: () => { S.historyN += 20; renderView(); },
  session: (el) => Sheet.open('session', { id: el.dataset.id }),
  again: (el) => { const s = Store.sessions.find((x) => x.id === el.dataset.id); if (s && s.spec) openRep(Object.assign({}, s.spec)); },
  del1: (el) => { $('#delZone').innerHTML = `<button class="btn danger" data-act="del2" data-id="${el.dataset.id}">Delete for good</button><button class="btn secondary" data-act="sheet-close">Keep it</button>`; },
  del2: (el) => { Store.remove('sessions', el.dataset.id); toast('Deleted'); Sheet.close(); },

  // rep flow
  'rep-mode': (el) => { const r = S.rep; keepCustomFields(r); r.mode = el.dataset.mode; lsSet('gr.mode', r.mode); if (r.mode === 'mic') { S.micBlocked = false; lsSet('gr.micBlocked', '0'); } if (r.step === 'capture') { Rec.cancel(); runCleanups(); } Sheet.render(true); },
  'rep-shuffle': () => { S.rep.spec = impromptuSpec(); Sheet.render(true); },
  'rep-start': () => {
    const r = S.rep, s = r.spec;
    if (s.editable) {
      const pr = ($('#cPrompt').value || '').trim();
      if (!pr) { toast('Write the question or moment first.'); return; }
      s.prompt = pr; s.audience = ($('#cAud').value || '').trim() || 'Senior executives'; s.time = Number($('#cTime').value) || 60; s.editable = false; s.title = pr.length > 48 ? pr.slice(0, 46) + '…' : pr;
    }
    const think = Store.profile.settings.thinkTime;
    r.step = think && r.mode !== 'upload' && r.attempt === 1 ? 'think' : 'capture';
    Sheet.render();
  },
  'think-skip': () => { runCleanups(); S.rep.step = 'capture'; Sheet.render(); },
  'rec-toggle': () => recToggle(),
  'dict-done': () => {
    const r = S.rep, box = $('#dictBox');
    const txt = (box.value || '').trim();
    if (A.wordList(txt).length < 3) { toast('Say or type your answer first.'); return; }
    const typed = $('#typedChk').checked;
    const secs = r.dict ? r.dict.seconds() : 0;
    runCleanups();
    analyzeRep({ transcript: txt, source: typed ? 'typed' : 'dictation', durationSec: typed ? null : secs || null });
  },
  'up-go': () => {
    const r = S.rep; const f = r.upFile;
    if (!f) { toast('Choose a recording first.'); return; }
    const chk = $('#upFrames');
    analyzeRep({ transcript: ($('#upText').value || '').trim(), source: 'upload', durationSec: null, file: f, isVideo: /^video\//.test(f.type), useFrames: chk ? chk.checked : false });
  },
  rescore: () => {
    const r = S.rep; const txt = ($('#reText').value || '').trim();
    const src = r.input.source === 'mic' || r.input.source === 'upload' ? r.input.source : r.input.source;
    scoreRep(txt, src, r.input.durationSec);
    if (r.session.coach) { r.session.coach = null; r.session.scores = blendScores(r.session.autoScores, null); Store.put('sessions', r.session); }
    r.coachState = 'idle';
    Sheet.render(true); toast('Re-scored');
  },
  'coach-run': () => runCoach(),
  'coach-stop': () => { if (coachCtl) coachCtl.abort(); },
  'copy-rewrite': () => { const el = $('#rewriteText'); copyText(el.textContent, el); },
  runback: () => { const r = S.rep; openRep(r.spec, { attempt: r.attempt + 1, prev: r.session, mode: r.mode, skipBrief: true }); },

  // spar
  'spar-diff': (el) => { S.spar.ctx = $('#sparCtx').value; S.spar.difficulty = el.dataset.v; Sheet.render(true); },
  'spar-rounds': (el) => { S.spar.ctx = $('#sparCtx').value; S.spar.rounds = Number(el.dataset.v); Sheet.render(true); },
  'spar-start': () => { const sp = S.spar; sp.ctx = ($('#sparCtx').value || '').trim() || sp.persona.defaultContext; sp.step = 'chat'; sparAsk(); },
  'spar-send': () => sparSend(),
  'spar-retry': () => sparAsk(),
  'spar-end': () => sparDebrief(),
  'spar-voice': () => { const sp = S.spar; sp.voice = !sp.voice; if (!sp.voice) { try { speechSynthesis.cancel(); } catch (e) { /* ignore */ } } const box = $('#sparBox'); const keep = box ? box.value : ''; Sheet.render(true); const nb = $('#sparBox'); if (nb) nb.value = keep; },
  'spar-again': () => { const sp = S.spar; openSpar(sp.persona.id, { ctx: sp.ctx, difficulty: sp.difficulty, rounds: sp.rounds, boss: sp.boss }); },
  'spar-q': (el) => openRep(questionSpec(el.dataset.q, el.dataset.aud, 'spar')),

  // drills
  'drill-finish': () => { const d = S.drill; d.done = true; logDrill(d.id); Sheet.render(true); },
  'breath-go': () => { const d = S.drill; d.running = true; Sheet.render(true); runBreath(() => { d.running = false; d.done = true; logDrill('breath', 2); Sheet.render(true); }); },
  'breath-stop': () => { runCleanups(); S.drill.running = false; Sheet.render(true); },
  'step-go': () => startSteps(),
  'step-next': () => nextStep(),
  'enun-set': (el) => { S.drill.set = Number(el.dataset.v); S.drill.i = 0; Sheet.render(true); },
  'line-next': (el) => { const d = S.drill, n = Number(el.dataset.n); if (d.id === 'enunciation' && d.i >= n - 1) { d.set = (d.set + 1) % C.ENUNCIATION.length; d.i = 0; } else d.i++; Sheet.render(true); },
  'line-prev': () => { S.drill.i = Math.max(0, S.drill.i - 1); Sheet.render(true); },
  'swap-reveal': () => { S.drill.revealed = true; Sheet.render(true); },
  'swap-next': () => { S.drill.revealed = false; S.drill.i++; Sheet.render(true); },
  'pace-pass': (el) => { runCleanups(); Object.assign(S.drill, { passage: Number(el.dataset.v), running: false }); Sheet.render(true); },
  'pace-wpm': (el) => { runCleanups(); Object.assign(S.drill, { wpm: Number(el.dataset.v), running: false }); Sheet.render(true); },
  'pace-go': () => runPace(),
  'pace-stop': () => { runCleanups(); S.drill.running = false; Sheet.render(true); },
  'con-next': () => { Object.assign(S.drill, { i: S.drill.i + 1, text: '', out: '' }); Sheet.render(true); },
  'con-check': () => concisionCheck(),

  // tools
  'prep-go': (el) => prepGo(el.dataset.id || null),
  'prep-edit': (el) => { S.tool = null; Sheet.open('prep', { id: el.dataset.id, edit: true }); },
  'prep-open': (el) => { const pr = Store.preps.find((x) => x.id === el.dataset.id); if (!pr) return; const op = pr.result && pr.result.opening; openRep(customSpec({ title: `Opening: ${pr.title}`, audience: pr.audience, situation: pr.objective, prompt: op ? `Deliver your opening. Your draft: "${op}"` : `Open the meeting. Your objective: ${pr.objective}`, time: 45, areas: ['A', 'E'] })); },
  'prep-q': (el) => { const pr = Store.preps.find((x) => x.id === el.dataset.id); const q = pr && pr.result && pr.result.questions[Number(el.dataset.i)]; if (q) openRep(questionSpec(q.q, pr.audience, pr.id)); },
  'prep-spar': (el) => { const pr = Store.preps.find((x) => x.id === el.dataset.id); if (!pr) return; openSpar(personaForAudience(pr.audience), { ctx: `${pr.title}. You want them to: ${pr.objective}. Facts: ${pr.facts || 'n/a'}. Their likely concern: ${pr.worries || 'n/a'}.` }); },
  'prep-del1': (el) => { $('#delZone').innerHTML = `<button class="btn danger" data-act="prep-del2" data-id="${el.dataset.id}">Delete for good</button>`; },
  'prep-del2': (el) => { Store.remove('preps', el.dataset.id); toast('Deleted'); Sheet.close(); },
  'sh-mode': (el) => { S.tool = Object.assign(S.tool || {}, { mode: el.dataset.v, text: $('#shIn').value, aud: $('#shAud').value }); Sheet.render(true); },
  'sh-go': () => sharpenGo(),
  'sh-copy': () => { const el = $('#shOut'); copyText(el.textContent, el); },
  'sh-rehearse': () => { const t = S.tool; if (!t || !t.res) return; openRep(customSpec({ title: 'Sharpened version', audience: t.aud, prompt: `Say this out loud, naturally, in your own voice: "${t.res.sharpened.slice(0, 600)}"`, time: Math.max(30, Math.round(A.wordList(t.res.sharpened).length / 2.4)), areas: ['D', 'A'] })); },
  'vis-ctx': (el) => { S.tool.ctx = el.dataset.v; Sheet.render(true); },
  'vis-go': () => visGo(),
  'review-go': () => reviewGo(),
  'assess-save': () => { const r = {}; $$('[data-rate]').forEach((el) => { r[el.dataset.rate] = Number(el.value); }); Store.saveProfile({ ratings: r }); toast('Self-rating saved'); Sheet.close(); },
  boss: () => { const b = G.boss(); openSpar(b.persona.id, { boss: true }); },
  game: () => openEoa(),
  'set-objective': (el) => { Store.saveProfile({ objective: el.dataset.id }); toast(`Objective ${el.dataset.id}: ${C.area(el.dataset.id).title}`); if (el.dataset.close) Sheet.close(); else if (S.sheet) Sheet.render(true); else renderView(); },
  'cel-next': () => Celebrate.next(),
  'eoa-start': () => eoaStart(),
  'eoa-pick': (el) => eoaAnswer(el.dataset.v === '1'),
  'eoa-next': () => { const g = S.game; g.i++; g.answered = null; if (g.i >= g.items.length) eoaEnd(); else Sheet.render(true); },
  'hb-score': () => hbLock(),
  'hb-coach': () => hbCoach(),
  'hb-say': () => hbSay(),
  'hb-new': () => { const cur = S.game && S.game.kase ? S.game.kase.id : ''; const others = C.HSIA_CASES.filter((k) => k.id !== cur); openHsia(others[Math.floor(Math.random() * others.length)].id); },
  'quest-open': (el) => { S.tool = { open: el.dataset.id }; Sheet.render(true); },
  'quest-save': (el) => { const q = C.QUESTS.find((x) => x.id === el.dataset.id); const n = $('#qnote'); Store.put('sessions', { kind: 'quest', refId: q.id, week: G.isoWeek().key, title: `Quest: ${q.cat}`, note: n ? n.value.trim() : '', date: dkey(), ts: Date.now() }); S.tool = {}; toast('Quest logged · +30 XP'); chime('small'); Sheet.render(true); },
  'arsenal-rep': () => { const pool = C.SCENARIOS.filter((x) => x.areas.includes(Store.profile.objective)); openRep(scenarioSpec(pick(pool.length ? pool : C.SCENARIOS, Math.floor(Math.random() * 99)).id)); },
  'mt-go': () => meetingGo(),
  'mt-self': () => meetingSelf(),
  'mt-pin': (el) => { const l = Store.logs.find((x) => x.id === el.dataset.id); if (!l) return; Store.saveProfile(Object.assign({ nextAdjustment: l.adjustment }, l.objective_area ? { objective: l.objective_area } : {})); toast('Pinned to Today'); Sheet.render(true); },
  'mt-rehearse': (el) => { const l = Store.logs.find((x) => x.id === el.dataset.id); if (!l) return; openRep(customSpec({ title: `Replay: ${l.title}`, audience: C.mtype(l.type).name, situation: 'From your meeting review.', prompt: `Deliver the executive version of your key intervention, in your own words: "${l.executive_version.slice(0, 700)}"`, time: 60, areas: ['A', 'E'] })); },
  'mt-del1': (el) => { $('#delZone').innerHTML = `<button class="btn danger" data-act="mt-del2" data-id="${el.dataset.id}">Delete for good</button>`; },
  'mt-del2': (el) => { Store.remove('logs', el.dataset.id); toast('Deleted'); Sheet.close(); },
  'pl-go': () => planGo(),
  'pl-apply': () => planApply(),
  'pl-back': () => { S.tool.res = null; Sheet.render(); },
  export: (el) => exportData(el.dataset.fmt),
  'export-copy': () => { const el = $('#exportText'); copyText(el.value, el); },
  reset1: () => { $('#resetZone').innerHTML = `<div class="note warn">${icon('info')}<span>This erases every session, log, prep and setting, on every device. It can't be undone.</span></div><div class="actions" style="margin-top:10px"><button class="btn danger" data-act="reset2">Erase everything</button><button class="btn secondary" data-act="reset-cancel">Cancel</button></div>`; },
  reset2: () => { Store.resetAll(); toast('All practice data erased'); go('today'); },
  'reset-cancel': () => renderView(),
};
const CHANGE = {
  'up-file': (el) => { const f = el.files && el.files[0]; S.rep.upFile = f || null; const n = $('#upName'); if (n) n.textContent = f ? `${f.name} · ${(f.size / 1048576).toFixed(1)} MB` : 'Choose a recording'; const b = $('#upGo'); if (b) b.disabled = !f; },
  'vis-file': (el) => visFile(el),
  'pl-file': (el) => { const f = el.files && el.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { $('#plText').value = String(rd.result || '').slice(0, 60000); }; rd.readAsText(f); },
  'mt-file': (el) => { const f = el.files && el.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { const txt = String(rd.result || '').replace(/^WEBVTT.*$/m, '').replace(/^\d+\s*$/gm, '').replace(/^\d\d:\d\d[:.,\d]* --> .*$/gm, '').replace(/\n{2,}/g, '\n').trim(); $('#mt-text').value = txt.slice(0, 60000); if (!$('#mt-title').value) $('#mt-title').value = f.name.replace(/\.[^.]+$/, ''); }; rd.readAsText(f); },
  'dx-pick': (el) => { const dx = C.DX.find((x) => x[0] === el.value); if (dx) { S.rep.spec = teachbackSpec(dx); Sheet.render(true); } },
  import: (el) => {
    const f = el.files && el.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => { try { const n = Store.importAll(JSON.parse(String(rd.result))); toast(`Restored ${n} items`); renderView(); } catch (e) { toast(e.message || 'That file couldn\'t be read.'); } };
    rd.readAsText(f);
  },
};

/* ---------------- Boot ---------------- */
function boot() {
  $('#brandMark').innerHTML = BRAND_SVG;
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (!t || t.tagName === 'INPUT') return;
    const fn = ACT[t.dataset.act];
    if (fn) { e.preventDefault(); fn(t, e); }
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.pf || t.dataset.plan || t.dataset.set) S.deferRender = true; // let a tap that caused this blur finish first
    if (t.dataset.actChange && CHANGE[t.dataset.actChange]) return CHANGE[t.dataset.actChange](t);
    if (t.dataset.pf) return Store.saveProfile({ [t.dataset.pf]: t.value.trim() });
    if (t.dataset.plan) {
      const v = A.clamp(Number(t.value) || 0, 1, 10); const pl = G.plan(); const cur = Object.assign({}, Store.profile.plan || {});
      if (t.dataset.plan === 'overall') cur.overall = Object.assign({}, pl.overall, { [t.dataset.dim]: v });
      else cur[t.dataset.plan] = Object.assign({}, pl[t.dataset.plan], { [t.dataset.dim]: v });
      Store.saveProfile({ plan: cur }); toast('Plan saved'); return;
    }
    if (t.dataset.set) {
      const k = t.dataset.set, s = Object.assign({}, Store.profile.settings);
      if (k === 'pace') { const [a, b] = t.value.split('-').map(Number); s.paceLo = a; s.paceHi = b; }
      else if (k === 'autoCoach' || k === 'voice' || k === 'sound') s[k] = t.checked;
      else if (k === 'customFillers') s.customFillers = t.value.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 20);
      else s[k] = Number(t.value);
      Store.saveProfile({ settings: s }); toast('Saved');
    }
  });
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.sc) { const b = $('#scv-' + t.dataset.sc); if (b) b.textContent = t.value; if (S.tool && S.tool.sc) S.tool.sc[t.dataset.sc] = Number(t.value); }
    if (t.dataset.rate) { const b = $('#rv-' + t.dataset.rate); if (b) b.textContent = f1(t.value); }
  });
  document.addEventListener('focusout', () => { setTimeout(() => { const ae = document.activeElement; if (S.pendingRender && !($('#view').contains(ae) && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName))) renderView(); }, 50); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#celebrate').hidden) return Celebrate.next();
    if (e.key === 'Escape' && S.sheet && !Rec.active) Sheet.close();
    if (S.sheet && S.sheet.type === 'eoa' && S.game && S.game.step === 'play' && !S.game.answered && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) eoaAnswer(e.key === 'ArrowRight');
  });
  window.addEventListener('scroll', () => { const tb = $('.topbar'); if (tb) tb.classList.toggle('scrolled', window.scrollY > 4); }, { passive: true });
  window.addEventListener('hashchange', () => { const r = location.hash.slice(1); if (ROUTES.includes(r) && r !== S.route) { S.route = r; renderView(); } });
  const h = location.hash.slice(1); S.route = ROUTES.includes(h) ? h : 'today';
  Store.on((what) => {
    if (what === 'profile' || what === 'all') A.setCustomFillers(Store.profile.settings.customFillers);
    renderView();
    if (what !== 'profile') G.check();
  });
  AI.on(() => { renderView(); if (S.sheet && ['spar', 'prep', 'sharpen', 'visual', 'plan', 'review', 'meeting'].includes(S.sheet.type) && !(S.tool && S.tool.busy) && !(S.spar && S.spar.step !== 'setup')) Sheet.render(true); });
  Store.init();
  AI.init();
  if (window.speechSynthesis) { try { speechSynthesis.getVoices(); } catch (e) { /* ignore */ } }
}
boot();
