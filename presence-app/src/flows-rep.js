/* ============================================================
   Green Room — sheets, recorder and the practice-rep flow
   ============================================================ */
const SHEETS = {};
const cleanups = [];
function addCleanup(fn) { cleanups.push(fn); }
function runCleanups() { while (cleanups.length) { try { cleanups.pop()(); } catch (e) { /* ignore */ } } }

const Sheet = {
  open(type, data = {}) {
    runCleanups();
    S.sheet = Object.assign({ type }, data);
    const el = $('#sheet');
    el.hidden = false;
    document.body.style.overflow = 'hidden';
    this.render();
    el.scrollTop = 0;
  },
  close() {
    runCleanups();
    Rec.cancel();
    try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    S.sheet = null; S.rep = null; S.spar = null; S.drill = null; S.tool = null;
    const el = $('#sheet');
    el.hidden = true; el.innerHTML = '';
    document.body.style.overflow = '';
    renderView();
  },
  render(keepScroll) {
    if (!S.sheet) return;
    const def = SHEETS[S.sheet.type];
    if (!def) return;
    const el = $('#sheet');
    const top = el.scrollTop;
    const out = def.render(S.sheet);
    el.innerHTML = `<div class="sheet-panel"><div class="sheet-bar"><div class="wrap">
      <button class="icon-btn plain" data-act="${out.back ? 'sheet-back' : 'sheet-close'}" aria-label="${out.back ? 'Back' : 'Close'}">${icon(out.back ? 'back' : 'close')}</button>
      <div class="title">${esc(out.title || '')}</div>${out.right || ''}</div></div>
      <div class="sheet-body wrap">${out.body}</div></div>`;
    if (keepScroll) el.scrollTop = top; else el.scrollTop = 0;
    animateGauges(el);
    if (def.mount) def.mount(S.sheet);
  },
};

/* ---------------- Live microphone recorder ---------------- */
const Rec = {
  active: false,
  async start({ onLevel, onText } = {}) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) throw new Error('nomic');
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac'];
    const mime = types.find((t) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
    this.rec = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
    this.chunks = [];
    this.rec.ondataavailable = (e) => { if (e.data && e.data.size) this.chunks.push(e.data); };
    this.rec.start(500);
    this.an = null;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      if (this.ctx.resume) await this.ctx.resume();
      const src = this.ctx.createMediaStreamSource(this.stream);
      this.an = this.ctx.createAnalyser(); this.an.fftSize = 1024; src.connect(this.an);
    } catch (e) { this.an = null; }
    this.finalText = ''; this.interim = ''; this.sr = null;
    const SRC = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SRC) {
      try {
        const r = new SRC();
        r.continuous = true; r.interimResults = true; r.lang = navigator.language || 'en-US';
        r.onresult = (e) => {
          let interim = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const t = e.results[i][0].transcript;
            if (e.results[i].isFinal) this.finalText += (this.finalText ? ' ' : '') + t.trim(); else interim += t;
          }
          this.interim = interim;
          onText && onText(this.finalText, interim);
        };
        r.onerror = () => {};
        r.onend = () => { if (this.active) { try { r.start(); } catch (e) { /* ignore */ } } };
        r.start(); this.sr = r;
      } catch (e) { this.sr = null; }
    }
    this.active = true; this.t0 = performance.now();
    const buf = this.an ? new Uint8Array(this.an.fftSize) : null;
    const loop = () => {
      if (!this.active) return;
      if (this.an) { this.an.getByteTimeDomainData(buf); let s = 0; for (let i = 0; i < buf.length; i++) { const x = (buf[i] - 128) / 128; s += x * x; } onLevel && onLevel(Math.sqrt(s / buf.length)); }
      this.raf = requestAnimationFrame(loop);
    };
    loop();
    return { recognition: !!this.sr };
  },
  async stop() {
    if (!this.active) return null;
    this.active = false; cancelAnimationFrame(this.raf);
    const durationSec = (performance.now() - this.t0) / 1000;
    try { this.sr && this.sr.stop(); } catch (e) { /* ignore */ }
    const blob = await new Promise((res) => {
      this.rec.onstop = () => res(new Blob(this.chunks, { type: this.rec.mimeType || 'audio/webm' }));
      try { this.rec.stop(); } catch (e) { res(new Blob(this.chunks)); }
    });
    try { this.stream.getTracks().forEach((t) => t.stop()); } catch (e) { /* ignore */ }
    this.closeCtx(); this.stream = null;
    await new Promise((r) => setTimeout(r, 450));
    return { blob, durationSec, transcript: (this.finalText + ' ' + (this.interim || '')).trim(), recognition: !!this.sr };
  },
  cancel() {
    if (!this.active && !this.stream) return;
    this.active = false; cancelAnimationFrame(this.raf);
    try { this.sr && this.sr.abort(); } catch (e) { /* ignore */ }
    try { this.rec && this.rec.state !== 'inactive' && this.rec.stop(); } catch (e) { /* ignore */ }
    try { this.stream && this.stream.getTracks().forEach((t) => t.stop()); } catch (e) { /* ignore */ }
    this.closeCtx(); this.stream = null;
  },
  closeCtx() {
    const c = this.ctx; this.ctx = null;
    if (c && c.state !== 'closed') { try { const p = c.close(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ } }
  },
};
function markMicBlocked() { S.micBlocked = true; lsSet('gr.micBlocked', '1'); }

