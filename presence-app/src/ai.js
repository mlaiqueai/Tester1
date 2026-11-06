/* ============================================================
   Green Room — AI coach (Claude via the artifact's sample capability)
   ============================================================ */
const AI = (() => {
  let fn = null;
  let state = 'starting'; // starting | ready | off
  let imagesOk = false;
  const subs = new Set();
  const emit = () => subs.forEach((f) => { try { f(); } catch (e) { console.error(e); } });
  const PERMANENT = ['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'];

  async function init() {
    try {
      if (window.claude && typeof window.claude.use === 'function') fn = await window.claude.use('sample');
    } catch (e) { fn = null; }
    state = fn ? 'ready' : 'off';
    if (fn) { try { const lim = await fn.limits(); imagesOk = !!(lim && lim.images); } catch (e) { imagesOk = false; } }
    emit();
  }

  function fail(e) {
    if (e && PERMANENT.includes(e.code)) { state = 'off'; emit(); }
    throw e;
  }
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
    if (c === 'sampling_disabled' || c === 'unavailable' || c === 'not_declared' || c === 'capability_disabled' || c === 'capability_removed') return 'The AI coach isn\'t available in this view. Your scores and notes still work.';
    if (c === 'rate_limited') return 'You\'ve hit a usage limit for now. Try again in a little while.';
    if (c === 'session_expired') return 'Your Claude session expired. Sign in again, then retry.';
    if (c === 'invalid_json') return 'The coach\'s answer came back garbled. Tap retry.';
    if (c === 'refused') return 'The coach couldn\'t respond to that. Try rephrasing.';
    if (c === 'prompt_too_large') return 'That\'s too long for one review. Try a shorter excerpt.';
    if (c === 'image_rejected' || c === 'images_unavailable') return 'That image couldn\'t be used. Try a different photo.';
    return 'The coach didn\'t answer. Check your connection and retry.';
  }

  /* ---------------- Prompt building blocks ---------------- */
  function who(p) {
    const focus = (p.focus || []).map((id) => C.skill(id)).filter(Boolean)
      .map((s) => `- ${s.name}${p.ratings && p.ratings[s.id] ? ` (self-rated ${p.ratings[s.id]}/5)` : ''}: ${s.good}`).join('\n');
    let ev = '';
    if (p.evaluation && p.evaluation.summary) {
      ev = `\nFrom their executive presence evaluation: ${p.evaluation.summary}`;
      if (p.evaluation.areas && p.evaluation.areas.length) ev += '\nDevelopment areas named in it: ' + p.evaluation.areas.map((a) => `${(C.skill(a.skill) || {}).name || a.skill}${a.evidence ? ` ("${a.evidence}")` : ''}`).join('; ');
    }
    return `ABOUT THE PERSON YOU COACH
Name: ${p.name || 'the client'}. Role: ${p.role || 'senior leader'}.
Usual audiences: ${p.audiences || 'senior executives'}.
Their goal: ${p.goal || 'stronger executive presence'}.
Current development focus:
${focus || '- General executive presence'}${ev}`;
  }

  const COACH_VOICE = `You are an elite executive-presence and speech coach who has prepared CEOs for boards, investor days and hostile Q&A. You are direct, specific and warm. You quote the person's exact words when you point out an issue, and you always show the better version. One high-leverage fix beats five small ones. No filler, no generic advice, no praise that isn't earned.`;

  const SCALE = `Score calibration (0-100): 90+ would impress a Fortune 500 board; 80 is a strong VP; 70 is a solid senior manager; 60 is competent but forgettable; below 50 undermines credibility.`;

  function metricsBlock(m) {
    if (!m) return 'No measurements.';
    const L = [];
    L.push(`Words: ${m.words}${m.durationSec ? `; duration ${Math.round(m.durationSec)}s` : ''}${m.wpm ? `; pace ${m.wpm} wpm` : ''}`);
    L.push(`Fillers: ${m.fillers}${m.fillerTypes && m.fillerTypes.length ? ' (' + m.fillerTypes.map((x) => `${x.label} ×${x.n}`).join(', ') + ')' : ''}`);
    L.push(`Hedges: ${m.hedges}${m.hedgeTypes && m.hedgeTypes.length ? ' (' + m.hedgeTypes.map((x) => `${x.label} ×${x.n}`).join(', ') + ')' : ''}`);
    L.push(`Answer-first check on the opening sentence: ${m.bluf === true ? 'looks like it leads with the answer' : m.bluf === false ? 'opens with set-up rather than the answer' : 'unclear'}`);
    L.push(`Numbers used: ${m.numbers}; average sentence length: ${m.avgSentence} words${m.weakEnd ? `; weak ending: "${m.weakEnd}"` : ''}`);
    return L.join('\n');
  }
  function audioBlock(a) {
    if (!a || !a.ok) return '';
    return `Acoustic measurements from the recording:
- Speaking span ${a.activeSpan}s; estimated pace ${a.estWpm || 'n/a'} wpm
- Pauses: ${a.pauses.deliberate} deliberate (0.6–2s), ${a.pauses.long} long gaps (2s+), ${a.pauses.deliberatePerMin}/min
- Pitch range ${a.pitch.rangeSt ?? 'n/a'} semitones (under 4 sounds flat; 6+ is expressive)
- Rising endings on ${a.upspeak.pct ?? 'n/a'}% of phrases (upspeak; under 15% is good)
- Volume trails off at the end of ${a.volume.trailOffPct}% of phrases`;
  }
  function captureNote(source) {
    if (source === 'dictation') return 'Captured with phone dictation: dictation usually deletes "um" and "uh", so filler counts are a floor, not the truth. Pace is approximate.';
    if (source === 'typed') return 'This answer was typed, not spoken: do not judge vocal delivery. Set delivery to null.';
    if (source === 'mic') return 'Captured live from the microphone with speech recognition; the transcript may have small recognition errors and no punctuation. Don\'t penalize recognition mistakes.';
    if (source === 'upload') return 'Captured from an uploaded recording. The transcript (if any) was pasted by the user.';
    return '';
  }

  /* ---------------- Rep feedback ---------------- */
  function feedbackPrompt(p, spec, rec) {
    const skills = C.SKILLS.map((s) => s.id).join(', ');
    return `${COACH_VOICE}

${who(p)}

THE REP
Exercise: ${spec.title}
Audience: ${spec.audience || 'senior executives'}
Situation: ${spec.situation || '—'}
Task: ${spec.prompt}
Time limit: ${spec.time ? spec.time + ' seconds' : 'none'}
Success criteria:
${(spec.criteria || []).map((c) => '- ' + c).join('\n') || '- Clear, concise, confident'}
${rec.attempt > 1 ? `This is attempt ${rec.attempt}. Previous attempt scored ${rec.prevScore ?? 'n/a'}. Comment briefly on what improved or didn't.` : ''}

HOW IT WAS CAPTURED
${captureNote(rec.source)}

MEASUREMENTS
${metricsBlock(rec.metrics)}
${audioBlock(rec.audio)}
${rec.hasImages ? 'Also attached: still frames from their video. Include one note on body language, eye line, framing or setting in "fixes" or "strengths" if it matters.' : ''}

TRANSCRIPT
"""
${String(rec.transcript || '').slice(0, 12000)}
"""

${SCALE}

Reply with only a JSON object in exactly this shape:
{
  "headline": "one-sentence verdict, max 18 words",
  "scores": {"clarity": 0-100, "concision": 0-100, "confidence": 0-100, "delivery": 0-100 or null, "impact": 0-100, "composure": 0-100 or null},
  "criteria": [{"criterion": "copy each success criterion", "met": "yes" | "partly" | "no"}],
  "strengths": ["max 2 specific strengths, each max 20 words"],
  "fixes": [{"issue": "2-5 word label", "quote": "their exact words, or empty", "why": "max 20 words", "try": "the exact words or behavior to use instead"}],
  "rewrite": "an executive version of their answer: same facts (invent nothing beyond light placeholders like [X]), answer first, about 60% of the words, written to be spoken in their voice",
  "next_rep": "one specific instruction for the immediate retry, max 25 words",
  "skills": [{"id": "one of: ${skills}", "rating": 1-5}]
}
Rules: max 3 fixes, ordered by impact. Composure is null unless the task involves pressure, pushback or a hard question. "skills" lists only skills clearly shown in this rep (max 5).`;
  }

  /* ---------------- Sparring ---------------- */
  function sparRules(p, persona, ctx, difficulty, rounds) {
    return `ROLE-PLAY FOR SPEAKING PRACTICE. Stay in character for the whole conversation.

You are ${persona.name}, ${persona.role}. Style: ${persona.style}
The person you're speaking with: ${p.name || 'the candidate'}, ${p.role || 'a senior leader'}.
Scenario: ${ctx}
Difficulty: ${C.DIFFICULTY[difficulty] || C.DIFFICULTY.tough}

Rules:
- Speak as you would out loud in the room: one turn at a time, max 45 words, no stage directions, no lists, no markdown.
- Ask exactly one question per turn. React to their last answer first in a few words when it's natural ("That's a big claim." / "Fine." / "Let me stop you there.").
- If an answer is vague, long or dodges the question, press on it the way a real ${persona.role} would: ask for the number, the decision, or the risk.
- Build on what they actually said; don't run through a script.
- There will be ${rounds} questions in total. On the final turn, after their last answer, give a one-sentence in-character reaction and end with the exact token [END].
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
  "scores": {"clarity": 0-100, "concision": 0-100, "confidence": 0-100, "delivery": 0-100 or null, "impact": 0-100, "composure": 0-100},
  "moments": [{"question": "the question, shortened", "verdict": "strong" | "ok" | "weak", "note": "max 20 words on what worked or didn't", "better": "for ok/weak answers: a stronger answer in max 45 words, in their voice; empty for strong"}],
  "strengths": ["max 2"],
  "patterns": ["max 2 patterns across answers, e.g. 'Buries the number at the end'"],
  "next_focus": "the one thing to practice next, max 25 words",
  "skills": [{"id": "skill id from: ${C.SKILLS.map((s) => s.id).join(', ')}", "rating": 1-5}]
}
One "moments" entry per question asked. Set delivery to null if the answers were typed.`;
  }

  /* ---------------- Evaluation import ---------------- */
  function evaluationPrompt(p, textIn) {
    return `You are an executive coach reading a client's executive presence evaluation (it may be a 360 report, a coach's assessment, performance review notes or self-reflection).

