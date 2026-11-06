/* ============================================================
   Green Room — AI coach (Claude via the artifact's sample capability)
   Every prompt is built around the person's development plan.
   ============================================================ */
const AI = (() => {
  let fn = null;
  let state = 'starting'; // starting | ready | off
  let imagesOk = false;
  const subs = new Set();
  const emit = () => subs.forEach((f) => { try { f(); } catch (e) { console.error(e); } });
  const PERMANENT = ['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'];

  async function init() {
    try { if (window.claude && typeof window.claude.use === 'function') fn = await window.claude.use('sample'); } catch (e) { fn = null; }
    state = fn ? 'ready' : 'off';
    if (fn) { try { const lim = await fn.limits(); imagesOk = !!(lim && lim.images); } catch (e) { imagesOk = false; } }
    emit();
  }
  function fail(e) { if (e && PERMANENT.includes(e.code)) { state = 'off'; emit(); } throw e; }
  async function json(prompt, opts = {}) {
    if (!fn) throw { code: 'unavailable', message: 'Claude is not available here.' };
    try { return await fn.json(prompt, opts); } catch (e) { return fail(e); }
  }
  async function text(input, opts = {}) {
    if (!fn) throw { code: 'unavailable', message: 'Claude is not available here.' };
    try { return await fn(input, opts); } catch (e) { return fail(e); }
  }
  function errorText(e) {
    const c = e && e.code;
    if (c === 'cancelled') return '';
    if (c === 'not_granted') return 'The coach needs permission to use Claude. You can allow it from this page\'s Permissions menu.';
    if (['sampling_disabled', 'unavailable', 'not_declared', 'capability_disabled', 'capability_removed'].includes(c)) return 'The AI coach isn\'t available in this view. Your scores still work.';
    if (c === 'rate_limited') return 'You\'ve hit a usage limit for now. Try again in a little while.';
    if (c === 'session_expired') return 'Your Claude session expired. Sign in again, then retry.';
    if (c === 'invalid_json') return 'The coach\'s answer came back garbled. Tap retry.';
    if (c === 'refused') return 'The coach couldn\'t respond to that. Try rephrasing.';
    if (c === 'prompt_too_large') return 'That\'s too long for one review. Try a shorter excerpt.';
    if (c === 'image_rejected' || c === 'images_unavailable') return 'That image couldn\'t be used. Try a different photo.';
    return 'The coach didn\'t answer. Check your connection and retry.';
  }

  /* ---------------- The plan, as context ---------------- */
  const f1 = (v) => (v == null ? '?' : Number(v).toFixed(1).replace(/\.0$/, ''));
  function planOf(p) { return Object.assign({}, C.DEFAULT_PLAN, p.plan || {}); }
  function who(p) {
    const pl = planOf(p);
    const dims = C.DIMENSIONS.map((d) => `- ${d.name}: baseline ${f1(pl.baseline[d.id])}, target ${f1(pl.target[d.id])}`).join('\n');
    const areas = C.AREAS.map((a) => {
      const t = (pl.tendencies && pl.tendencies[a.id]) || [];
      return `${a.id}. ${a.title}${a.id === p.objective ? ' (THIS WEEK\'S OBJECTIVE)' : ''}\n   Current tendency: ${t.length ? t.join('; ') : 'not specified'}\n   Desired behavior: ${a.desired.join('; ')}`;
    }).join('\n');
    const str = (pl.strengths || []).map((s) => `- ${s.title}: ${(s.points || []).join('; ')}`).join('\n');
    return `ABOUT THE PERSON YOU COACH
${p.name || 'The client'}${p.role ? ', ' + p.role : ''}. Usual audiences: ${p.audiences || 'senior executives'}.
North Star: ${pl.north}
${pl.goal}
Overall executive presence: baseline ${f1(pl.overall.baseline)}/10, target ${f1(pl.overall.target)}/10.
Dimensions (1-10):
${dims}
${str ? 'Established strengths:\n' + str + '\n' : ''}Development areas:
${areas}
Their communication framework: HEADLINE (central point) → STRUCTURE (two or three supporting arguments) → IMPLICATION (why it matters) → ACTION (what happens next). Rules: three points maximum; two-sentence executive summary; one clear recommendation; one explicit next action.
Executive language they are building: "My recommendation is…", "The fundamental issue is…", "There are two considerations here.", "The strategic implication is…", "I would distinguish between…", "The decision we need to make is…", "I would prioritize…", "The risk I would focus on is…". Language they are dropping: "I think maybe we should consider…", "One thing I was thinking about…", "I'm not sure if this makes sense…".
The path: Stage 1 Strong Analyst → Stage 2 Strategic Business Leader → Stage 3 Executive. The goal is Stage 3.
The standard is not how intelligent they sound. It is whether people leave with greater clarity, confidence in the direction, and an understanding of what needs to happen.`;
  }

  const COACH_VOICE = `You are an elite executive-presence coach who has prepared CEOs for boards, investor days and hostile Q&A. Be direct, specific and warm. Quote their exact words when you point out an issue and always show the executive version. One high-leverage fix beats five small ones. Don't try to change their personality; sharpen how their thinking comes across. No filler, no generic advice, no unearned praise.`;
  const SCALE = `Scores are 1-10 with one decimal, calibrated to their plan: 7.0 is their current baseline (a strong analyst: rigorous, but builds to the point and hedges); 8.5 is their target (sounds like an executive); 9+ is C-suite or board level; 5 or below undermines credibility.`;
  const DIM_IDS = C.DIMENSIONS.map((d) => `"${d.id}"`).join(', ');

  function metricsBlock(m) {
    if (!m) return 'No measurements.';
    const L = [];
    L.push(`Words: ${m.words}${m.durationSec ? `; duration ${Math.round(m.durationSec)}s` : ''}${m.wpm ? `; pace ${m.wpm} wpm` : ''}`);
    L.push(`Fillers: ${m.fillers}${m.fillerTypes && m.fillerTypes.length ? ' (' + m.fillerTypes.map((x) => `${x.label} ×${x.n}`).join(', ') + ')' : ''}`);
    L.push(`Hedges: ${m.hedges}${m.hedgeTypes && m.hedgeTypes.length ? ' (' + m.hedgeTypes.map((x) => `${x.label} ×${x.n}`).join(', ') + ')' : ''}`);
    if (m.hsia) L.push(`Automatic framework check: headline ${m.hsia.headline ? 'yes' : 'no'}, structure ${m.hsia.structure ? 'yes' : 'no'}, implication ${m.hsia.implication ? 'yes' : 'no'}, action ${m.hsia.action ? 'yes' : 'no'}`);
    L.push(`Numbers used: ${m.numbers}; average sentence ${m.avgSentence} words${m.weakEnd ? `; weak ending "${m.weakEnd}"` : ''}`);
    return L.join('\n');
  }
  function audioBlock(a) {
    if (!a || !a.ok) return '';
    return `Acoustic measurements: speaking span ${a.activeSpan}s; estimated pace ${a.estWpm || 'n/a'} wpm; ${a.pauses.deliberate} deliberate pauses (${a.pauses.deliberatePerMin}/min), ${a.pauses.long} long gaps; pitch range ${a.pitch.rangeSt ?? 'n/a'} semitones (under 4 is flat); rising endings on ${a.upspeak.pct ?? 'n/a'}% of phrases; volume trails off on ${a.volume.trailOffPct}% of phrases.`;
  }
  function captureNote(source) {
    if (source === 'dictation') return 'Captured with phone dictation, which deletes most "um"s: filler counts are a floor. Pace is approximate.';
    if (source === 'typed') return 'Typed, not spoken: don\'t judge vocal delivery; set "confidence" from wording only.';
    if (source === 'mic') return 'Captured live with speech recognition; ignore small recognition errors and missing punctuation.';
    if (source === 'upload') return 'Captured from an uploaded recording; the transcript (if any) was pasted by them.';
    return '';
  }
  const HSIA_JSON = `"hsia": {"headline": {"met": true|false, "note": "max 12 words"}, "structure": {...}, "implication": {...}, "action": {...}}`;

  /* ---------------- Rep feedback ---------------- */
  function feedbackPrompt(p, spec, rec) {
    return `${COACH_VOICE}

${who(p)}

THE REP
Exercise: ${spec.title}
Audience: ${spec.audience || 'senior executives'}
Situation: ${spec.situation || '—'}
Task: ${spec.prompt}
Time limit: ${spec.time ? spec.time + ' seconds' : 'none'}
Success criteria:
${(spec.criteria || []).map((c) => '- ' + c).join('\n') || '- Headline, structure, implication, action'}
${rec.attempt > 1 ? `Attempt ${rec.attempt}. Previous attempt scored ${rec.prevScore != null ? f1(rec.prevScore / 10) : 'n/a'}/10. Say briefly what improved.` : ''}

HOW IT WAS CAPTURED
${captureNote(rec.source)}

MEASUREMENTS
${metricsBlock(rec.metrics)}
${audioBlock(rec.audio)}
${rec.hasImages ? 'Also attached: still frames from their video. Include one note on presence (posture, eye line, energy) if it matters.' : ''}

TRANSCRIPT
"""
${String(rec.transcript || '').slice(0, 12000)}
"""

${SCALE}

Reply with only a JSON object in exactly this shape:
{
  "headline": "one-sentence verdict, max 18 words",
  "scores": {"framing": 1-10, "clarity": 1-10, "concision": 1-10, "assertive": 1-10, "confidence": 1-10, "decision": 1-10, "stakeholder": 1-10 or null, "commercial": 1-10 or null},
  ${HSIA_JSON},
  "stage": 1 | 2 | 3,
  "criteria": [{"criterion": "copy each success criterion", "met": "yes" | "partly" | "no"}],
  "strengths": ["max 2 specific strengths, max 20 words each"],
  "fixes": [{"area": "A"|"B"|"C"|"D"|"E", "issue": "2-5 word label", "quote": "their exact words, or empty", "why": "max 20 words", "try": "the exact executive wording to use instead"}],
  "summary2": "their answer as a two-sentence executive summary",
  "rewrite": "the executive version, spoken in their voice, in Headline → Structure → Implication → Action order; same facts (light placeholders like [X] allowed, invent nothing); about 60% of their words",
  "next_rep": "one behavioral instruction for the immediate retry, max 25 words"
}
Rules: "stage" is which stage this answer sounds like (1 Strong Analyst, 2 Strategic Business Leader, 3 Executive). Max 3 fixes, highest impact first, each tagged with the development area it belongs to. Score "stakeholder" and "commercial" only if the rep clearly shows them, otherwise null.`;
  }

  /* ---------------- Sparring ---------------- */
  function sparRules(p, persona, ctx, difficulty, rounds) {
    return `ROLE-PLAY FOR SPEAKING PRACTICE. Stay in character for the whole conversation.

You are ${persona.name}, ${persona.role}. Style: ${persona.style}
You're speaking with ${p.name || 'a senior leader'}${p.role ? ', ' + p.role : ''}.
Scenario: ${ctx}
Difficulty: ${C.DIFFICULTY[difficulty] || C.DIFFICULTY.tough}

Rules:
- Speak as you would out loud in the room: one turn at a time, max 50 words, no stage directions, no lists, no markdown.
- Ask one question or make one move per turn. React to their last answer first in a few words when it's natural.
- If they bury the conclusion, hedge, ramble or present analysis without a recommendation, react the way a real ${persona.role} would: interrupt, ask for the bottom line, ask what they recommend, or press for the number.
- If they lead well (clear headline, a recommendation, a decision with an owner), let it land and move on to the next hard question.
- Build on what they actually said; don't run a script.
- There will be ${rounds} turns from you in total. After their final answer, give a one-sentence in-character reaction and end with the exact token [END].
- Their answers are transcribed speech: ignore small transcription errors.`;
  }
  function sparTurns(rules, convo, isLast) {
    const turns = [{ role: 'user', content: rules + '\n\nBegin now with your opening line and first question.' }];
    for (const t of convo) turns.push({ role: t.role === 'me' ? 'user' : 'assistant', content: t.content || '…' });
    if (isLast) turns[turns.length - 1] = { role: 'user', content: turns[turns.length - 1].content + '\n\n(That was the final answer. React in character in one sentence, then end with [END].)' };
    return turns;
  }
  function debriefPrompt(p, persona, ctx, convo) {
    const transcript = convo.map((t) => `${t.role === 'me' ? (p.name || 'Candidate') : persona.name}: ${t.content}${t.role === 'me' && t.metrics ? `   [${t.metrics.secs ? t.metrics.secs + 's, ' : ''}${t.metrics.words} words, ${t.metrics.fillers} fillers, ${t.metrics.hedges} hedges]` : ''}`).join('\n');
    return `${COACH_VOICE}

${who(p)}

They just finished a role-play with "${persona.name}" (${persona.role}). Scenario: ${ctx}
Answers were spoken and transcribed (or typed); bracketed numbers are measurements of each answer.

CONVERSATION
${transcript.slice(0, 30000)}

${SCALE}

Debrief them. Reply with only a JSON object in exactly this shape:
{
  "headline": "one-sentence verdict, max 18 words",
  "scores": {"framing": 1-10, "clarity": 1-10, "concision": 1-10, "assertive": 1-10, "confidence": 1-10, "decision": 1-10, "stakeholder": 1-10, "commercial": 1-10 or null},
  "stage": 1 | 2 | 3,
  "moments": [{"question": "their question, shortened", "verdict": "strong" | "ok" | "weak", "note": "max 20 words", "better": "for ok/weak: a stronger answer in max 45 words, in their voice, headline first; empty for strong"}],
  "strengths": ["max 2"],
  "patterns": ["max 2 patterns across answers, tied to their development areas"],
  "next_focus": "the one behavior to practice next, max 25 words"
}
One "moments" entry per question asked. "stage" is which stage they sounded like overall.`;
  }

  /* ---------------- Meeting review (Section 6 scorecard) ---------------- */
  function meetingPrompt(p, m, prev) {
    return `${COACH_VOICE}

${who(p)}

Review this real meeting against their Meeting Performance Scorecard.
Meeting type: ${C.mtype(m.type).name}
Meeting: ${m.title}
What they wanted from it: ${m.goal || 'not stated'}
${prev ? `Their previous meeting of this type scored ${f1(prev.overall / 10)}/10; the adjustment they set then was: "${prev.adjustment || '—'}". Say whether they made it.` : ''}

TRANSCRIPT OR NOTES (focus on ${p.name || 'their'} contributions; others may appear)
"""
${String(m.transcript).slice(0, 60000)}
"""

${SCALE}

Reply with only a JSON object in exactly this shape:
{
  "overall": 1-10,
  "assessment": "the overall assessment in 2-3 sentences",
  "scorecard": {"opening": 1-10, "framing": 1-10, "clarity": 1-10, "concision": 1-10, "confidence": 1-10, "judgment": 1-10, "influence": 1-10, "leadership": 1-10, "closing": 1-10},
  "dims": {${DIM_IDS.split(', ').map((d) => `${d}: 1-10`).join(', ')}},
  "stage": 1 | 2 | 3,
  "worked": ["max 3, specific"],
  "didnt": ["max 3, specific"],
  "examples": [{"quote": "their exact words from the transcript", "issue": "what was wrong, max 15 words", "executive": "what an executive-level version would sound like"}],
  "executive_version": "how their most important intervention would sound at executive level, in Headline → Structure → Implication → Action order",
  "patterns": ["recurring communication habits seen here, tied to development areas A-E, max 3"],
  "adjustment": "ONE behavioral adjustment for the next meeting, max 20 words",
  "objective_area": "A" | "B" | "C" | "D" | "E"
}
Give 2-4 examples. Use only what the transcript shows; if their part is thin, say so in the assessment and score conservatively.`;
  }

  /* ---------------- Plan update ---------------- */
  function planPrompt(p, textIn) {
    return `You are an executive coach updating a client's development plan from a new assessment (it may be coaching notes, a 360, review comments or a meeting debrief).

Their current plan for reference:
${who(p)}

NEW ASSESSMENT
"""
${String(textIn).slice(0, 60000)}
"""

Reply with only a JSON object in exactly this shape:
{
  "summary": "two sentences: how they come across now and the biggest unlock",
  "baseline": {${DIM_IDS.split(', ').map((d) => `${d}: 1-10 or null`).join(', ')}},
  "overall": 1-10 or null,
  "strengths": [{"title": "short title", "points": ["max 4 short points"]}],
  "tendencies": {"A": ["current tendency, short"], "B": [], "C": [], "D": [], "E": []},
  "objective_area": "A" | "B" | "C" | "D" | "E"
}
Only set a baseline score where the assessment supports one; otherwise null. Keep their wording where you can.`;
  }

  /* ---------------- Meeting prep (Before) ---------------- */
  function prepPrompt(p, f) {
    return `${COACH_VOICE}

${who(p)}

Build their prep for an upcoming meeting, following their "Before" routine: intended outcome, central message, three supporting points, difficult questions, and the decision or action required.

Meeting: ${f.title}
Audience: ${f.audience}
Time they'll have: ${f.time || 'unknown'}
Intended outcome (what they want decided or done): ${f.objective}
Key facts and numbers: ${f.facts || 'none given'}
What worries them: ${f.worries || 'nothing given'}

Reply with only a JSON object in exactly this shape:
{
  "key_message": "the central message in one sentence, max 25 words",
  "summary2": "a two-sentence executive summary they could open with",
  "opening": "their first two sentences, verbatim, headline first",
  "points": [{"point": "supporting point, max 15 words", "proof": "the fact or number that proves it"}],
  "implication": "the strategic implication, one sentence",
  "questions": [{"q": "a difficult question this audience is likely to ask", "a": "a strong answer, max 45 words, headline first"}],
  "ask": "the decision or action required, verbatim",
  "close": "a closing line that confirms decisions, owners and dates",
  "watch_outs": ["2 reminders tied to their development areas, max 15 words each"]
}
Exactly 3 points and 4 questions. Use only the facts given; write [number] where a figure is missing.`;
  }

  function sharpenPrompt(p, textIn, audience, mode) {
    return `${COACH_VOICE}

${who(p)}

Rewrite the text below so it sounds like a confident senior executive ${mode === 'spoken' ? 'saying it out loud' : 'writing it'}, for this audience: ${audience}. Use their framework: headline first, two or three supporting points, the implication, then the action. Use their executive phrases where natural. Cut hedges, fillers and throat-clearing. Keep every fact; invent none. Keep their voice; don't make it pompous.

TEXT
"""
${String(textIn).slice(0, 15000)}
"""

Reply with only a JSON object: {"sharpened": "the rewrite", "summary2": "a two-sentence executive summary", "changes": ["the 3 most important changes, max 15 words each"]}`;
  }

  function hsiaPrompt(p, kase, fld) {
    return `${COACH_VOICE}

${who(p)}

They are practicing the Headline → Structure → Implication → Action framework on this case.
Case: ${kase.title}. Audience: ${kase.audience}.
Raw notes they were given:
${kase.notes.map((n) => '- ' + n).join('\n')}

Their answer:
HEADLINE: ${fld.headline}
STRUCTURE: ${fld.structure.filter(Boolean).map((x, i) => `(${i + 1}) ${x}`).join(' ')}
IMPLICATION: ${fld.implication}
ACTION: ${fld.action}

${SCALE}

Reply with only a JSON object:
{"score": 1-10, "verdict": "one sentence, max 18 words", "parts": {"headline": {"score": 1-10, "note": "max 15 words"}, "structure": {...}, "implication": {...}, "action": {...}}, "model": {"headline": "...", "structure": ["...", "..."], "implication": "...", "action": "..."}, "summary2": "the case as a two-sentence executive summary"}`;
  }

  function visualPrompt(p, context, n) {
    return `You are an executive presence coach reviewing how a senior leader comes across visually. ${n > 1 ? `The ${n} attached images are frames from one video` : 'The attached image is a photo'} of them in this setting: ${context}.
They are ${p.role || 'a senior leader'} working toward executive-level presence.

Judge only what is visible: posture, eye line and camera angle, framing, lighting, facial expression and energy, attire and background polish. Be specific about what to change. Don't comment on physical features a person can't or shouldn't change.

Reply with only a JSON object:
{"headline": "one-sentence verdict, max 18 words", "scores": {"posture": 1-10, "eye_line": 1-10, "framing": 1-10, "lighting": 1-10, "expression": 1-10, "polish": 1-10}, "keep": ["max 2"], "fixes": [{"issue": "2-5 word label", "try": "a specific change"}]}
Max 4 fixes, highest impact first.`;
  }

  function reviewPrompt(p, summary) {
    return `${COACH_VOICE}

${who(p)}

Their practice and meeting data for the last 7 days, with the 7 days before for comparison (scores are 0-100; divide by 10 for the 1-10 scale):
${summary}

Write their weekly review in the spirit of their "After" routine: identify patterns, compare against before, set one improvement objective. Reply with only a JSON object:
{
  "headline": "one-sentence summary of the week, max 18 words",
  "wins": ["max 3 specific wins backed by the data"],
  "patterns": ["max 3 patterns to work on, backed by the data"],
  "focus": {"area": "A" | "B" | "C" | "D" | "E", "why": "max 25 words", "drill": "a daily 5-minute drill for this week, max 30 words"},
  "challenge": "one real-world challenge for a meeting this week, max 25 words",
  "stage_note": "one sentence on progress toward their target and the next stage"
}
If there was little practice, say so plainly and make the focus about consistency.`;
  }

  return {
    init, json, text, errorText,
    get state() { return state; }, get ready() { return state === 'ready'; }, get imagesOk() { return imagesOk; },
    on: (f) => { subs.add(f); return () => subs.delete(f); },
    feedbackPrompt, sparRules, sparTurns, debriefPrompt, meetingPrompt, planPrompt, prepPrompt, sharpenPrompt, hsiaPrompt, visualPrompt, reviewPrompt,
  };
})();