let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen');
    else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { /* not granted */ }
}

/* Dictation box tracker: timer starts at first words, ends at last words. */
function trackDictation(box, onTick) {
  const st = { t0: 0, last: 0, inserts: 0, chars: 0, pasted: false };
  box.addEventListener('input', (e) => {
    const now = performance.now();
    if (!st.t0 && box.value.trim()) st.t0 = now;
    if (st.t0) st.last = now;
    if (e.inputType === 'insertFromPaste') st.pasted = true;
    if (e.data) { st.inserts++; st.chars += e.data.length; }
    onTick && onTick(st);
  });
  box.addEventListener('paste', () => { st.pasted = true; });
  const iv = setInterval(() => onTick && onTick(st), 500);
  addCleanup(() => clearInterval(iv));
  st.stop = () => clearInterval(iv);
  st.seconds = () => (st.t0 ? (st.last - st.t0) / 1000 + 1.2 : 0);
  st.looksTyped = () => st.pasted || (st.inserts > 8 && st.chars / st.inserts < 2.2);
  return st;
}

/* ---------------- Specs ---------------- */
function scenarioSpec(id) { const s = C.SCENARIOS.find((x) => x.id === id); return s ? Object.assign({ kind: 'scenario', refId: s.id }, s) : null; }
function impromptuSpec(i) {
  const idx = i == null ? Math.floor(Math.random() * C.IMPROMPTU.length) : Number(i);
  return { kind: 'impromptu', refId: String(idx), title: 'Impromptu, 60 seconds', audience: 'A room of senior colleagues.', situation: 'No preparation. A few seconds to think.', prompt: C.IMPROMPTU[idx % C.IMPROMPTU.length], criteria: ['A clear position in the first sentence', 'One reason, with an example', 'A close that restates the point', 'Done inside 60 seconds'], tip: 'Use PREP: Point, Reason, Example, Point.', time: 60, focus: ['conviction', 'concision', 'structure'] };
}
function teachbackSpec(dx) {
  dx = dx || C.dxEstimate(new Date());
  return { kind: 'teachback', refId: dx[0], title: `Teach-back: ${dx[2]}`, audience: 'A board member with no diagnostics background. Smart, busy and allergic to jargon.', situation: `From the DX Daily curriculum (${dx[1]}). ${dx[3] || ''}`.trim(), prompt: `Explain "${dx[2]}" in 60 seconds: what it is in one sentence, why it matters in dollars or patients, and one example.`, criteria: ['A plain-English definition in one sentence', 'Why it matters, with a number', 'One concrete example or analogy', 'No unexplained acronyms'], tip: 'If you use an acronym, define it in five words or drop it.', time: 60, focus: ['altitude', 'concision', 'precision'] };
}
function customSpec(f = {}) {
  return { kind: 'custom', refId: 'custom', title: f.title || 'Your own prompt', audience: f.audience || 'Senior executives', situation: f.situation || '', prompt: f.prompt || '', criteria: f.criteria || ['Answer or recommendation in the first sentence', 'One or two supporting points with a number', 'A clear ask or close', 'Inside the time limit'], tip: f.tip || 'Say the headline first. Then stop sooner than feels natural.', time: f.time || 60, focus: f.focus || ['bluf', 'concision'], editable: !f.prompt };
}
function questionSpec(q, aud, refId) {
  return { kind: 'question', refId: refId || 'prep', title: 'Tough question', audience: aud || 'Senior executives', situation: 'From your meeting prep.', prompt: q, criteria: ['Answers in the first sentence', 'One proof point', 'Stops when done', 'Under 45 seconds'], tip: 'Pause. Answer. Prove. Stop.', time: 45, focus: ['qa', 'composure', 'bluf'] };
}

/* ---------------- Rep flow ---------------- */
function defaultMode() { return S.micBlocked ? 'dictate' : 'mic'; }
function openRep(spec, opts = {}) {
  if (!spec) return;
  S.rep = { spec, step: opts.skipBrief ? 'capture' : 'brief', mode: opts.mode || lsGet('gr.mode', defaultMode()), attempt: opts.attempt || 1, prev: opts.prev || null };
  if (S.rep.mode === 'mic' && S.micBlocked) S.rep.mode = 'dictate';
  Sheet.open('rep');
}
const kindLabel = (k) => ({ scenario: 'Scenario', impromptu: 'Impromptu', teachback: 'Teach-back', custom: 'Your prompt', question: 'Tough question', concision: 'Concision gym' }[k] || 'Rep');

