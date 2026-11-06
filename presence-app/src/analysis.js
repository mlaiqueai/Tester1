/* ============================================================
   Green Room — analysis engine
   Text: fillers, hedges, power language, structure, concision.
   Audio: pauses, pitch range, rising endings, volume, pace estimate.
   ============================================================ */
const A = {};

A.clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
A.round = (v, d = 0) => { const m = Math.pow(10, d); return Math.round(v * m) / m; };
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const pct = (sorted, p) => { if (!sorted.length) return 0; const i = A.clamp(Math.floor(p * (sorted.length - 1)), 0, sorted.length - 1); return sorted[i]; };
const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return pct(s, 0.5); };
const std = (a) => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) * (x - m)))); };

A.normalize = (t) => String(t || '')
  .replace(/[‘’ʼ]/g, "'")
  .replace(/[“”]/g, '"')
  .replace(/…/g, '...')
  .replace(/[ \t]+/g, ' ')
  .trim();

A.wordList = (t) => (t.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)));

// Pattern libraries. Each: [regex source, label]
const FILLERS = [
  ['\\b(?:u+m+|u+h+m*|e+rm+|a+h+|h+m+|m{2,})\\b', 'um / uh'],
  ["\\byou know\\b(?!\\s+(?:what|how|that|the|why|who|when|where|if|this|him|her|them|it|about)\\b)", 'you know'],
  ["\\bI mean\\b(?!\\s+(?:it|that|to|what)\\b)", 'I mean'],
  ["(?:,\\s*like\\b(?!\\s+(?:this|that|a|an|the|to)\\b)|\\blike,|\\b(?:was|were|it's|and|but|just|so|be|is)\\s+like\\b(?!\\s+(?:this|that|to|a|an|the|it|him|her|them|me|us|you|we|i|crazy|before|when)\\b))", 'like'],
  ['\\b(?:basically|literally|actually|honestly|obviously|totally|seriously|essentially)\\b', 'basically / actually'],
  ['(?:^|[.!?]\\s+)(?:and\\s+)?(?:so|well|okay|ok|alright|right)\\b(?=[,\\s])', 'so / well'],
  ['\\bright\\?', 'right?'],
  ["\\b(?:and stuff(?: like that)?|or something(?: like that)?|or whatever|and all that|et cetera|and so on and so forth|blah blah)\\b", 'vague tail'],
  ['\\b(?:you see|if you will|at the end of the day)\\b', 'stock phrase'],
];
const HEDGES = [
  ["\\bI think\\b", 'I think'],
  ["\\bI feel(?: like)?\\b", 'I feel'],
  ["\\bI guess\\b", 'I guess'],
  ["\\bI suppose\\b", 'I suppose'],
  ["\\b(?:I would say|I'd say)\\b", "I'd say"],
  ['\\bmaybe\\b', 'maybe'],
  ['\\bperhaps\\b', 'perhaps'],
  ['\\bprobably\\b', 'probably'],
  ['\\b(?:possibly|potentially)\\b', 'possibly'],
  ['\\bmight\\b', 'might'],
  ['\\b(?:kind of|kinda)\\b', 'kind of'],
  ['\\b(?:sort of|sorta)\\b', 'sort of'],
  ['\\b(?:a little bit|a little|a bit)\\b(?!\\s+(?:of\\s+)?(?:data|time|more|less))', 'a bit'],
  ['\\bjust\\b', 'just'],
  ['\\bhopefully\\b', 'hopefully'],
  ['\\b(?:try to|trying to|tried to)\\b', 'try to'],
  ["\\b(?:I'm not (?:sure|certain)|not sure)\\b", 'not sure'],
  ['\\b(?:does that|if that|that) makes? sense\\b', 'does that make sense'],
  ['\\b(?:sorry|apologies|I apologize)\\b', 'sorry'],
  ["\\bI (?:could|might) be wrong\\b", 'I could be wrong'],
  ['\\b(?:somewhat|fairly|pretty)\\b(?=\\s+[a-z])', 'pretty / fairly'],
  ['\\b(?:it seems|seems like|it looks like)\\b', 'it seems'],
  ['\\bI was wondering\\b', 'I was wondering'],
  ['\\bquick question\\b', 'quick question'],
  ["\\bI believe\\b", 'I believe'],
  ["\\bone thing I was (?:just )?thinking\\b", 'one thing I was thinking'],
  ["\\bI'm not sure (?:if|whether) (?:this|that) makes sense\\b", "I'm not sure this makes sense"],
  ["\\b(?:I don't want to overstep|let me think out loud)\\b", 'self-undercutting'],
];
const POWER = [
  ['\\b(?:I|we) recommend\\b|\\bmy recommendation\\b|\\bour recommendation\\b', 'recommend'],
  ['\\b(?:I|we) propose\\b', 'propose'],
  ["\\b(?:I|we)(?:'ve| have)? decided\\b|\\bthe decision is\\b|\\bmy decision\\b", 'decided'],
  ["\\b(?:we will|we'll|I will|I'll)\\b", 'will'],
  ["\\b(?:bottom line|the answer is|the short answer|my view is|my position|here's why|here is why)\\b", 'clear position'],
  ["\\b(?:I'm|I am|we're|we are) confident\\b", 'confident'],
  ['\\b(?:the data shows?|the evidence shows?|the numbers show)\\b', 'evidence'],
  ['\\b(?:because|therefore|which means)\\b', 'because'],
  ["\\b(?:I need|we need|I'm asking|we're asking|the ask is|I am asking|we are asking)\\b", 'ask'],
];
const SIGNPOSTS = /\b(?:first(?:ly)?|second(?:ly)?|third(?:ly)?|finally|lastly|(?:two|three|four) (?:things|reasons|points|risks|options|questions|priorities)|in summary|to summari[sz]e|to sum up|bottom line|net[- ]net|in short)\b/gi;
const IMPACT = /\b(?:revenue|margins?|costs?|savings|returns?|roi|irr|ebitda|payback|valuation|risks?|patients?|outcomes?|growth|market share|decision|approve|approval|budget|value|profit|cash|deadline|timeline|upside|downside|multiple|volume|coverage|reimbursement)\b/gi;
const NUMBERS = /(?:\$\s?\d[\d,.]*\s?(?:k|m|mm|b|bn|million|billion|thousand)?|\b\d[\d,.]*\s?(?:%|percent|x|bps|basis points|million|billion|thousand|k|m|months?|weeks?|days?|years?|quarters?)?(?![\w])|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty|thirty|forty|fifty|sixty|hundred)(?:[- ]\w+)?\s+(?:percent|million|billion|thousand|times|basis points|months|weeks|years)\b)/gi;
const BLUF_POS = /\b(?:recommend|recommendation|propose|should|bottom line|the answer is|short answer|my view|our view|we need|I need|the ask|approve|decline|pass on|invest|in short|our thesis|my thesis|the issue is|here's the|here is the|I'm asking|we're asking|we will|we missed|missed|(?:below|above|behind|ahead of) (?:plan|target|budget|forecast)|we are (?:below|behind|ahead)|is (?:\d|yes|no)|yes\b|no\b)/i;
const BLUF_NEG = /\b(?:background|context|before I|let me (?:start|give|walk|begin)|to give you|as you (?:know|may know)|I wanted to (?:start|give)|so basically|first,? (?:some|a bit of|a little) (?:background|context)|thanks for having me|great question)\b/i;
const IMPLIC = /\b(?:which means|that means|this means|what this means|the (?:strategic )?implications?|matters because|this matters|so what|the impact (?:is|on)|as a result|therefore|the upside is|the downside is|the consequence|so we|that's why)\b/i;
const ACTION = /\b(?:next steps?|I recommend|my recommendation|we should|we need to|the decision (?:we need|in front|for us)|I'm asking|we're asking|I am asking|we are asking|I propose|let's|I will|I'll|we will|we'll|owns?|owner|by (?:monday|tuesday|wednesday|thursday|friday|next week|end of|the \d+|q[1-4])|approve|approval|sign off|reconvene|follow up)\b/i;
const RECOMMEND = /\b(?:I|we) recommend\b|\bmy recommendation\b|\bI propose\b|\bI(?:'d| would) prioriti[sz]e\b|\bmy (?:call|view) is\b|\bI(?:'d| would) (?:pass|invest|proceed|approve|partner|build|wait)\b|\bbottom line\b/i;
const recommends = (t) => {
  if (RECOMMEND.test(t)) return true;
  const re = /\b(\w+)\s+we should\b(?!\s+(?:consider|probably|maybe|think|look|explore))/gi; let m;
  while ((m = re.exec(t))) if (!/^(?:maybe|perhaps|probably|possibly|think)$/i.test(m[1])) return true;
  return /^we should\b(?!\s+(?:consider|probably|maybe|think|look|explore))/i.test(t);
};
const CHANGE_MIND = /\bwhat would change my mind\b|\bchange my (?:mind|view)\b|\bunless\b|\bif and only if\b/i;
const TRADEOFF = /\btrade-?offs?\b|\bversus\b|\bvs\.?\b|\binstead of\b|\bat the cost of\b|\bin exchange for\b|\brather than\b|\bthe cost of\b/i;
const OWNERSHIP = /\bI(?:'ll| will) own\b|\bI own\b|\bowns?\b|\bowner\b|\baccountab/i;
const FRAMING = /\bthe (?:fundamental|core|real|central|strategic) (?:issue|question|problem|point|choice)\b|\bthe question (?:is|in front of us)\b|\bwhat matters (?:here|most)\b|\bstrategic(?:ally)?\b|\bthe decision we need\b/i;
const MANY_POINTS = /\b(?:fourth(?:ly)?|fifth(?:ly)?|sixth|(?:four|five|six|seven|eight) (?:things|reasons|points|considerations|factors|risks|issues))\b/i;
const WEAK_END = /(?:so yeah|\byeah|that's (?:it|all|about it)|I guess|anyway|or something|does that make sense|if that makes sense|I don't know|you know|and stuff)\W*$/i;

function compile(list) { return list.map(([src, label]) => ({ re: new RegExp(src, 'gim'), label })); }
const RX = { fillers: compile(FILLERS), hedges: compile(HEDGES), power: compile(POWER) };

A.setCustomFillers = function (words) {
  const extra = (words || []).map((w) => String(w).trim()).filter(Boolean).slice(0, 20)
    .map((w) => [`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, w.toLowerCase()]);
  RX.fillers = compile(FILLERS.concat(extra));
};

function findAll(text, list, kind) {
  const hits = [];
  for (const { re, label } of list) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      let start = m.index, str = m[0];
      // trim leading punctuation/space from sentence-opener matches
      const lead = str.match(/^[.!?\s]+/);
      if (lead) { start += lead[0].length; str = str.slice(lead[0].length); }
      if (str.length) hits.push({ start, end: start + str.length, kind, label, text: str });
      if (m[0].length === 0) re.lastIndex++;
    }
  }
  return hits;
}

function countBy(hits) {
  const map = {};
  for (const h of hits) map[h.label] = (map[h.label] || 0) + 1;
  return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([label, n]) => ({ label, n }));
}

function syllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const s = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const m = s.match(/[aeiouy]{1,2}/g);
  return Math.max(1, m ? m.length : 1);
}

A.sentences = function (text) {
  const parts = text.replace(/([.!?]+)(\s+|$)/g, '$1\n').split('\n').map((s) => s.trim()).filter((s) => /[A-Za-z0-9]/.test(s));
  return parts;
};

/**
 * Analyze a transcript.
 * opts: { durationSec, source: 'mic'|'dictation'|'typed'|'upload', timeLimit, paceLo, paceHi }
 */
A.analyzeText = function (raw, opts = {}) {
  const text = A.normalize(raw);
  const words = A.wordList(text);
  const n = words.length;
  const spoken = opts.source && opts.source !== 'typed';
  const durationSec = spoken && opts.durationSec ? opts.durationSec : null;
  const minutes = durationSec ? durationSec / 60 : null;

  const fillerHits = findAll(text, RX.fillers, 'filler');
  const hedgeHits = findAll(text, RX.hedges, 'hedge');
  const powerHits = findAll(text, RX.power, 'power');
  // Repeated word restarts ("the the", "I I")
  const repRe = /\b([A-Za-z']+)\s+\1\b/gi; let rm;
  while ((rm = repRe.exec(text))) {
    if (!/^(?:that|had|is|very|bye|no|yes|so)$/i.test(rm[1])) fillerHits.push({ start: rm.index, end: rm.index + rm[0].length, kind: 'filler', label: 'restart', text: rm[0] });
  }

  let sentences = A.sentences(text);
  const punctuated = /[.!?]/.test(text);
  if (!punctuated && n > 25) {
    sentences = [];
    for (let i = 0; i < n; i += 16) sentences.push(words.slice(i, i + 16).join(' '));
  }
  const sentLens = sentences.map((s) => A.wordList(s).length).filter((x) => x > 0);
  const avgSentence = sentLens.length ? mean(sentLens) : n;
  const longSentences = sentLens.filter((x) => x > 30).length;

  const first = sentences[0] ? A.wordList(sentences[0]).slice(0, 30).join(' ') : words.slice(0, 30).join(' ');
  let bluf = 'unclear';
  if (n >= 8) {
    if (BLUF_NEG.test(first)) bluf = false;
    else if (BLUF_POS.test(first)) bluf = true;
    else if (/^(?:so|well|um|uh|okay|ok)\b/i.test(first) || A.wordList(sentences[0] || '').length > 35) bluf = false;
  }
  const signposts = (text.match(SIGNPOSTS) || []).length;
  const impactWords = (text.match(IMPACT) || []).length;
  const numbers = (text.match(NUMBERS) || []).filter((x) => /\d|percent|million|billion|thousand|times|basis/i.test(x)).length;
  const lastSentence = sentences[sentences.length - 1] || '';
  const weakEnd = n >= 15 && WEAK_END.test(lastSentence.trim()) ? (lastSentence.match(WEAK_END) || [''])[0].replace(/\W+$/, '').trim() : null;
  const asks = powerHits.filter((h) => h.label === 'ask' || h.label === 'recommend' || h.label === 'propose').length;
  const apologies = hedgeHits.filter((h) => h.label === 'sorry').length;
  const iCount = (text.match(/\bI\b|\bI'm\b|\bI've\b|\bI'll\b|\bmy\b/g) || []).length;
  const weCount = (text.match(/\bwe\b|\bwe're\b|\bwe've\b|\bwe'll\b|\bour\b/gi) || []).length;

  const lower = words.map((w) => w.toLowerCase().replace(/[^a-z0-9']/g, '')).filter(Boolean);
  const uniq = new Set(lower).size;
  const tri = {};
  for (let i = 0; i + 2 < lower.length; i++) {
    const k = lower.slice(i, i + 3).join(' ');
    if (/^(?:um|uh|you know|i mean)/.test(k)) continue;
    tri[k] = (tri[k] || 0) + 1;
  }
  const repeats = Object.entries(tri).filter(([, c]) => c >= 3).map(([k, c]) => ({ phrase: k, n: c })).slice(0, 5);
  const syl = words.reduce((s, w) => s + syllables(w), 0);
  const flesch = n ? A.round(206.835 - 1.015 * (n / Math.max(1, sentLens.length)) - 84.6 * (syl / n)) : null;

  const wpm = minutes && durationSec >= 8 ? A.round(n / minutes) : null;
  const tail = sentences.length >= 3 ? sentences.slice(-2).join(' ') : words.slice(Math.floor(n * 0.55)).join(' ');
  const tooMany = MANY_POINTS.test(text);
  const execPhrases = (typeof C !== 'undefined' && C.EXEC_PHRASES ? C.EXEC_PHRASES : []).filter((p) => p.re.test(text)).map((p) => p.id);
  const weakPhrases = (typeof C !== 'undefined' && C.WEAK_PHRASES ? C.WEAK_PHRASES : []).filter((p) => p.re.test(text)).map((p) => p.say);
  const hsia = {
    headline: bluf === true,
    structure: !tooMany && (signposts >= 1 || execPhrases.includes('two')),
    implication: IMPLIC.test(text),
    action: n >= 8 && ACTION.test(tail),
  };
  return {
    v: 2, hsia, tooMany, execPhrases, weakPhrases,
    recommends: recommends(text), changeMind: CHANGE_MIND.test(text), tradeoff: TRADEOFF.test(text), ownership: OWNERSHIP.test(text), framingPhrase: FRAMING.test(text),
    text, words: n, durationSec, wpm, spoken, source: opts.source || 'typed',
    fillers: { total: fillerHits.length, byType: countBy(fillerHits), perMin: minutes ? A.round(fillerHits.length / minutes, 1) : null, per100: n ? A.round((fillerHits.length / n) * 100, 1) : 0 },
    hedges: { total: hedgeHits.length, byType: countBy(hedgeHits), per100: n ? A.round((hedgeHits.length / n) * 100, 1) : 0 },
    power: { total: powerHits.length, byType: countBy(powerHits) },
    sentences: sentLens.length, avgSentence: A.round(avgSentence, 1), longSentences, punctuated,
    bluf, firstSentence: sentences[0] || '', signposts, impactWords, numbers, weakEnd, asks, apologies,
    iCount, weCount, vocab: n ? A.round(uniq / n, 2) : 0, repeats, flesch,
    hits: fillerHits.concat(hedgeHits, powerHits),
  };
};

/** Turn transcript + hits into highlighted HTML. */
A.highlight = function (ta) {
  const text = ta.text;
  const prio = { filler: 3, hedge: 2, power: 1 };
  const hits = [...ta.hits].sort((a, b) => a.start - b.start || prio[b.kind] - prio[a.kind]);
  const kept = [];
  let lastEnd = -1;
  for (const h of hits) {
    if (h.start >= lastEnd) { kept.push(h); lastEnd = h.end; }
    else if (kept.length && prio[h.kind] > prio[kept[kept.length - 1].kind] && h.start === kept[kept.length - 1].start) { kept[kept.length - 1] = h; lastEnd = h.end; }
  }
  let out = '', pos = 0;
  for (const h of kept) {
    out += esc(text.slice(pos, h.start));
    out += `<mark class="hl hl-${h.kind}" title="${esc(h.label)}">${esc(text.slice(h.start, h.end))}</mark>`;
    pos = h.end;
  }
  out += esc(text.slice(pos));
  return out;
};

/**
 * Score a rep on the plan's dimensions (0-100 internally, shown /10).
 * ta = text analysis (may be null), au = audio analysis (may be null).
 * opts: { paceLo, paceHi, timeLimit }
 */
A.score = function (ta, au, opts = {}) {
  const lo = opts.paceLo || 130, hi = opts.paceHi || 160;
  const s = {};
  const notes = [];
  const n = ta ? ta.words : 0;
  const cl = (v) => Math.round(A.clamp(v, 20, 100));

  // Executive confidence: how it sounds (pace, fillers, pauses, pitch, rising endings)
  const del = [];
  let wpm = ta && ta.wpm;
  if (!wpm && au && au.estWpm) wpm = au.estWpm;
  if (wpm) { const d = wpm < lo ? lo - wpm : wpm > hi ? wpm - hi : 0; del.push([A.clamp(100 - d * 1.6, 30, 100), 0.3]); }
  if (ta && n >= 10) {
    const perMin = ta.fillers.perMin != null ? ta.fillers.perMin : ta.fillers.per100 * 1.45;
    del.push([A.clamp(100 - Math.max(0, perMin - 1) * 14, 20, 100), 0.35]);
    if (ta.weakEnd) del.push([60, 0.1]);
  }
  if (au && au.ok) {
    const dp = au.pauses.deliberatePerMin;
    del.push([A.clamp(dp < 3 ? 100 - (3 - dp) * 15 : dp > 14 ? 100 - (dp - 14) * 6 : 100, 40, 100), 0.12]);
    const range = au.pitch.rangeSt;
    if (range != null) del.push([range >= 6 ? 100 : range >= 3 ? 60 + (range - 3) * 13 : 40 + range * 7, 0.13]);
    if (au.upspeak.pct != null) del.push([au.upspeak.pct <= 15 ? 100 : A.clamp(100 - (au.upspeak.pct - 15) * 1.6, 40, 100), 0.1]);
  }
  if (del.length && ta && ta.source !== 'typed' || del.length && !ta) { const w = del.reduce((a, [, x]) => a + x, 0); s.confidence = Math.round(del.reduce((a, [v, x]) => a + v * x, 0) / w); }

  if (ta && n >= 10) {
    const h = ta.hsia;
    s.assertive = cl(100 - ta.hedges.per100 * 9 - ta.apologies * 8 - (ta.weakEnd ? 10 : 0) - ta.weakPhrases.length * 6 + Math.min(10, ta.power.total * 3) + (ta.ownership ? 4 : 0));
    let c = 56 + (ta.bluf === true ? 24 : ta.bluf === 'unclear' ? 6 : -12) + Math.min(10, ta.signposts * 5) + (h.structure ? 4 : 0);
    c += ta.avgSentence <= 18 ? 6 : ta.avgSentence <= 24 ? 2 : ta.avgSentence > 30 ? -10 : -4;
    s.clarity = cl(c);
    let co = 100 - Math.max(0, ta.avgSentence - 18) * 2.5 - ta.longSentences * 4 - ta.repeats.length * 5 - (ta.tooMany ? 8 : 0)
      - ((ta.fillers.total + ta.hedges.total) / Math.max(1, n)) * 100 * 1.5;
    if (opts.timeLimit && ta.durationSec && ta.durationSec > opts.timeLimit * 1.15) co -= ((ta.durationSec / opts.timeLimit) - 1) * 40;
    s.concision = cl(co);
    s.framing = cl(48 + (h.implication ? 16 : 0) + Math.min(14, ta.numbers * 5) + Math.min(10, ta.impactWords * 2) + (ta.framingPhrase ? 10 : 0) + (ta.bluf === true ? 4 : 0));
    s.decision = cl(42 + (ta.recommends ? 20 : 0) + (h.action ? 16 : 0) + (ta.changeMind ? 10 : 0) + (ta.tradeoff ? 8 : 0) + (ta.ownership ? 6 : 0) - (ta.bluf === false ? 6 : 0));
  }
  const keys = ['framing', 'clarity', 'concision', 'assertive', 'confidence', 'decision'];
  const vals = keys.map((k) => s[k]).filter((v) => v != null);
  s.overall = vals.length ? Math.round(mean(vals)) : null;

  // Coaching notes, tied to development areas A-E
  if (ta && n >= 10) {
    const h = ta.hsia;
    if (ta.bluf === false) notes.push({ w: 10, area: 'A', dim: 'clarity', text: 'You built up to the point. Start with the conclusion: "My recommendation is…"' });
    if (!ta.recommends && n > 45) notes.push({ w: 8, area: 'C', dim: 'decision', text: 'Analysis without a verdict. State what you recommend and what would change your mind.' });
    if (ta.weakPhrases.length) notes.push({ w: 8, area: 'D', dim: 'assertive', text: `You said "${ta.weakPhrases[0].replace('…', '')}". Swap it for an executive phrase from your arsenal.` });
    if (ta.hedges.total >= 2) notes.push({ w: 7 + Math.min(3, ta.hedges.total / 3), area: 'D', dim: 'assertive', text: `${ta.hedges.total} hedges (${ta.hedges.byType.slice(0, 3).map((x) => `"${x.label}"`).join(', ')}). Speak with measured conviction.` });
    if (ta.tooMany) notes.push({ w: 7, area: 'B', dim: 'concision', text: 'More than three points. Keep the three that change the decision.' });
    if (!h.action && n > 40) notes.push({ w: 7, area: 'E', dim: 'decision', text: 'No explicit next action. Close with the decision or next step, an owner and a date.' });
    if (!h.implication && n > 50) notes.push({ w: 6, area: 'A', dim: 'framing', text: 'No implication. Say why it matters: "The strategic implication is…"' });
    if (!h.structure && n > 60) notes.push({ w: 5, area: 'B', dim: 'clarity', text: 'No structure signposted. Preview it: "There are two considerations here."' });
    if (ta.fillers.total >= 3) notes.push({ w: 6 + Math.min(3, ta.fillers.total / 4), area: 'D', dim: 'confidence', text: `${ta.fillers.total} fillers (${ta.fillers.byType.slice(0, 2).map((x) => `"${x.label}" ×${x.n}`).join(', ')}). Swap each for a silent beat.` });
    if (ta.avgSentence > 24 && ta.punctuated) notes.push({ w: 6, area: 'B', dim: 'concision', text: `Sentences average ${Math.round(ta.avgSentence)} words. Aim for under 20.` });
    if (ta.repeats.length) notes.push({ w: 4, area: 'B', dim: 'concision', text: `Repeated phrase: "${ta.repeats[0].phrase}". Say it once, then stop.` });
    if (ta.numbers === 0 && n > 50) notes.push({ w: 4, area: 'A', dim: 'framing', text: 'No numbers. One specific figure makes the judgment credible.' });
    if (ta.weakEnd) notes.push({ w: 5, area: 'D', dim: 'assertive', text: `You ended on "${ta.weakEnd}". End on the recommendation or the action, then stop.` });
  }
  if (wpm) {
    if (wpm > hi + 5) notes.push({ w: 6 + Math.min(3, (wpm - hi) / 15), area: 'D', dim: 'confidence', text: `${Math.round(wpm)} words a minute is above your ${lo}–${hi} band. Speak deliberately.` });
    else if (wpm < lo - 15) notes.push({ w: 3, area: 'D', dim: 'confidence', text: `${Math.round(wpm)} words a minute is slow. Move through context; slow down for the point.` });
  }
  if (au && au.ok) {
    if (au.upspeak.pct != null && au.upspeak.pct > 25 && au.upspeak.segments >= 4) notes.push({ w: 6, area: 'D', dim: 'confidence', text: `About ${Math.round(au.upspeak.pct)}% of your phrases ended on a rising pitch. Land statements down.` });
    if (au.pitch.rangeSt != null && au.pitch.rangeSt < 4) notes.push({ w: 4, area: 'D', dim: 'confidence', text: `Narrow pitch range (${au.pitch.rangeSt} semitones). Lift for contrast, drop for conclusions.` });
    if (au.pauses.deliberatePerMin < 2 && au.activeSpan > 30) notes.push({ w: 4, area: 'D', dim: 'confidence', text: 'Few deliberate pauses. Pause before and after your headline.' });
  }
  if (opts.timeLimit && ta && ta.durationSec && ta.durationSec > opts.timeLimit * 1.15) notes.push({ w: 6, area: 'B', dim: 'concision', text: `You ran ${Math.round(ta.durationSec - opts.timeLimit)}s over the ${opts.timeLimit}s limit.` });
  notes.sort((a, b) => b.w - a.w);
  if (!notes.length && n >= 20) notes.push({ w: 1, area: 'B', dim: 'concision', text: 'Clean rep. Now say it 20% shorter with the same punch.' });
  s.notes = notes.slice(0, 4).map((x) => ({ area: x.area, dim: x.dim, text: x.text }));
  s.wpm = wpm ? Math.round(wpm) : null;
  return s;
};

/* Map scores saved before the plan dimensions existed */
A.normScores = function (sc) {
  if (!sc || sc.v === 2 || sc.framing != null || sc.assertive != null || sc.decision != null) return sc || {};
  const out = { clarity: sc.clarity, concision: sc.concision, assertive: sc.confidence, confidence: sc.delivery, framing: sc.impact };
  const v = Object.values(out).filter((x) => x != null);
  out.overall = sc.overall != null ? sc.overall : v.length ? Math.round(mean(v)) : null;
  return out;
};

/* ------------------------------------------------------------
   Audio
   ------------------------------------------------------------ */
A.decodeFile = async function (fileOrBlob) {
  const buf = await fileOrBlob.arrayBuffer();
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) throw new Error('This browser can\'t decode audio.');
  const ctx = new AC();
  try {
    const audio = await new Promise((resolve, reject) => {
      const p = ctx.decodeAudioData(buf, resolve, reject);
      if (p && typeof p.then === 'function') p.then(resolve, reject);
    });
    return audio;
  } finally {
    try { const p = ctx.close && ctx.close(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ }
  }
};

A.toMono = function (audioBuffer, target = 16000, maxSec = 600) {
  const sr = audioBuffer.sampleRate;
  const ch = audioBuffer.numberOfChannels;
  const len = Math.min(audioBuffer.length, Math.floor(sr * maxSec));
  const ratio = sr / target;
  const outLen = Math.floor(len / ratio);
  const out = new Float32Array(outLen);
  const chans = [];
  for (let i = 0; i < ch; i++) chans.push(audioBuffer.getChannelData(i));
  for (let i = 0; i < outLen; i++) {
    const a = Math.floor(i * ratio), b = Math.min(len, Math.max(a + 1, Math.floor((i + 1) * ratio)));
    let sum = 0;
    for (let j = a; j < b; j++) for (let c = 0; c < ch; c++) sum += chans[c][j];
    out[i] = sum / ((b - a) * ch);
  }
  return { data: out, sr: target, duration: audioBuffer.duration };
};

const tick = () => new Promise((r) => setTimeout(r, 0));

/** Full acoustic analysis on mono 16 kHz samples. */
A.analyzeAudio = async function ({ data, sr, duration }, onProgress) {
  const hop = Math.round(sr * 0.01), win = Math.round(sr * 0.025);
  const nF = Math.max(0, Math.floor((data.length - win) / hop) + 1);
  if (nF < 50) return { ok: false, reason: 'Recording is too short to analyze.' };
  const db = new Float32Array(nF);
  for (let f = 0; f < nF; f++) {
    let s = 0; const o = f * hop;
    for (let j = 0; j < win; j++) { const v = data[o + j]; s += v * v; }
    db[f] = 10 * Math.log10(s / win + 1e-10);
  }
  const sorted = Array.from(db).sort((a, b) => a - b);
  const floor = pct(sorted, 0.1), peak = pct(sorted, 0.97);
  if (peak - floor < 10) return { ok: false, reason: 'Couldn\'t find clear speech in this recording. Try a quieter room or hold the phone closer.' };
  const thr = Math.max(floor + 8, floor + 0.32 * (peak - floor));
  let sp = new Uint8Array(nF);
  for (let f = 0; f < nF; f++) sp[f] = db[f] > thr ? 1 : 0;
  // close gaps < 200 ms (inside words), drop blips < 60 ms
  const fill = (arr, val, maxLen) => {
    let i = 0;
    while (i < nF) {
      if (arr[i] === val) { let j = i; while (j < nF && arr[j] === val) j++; if (i > 0 && j < nF && j - i < maxLen) for (let k = i; k < j; k++) arr[k] = 1 - val; i = j; } else i++;
    }
  };
  fill(sp, 0, 20); fill(sp, 1, 6);
  const segs = [];
  { let i = 0; while (i < nF) { if (sp[i]) { let j = i; while (j < nF && sp[j]) j++; segs.push([i, j]); i = j; } else i++; } }
  if (!segs.length) return { ok: false, reason: 'No speech detected.' };
  const fr = (x) => (x * hop) / sr;
  const activeStart = fr(segs[0][0]), activeEnd = fr(segs[segs.length - 1][1]);
  const activeSpan = Math.max(0.1, activeEnd - activeStart);
  const speakingTime = segs.reduce((s, [a, b]) => s + fr(b - a), 0);
  const gaps = [];
  for (let i = 1; i < segs.length; i++) gaps.push(fr(segs[i][0] - segs[i - 1][1]));
  const realPauses = gaps.filter((g) => g >= 0.3);
  const deliberate = gaps.filter((g) => g >= 0.6 && g < 2.0).length;
  const longGaps = gaps.filter((g) => g >= 2.0).length;
  onProgress && onProgress(0.25);
  await tick();

  // Syllable nuclei from the energy envelope (pace estimate)
  const env = new Float32Array(nF);
  for (let f = 0; f < nF; f++) { let s = 0, c = 0; for (let k = -2; k <= 2; k++) { const i = f + k; if (i >= 0 && i < nF) { s += db[i]; c++; } } env[f] = s / c; }
  let syl = 0, lastPeak = -100;
  for (let f = 3; f < nF - 3; f++) {
    if (!sp[f]) continue;
    if (env[f] >= env[f - 1] && env[f] > env[f + 1]) {
      let mn = env[f];
      for (let k = Math.max(0, f - 9); k <= Math.min(nF - 1, f + 9); k++) mn = Math.min(mn, env[k]);
      if (env[f] - mn >= 2.5 && f - lastPeak >= 10) { syl++; lastPeak = f; }
    }
  }
  const estWpm = A.round((syl / 1.45) / (activeSpan / 60));

  // Pitch: normalized autocorrelation at 8 kHz on voiced frames, 20 ms hop
  const dsr = 8000, step = sr / dsr;
  const dN = Math.floor(data.length / step);
  const d8 = new Float32Array(dN);
  for (let i = 0; i < dN; i++) { const a = Math.floor(i * step); d8[i] = (data[a] + (data[a + 1] || 0)) / 2; }
  const pwin = 320, phop = 160, minLag = 20, maxLag = 114;
  const nP = Math.max(0, Math.floor((dN - pwin - maxLag) / phop));
  const f0 = new Float32Array(nP);
  for (let p = 0; p < nP; p++) {
    if (p % 400 === 0) { onProgress && onProgress(0.25 + 0.65 * (p / Math.max(1, nP))); await tick(); }
    const tSec = (p * phop) / dsr;
    const fi = Math.min(nF - 1, Math.floor((tSec * sr) / hop) + 1);
    if (!sp[fi] || db[fi] < thr + 3) continue;
    const o = p * phop;
    let e0 = 0;
    for (let j = 0; j < pwin; j++) e0 += d8[o + j] * d8[o + j];
    if (e0 < 1e-6) continue;
    let best = 0, bestLag = 0;
    const r = new Float32Array(maxLag + 2);
    for (let lag = minLag; lag <= maxLag + 1; lag++) {
      let c = 0, e1 = 0;
      for (let j = 0; j < pwin; j++) { const b = d8[o + j + lag]; c += d8[o + j] * b; e1 += b * b; }
      const v = c / Math.sqrt(e0 * e1 + 1e-12);
      r[lag] = v;
      if (lag <= maxLag && v > best) { best = v; bestLag = lag; }
    }
    if (best > 0.55 && bestLag > minLag && bestLag < maxLag) {
      const a = r[bestLag - 1], b = r[bestLag], c = r[bestLag + 1];
      const den = a - 2 * b + c;
      const shift = den !== 0 ? 0.5 * (a - c) / den : 0;
      f0[p] = dsr / (bestLag + A.clamp(shift, -1, 1));
    }
  }
  // median-smooth and drop octave jumps
  const voiced = [];
  for (let p = 0; p < nP; p++) if (f0[p] > 0) voiced.push(f0[p]);
  const fMed = median(voiced);
  const st = new Float32Array(nP).fill(NaN);
  for (let p = 2; p < nP - 2; p++) {
    if (!(f0[p] > 0)) continue;
    const w = [f0[p - 2], f0[p - 1], f0[p], f0[p + 1], f0[p + 2]].filter((x) => x > 0);
    const m = median(w);
    if (fMed && (m > fMed * 1.85 || m < fMed / 1.85)) continue;
    st[p] = 12 * Math.log2(m / fMed);
  }
  const stVals = Array.from(st).filter((x) => !isNaN(x));
  const stSorted = [...stVals].sort((a, b) => a - b);
  const rangeSt = stVals.length >= 40 ? A.round(pct(stSorted, 0.9) - pct(stSorted, 0.1), 1) : null;

  // Rising endings and trail-off per phrase (segments separated by >= 350 ms)
  const phrases = [];
  { let cur = null;
    for (let i = 0; i < segs.length; i++) {
      if (!cur) cur = [segs[i][0], segs[i][1]];
      else if (fr(segs[i][0] - cur[1]) < 0.35) cur[1] = segs[i][1];
      else { phrases.push(cur); cur = [segs[i][0], segs[i][1]]; }
    }
    if (cur) phrases.push(cur); }
  let up = 0, judged = 0, trail = 0, trailJudged = 0;
  const phraseDb = [];
  for (const [a, b] of phrases) {
    const dur = fr(b - a);
    const dbs = Array.from(db.slice(a, b));
    phraseDb.push(mean(dbs));
    if (dur >= 0.8) {
      const cut = a + Math.floor((b - a) * 0.75);
      const head = mean(Array.from(db.slice(a, cut))), tail = mean(Array.from(db.slice(cut, b)));
      trailJudged++; if (head - tail > 6) trail++;
    }
    if (dur < 0.7) continue;
    const pa = Math.floor((fr(a) * dsr) / phop), pb = Math.floor((fr(b) * dsr) / phop);
    const pts = [];
    for (let p = pa; p < Math.min(pb, nP); p++) if (!isNaN(st[p])) pts.push([p, st[p]]);
    if (pts.length < 12) continue;
    const tailFrames = Math.round((0.3 * dsr) / phop);
    const tailPts = pts.filter(([p]) => p >= pb - tailFrames).map(([, v]) => v);
    const bodyPts = pts.filter(([p]) => p < pb - tailFrames).map(([, v]) => v);
    if (tailPts.length < 3 || bodyPts.length < 5) continue;
    judged++;
    if (median(tailPts) - median(bodyPts) > 2) up++;
  }
  onProgress && onProgress(1);

  // Waveform summary for drawing
  const bins = 160, per = Math.max(1, Math.floor(data.length / bins)), wave = [];
  for (let b = 0; b < bins; b++) { let m = 0; const o = b * per; for (let j = 0; j < per && o + j < data.length; j += 4) m = Math.max(m, Math.abs(data[o + j])); wave.push(m); }
  const wmax = Math.max(...wave, 1e-6);

  return {
    ok: true,
    duration: A.round(duration || data.length / sr, 1),
    activeSpan: A.round(activeSpan, 1),
    speakingTime: A.round(speakingTime, 1),
    speechRatio: A.round(speakingTime / activeSpan, 2),
    pauses: {
      count: realPauses.length,
      deliberate,
      deliberatePerMin: A.round(deliberate / (activeSpan / 60), 1),
      long: longGaps,
      avg: A.round(mean(realPauses), 2),
      longest: A.round(Math.max(0, ...gaps), 1),
    },
    estWpm: activeSpan > 8 ? estWpm : null,
    sylRate: A.round(syl / Math.max(0.1, speakingTime), 1),
    pitch: { medianHz: fMed ? Math.round(fMed) : null, rangeSt, stdSt: stVals.length ? A.round(std(stVals), 1) : null, monotone: rangeSt != null && rangeSt < 4 },
    upspeak: { segments: judged, rising: up, pct: judged >= 3 ? A.round((up / judged) * 100) : null },
    volume: { phraseVarDb: A.round(std(phraseDb), 1), trailOffPct: trailJudged ? A.round((trail / trailJudged) * 100) : 0 },
    wave: wave.map((v) => A.round(v / wmax, 3)),
  };
};

/** Pull a few still frames from a video file for the visual check. */
A.videoFrames = async function (file, count = 3) {
  const url = URL.createObjectURL(file);
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto'; v.src = url;
  const once = (ev, ms = 8000) => new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('The video took too long to load.')), ms);
    v.addEventListener(ev, () => { clearTimeout(t); res(); }, { once: true });
    v.addEventListener('error', () => { clearTimeout(t); rej(new Error('This video format can\'t be read here. Try a photo instead.')); }, { once: true });
  });
  try {
    await once('loadeddata');
    try { await v.play(); v.pause(); } catch (e) { /* autoplay blocked is fine */ }
    const dur = v.duration || 1;
    const marks = [0.2, 0.5, 0.8].slice(0, count);
    const frames = [];
    const scale = Math.min(1, 960 / (v.videoWidth || 960));
    const cw = Math.max(1, Math.round((v.videoWidth || 640) * scale)), ch = Math.max(1, Math.round((v.videoHeight || 480) * scale));
    const canvas = document.createElement('canvas'); canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext('2d');
    for (const m of marks) {
      v.currentTime = Math.min(dur - 0.05, dur * m);
      await once('seeked');
      ctx.drawImage(v, 0, 0, cw, ch);
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.82));
      if (blob) frames.push({ blob, url: URL.createObjectURL(blob) });
    }
    return { frames, duration: dur };
  } finally {
    URL.revokeObjectURL(url);
  }
};

/** Shrink a photo before sending it. */
A.shrinkImage = async function (file, max = 1280) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('That image couldn\'t be opened.')); img.src = url; });
    const sc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * sc); c.height = Math.round(img.naturalHeight * sc);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
    return { blob, url: URL.createObjectURL(blob) };
  } finally { URL.revokeObjectURL(url); }
};