Client: ${p.name || 'the client'}, ${p.role || ''}.

Map what it says onto this skills framework (use these ids exactly):
${C.SKILLS.map((s) => `- ${s.id}: ${s.name} (${s.good})`).join('\n')}

EVALUATION TEXT
"""
${String(textIn).slice(0, 60000)}
"""

Reply with only a JSON object in exactly this shape:
{
  "summary": "two sentences: how they come across today and the single biggest unlock",
  "strengths": ["up to 5 strengths named or clearly implied, max 15 words each"],
  "areas": [{"skill": "skill id", "priority": 1 | 2 | 3, "evidence": "short quote or paraphrase from the evaluation", "target": "what good looks like for them, max 20 words"}],
  "ratings": {"skill id": 1-5},
  "behaviors": ["3 signature behaviors to adopt, each an observable habit, max 15 words"],
  "plan": [{"week": 1, "theme": "max 5 words", "commitments": ["3 specific practice commitments for that week"]}]
}
Rules: 3-6 areas, priority 1 = most important. Rate only skills the evaluation gives evidence for. Plan has exactly 4 weeks that build on each other. Use only what the text supports; don't invent feedback.`;
  }

  /* ---------------- Meeting prep ---------------- */
  function prepPrompt(p, f) {
    return `${COACH_VOICE}

${who(p)}

They have an important meeting coming up and want to walk in with presence. Build their prep.

Meeting: ${f.title}
Audience: ${f.audience}
Time they'll have: ${f.time || 'unknown'}
What they want the audience to decide or do: ${f.objective}
Key facts and numbers they can use: ${f.facts || 'none given'}
What worries them: ${f.worries || 'nothing given'}

Reply with only a JSON object in exactly this shape:
{
  "key_message": "the one sentence they want remembered, max 25 words",
  "opening": "their first two sentences, verbatim, answer-first",
  "points": [{"point": "supporting point, max 15 words", "proof": "the fact or number that proves it"}],
  "questions": [{"q": "a tough question this audience is likely to ask", "a": "a strong answer in max 45 words, answer-first"}],
  "ask": "the explicit ask, verbatim",
  "close": "a closing line, verbatim",
  "watch_outs": ["2 reminders tied to their development focus, max 15 words each"]
}
Exactly 3 points and 4 questions. Use only the facts given; where a number is missing write [number].`;
  }

  /* ---------------- Sharpen ---------------- */
  function sharpenPrompt(p, textIn, audience, mode) {
    return `${COACH_VOICE}

${who(p)}

Rewrite the text below so it sounds like a confident senior executive ${mode === 'spoken' ? 'saying it out loud' : 'writing it'}, for this audience: ${audience}.
Answer or recommendation first. Cut hedges, fillers and throat-clearing. Prefer short sentences and specific numbers. Keep every fact; invent none. Keep their voice; don't make it pompous.

TEXT
"""
${String(textIn).slice(0, 15000)}
"""

Reply with only a JSON object: {"sharpened": "the rewrite", "changes": ["the 3 most important changes you made, max 15 words each"]}`;
  }

  /* ---------------- Visual check ---------------- */
  function visualPrompt(p, context, n) {
    return `You are an executive presence coach reviewing how a senior leader comes across visually. ${n > 1 ? `The ${n} attached images are frames from one video` : 'The attached image is a photo'} of them in this setting: ${context}.

${who(p)}

Judge only what is visible: posture, eye line and camera angle, framing, lighting, facial expression and energy, attire and background polish. Be specific about what to change (e.g. "raise the camera about 10 cm so the lens is at eye level"). Don't comment on physical features a person can't or shouldn't change.

Reply with only a JSON object in exactly this shape:
{
  "headline": "one-sentence verdict, max 18 words",
  "scores": {"posture": 1-10, "eye_line": 1-10, "framing": 1-10, "lighting": 1-10, "expression": 1-10, "polish": 1-10},
  "keep": ["max 2 things working well"],
  "fixes": [{"issue": "2-5 word label", "try": "a specific change"}]
}
Max 4 fixes, highest impact first.`;
  }

  /* ---------------- Weekly review ---------------- */
  function reviewPrompt(p, summary) {
    return `${COACH_VOICE}

${who(p)}

Here is their practice data for the last 7 days, with the 7 days before for comparison:
${summary}

Write their weekly review. Reply with only a JSON object in exactly this shape:
{
  "headline": "one-sentence summary of the week, max 18 words",
  "wins": ["max 3 specific wins backed by the data"],
  "patterns": ["max 3 patterns to work on, specific, backed by the data"],
  "focus": {"skill": "one skill id from: ${C.SKILLS.map((s) => s.id).join(', ')}", "why": "max 25 words", "drill": "a daily 5-minute drill for this week, max 30 words"},
  "challenge": "one real-world challenge to try in a meeting this week, max 25 words"
}
If there was little practice, say so plainly and make the focus about consistency.`;
  }

  function fieldPrompt(p, log) {
    return `${COACH_VOICE}

${who(p)}

They logged a real meeting:
Meeting: ${log.title}
Audience and stakes: ${log.audience || '—'}; stakes ${log.stakes}
Self-ratings (1-5): clarity ${log.r.clarity}, concision ${log.r.concision}, confidence ${log.r.confidence}, composure ${log.r.composure}
What went well: ${log.well || '—'}
What they'd change: ${log.change || '—'}

Give your take in 3 short paragraphs, max 120 words total: what the self-ratings and notes suggest, one thing to keep doing, and one specific thing to rehearse before the next meeting like this. Plain text, no headings, no lists.`;
  }

  return {
    init, json, text, errorText,
    get state() { return state; }, get ready() { return state === 'ready'; }, get imagesOk() { return imagesOk; },
    on: (f) => { subs.add(f); return () => subs.delete(f); },
    feedbackPrompt, sparRules, sparTurns, debriefPrompt, evaluationPrompt, prepPrompt, sharpenPrompt, visualPrompt, reviewPrompt, fieldPrompt,
  };
})();