SHEETS.rep = {
  render() {
    const r = S.rep;
    if (!r) return { title: '', body: '' };
    const title = r.attempt > 1 ? `${r.spec.title} · try ${r.attempt}` : r.spec.title;
    const fn = { brief: repBrief, think: repThink, capture: repCapture, analyzing: repAnalyzing, result: repResult }[r.step];
    return { title, body: fn(r) };
  },
  mount() { const r = S.rep; if (!r) return; if (r.step === 'think') mountThink(); if (r.step === 'capture') mountCapture(); if (r.step === 'result' && r.autoCoach) { r.autoCoach = false; runCoach(); } },
};

function modeSeg(r) {
  const modes = [['mic', 'Speak', 'mic'], ['dictate', 'Dictate or type', 'keyboard'], ['upload', 'Upload', 'upload']];
  return `<div class="seg full" role="group" aria-label="How you'll answer">${modes.map(([id, n]) => `<button data-act="rep-mode" data-mode="${id}" aria-pressed="${r.mode === id}">${n}</button>`).join('')}</div>
    <p class="small muted">${r.mode === 'mic' ? 'Records your voice and transcribes it live. Scores pace, pauses, pitch range and rising endings.' : r.mode === 'dictate' ? 'Tap the microphone on your keyboard and speak, or type. Pace is timed from your first word to your last.' : 'Upload a voice memo or video. Get the full voice analysis; paste the transcript to score content too.'}</p>
    ${r.mode === 'mic' && S.micBlocked ? '' : ''}`;
}
function repBrief(r) {
  const s = r.spec;
  const dxSel = s.kind === 'teachback' ? `<label class="field">Lesson<select class="input" id="dxPick" data-act-change="dx-pick">${C.DX.map((x) => `<option value="${x[0]}" ${x[0] === s.refId ? 'selected' : ''}>${x[0]} · ${esc(x[2])}</option>`).join('')}</select></label>` : '';
  const editable = s.editable ? `<label class="field">The question or moment you're rehearsing<textarea class="input" id="cPrompt" rows="3" placeholder="e.g. Open the board update on the Q3 partnership miss">${esc(s.prompt)}</textarea></label>
    <label class="field">Audience<input class="input" id="cAud" value="${esc(s.audience)}"></label>
    <label class="field">Time limit<select class="input" id="cTime">${[30, 45, 60, 90, 120, 180].map((t) => `<option value="${t}" ${s.time === t ? 'selected' : ''}>${t} seconds</option>`).join('')}</select></label>` : '';
  return `<div class="stack-lg">
    <div class="stack"><span class="eyebrow">${kindLabel(s.kind)} · ${s.time}s</span><h1 class="h1">${esc(s.title)}</h1></div>
    ${dxSel}
    ${editable || `<dl class="brief-meta"><dt>Audience</dt><dd>${esc(s.audience)}</dd>${s.situation ? `<dt>Situation</dt><dd>${esc(s.situation)}</dd>` : ''}</dl>
    <div class="prompt-box"><span class="eyebrow">Your task</span>${esc(s.prompt)}</div>`}
    ${s.kind === 'impromptu' ? `<div><button class="btn secondary sm" data-act="rep-shuffle">${icon('refresh')}Different question</button></div>` : ''}
    <div class="card stack"><span class="eyebrow">What good looks like</span>${(s.criteria || []).map((c) => `<div class="crit">${icon('check')}<span>${esc(c)}</span></div>`).join('')}</div>
    ${s.tip ? `<div class="note">${icon('spark')}<span>${esc(s.tip)}</span></div>` : ''}
    ${r.prev && r.prev.coach && r.prev.coach.next_rep ? `<div class="note warn">${icon('target')}<span><b>This try:</b> ${esc(r.prev.coach.next_rep)}</span></div>` : ''}
    <div class="stack"><span class="eyebrow">How you'll answer</span>${modeSeg(r)}</div>
    <button class="btn block" data-act="rep-start">${icon('play')}${Store.profile.settings.thinkTime && r.mode !== 'upload' && !s.editable ? `Start (${Store.profile.settings.thinkTime}s to think)` : 'Start'}</button>
  </div>`;
}
function repThink(r) {
  return `<div class="stack-lg" style="text-align:center;align-items:center;padding-top:20px">
    <span class="eyebrow">Think. Don't script.</span>
    <div class="timer" id="thinkT">${Store.profile.settings.thinkTime}</div>
    <div class="prompt-box" style="text-align:left;width:100%">${esc(r.spec.prompt)}</div>
    <p class="muted">Pick your headline: the one sentence you'd say if you only had one.</p>
    <button class="btn secondary" data-act="think-skip">I'm ready</button>
  </div>`;
}
function mountThink() {
  let t = Store.profile.settings.thinkTime;
  const iv = setInterval(() => {
    t--; const el = $('#thinkT'); if (el) el.textContent = t;
    if (t <= 0) { clearInterval(iv); if (S.rep && S.rep.step === 'think') { S.rep.step = 'capture'; Sheet.render(); } }
  }, 1000);
  addCleanup(() => clearInterval(iv));
}
function compactPrompt(r) {
  return `<div class="prompt-box" style="font-size:18px"><span class="eyebrow">${esc(r.spec.audience.split('.')[0])}</span>${esc(r.spec.prompt)}</div>
  ${r.prev && r.prev.coach && r.prev.coach.next_rep && r.step === 'capture' ? `<div class="note warn">${icon('target')}<span><b>This try:</b> ${esc(r.prev.coach.next_rep)}</span></div>` : ''}`;
}
function repCapture(r) {
  const lim = r.spec.time;
  if (r.mode === 'mic') {
    return `<div class="stack-lg">${compactPrompt(r)}
      <div class="recorder">
        <div class="timer" id="recT">0:00</div><div class="timer-sub">limit ${fmtSec(lim)}</div>
        <div class="timebar"><i id="recBar"></i></div>
        <canvas class="level" id="recLevel" width="840" height="128" aria-hidden="true"></canvas>
        <button class="rec-btn" id="recBtn" data-act="rec-toggle" aria-label="Start recording">${icon('mic')}</button>
        <div class="small muted" id="recHint">Tap to start speaking. Tap again when you're done.</div>
        <div class="live-text" id="recText" aria-live="polite"></div>
      </div>
      <div class="row" style="justify-content:center"><button class="link" data-act="rep-mode" data-mode="dictate">Use dictation instead</button></div>
    </div>`;
  }
  if (r.mode === 'dictate') {
    return `<div class="stack-lg">${compactPrompt(r)}
      <div class="row between"><div><div class="timer" id="dictT" style="font-size:34px">0:00</div><div class="timer-sub" id="dictSub">Timer starts at your first word</div></div><span class="pill" id="dictWords">0 words</span></div>
      <div class="timebar"><i id="dictBar"></i></div>
      <textarea class="input tall" id="dictBox" placeholder="Tap here, then tap the microphone on your keyboard and speak your answer out loud." autocapitalize="sentences"></textarea>
      <label class="check small"><input type="checkbox" id="typedChk"> I typed this (don't score pace)</label>
      <div class="actions"><button class="btn" data-act="dict-done">${icon('check')}Done, score it</button></div>
      <div class="note">${icon('info')}<span>Phone dictation drops most "um"s and "uh"s, so filler counts are a floor. For a full voice read, upload a voice memo instead.</span></div>
    </div>`;
  }
  return `<div class="stack-lg">${compactPrompt(r)}
    <label class="dropzone" for="upFile">${icon('upload')}<span class="h3" id="upName">Choose a recording</span><span class="small muted">Voice memo or video. Speak your answer, then pick the file here.</span>
      <input type="file" id="upFile" accept="audio/*,video/*" class="sr" data-act-change="up-file"></label>
    <label class="field">Transcript (optional, recommended)<textarea class="input" id="upText" placeholder="Paste the transcript to score content too. On iPhone, Voice Memos can show a transcript you can copy."></textarea></label>
    ${AI.ready && AI.imagesOk ? '<label class="check small"><input type="checkbox" id="upFrames" checked> If it\'s a video, let the coach see a few still frames for body language</label>' : ''}
    <button class="btn block" data-act="up-go" id="upGo" disabled>${icon('spark')}Analyze</button>
  </div>`;
}
function mountCapture() {
  const r = S.rep;
  if (r.mode === 'dictate') {
    const box = $('#dictBox');
    const lim = r.spec.time;
    r.dict = trackDictation(box, (st) => {
      const sec = st.t0 ? (performance.now() - st.t0) / 1000 : 0;
      const t = $('#dictT'); if (t) { t.textContent = fmtSec(sec); t.classList.toggle('over', sec > lim); }
      const bar = $('#dictBar'); if (bar) { bar.style.width = Math.min(100, (sec / lim) * 100) + '%'; bar.classList.toggle('over', sec > lim); }
      const w = $('#dictWords'); if (w) w.textContent = plural(A.wordList(box.value).length, 'word');
      const sub = $('#dictSub'); if (sub && st.t0) sub.textContent = `limit ${fmtSec(lim)}`;
      const chk = $('#typedChk'); if (chk && !chk.dataset.touched) chk.checked = st.looksTyped();
    });
    $('#typedChk').addEventListener('change', (e) => { e.target.dataset.touched = '1'; });
    setTimeout(() => box.focus(), 50);
  }
  if (r.mode === 'mic') {
    const cv = $('#recLevel');
    r.levels = []; r.levelTick = 0;
    const draw = () => {
      if (!cv) return;
      const c = cv.getContext('2d'); const W = cv.width, H = cv.height;
      c.clearRect(0, 0, W, H);
      const col = getComputedStyle(document.documentElement).getPropertyValue('--brass').trim() || '#86621F';
      c.fillStyle = col;
      const n = 70, bw = W / n;
      const L = r.levels.slice(-n);
      L.forEach((v, i) => { const h = Math.max(4, Math.min(1, v * 4) * (H - 8)); c.fillRect(i * bw + 2, (H - h) / 2, bw - 4, h); });
    };
    r.draw = draw; draw();
  }
}

