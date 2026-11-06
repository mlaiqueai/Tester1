/* ============================================================
   Green Room — development-plan framework and game content.
   Generic coaching framework only. Personal baselines, strengths and
   observed tendencies live in the private profile (profile.plan).
   ============================================================ */

// The eight scored dimensions (internal 0-100, shown as /10)
C.DIMENSIONS = [
  { id: 'framing', name: 'Strategic framing', short: 'Framing', blurb: 'Frames the right problem and its implication' },
  { id: 'clarity', name: 'Communication clarity', short: 'Clarity', blurb: 'Easy to follow: headline first, clear structure' },
  { id: 'concision', name: 'Conciseness', short: 'Concision', blurb: 'One message, three points max, then stop' },
  { id: 'assertive', name: 'Assertiveness', short: 'Assertive', blurb: 'Measured conviction, no needless hedging' },
  { id: 'confidence', name: 'Executive confidence', short: 'Confidence', blurb: 'Deliberate pace, no fillers, statements land' },
  { id: 'decision', name: 'Decision leadership', short: 'Decision', blurb: 'Recommends, names trade-offs, drives the next action' },
  { id: 'stakeholder', name: 'Stakeholder management', short: 'Stakeholders', blurb: 'Reads the room, builds alignment' },
  { id: 'commercial', name: 'Commercial judgment', short: 'Commercial', blurb: 'Economics, risk and what matters' },
];
C.dim = (id) => C.DIMENSIONS.find((d) => d.id === id);
C.DEFAULT_PLAN = {
  north: 'Develop the executive presence to lead complex strategic discussions, influence senior stakeholders, drive decisions and represent the organization at an executive level.',
  goal: 'Not to change personality: to improve how analytical thinking, commercial judgment and strategic insight are communicated.',
  baseline: { framing: 7, clarity: 7, concision: 7, assertive: 7, confidence: 7, decision: 7, stakeholder: 7, commercial: 7 },
  target: { framing: 8.5, clarity: 8.5, concision: 8.5, assertive: 8.5, confidence: 8.5, decision: 8.5, stakeholder: 8.5, commercial: 8.5 },
  overall: { baseline: 7, target: 8.5 },
  strengths: [],
  tendencies: {},
  note: '',
};

// Development areas (A–E): the recurring themes the whole app trains
C.AREAS = [
  { id: 'A', title: 'Lead with the conclusion', short: 'Conclusion first', dims: ['clarity', 'framing'],
    desired: ['Start with the conclusion', 'Explain the supporting rationale', 'State the implication', 'Identify the required decision'] },
  { id: 'B', title: 'Improve conciseness', short: 'Concise', dims: ['concision', 'clarity'],
    desired: ['One message per intervention', 'Three supporting points maximum', 'Eliminate unnecessary qualifiers', 'Stop speaking when the point is established'] },
  { id: 'C', title: 'Move from analysis to judgment', short: 'Judgment', dims: ['decision', 'framing'],
    desired: ['Form a point of view', 'State what you recommend', 'Explain what would change your mind', 'Make the trade-offs explicit'] },
  { id: 'D', title: 'Increase assertiveness', short: 'Assertive', dims: ['assertive', 'confidence'],
    desired: ['Speak with measured conviction', 'Avoid unnecessary hedging', 'Disagree constructively', 'Take ownership of recommendations'] },
  { id: 'E', title: 'Demonstrate discussion leadership', short: 'Lead the room', dims: ['decision', 'stakeholder'],
    desired: ['Frame the problem', 'Establish the decision criteria', 'Organize the conversation', 'Summarize alignment and disagreement', 'Close with next steps and accountability'] },
];
C.area = (id) => C.AREAS.find((a) => a.id === id);

C.HSIA = [
  { id: 'headline', name: 'Headline', q: 'What is your central point?' },
  { id: 'structure', name: 'Structure', q: 'What are the two or three supporting arguments?' },
  { id: 'implication', name: 'Implication', q: 'Why does this matter?' },
  { id: 'action', name: 'Action', q: 'What should happen next?' },
];
C.HSIA_RULES = ['Three points, maximum', 'Two-sentence executive summary', 'One clear recommendation', 'One explicit next action'];