async function recToggle() {
  const r = S.rep;
  const btn = $('#recBtn');
  if (!Rec.active) {
    try {
      btn.disabled = true;
      const res = await Rec.start({
        onLevel: (v) => { r.levels.push(v); if (r.levels.length > 200) r.levels.shift(); if (r.levelTick++ % 3 === 0) r.draw(); },
        onText: (fin, interim) => { const el = $('#recText'); if (el) el.textContent = (fin + ' ' + interim).trim().split(' ').slice(-40).join(' '); },
      });
      r.levelTick = 0;
      btn.disabled = false; btn.classList.add('recording'); btn.innerHTML = icon('stop'); btn.setAttribute('aria-label', 'Stop recording');
      $('#recHint').textContent = res.recognition ? 'Listening. Tap to stop.' : 'Recording. Live transcript isn\'t available in this browser; you can add one after.';
      keepAwake(true);
      const t0 = performance.now(), lim = r.spec.time;
      const iv = setInterval(() => {
        const sec = (performance.now() - t0) / 1000;
        const t = $('#recT'); if (t) { t.textContent = fmtSec(sec); t.classList.toggle('over', sec > lim); }
        const b = $('#recBar'); if (b) { b.style.width = Math.min(100, (sec / lim) * 100) + '%'; b.classList.toggle('over', sec > lim); }
      }, 250);
      addCleanup(() => clearInterval(iv));
    } catch (e) {
      Rec.cancel();
      markMicBlocked();
      r.mode = 'dictate'; lsSet('gr.mode', 'dictate');
      toast('Live mic isn\'t available here. Switched to dictation.', 3600);
      Sheet.render();
    }
  } else {
    btn.disabled = true;
    keepAwake(false);
    const out = await Rec.stop();
    runCleanups();
    if (!out || !out.blob || out.blob.size < 2000) { toast('That recording was empty. Try again.'); Sheet.render(); return; }
    analyzeRep({ transcript: out.transcript, source: 'mic', durationSec: out.durationSec, blob: out.blob });
  }
}

async function analyzeRep({ transcript, source, durationSec, blob, file, isVideo, useFrames }) {
  const r = S.rep;
  r.step = 'analyzing'; r.progress = 0; r.input = { transcript, source, durationSec, isVideo };
  Sheet.render();
  let au = null, frames = null;
  if (blob || file) {
    try {
      const buf = await A.decodeFile(blob || file);
      const mono = A.toMono(buf);
      au = await A.analyzeAudio(mono, (p) => { const el = $('#anaBar'); if (el) el.style.width = Math.round(p * 100) + '%'; });
    } catch (e) { au = { ok: false, reason: 'Couldn\'t read the audio in that file. Try an .m4a voice memo or a shorter clip.' }; }
    if (file && isVideo && useFrames && AI.ready && AI.imagesOk) { try { frames = (await A.videoFrames(file, 3)).frames; } catch (e) { frames = null; } }
  }
  if (!S.rep) return; // sheet closed meanwhile
  if (source === 'upload' && au && au.ok) durationSec = au.activeSpan;
  r.au = au; r.frames = frames; r.input.durationSec = durationSec;
  scoreRep(transcript, source, durationSec);
  r.step = 'result';
  r.coachState = 'idle'; r.coachErr = '';
  const words = r.ta ? r.ta.words : 0;
  r.autoCoach = AI.ready && Store.profile.settings.autoCoach && words >= 15;
  Sheet.render();
}
function scoreRep(transcript, source, durationSec) {
  const r = S.rep, p = Store.profile.settings;
  const au = r.au && r.au.ok ? r.au : null;
  const ta = transcript && transcript.trim() ? A.analyzeText(transcript, { source, durationSec }) : null;
  const sc = A.score(ta, au, { paceLo: p.paceLo, paceHi: p.paceHi, timeLimit: r.spec.time });
  if (source === 'typed') { delete sc.delivery; const v = ['clarity', 'concision', 'confidence', 'impact'].map((k) => sc[k]).filter((x) => x != null); sc.overall = v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; }
  r.ta = ta; r.sc = sc;
  const sp = r.spec;
  const sess = Object.assign(r.session || {}, {
    ts: (r.session && r.session.ts) || Date.now(), date: (r.session && r.session.date) || dkey(),
    kind: sp.kind, refId: sp.refId, title: sp.title, prompt: sp.prompt,
    spec: { kind: sp.kind, refId: sp.refId, title: sp.title, audience: sp.audience, situation: sp.situation || '', prompt: sp.prompt, criteria: sp.criteria || [], tip: sp.tip || '', time: sp.time, focus: sp.focus || [] },
    source, durationSec: durationSec ? Math.round(durationSec) : (au ? Math.round(au.activeSpan) : null),
    transcript: ta ? ta.text.slice(0, 20000) : '',
    metrics: ta ? { words: ta.words, wpm: sc.wpm, fillers: ta.fillers.total, fillersPerMin: ta.fillers.perMin, fillerTypes: ta.fillers.byType.slice(0, 6), hedges: ta.hedges.total, hedgesPer100: ta.hedges.per100, hedgeTypes: ta.hedges.byType.slice(0, 6), bluf: ta.bluf, numbers: ta.numbers, avgSentence: ta.avgSentence, weakEnd: ta.weakEnd, signposts: ta.signposts } : (au ? { words: 0, wpm: sc.wpm } : null),
    audio: au ? { activeSpan: au.activeSpan, estWpm: au.estWpm, pauses: au.pauses, pitch: { rangeSt: au.pitch.rangeSt, medianHz: au.pitch.medianHz }, upspeak: au.upspeak, volume: au.volume, wave: au.wave } : null,
    autoScores: { clarity: sc.clarity, concision: sc.concision, confidence: sc.confidence, delivery: sc.delivery, impact: sc.impact, overall: sc.overall },
    notes: sc.notes, attempt: r.attempt, prevId: r.prev ? r.prev.id : null, prevScore: r.prev && r.prev.scores ? r.prev.scores.overall : null,
  });
  sess.scores = blendScores(sess.autoScores, sess.coach && sess.coach.scores);
  r.session = Store.put('sessions', sess);
}
function blendScores(auto, coach) {
  const out = {};
  for (const d of C.DIMENSIONS) {
    const a = auto ? auto[d.id] : null, c = coach ? Number(coach[d.id]) : NaN;
    if (coach && coach[d.id] != null && !isNaN(c)) out[d.id] = a != null ? Math.round(d.id === 'delivery' ? 0.5 * a + 0.5 * c : 0.3 * a + 0.7 * c) : Math.round(c);
    else if (a != null) out[d.id] = a;
  }
  const v = C.DIMENSIONS.map((d) => out[d.id]).filter((x) => x != null);
  out.overall = v.length ? Math.round(v.reduce((x, y) => x + y, 0) / v.length) : null;
  return out;
}