// Section 6: meeting performance scorecard
C.SCORECARD = [
  { id: 'opening', name: 'Opening', q: 'Did you establish credibility and context?' },
  { id: 'framing', name: 'Strategic framing', q: 'Did you frame the right problem?' },
  { id: 'clarity', name: 'Clarity', q: 'Were your points easy to understand?' },
  { id: 'concision', name: 'Conciseness', q: 'Did you eliminate unnecessary detail?' },
  { id: 'confidence', name: 'Confidence', q: 'Did you communicate conviction?' },
  { id: 'judgment', name: 'Judgment', q: 'Did you express a clear point of view?' },
  { id: 'influence', name: 'Influence', q: 'Did you move the discussion forward?' },
  { id: 'leadership', name: 'Leadership', q: 'Did you establish direction and ownership?' },
  { id: 'closing', name: 'Closing', q: 'Did you establish decisions and next steps?' },
];
C.MEETING_TYPES = [
  { id: 'internal', name: 'Internal leadership meeting' },
  { id: 'partner', name: 'External partnership discussion' },
  { id: 'ic', name: 'Investment committee presentation' },
  { id: 'negotiation', name: 'Strategic negotiation' },
  { id: 'oneonone', name: 'One-on-one with leadership' },
  { id: 'briefing', name: 'Presentation or executive briefing' },
];
C.mtype = (id) => C.MEETING_TYPES.find((m) => m.id === id) || { id, name: 'Meeting' };

C.OPERATING = {
  before: ['Identify the intended outcome', 'Define the central message', 'Establish three supporting points', 'Anticipate difficult questions', 'Determine the decision or action required'],
  during: ['Lead with the conclusion', 'Speak deliberately', 'Avoid unnecessary elaboration', 'Make recommendations', 'Close the loop'],
  after: ['Review the transcript', 'Score executive presence', 'Identify communication patterns', 'Compare against previous meetings', 'Set one improvement objective'],
};