function repAnalyzing() {
  return `<div class="stack-lg" style="align-items:center;text-align:center;padding-top:40px">
    <div class="thinking"><span class="dotpulse"><i></i><i></i><i></i></span>Listening back to your rep…</div>
    <div class="progress" style="max-width:320px"><i id="anaBar"></i></div>
    <p class="small muted">Measuring pace, pauses, pitch and word choice.</p></div>`;
}

/* Result rendering, shared by the live result and the history detail view */
function resultBody(sess, opts = {}) {
  const m = sess.metrics || {}, au = sess.audio, sc = sess.scores || {};
  const p = Store.profile.settings;
  const lim = sess.spec && sess.spec.time;
  const delta = sess.prevScore != null && sc.overall != null ? sc.overall - sess.prevScore : null;
  const wpmCls = m.wpm ? (m.wpm >= p.paceLo && m.wpm <= p.paceHi ? 'good' : Math.abs(m.wpm - (m.wpm < p.paceLo ? p.paceLo : p.paceHi)) <= 15 ? 'warn' : 'bad') : '';
  const fCls = m.fillersPerMin != null ? (m.fillersPerMin <= 2 ? 'good' : m.fillersPerMin <= 5 ? 'warn' : 'bad') : (m.fillers != null ? (m.fillers <= 1 ? 'good' : m.fillers <= 4 ? 'warn' : 'bad') : '');
  const kp = [];
  if (sess.durationSec) kp.push(['Time', fmtSec(sess.durationSec), lim ? `limit ${fmtSec(lim)}` : '', lim && sess.durationSec > lim * 1.15 ? 'bad' : '']);
  if (m.wpm) kp.push(['Pace', m.wpm, (m.words ? 'wpm' : 'wpm, estimated') + ` · target ${p.paceLo}–${p.paceHi}`, wpmCls]);
  if (m.words) kp.push(['Fillers', m.fillers, m.fillersPerMin != null ? `${m.fillersPerMin}/min${sess.source === 'dictation' ? ' (dictation)' : ''}` : `${m.words} words`, fCls]);
  if (m.words) kp.push(['Hedges', m.hedges, `${m.hedgesPer100} per 100 words`, m.hedges === 0 ? 'good' : m.hedgesPer100 <= 2 ? 'warn' : 'bad']);
  if (m.words) kp.push(['Answer first', m.bluf === true ? 'Yes' : m.bluf === false ? 'No' : '—', 'opening sentence', m.bluf === true ? 'good' : m.bluf === false ? 'bad' : '']);
  if (m.words) kp.push(['Numbers', m.numbers, 'specific figures', m.numbers ? 'good' : '']);
  if (au) {
    kp.push(['Pauses', au.pauses.deliberate, `${au.pauses.deliberatePerMin}/min deliberate`, au.pauses.deliberatePerMin >= 3 ? 'good' : 'warn']);
    if (au.pitch.rangeSt != null) kp.push(['Pitch range', au.pitch.rangeSt, 'semitones', au.pitch.rangeSt >= 6 ? 'good' : au.pitch.rangeSt >= 4 ? 'warn' : 'bad']);
    if (au.upspeak.pct != null) kp.push(['Rising ends', au.upspeak.pct + '%', 'of phrases', au.upspeak.pct <= 15 ? 'good' : au.upspeak.pct <= 30 ? 'warn' : 'bad']);
  }
  const ta = sess.transcript ? A.analyzeText(sess.transcript, { source: sess.source, durationSec: sess.durationSec }) : null;
  return `<div class="stack-lg">
    <div class="stack" style="gap:4px"><span class="eyebrow">${esc(kindLabel(sess.kind))}${sess.attempt > 1 ? ` · try ${sess.attempt}` : ''} · ${esc(fmtDate(sess.ts))}</span><h1 class="h2">${esc(sess.title)}</h1></div>
    <div class="card raised stack" style="align-items:center">
      <div style="width:100%;max-width:320px">${gauge(sc.overall, { label: sess.coach ? 'Presence score · coached' : 'Presence score', animate: opts.animate !== false })}</div>
      ${delta != null ? `<span class="delta ${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '+' : ''}${delta} vs last try</span>` : ''}
      <div style="width:100%">${bars(sc)}</div>
    </div>
    ${kp.length ? `<div class="kpis">${kp.map(([k, v, s, c]) => `<div class="kpi ${c}"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div><div class="s">${esc(s)}</div></div>`).join('')}</div>` : ''}
    ${au && au.wave ? `<div class="card stack" style="gap:6px"><span class="eyebrow">Your recording</span>${waveSvg(au.wave)}</div>` : ''}
    ${sess.notes && sess.notes.length ? `<div class="card stack"><span class="eyebrow">What the numbers say</span>${sess.notes.map((n) => `<div class="crit partly">${icon('target')}<span>${esc(n.text)}</span></div>`).join('')}</div>` : ''}
    ${opts.coachHtml != null ? opts.coachHtml : sess.coach ? coachCard(sess.coach) : ''}
    ${ta ? `<div class="card stack"><div class="row between"><span class="eyebrow">Transcript</span><div class="legend"><span><i style="background:var(--bad)"></i>Filler</span><span><i style="background:var(--warn)"></i>Hedge</span><span><i style="background:var(--good)"></i>Strong</span></div></div><div class="transcript">${A.highlight(ta)}</div></div>` : `<div class="note">${icon('info')}<span>No transcript, so content wasn't scored. Add one below to score clarity, concision, confidence and impact.</span></div>`}
    ${opts.editable ? `<details class="fold" ${ta ? '' : 'open'}><summary>${ta ? 'Fix the transcript and re-score' : 'Add a transcript'}${icon('chev')}</summary><div class="fold-body stack"><textarea class="input" id="reText" placeholder="Paste or dictate what you said">${esc(sess.transcript || '')}</textarea><button class="btn secondary" data-act="rescore">Re-score</button></div></details>` : ''}
  </div>`;
}
function coachCard(c) {
  return `<div class="card coach stack-lg">
    <div class="coach-head"><span class="badge">${icon('spark')}</span><span class="eyebrow">Coach's read</span></div>
    ${c.headline ? `<p class="headline">${esc(c.headline)}</p>` : ''}
    ${c.criteria && c.criteria.length ? `<div class="criteria">${c.criteria.map((x) => { const m = String(x.met).toLowerCase(); const k = m === 'yes' || m === 'true' ? 'yes' : m === 'partly' ? 'partly' : 'no'; return `<div class="crit ${k}">${icon(k)}<span>${esc(x.criterion)}</span></div>`; }).join('')}</div>` : ''}
    ${c.strengths && c.strengths.length ? `<div class="stack"><span class="eyebrow">Keep</span>${c.strengths.map((s) => `<div class="better">${esc(s)}</div>`).join('')}</div>` : ''}
    ${c.fixes && c.fixes.length ? `<div class="stack"><span class="eyebrow">Fix</span>${c.fixes.map((f) => `<div class="fix"><span class="issue">${esc(f.issue)}</span>${f.quote ? `<div class="quote">"${esc(f.quote)}"</div>` : ''}${f.why ? `<div class="small muted">${esc(f.why)}</div>` : ''}${f.try ? `<div class="better">${esc(f.try)}</div>` : ''}</div>`).join('')}</div>` : ''}
    ${c.rewrite ? `<div class="stack"><div class="row between"><span class="eyebrow">Executive version</span><button class="link" data-act="copy-rewrite">${icon('copy', '')} Copy</button></div><div class="better" id="rewriteText" style="font-size:15.5px;line-height:1.6">${esc(c.rewrite)}</div></div>` : ''}
    ${c.next_rep ? `<div class="note warn">${icon('target')}<span><b>Next try:</b> ${esc(c.next_rep)}</span></div>` : ''}
  </div>`;
}
function liveCoachHtml(r) {
  if (AI.state === 'off') return '';
  if (r.coachState === 'loading') return `<div class="card coach stack"><div class="coach-head"><span class="badge">${icon('spark')}</span><span class="eyebrow">Coach's read</span></div><div class="thinking"><span class="dotpulse"><i></i><i></i><i></i></span>Reviewing your rep against the brief…</div><div><button class="btn ghost sm" data-act="coach-stop">Stop</button></div></div>`;
  if (r.coachState === 'error') return `<div class="card coach stack"><div class="coach-head"><span class="badge">${icon('spark')}</span><span class="eyebrow">Coach's read</span></div><p class="muted">${esc(r.coachErr)}</p><div><button class="btn secondary sm" data-act="coach-run">${icon('refresh')}Retry</button></div></div>`;
  if (r.session && r.session.coach) return coachCard(r.session.coach);
  if (!r.ta || r.ta.words < 8) return '';
  return `<button class="btn deep block" data-act="coach-run">${icon('spark')}Get coach feedback</button>`;
}
function repResult(r) {
  const sess = r.session;
  return resultBody(sess, { coachHtml: liveCoachHtml(r), editable: true }) + `
    <div class="actions" style="margin-top:18px"><button class="btn" data-act="runback">${icon('refresh')}Run it back</button><button class="btn secondary" data-act="sheet-close">Done</button></div>
    <p class="small muted" style="margin-top:10px;text-align:center"><span class="xp-pop">+${sessionXp(sess)} XP</span> · saved to your history</p>`;
}

let coachCtl = null;
async function runCoach() {
  const r = S.rep;
  if (!r || !r.session || !AI.ready) return;
  r.coachState = 'loading'; Sheet.render(true);
  coachCtl = new AbortController();
  const sess = r.session;
  try {
    const prompt = AI.feedbackPrompt(Store.profile, r.spec, { transcript: sess.transcript, source: sess.source, metrics: Object.assign({ durationSec: sess.durationSec }, sess.metrics || {}), audio: r.au, attempt: r.attempt, prevScore: sess.prevScore, hasImages: !!(r.frames && r.frames.length) });
    const opts = { signal: coachCtl.signal, modelTier: 'default' };
    if (r.frames && r.frames.length) opts.images = r.frames.map((f) => f.blob);
    const res = await AI.json(prompt, opts);
    if (!res || typeof res !== 'object') throw { code: 'invalid_json' };
    const coach = normalizeCoach(res);
    if (!S.rep || S.rep.session !== sess) return;
    sess.coach = coach;
    sess.scores = blendScores(sess.autoScores, coach.scores);
    r.session = Store.put('sessions', sess);
    r.coachState = 'done';
  } catch (e) {
    if (!S.rep) return;
    r.coachState = e && e.code === 'cancelled' ? 'idle' : 'error';
    r.coachErr = AI.errorText(e);
  }
  coachCtl = null;
  if (S.sheet && S.sheet.type === 'rep') Sheet.render(true);
}
function normalizeCoach(res) {
  const num = (v) => (v == null || v === '' || isNaN(Number(v)) ? null : A.clamp(Math.round(Number(v)), 0, 100));
  const sc = res.scores || {};
  const arr = (a) => (Array.isArray(a) ? a : []);
  return {
    headline: String(res.headline || ''),
    scores: { clarity: num(sc.clarity), concision: num(sc.concision), confidence: num(sc.confidence), delivery: num(sc.delivery), impact: num(sc.impact), composure: num(sc.composure) },
    criteria: arr(res.criteria).slice(0, 6).map((c) => ({ criterion: String(c.criterion || ''), met: String(c.met || 'no') })),
    strengths: arr(res.strengths).slice(0, 2).map(String),
    fixes: arr(res.fixes).slice(0, 3).map((f) => ({ issue: String(f.issue || ''), quote: String(f.quote || ''), why: String(f.why || ''), try: String(f.try || '') })),
    rewrite: String(res.rewrite || ''),
    next_rep: String(res.next_rep || ''),
    skills: arr(res.skills).filter((s) => C.skill(s.id)).slice(0, 5).map((s) => ({ id: s.id, rating: A.clamp(Number(s.rating) || 3, 1, 5) })),
  };
}