// Section 7: executive language
C.EXEC_PHRASES = [
  { id: 'recommend', say: 'My recommendation is…', re: /\bmy recommendation (?:is|would be)\b|\bI recommend\b/i },
  { id: 'fundamental', say: 'The fundamental issue is…', re: /\bthe (?:fundamental|core|real|central) (?:issue|question|problem) (?:is|here)\b/i },
  { id: 'two', say: 'There are two considerations here.', re: /\bthere are (?:two|three) (?:considerations|things|issues|factors|reasons|questions)\b/i },
  { id: 'implication', say: 'The strategic implication is…', re: /\bthe (?:strategic )?implication (?:is|here)\b/i },
  { id: 'distinguish', say: 'I would distinguish between…', re: /\bI(?:'d| would) distinguish between\b/i },
  { id: 'decision', say: 'The decision we need to make is…', re: /\bthe decision (?:we need to make|in front of us|we need|we have to make|for us)\b/i },
  { id: 'prioritize', say: 'I would prioritize…', re: /\bI(?:'d| would) prioriti[sz]e\b/i },
  { id: 'risk', say: 'The risk I would focus on is…', re: /\bthe (?:risk|key risk|main risk) I(?:'d| would) focus on\b/i },
  { id: 'changemind', say: 'What would change my mind is…', re: /\bwhat would change my mind\b|\bI(?:'d| would) change my (?:mind|view) if\b/i },
  { id: 'summary', say: 'Let me summarize where we are…', re: /\blet me summari[sz]e\b|\bto summari[sz]e where we are\b|\bwhere we agree\b/i },
];
C.WEAK_PHRASES = [
  { say: 'I think maybe we should consider…', re: /\bI think maybe\b|\bmaybe we should consider\b/i },
  { say: 'One thing I was thinking about…', re: /\bone thing I was thinking\b|\bI was (?:just )?thinking (?:about|that)\b/i },
  { say: 'I\'m not sure if this makes sense…', re: /\bI'm not sure (?:if|whether) (?:this|that) makes sense\b|\bnot sure if this makes sense\b/i },
];

// Section 11: stages and levels. Promotions into a new stage need the scores, not just XP.
C.STAGES = [
  { id: 1, name: 'Strong Analyst', blurb: 'Understands complex issues, develops insights and provides rigorous analysis.' },
  { id: 2, name: 'Strategic Business Leader', blurb: 'Synthesizes information, forms independent judgments, recommends actions and influences stakeholders.' },
  { id: 3, name: 'Executive', blurb: 'Sets direction, shapes decisions, mobilizes people, manages ambiguity and creates organizational outcomes.' },
];
C.LEVELS = [
  { n: 1, stage: 1, xp: 0, title: 'Analyst I' },
  { n: 2, stage: 1, xp: 150, title: 'Analyst II' },
  { n: 3, stage: 1, xp: 400, title: 'Senior Analyst' },
  { n: 4, stage: 2, xp: 800, title: 'Strategist' },
  { n: 5, stage: 2, xp: 1300, title: 'Strategic Advisor' },
  { n: 6, stage: 2, xp: 2000, title: 'Business Leader' },
  { n: 7, stage: 3, xp: 3000, title: 'Executive' },
  { n: 8, stage: 3, xp: 4200, title: 'Senior Executive' },
  { n: 9, stage: 3, xp: 6000, title: 'Enterprise Leader' },
];
C.GATES = {
  2: { score: 78, reps: 10, text: 'Average 7.8+ over your last 10 scored reps' },
  3: { score: 85, reps: 10, meetings: 3, meetingScore: 80, text: 'Average 8.5+ over your last 10 scored reps, and three real meetings reviewed at 8.0+' },
};
C.STREAK_MULT = [[30, 2], [14, 1.5], [7, 1.25], [3, 1.1], [0, 1]];

// Section 8: leadership quests (real-world, weekly)
C.QUESTS = [
  { id: 'own1', cat: 'Strategic ownership', text: 'In one meeting, say "I\'ll own this" and name the next step and the date.' },
  { id: 'own2', cat: 'Strategic ownership', text: 'Take one problem you\'ve been analyzing and write the recommendation you would defend.' },
  { id: 'dec1', cat: 'Decision-making', text: 'Make one recommendation before all the data is in. Say what would change your mind.' },
  { id: 'dec2', cat: 'Decision-making', text: 'When asked "what do you think?", answer with a position in the first sentence.' },
  { id: 'up1', cat: 'Managing up', text: 'Send your leader a three-line note before they ask: what changed, what\'s at risk, what you need.' },
  { id: 'up2', cat: 'Managing up', text: 'Before a leadership meeting, tell your boss the one decision you\'ll ask for.' },
  { id: 'inf1', cat: 'Organizational influence', text: 'Pre-wire one decision: talk to two stakeholders one-on-one before the meeting.' },
  { id: 'inf2', cat: 'Organizational influence', text: 'In a cross-functional meeting, summarize where the group agrees and where it doesn\'t.' },
  { id: 'del1', cat: 'Delegation', text: 'Hand off one workstream you\'d normally carry. Agree on the outcome and the check-in, not the method.' },
  { id: 'del2', cat: 'Delegation', text: 'Ask a team member to present a piece you would normally present. Coach them beforehand.' },
  { id: 'jud1', cat: 'Executive judgment', text: 'In one meeting, drop a point on purpose: "That\'s interesting, but not decision-relevant."' },
  { id: 'jud2', cat: 'Executive judgment', text: 'Cut your next update to the three points that matter. Leave the rest in the appendix.' },
];

// Area tags for the existing scenarios
C.SCEN_AREAS = {
  'ic-rec': ['A', 'B', 'C'], 'lp-why': ['D', 'C'], thesis: ['A', 'C'], 'valuation-push': ['D', 'C'], anchor: ['D', 'C'],
  'board-bad-news': ['A', 'D'], 'status-60': ['B', 'E'], 'town-hall': ['E', 'A'], 'no-unknown': ['D', 'B'], 'close-meeting': ['E'],
  tmay: ['B', 'A'], 'why-move': ['B', 'D'], weakness: ['D'], 'deal-story': ['B', 'C'], elevator: ['B'], 'disagree-up': ['D', 'C'],
  'say-no': ['D', 'E'], 'open-meeting': ['E', 'A'], recognize: ['B'],
};
C.SCENARIOS.unshift(
  { id: 'two-sentence', cat: 'board', title: 'Two-sentence executive summary', time: 20, areas: ['A', 'B'],
    audience: 'Your CEO, in a hallway between meetings.', situation: 'A partnership you lead has had a complicated month: a delayed payer contract, a strong clinical readout, and a request for more budget.',
    prompt: 'They ask, "Where are we on the partnership?" Answer in exactly two sentences.',
    criteria: ['Exactly two sentences', 'The headline first', 'The one thing they need to know or decide', 'No background'], tip: 'Sentence one: where it stands. Sentence two: what you need or what happens next.', focus: [] },
  { id: 'frame-problem', cat: 'board', title: 'Frame the problem and run the room', time: 75, areas: ['E', 'A'],
    audience: 'A leadership team of six. They\'ve debated this twice without a decision.', situation: 'The question is whether to expand into transplant diagnostics this year. You called the meeting.',
    prompt: 'Open the discussion: frame the problem, set the decision criteria, and say how you\'ll run the next 40 minutes.',
    criteria: ['Frames the actual decision in one sentence', 'Names two or three decision criteria', 'Sets how the discussion will run', 'Says what will be decided by the end'], tip: '"The decision we need to make is… We\'ll judge it on three criteria…"', focus: [] },
  { id: 'summarize-room', cat: 'board', title: 'Summarize alignment and disagreement', time: 60, areas: ['E', 'B'],
    audience: 'CFO, CMO and COO, 30 minutes into a stalled debate.', situation: 'The CFO wants to partner for a new test to save capital. The CMO wants to build to control the data. The COO worries about lab capacity.',
    prompt: 'Step in. Summarize where the group agrees, where it disagrees, and propose how to resolve it.',
    criteria: ['States the agreement first', 'Names the real disagreement precisely', 'Proposes a way to resolve it', 'Assigns an owner and a date'], tip: '"Let me summarize where we are. We agree on… We disagree on… I propose…"', focus: [] },
  { id: 'judgment-call', cat: 'deals', title: '"What\'s your call?"', time: 60, areas: ['C', 'D'],
    audience: 'The CEO.', situation: 'Diligence on an acquisition is 70% done. Two open questions remain: payer mix and retention of the lab director.',
    prompt: 'The CEO asks, "If you had to decide today, what\'s your call?" Answer.',
    criteria: ['A clear recommendation in the first sentence', 'The main trade-off, made explicit', 'What would change your mind', 'The next action'], tip: 'Judgment under uncertainty is the job. Decide, then say what would change it.', focus: [] },
  { id: 'distinguish', cat: 'deals', title: 'Scientific merit vs investment merit', time: 60, areas: ['C', 'A'],
    audience: 'A physician leader who is excited about a startup\'s breakthrough assay.', situation: 'The science is excellent. The reimbursement path is unclear and the company needs $30M.',
    prompt: 'Give your view on whether to invest, separating scientific merit from investment merit.',
    criteria: ['A position in the first sentence', 'Separates science from economics', 'Respects their enthusiasm without deferring to it', 'Says what would make it investable'], tip: '"I would distinguish between scientific merit and investment merit."', focus: [] },
  { id: 'brief-up', cat: 'board', title: 'Brief your boss in 45 seconds', time: 45, areas: ['A', 'B'],
    audience: 'Your boss, walking into a board meeting in ten minutes.', situation: 'Overnight, the target company lowered its revenue guidance by 12% and asked to delay signing.',
    prompt: 'Brief them: what changed, why it matters, what you recommend, and what you need from them.',
    criteria: ['Leads with what changed', 'The implication in one line', 'A recommendation', 'A specific ask'], tip: 'Anticipate what leadership needs to know, and tell them before they ask.', focus: [] },
);
for (const s of C.SCENARIOS) if (!s.areas) s.areas = C.SCEN_AREAS[s.id] || ['A'];

C.PERSONAS.splice(1, 0, {
  id: 'divided-room', name: 'The Divided Room', role: 'Leadership team that disagrees',
  style: 'You voice three executives: a CFO, a CMO and a COO. Prefix each line with the speaker ("CFO: …"). They talk past each other, drift into operational detail and wait to see whether someone takes charge. When the person frames the problem, sets criteria, summarizes or closes with owners and dates, the room responds to it; when they just add analysis, the debate keeps going.',
  defaultContext: 'A leadership meeting to decide whether to build or partner for a new transplant diagnostics test. You are the corporate development lead and you called the meeting.',
  focus: [], areas: ['E', 'C'],
});
C.QBANK['divided-room'] = ['CFO: Building costs six million. Partnering is a fraction of that. Why are we still debating?', 'CMO: If we partner, we lose the data. That\'s the whole point. COO: And nobody has asked whether the lab can even handle it.', 'CFO: We\'ve been at this for half an hour. Where do we actually land?', 'COO: Before we decide anything, who owns the capacity analysis?', 'CMO: So what are we telling the CEO tomorrow?'];
const PERSONA_AREAS = { 'ic-chair': ['A', 'C'], lp: ['D', 'C'], 'hiring-partner': ['B', 'A'], 'board-member': ['D', 'A'], cfo: ['D', 'C'], ceo: ['A', 'B'], moderator: ['D', 'C'] };
for (const p of C.PERSONAS) if (!p.areas) p.areas = PERSONA_AREAS[p.id] || ['A'];
C.BOSS_ROTATION = ['ic-chair', 'divided-room', 'cfo', 'board-member', 'lp', 'ceo', 'hiring-partner', 'moderator'];

C.WORD_SWAPS.unshift(
  ['I think maybe we should consider…', 'My recommendation is…'],
  ['One thing I was thinking about…', 'The fundamental issue is…'],
  ['I\'m not sure if this makes sense…', 'There are two considerations here.'],
  ['There are a lot of moving pieces.', 'I would distinguish between X and Y.'],
  ['So what this could mean is…', 'The strategic implication is…'],
  ['We should probably figure out what to do.', 'The decision we need to make is…'],
  ['There are a bunch of things we could look at.', 'I would prioritize…'],
  ['There are some risks to think about.', 'The risk I would focus on is…'],
);

// Executive or Analyst? quick-fire bank. exec: true = executive-level.
C.EOA = [
  { t: 'Before I get to the recommendation, let me walk through some of the background on how we got here.', exec: false, a: 'A', fix: 'My recommendation is to proceed. Here\'s why.' },
  { t: 'My recommendation is to proceed with a minority investment, conditional on a reimbursement milestone.', exec: true, a: 'A', why: 'Conclusion first, with the condition attached.' },
  { t: 'I think maybe we should consider partnering instead of building.', exec: false, a: 'D', fix: 'My recommendation is to partner rather than build.' },
  { t: 'The fundamental issue is not the science. It\'s who pays for the test.', exec: true, a: 'A', why: 'Frames the real problem in one line.' },
  { t: 'There are a lot of considerations: the market, the regulatory path, the team, reimbursement, competition and the capital needs.', exec: false, a: 'B', fix: 'Two considerations decide this: reimbursement and capital.' },
  { t: 'There are two considerations here: speed to market and control of the data.', exec: true, a: 'B', why: 'Previews a tight structure.' },
  { t: 'One thing I was thinking about is whether the timeline is realistic.', exec: false, a: 'D', fix: 'The risk I would focus on is the timeline.' },
  { t: 'The risk I would focus on is execution: this team has never scaled a lab.', exec: true, a: 'C', why: 'Names one risk, specifically.' },
  { t: 'I\'m not sure if this makes sense, but could we look at a licensing model?', exec: false, a: 'D', fix: 'I would distinguish between owning the asset and licensing it. Licensing gets most of the value for a third of the capital.' },
  { t: 'I would distinguish between scientific merit and investment merit. This has the first, not yet the second.', exec: true, a: 'C', why: 'A clear judgment built on a distinction.' },
  { t: 'On one hand the science is strong; on the other, the economics are uncertain, so there are arguments both ways.', exec: false, a: 'C', fix: 'The science is strong but the economics aren\'t there. I\'d pass at this price and revisit at the next round.' },
  { t: 'My recommendation is that we continue to evaluate the opportunity and gather more data.', exec: false, a: 'C', fix: 'My recommendation is to pass unless payer data arrives by March. That\'s what would change my mind.' },
  { t: 'What would change my mind is a signed commercial payer contract.', exec: true, a: 'C', why: 'Calibrated conviction: a position plus the evidence that would move it.' },
  { t: 'We could go a number of directions; it really depends on what leadership wants.', exec: false, a: 'E', fix: 'I\'d prioritize option B. The decision we need today is whether to fund diligence.' },
  { t: 'The decision we need to make today is whether to fund four weeks of diligence.', exec: true, a: 'E', why: 'Names the decision so the room can make it.' },
  { t: 'So, to say it another way, and just to reiterate, the economics are challenging.', exec: false, a: 'B', fix: 'The economics don\'t work at this price. (Then stop.)' },
  { t: 'Just to add some operational detail: samples ship overnight in temperature-controlled boxes through two couriers.', exec: false, a: 'B', fix: 'Cut it. It doesn\'t change the decision.' },
  { t: 'I\'ll let others weigh in before I share my thoughts.', exec: false, a: 'E', fix: 'Let me frame the decision, then I want to hear where everyone lands.' },
  { t: 'Let me frame this: we\'re deciding build versus partner, and we\'ll judge it on cost, speed and control of the data.', exec: true, a: 'E', why: 'Frames the problem and sets the criteria.' },
  { t: 'Great discussion, everyone. Let\'s sync up offline.', exec: false, a: 'E', fix: 'To close: we\'re approving diligence, Priya owns the model, and we reconvene on the 14th.' },
  { t: 'To close: we\'re approving diligence, Priya owns the model, and we reconvene on the 14th.', exec: true, a: 'E', why: 'Decision, owner and date.' },
  { t: 'It\'s possible the valuation could be somewhat high relative to comparables.', exec: false, a: 'D', fix: 'The valuation is 30% above comparables. I\'d counter at six times revenue.' },
  { t: 'I see it differently. Partnering gets us to market a year faster for a third of the capital.', exec: true, a: 'D', why: 'Disagrees directly, with a number.' },
  { t: 'Let me think out loud for a second about how this could work.', exec: false, a: 'A', fix: 'Here\'s how I\'d structure it. Two pieces.' },
  { t: 'I don\'t want to overstep, but I had a few thoughts.', exec: false, a: 'D', fix: 'I\'d push back on one point.' },
  { t: 'There are seven factors we should weigh before deciding.', exec: false, a: 'B', fix: 'Three factors decide this. The rest are noise.' },
  { t: 'Three things decide this deal: coverage, distribution and the team.', exec: true, a: 'B', why: 'Three points, maximum.' },
  { t: 'I would prioritize the payer strategy over the second indication.', exec: true, a: 'C', why: 'Makes the trade-off explicit.' },
  { t: 'We\'ve done a lot of analysis and we\'re still looking at a few different scenarios.', exec: false, a: 'C', fix: 'We ran four scenarios. Two survive. I recommend the second.' },
  { t: 'Let me summarize: we agree on the strategy and disagree on timing. Raj owns the timing analysis by Thursday.', exec: true, a: 'E', why: 'Summarizes and assigns ownership.' },
  { t: 'The strategic implication is that we become the default validation partner for transplant diagnostics.', exec: true, a: 'A', why: 'Lifts the point to why it matters.' },
  { t: 'Sorry, quick question, I might have missed this earlier.', exec: false, a: 'D', fix: 'One question: what\'s the payback period?' },
  { t: 'I\'ll own the integration plan and bring it back to this group in two weeks.', exec: true, a: 'D', why: 'Takes ownership with a date.' },
  { t: 'It depends. There are pros and cons and I can see it going either way.', exec: false, a: 'C', fix: 'It depends on one thing: coverage. If we get it by Q2, we invest.' },
  { t: 'Bottom line: we pass at this price. Two reasons.', exec: true, a: 'A', why: 'Headline, then structure.' },
  { t: 'Does that make sense?', exec: false, a: 'D', fix: 'What questions do you have?' },
];

// Headline Builder cases: raw analyst notes to turn into H → S → I → A
C.HSIA_CASES = [
  { id: 'deal', title: 'Series B diagnostics deal', audience: 'Investment committee',
    notes: ['Test covered by a Medicare LCD since March; commercial payers not yet', '30 transplant centers have expressed interest', 'Valuation $120M pre-money: 8x revenue vs 6x for comparables', 'Team strong scientifically, thin commercially', 'A competitor launches a kitted version in 2027', 'We would get regional exclusivity', 'Ask: $15M'] },
  { id: 'miss', title: 'Partnership behind plan', audience: 'Board strategy committee',
    notes: ['Revenue 40% below plan at month 9', 'Cause: payer contracting is slower than modeled', 'Ordering physicians growing 12% a month', 'Partner requests a 6-month extension, cost to us $1.2M', 'Exiting now costs a $0.3M penalty', 'Clinical feedback is strong'] },
  { id: 'build', title: 'Build vs partner', audience: 'Executive team',
    notes: ['An SVP wants to build the test in-house', 'Build: $6M and 24 months', 'Partner: $1.5M and 9 months, less control of the data', 'The data has moderate strategic value', 'Lab capacity is already constrained', 'A competitor is 12 months from launch'] },
  { id: 'ai', title: 'AI pathology vendor', audience: 'CMO and CFO',
    notes: ['Pilot showed reads 18% faster', 'Pathologists are split on adoption', 'Vendor wants a 5-year exclusive', 'Price $900K a year', 'IT integration takes 6 months', 'Two peer systems have already adopted'] },
  { id: 'room', title: 'A stalled leadership debate', audience: 'Three VPs who disagree',
    notes: ['Debate: prioritize oncology or transplant next year', 'No decision criteria have been agreed', '45 minutes into a 60-minute meeting', 'A decision is needed by quarter end', 'Oncology: bigger market, crowded', 'Transplant: smaller market, we have an edge'] },
  { id: 'interview', title: '"Why should we hire you?"', audience: 'Hiring partner, healthcare investing',
    notes: ['Background: banking, then corporate development at an academic health system', 'Led three partnerships, one doubled a startup\'s volume', 'CFA charterholder', 'Wants to invest earlier, with more ownership of outcomes', 'Deep diagnostics and reimbursement knowledge'] },
];

C.BADGES = [
  { id: 'first', name: 'First rep', desc: 'Complete your first practice rep.' },
  { id: 'streak3', name: 'Three-day streak', desc: 'Practice three days in a row.' },
  { id: 'streak7', name: 'Seven-day streak', desc: 'Seven days in a row. XP ×1.25.' },
  { id: 'streak30', name: 'Thirty-day streak', desc: 'Thirty days in a row. XP ×2.' },
  { id: 'fullhouse', name: 'Full house', desc: 'Hit all four of Headline, Structure, Implication and Action in one rep.' },
  { id: 'fullhouse10', name: 'Framework native', desc: 'Ten full-house reps.' },
  { id: 'headline10', name: 'Headline first', desc: 'Lead with the conclusion in ten reps.' },
  { id: 'nohedge', name: 'No hedges', desc: 'An 80+ word rep with zero hedges.' },
  { id: 'arsenal5', name: 'Executive vocabulary', desc: 'Use five different executive phrases in reps.' },
  { id: 'arsenal10', name: 'Full arsenal', desc: 'Use all ten executive phrases.' },
  { id: 'eoa90', name: 'Sharp ear', desc: '90%+ accuracy in Executive or Analyst?' },
  { id: 'hsia8', name: 'Headline builder', desc: 'Score 8.0+ in the Headline Builder.' },
  { id: 'spar1', name: 'Into the arena', desc: 'Finish a sparring session.' },
  { id: 'boss1', name: 'Boss defeated', desc: 'Beat a weekly boss with 8.0+.' },
  { id: 'boss4', name: 'Boss slayer', desc: 'Beat four weekly bosses.' },
  { id: 'room', name: 'Ran the room', desc: 'Score 8.0+ against the Divided Room.' },
  { id: 'meeting1', name: 'Game film', desc: 'Review your first real meeting.' },
  { id: 'meeting5', name: 'Longitudinal', desc: 'Review five real meetings.' },
  { id: 'meeting8', name: 'Executive in the room', desc: 'A real meeting scored 8.0+.' },
  { id: 'quest3', name: 'Field leader', desc: 'Complete three leadership quests.' },
  { id: 'runback', name: 'Run it back', desc: 'Improve a retry by 1.0+.' },
  { id: 'score85', name: 'On target', desc: 'Score 8.5+ on a rep: your target level.' },
  { id: 'perfect', name: 'Perfect day', desc: 'Finish all three daily missions.' },
  { id: 'perfect7', name: 'Perfect week', desc: 'Seven perfect days.' },
  { id: 'stage2', name: 'Strategic Business Leader', desc: 'Reach Stage 2.' },
  { id: 'stage3', name: 'Executive', desc: 'Reach Stage 3.' },
];