/* Session detail sheet (history) */
SHEETS.session = {
  render(sh) {
    const s = Store.sessions.find((x) => x.id === sh.id);
    if (!s) return { title: 'Session', body: '<p class="muted">This session was deleted.</p>' };
    if (s.kind === 'spar') return { title: s.title, body: sparDebriefBody(s) + sessionFooter(s) };
    if (s.kind === 'visual') return { title: s.title, body: visualResultBody(s.coach, s) + sessionFooter(s) };
    if (s.kind === 'drill') return { title: s.title, body: `<div class="stack"><span class="eyebrow">Drill · ${esc(fmtDate(s.ts))}</span><h1 class="h2">${esc(s.title)}</h1><p class="muted">${esc(s.minutes || 2)} minutes.</p></div>` + sessionFooter(s) };
    return { title: s.title, body: resultBody(s, { animate: true }) + sessionFooter(s) };
  },
};
function sessionFooter(s) {
  const again = s.spec ? `<button class="btn" data-act="again" data-id="${s.id}">${icon('refresh')}Practice again</button>` : '';
  return `<div class="actions" style="margin-top:18px">${again}<span id="delZone" style="display:contents"><button class="btn danger" data-act="del1" data-id="${s.id}">${icon('trash')}Delete</button></span></div>`;
}
