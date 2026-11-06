/* ============================================================
   Green Room — content library
   Skills framework, scenarios, sparring personas, drills, lessons.
   ============================================================ */
const C = {};

C.PILLARS = [
  { id: 'gravitas', name: 'Gravitas', blurb: 'Composure, conviction and decisiveness: the sense that you can be trusted with the hard call.' },
  { id: 'communication', name: 'Communication', blurb: 'Answer first, say it briefly, structure it so busy people can follow.' },
  { id: 'voice', name: 'Voice & articulation', blurb: 'Pace, pauses, crisp words and a voice that lands statements as statements.' },
  { id: 'language', name: 'Language power', blurb: 'Words that carry authority: no hedges, clear ownership, specific numbers.' },
  { id: 'physical', name: 'Physical & camera presence', blurb: 'Posture, eye contact, gestures and how you show up on video.' },
  { id: 'influence', name: 'Influence', blurb: 'Reading the room, disagreeing well and moving senior stakeholders.' },
];

C.SKILLS = [
  { id: 'composure', pillar: 'gravitas', name: 'Composure under pressure', good: 'Stays steady when challenged: slower, not faster; shorter, not longer.' },
  { id: 'conviction', pillar: 'gravitas', name: 'Conviction & point of view', good: 'States a clear position and the reasoning behind it.' },
  { id: 'decisiveness', pillar: 'gravitas', name: 'Decisiveness', good: 'Makes the call with incomplete information and names the trade-off.' },
  { id: 'bluf', pillar: 'communication', name: 'Answer first (BLUF)', good: 'The first sentence is the answer, recommendation or ask.' },
  { id: 'concision', pillar: 'communication', name: 'Concision', good: 'Uses the fewest words that carry the point, then stops.' },
  { id: 'structure', pillar: 'communication', name: 'Structure & signposting', good: 'Previews the shape ("three reasons"), walks it, lands the summary.' },
  { id: 'storytelling', pillar: 'communication', name: 'Storytelling', good: 'Makes a point stick with one specific example or moment.' },
  { id: 'qa', pillar: 'communication', name: 'Handling tough questions', good: 'Pauses, answers the question asked, bridges only when it helps.' },
  { id: 'altitude', pillar: 'communication', name: 'Executive altitude', good: 'Speaks at the so-what level: impact, money, risk, decision.' },
  { id: 'pace', pillar: 'voice', name: 'Pace control', good: 'Holds 130–160 words a minute and slows down for what matters.' },
  { id: 'pauses', pillar: 'voice', name: 'Purposeful pauses', good: 'Uses silence before and after key points instead of fillers.' },
  { id: 'fillers', pillar: 'voice', name: 'Filler-free speech', good: 'Fewer than two fillers a minute, even when thinking on the spot.' },
  { id: 'vocal_variety', pillar: 'voice', name: 'Vocal variety & inflection', good: 'Varied pitch and volume; statements end down, not up.' },
  { id: 'enunciation', pillar: 'voice', name: 'Enunciation', good: 'Crisp consonants, finished word endings, numbers said clearly.' },
  { id: 'hedging', pillar: 'language', name: 'Hedge-free language', good: 'No "I think", "kind of" or "just" diluting the point.' },
  { id: 'ownership', pillar: 'language', name: 'Ownership language', good: '"I recommend", "I decided", "we will". Owns outcomes, credits the team.' },
  { id: 'precision', pillar: 'language', name: 'Precision & specificity', good: 'Numbers, names and dates instead of "a lot", "soon", "some".' },
  { id: 'body', pillar: 'physical', name: 'Posture & gestures', good: 'Grounded, still, open; gestures that match the words.' },
  { id: 'eye', pillar: 'physical', name: 'Eye contact & camera presence', good: 'Holds eye contact through the end of a sentence; lens at eye level on video.' },
  { id: 'polish', pillar: 'physical', name: 'Polish & setting', good: 'Light on the face, clean frame, attire one notch above the room.' },
  { id: 'listening', pillar: 'influence', name: 'Listening & reading the room', good: 'Paraphrases before answering; adjusts depth to the audience.' },
  { id: 'pushback', pillar: 'influence', name: 'Disagreeing well', good: 'Disagrees directly and respectfully, with an alternative.' },
  { id: 'stakeholder', pillar: 'influence', name: 'Managing up', good: 'Brings senior people decisions and options, not status.' },
];
C.skill = (id) => C.SKILLS.find((s) => s.id === id);

// Which scoring dimension each skill shows up in
C.DIMENSIONS = [
  { id: 'clarity', name: 'Clarity', blurb: 'Answer first, clear structure' },
  { id: 'concision', name: 'Concision', blurb: 'Short sentences, nothing wasted' },
  { id: 'confidence', name: 'Confidence', blurb: 'No hedges, clear ownership' },
  { id: 'delivery', name: 'Delivery', blurb: 'Pace, pauses, fillers, voice' },
  { id: 'impact', name: 'Executive impact', blurb: 'So-what, numbers, the ask' },
  { id: 'composure', name: 'Composure', blurb: 'Steady under challenge' },
];
C.SKILL_DIM = {
  composure: 'composure', conviction: 'confidence', decisiveness: 'confidence', bluf: 'clarity', concision: 'concision',
  structure: 'clarity', storytelling: 'impact', qa: 'composure', altitude: 'impact', pace: 'delivery', pauses: 'delivery',
  fillers: 'delivery', vocal_variety: 'delivery', enunciation: 'delivery', hedging: 'confidence', ownership: 'confidence',
  precision: 'impact', body: 'delivery', eye: 'delivery', polish: 'impact', listening: 'composure', pushback: 'confidence',
  stakeholder: 'impact',
};

// Starter focus until an evaluation is imported
C.STARTER_FOCUS = ['bluf', 'concision', 'altitude', 'hedging', 'pauses', 'qa'];

C.LEVELS = [
  { xp: 0, name: 'Associate' }, { xp: 200, name: 'Manager' }, { xp: 600, name: 'Director' },
  { xp: 1400, name: 'Vice President' }, { xp: 2800, name: 'SVP' }, { xp: 5000, name: 'C-Suite' }, { xp: 8000, name: 'Board Chair' },
];

/* ------------------------------------------------------------
   Scenarios. time = seconds. focus = skill ids.
   ------------------------------------------------------------ */
C.SCENARIO_CATS = [
  { id: 'deals', name: 'Deals & investing' },
  { id: 'board', name: 'Board & leadership' },
  { id: 'career', name: 'Career & interviews' },
  { id: 'influence', name: 'Everyday influence' },
];

C.SCENARIOS = [
  {
    id: 'ic-rec', cat: 'deals', title: 'IC recommendation in 90 seconds', time: 90,
    audience: 'Investment committee: CFO, CMO and two physician leaders. They have read the memo.',
    situation: 'You finished diligence on a Series B diagnostics company. The committee meets for 20 minutes and your deal is third.',
    prompt: 'Give your recommendation, the two reasons that matter most, the biggest risk with its mitigant, and the ask.',
    criteria: ['Recommendation in the first sentence', 'Two reasons, each with a number', 'Names the biggest risk and how it is mitigated', 'Ends on a specific ask'],
    tip: 'They read the memo. Don\'t retell it. Tell them what to decide and why.',
    focus: ['bluf', 'altitude', 'conviction', 'concision'],
  },
  {
    id: 'lp-why', cat: 'deals', title: 'Why should I back you?', time: 60,
    audience: 'A physician-investor running a single-family office. They have heard eight fund pitches this year.',
    situation: 'Second meeting. They liked the thesis but are deciding between you and a larger, better-known manager.',
    prompt: 'Answer their question: "Why should I back you over the others?"',
    criteria: ['A differentiated edge, stated in one line', 'One proof point only you can claim', 'No generic claims ("passionate", "disciplined")', 'Closes with what you want next'],
    tip: 'Everyone says "disciplined" and "network". Name the thing only you can say, then prove it.',
    focus: ['conviction', 'precision', 'storytelling'],
  },
  {
    id: 'thesis', cat: 'deals', title: 'Your investment thesis in 60 seconds', time: 60,
    audience: 'A senior partner deciding whether to give you time on next week\'s agenda.',
    situation: 'Hallway conversation after a portfolio review.',
    prompt: 'Pitch the investment thesis you would build a portfolio around.',
    criteria: ['Thesis in one sentence', 'Why now: one market shift', 'How it makes money', 'What would prove you wrong'],
    tip: 'A thesis that can\'t be wrong isn\'t a thesis. Say what would change your mind.',
    focus: ['bluf', 'conviction', 'altitude'],
  },
  {
    id: 'valuation-push', cat: 'deals', title: '"We\'re overpaying"', time: 60,
    audience: 'A skeptical CFO in the deal review.',
    situation: 'You are proposing a minority investment at 6x forward revenue. The CFO cuts in.',
    prompt: 'Respond to: "We\'re overpaying. Why would we pay six times revenue for this?"',
    criteria: ['Acknowledges the concern without defending reflexively', 'Reframes with one or two data points', 'Holds the position or names the walk-away price', 'Stays short and calm'],
    tip: 'Pause first. A two-second pause before answering reads as confidence, not hesitation.',
    focus: ['composure', 'qa', 'precision', 'pushback'],
  },
  {
    id: 'anchor', cat: 'deals', title: 'Anchor the negotiation', time: 60,
    audience: 'The founder and CEO, plus their lead investor.',
    situation: 'Term sheet discussion. They want $8M upfront; you want more of the value tied to milestones.',
    prompt: 'Lay out your position on upfront cash versus milestone payments.',
    criteria: ['States the number first', 'Ties it to a principle they can accept', 'Signals flexibility on terms, not on value', 'Asks for their reaction, then stops'],
    tip: 'Say the number, then stop talking. Filling the silence gives value away.',
    focus: ['conviction', 'pauses', 'precision'],
  },
  {
    id: 'board-bad-news', cat: 'board', title: 'Deliver bad news to the board', time: 90,
    audience: 'The board\'s strategy committee.',
    situation: 'A partnership you championed is 40% below its revenue plan at month nine.',
    prompt: 'Open your update to the committee.',
    criteria: ['States the miss plainly in the first sentence', 'Owns it without excessive apology', 'One clear cause', 'The plan and what you need from them'],
    tip: 'Headline, ownership, cause, plan, ask. Bad news delivered early and plainly builds trust.',
    focus: ['bluf', 'ownership', 'composure'],
  },
  {
    id: 'status-60', cat: 'board', title: '60-second pipeline update', time: 60,
    audience: 'Executive staff meeting. Eight leaders, tight agenda.',
    situation: 'You have five deals in the pipeline. One needs a decision this week.',
    prompt: 'Give your weekly update.',
    criteria: ['Leads with what changed and the decision needed', 'Skips process narrative', 'One number per deal at most', 'Ends with the ask and the deadline'],
    tip: 'Senior people want decisions and exceptions, not activity.',
    focus: ['stakeholder', 'concision', 'altitude'],
  },
  {
    id: 'town-hall', cat: 'board', title: 'Announce a change to your team', time: 90,
    audience: 'Your team of nine, some of whom will be unhappy.',
    situation: 'Your deal team will now report into a new enterprise strategy office.',
    prompt: 'Announce the change.',
    criteria: ['What is changing, in one sentence', 'Why, in their terms', 'What it means for them, and what stays the same', 'How they can raise concerns'],
    tip: 'People hear "what does this mean for me?" first. Answer it before they ask.',
    focus: ['bluf', 'listening', 'storytelling'],
  },
  {
    id: 'no-unknown', cat: 'board', title: '"I don\'t know that number"', time: 30,
    audience: 'A board member, in front of the full board.',
    situation: 'You are asked for the exact commercial payer mix of a target company. You don\'t have it.',
    prompt: 'Answer the question.',
    criteria: ['No bluffing', 'Gives what you do know', 'Commits to a specific follow-up time', 'Under 30 seconds and calm'],
    tip: '"I don\'t have that number with me. Here\'s what I do know… I\'ll have it to you by Thursday."',
    focus: ['composure', 'qa', 'ownership'],
  },
  {
    id: 'close-meeting', cat: 'board', title: 'Close the meeting with decisions', time: 45,
    audience: 'Cross-functional leaders after a 60-minute working session.',
    situation: 'The discussion wandered. You have five minutes left.',
    prompt: 'Summarize the decisions, owners and dates, and close the meeting.',
    criteria: ['Decisions stated as decisions', 'Each with an owner and a date', 'Names what is still open', 'Ends on time'],
    tip: 'The person who summarizes the meeting usually owns the outcome.',
    focus: ['structure', 'decisiveness', 'concision'],
  },
  {
    id: 'tmay', cat: 'career', title: '"Tell me about yourself"', time: 90,
    audience: 'A partner at a healthcare growth equity firm.',
    situation: 'First-round interview for a principal role.',
    prompt: 'Answer: "Walk me through your background."',
    criteria: ['Present, past, future arc', 'One signature deal with a number', 'Why this role, why now', 'Under 90 seconds'],
    tip: 'This is a pitch, not a biography. Every sentence should point to why you, for this seat.',
    focus: ['storytelling', 'concision', 'precision'],
  },
  {
    id: 'why-move', cat: 'career', title: '"Why are you making a move?"', time: 45,
    audience: 'A hiring manager at an AI lab\'s finance team.',
    situation: 'Second-round interview. They are probing your motivation.',
    prompt: 'Answer: "Why leave a strong role to do this?"',
    criteria: ['Forward-looking, toward something', 'No complaints about your current employer', 'Connects your edge to their need', 'Crisp ending'],
    tip: 'Move toward, not away from.',
    focus: ['conviction', 'concision'],
  },
  {
    id: 'weakness', cat: 'career', title: '"What\'s a real weakness?"', time: 60,
    audience: 'A senior partner who dislikes rehearsed answers.',
    situation: 'Final-round interview.',
    prompt: 'Answer: "Tell me about a real development area. Not a humble-brag."',
    criteria: ['A real, specific development area', 'Evidence you are working on it', 'One result of that work', 'No over-apologizing'],
    tip: 'Self-awareness plus a system for improving reads as strength.',
    focus: ['composure', 'ownership', 'storytelling'],
  },
  {
    id: 'deal-story', cat: 'career', title: 'Walk me through a deal', time: 120,
    audience: 'An interview panel for a corporate development leadership role.',
    situation: 'Case-style interview question.',
    prompt: 'Walk the panel through the most complex deal you led: situation, your role, the hardest moment, outcome.',
    criteria: ['Situation and stakes in two sentences', 'Your specific decisions, said with "I"', 'The hardest moment and how you handled it', 'Outcome in numbers and what you\'d do differently'],
    tip: 'Use "I" for your decisions and "we" for the team\'s work.',
    focus: ['storytelling', 'ownership', 'structure'],
  },
  {
    id: 'elevator', cat: 'influence', title: '30 seconds with a health system CEO', time: 30,
    audience: 'A health system CEO at a conference reception.',
    situation: 'They ask, "So, what do you do?" They have about 30 seconds.',
    prompt: 'Answer them.',
    criteria: ['One-line identity they will remember', 'One proof point', 'A hook that invites a follow-up', 'Under 30 seconds'],
    tip: 'Make them ask a second question. That\'s the whole goal.',
    focus: ['concision', 'precision', 'storytelling'],
  },
  {
    id: 'disagree-up', cat: 'influence', title: 'Disagree with a senior leader', time: 60,
    audience: 'An SVP, in a meeting with their peers present.',
    situation: 'The SVP proposes building a diagnostic test in-house. You believe partnering is faster and cheaper.',
    prompt: 'Make your case for partnering.',
    criteria: ['Acknowledges their goal first', 'States the disagreement directly', 'Offers the alternative with one number', 'Invites a decision, not a debate'],
    tip: 'Agree on the goal, disagree on the path.',
    focus: ['pushback', 'conviction', 'listening'],
  },
  {
    id: 'say-no', cat: 'influence', title: 'Say no to an executive request', time: 45,
    audience: 'The CEO\'s chief of staff.',
    situation: 'They want full diligence on a target in one week. Doing it properly takes four.',
    prompt: 'Respond to the request.',
    criteria: ['A clear no to the timeline, said early', 'What you can deliver in one week', 'The risk of rushing, in one line', 'An option they can choose'],
    tip: 'Never just "no". Give a "no, and here\'s what I can do".',
    focus: ['pushback', 'stakeholder', 'decisiveness'],
  },
  {
    id: 'open-meeting', cat: 'influence', title: 'Open a high-stakes first meeting', time: 45,
    audience: 'Head of corporate development at a strategic acquirer.',
    situation: 'First meeting. They agreed to 30 minutes as a favor to a mutual contact.',
    prompt: 'Open the meeting.',
    criteria: ['Thanks them in one line, no more', 'Purpose and desired outcome', 'A short agenda', 'Hands over with a question'],
    tip: 'The first 30 seconds decide whether they lean in or check their phone.',
    focus: ['structure', 'bluf', 'listening'],
  },
  {
    id: 'recognize', cat: 'influence', title: 'Recognize a team member publicly', time: 30,
    audience: 'Your division leadership meeting.',
    situation: 'An analyst found a reconciliation error that saved the deal $2M.',
    prompt: 'Recognize them.',
    criteria: ['Specific about what they did', 'The impact, with the number', 'Why it matters beyond this deal', 'Warm, not gushing'],
    tip: 'Specific praise is credible praise.',
    focus: ['storytelling', 'precision'],
  },
];

C.IMPROMPTU = [
  'What is the most underrated risk in healthcare investing right now?',
  'Make the case for or against AI doing the first read on pathology slides.',
  'What is one thing you would change about how health systems do M&A?',
  'Describe a decision you would make differently today, and why.',
  'What separates a great investment memo from a good one?',
  'Should academic medical centers run their own venture funds?',
  'Why does reimbursement, not FDA clearance, decide which diagnostics win?',
  'What does good leadership look like in the first hour of a crisis?',
  'Pitch the best book you read this year in 60 seconds.',
  'What is a belief about your industry you changed your mind on?',
  'Should a $20M fund ever lead a round? Take a side.',
  'Why do most health system and startup partnerships fail?',
  'Defend a contrarian view about healthcare.',
  'What is the one metric you would use to run a diagnostics business?',
  'Make the case for your city as a healthcare innovation hub.',
  'Explain compounding to a twelve-year-old.',
  'What separates a good manager from a great executive?',
  'What would you tell yourself on your first day in banking?',
  'Is a CFA charter still worth it? Take a side.',
  'What makes a founder investable, beyond the numbers?',
  'What is the biggest mistake buyers make in post-merger integration?',
  'What will healthcare look like in 2035, and what are you betting on?',
  'Argue that slower decisions are sometimes better decisions.',
  'What should every board member understand about lab economics?',
  'Pitch yourself for a board seat in 60 seconds.',
  'What is the hardest feedback you have received, and what did you do with it?',
];

/* ------------------------------------------------------------
   Sparring personas (role-play with Claude)
   ------------------------------------------------------------ */
C.PERSONAS = [
  {
    id: 'ic-chair', name: 'The IC Chair', role: 'Investment committee chair',
    style: 'Numbers-first and impatient with narrative. Interrupts long answers and asks for the number, the downside case, and what you would need to believe.',
    defaultContext: 'You are recommending a $15M Series B investment in a diagnostics company with a kidney-transplant rejection test.',
    focus: ['bluf', 'precision', 'composure'],
  },
  {
    id: 'lp', name: 'The Physician LP', role: 'Physician running a family office',
    style: 'Polite but probing. Has seen many funds. Tests edge, track record, alignment, fees and what happens when a deal goes wrong.',
    defaultContext: 'You are raising a first-time, $15–20M medical-device fund and asking for a $500K commitment.',
    focus: ['conviction', 'storytelling', 'qa'],
  },
  {
    id: 'hiring-partner', name: 'The Hiring Partner', role: 'Partner at a healthcare growth equity firm',
    style: 'Sharp, friendly, fast. Mixes behavioral questions with quick case questions, and follows up on anything vague.',
    defaultContext: 'You are interviewing for a principal role focused on diagnostics and medtech.',
    focus: ['storytelling', 'concision', 'ownership'],
  },
  {
    id: 'board-member', name: 'The Board Member', role: 'Independent director, former health system CEO',
    style: 'Governance-minded. Focuses on risk, accountability, reputation and whether management has thought about the downside.',
    defaultContext: 'You are presenting a proposed acquisition of a regional reference lab.',
    focus: ['composure', 'altitude', 'ownership'],
  },
  {
    id: 'cfo', name: 'The Skeptical CFO', role: 'Chief financial officer',
    style: 'Cost and return obsessed. Challenges assumptions, asks for payback period, and pushes back on valuation and synergies.',
    defaultContext: 'You are asking for $4M to fund a commercialization partnership with a diagnostics startup.',
    focus: ['precision', 'pushback', 'composure'],
  },
  {
    id: 'ceo', name: 'The Busy CEO', role: 'Health system CEO',
    style: 'Strategic, short on time, wants the so-what. Will redirect you if you go into detail too early.',
    defaultContext: 'You have 10 minutes to get a yes on a strategic partnership in transplant diagnostics.',
    focus: ['bluf', 'altitude', 'stakeholder'],
  },
  {
    id: 'moderator', name: 'The Panel Moderator', role: 'Conference panel moderator',
    style: 'Lively and slightly provocative. Asks for hot takes, predictions and clear opinions in front of an audience.',
    defaultContext: 'You are on a panel about the future of diagnostics investing at a healthcare conference.',
    focus: ['conviction', 'storytelling', 'vocal_variety'],
  },
];

// Offline question banks, used when Claude isn't available
C.QBANK = {
  'ic-chair': ['What is the one number that makes this deal work?', 'What has to be true for this to return three times our money?', 'What is the downside case, and what do we lose in it?', 'Why are we the right owner of this asset?', 'If you had to cut the check size in half, what would you do?'],
  lp: ['Why should I back a first-time manager?', 'Tell me about a deal you passed on that worked out. What did you miss?', 'How are you aligned with your LPs?', 'What happens when your best company runs out of cash?', 'Why this fund size?'],
  'hiring-partner': ['Walk me through your background in 90 seconds.', 'Tell me about a deal that went wrong.', 'How would you size the market for a kidney-transplant monitoring test?', 'What would your last boss say you need to work on?', 'Why us, and why now?'],
  'board-member': ['What is the reputational risk if this goes wrong?', 'Who is accountable if integration slips?', 'What did you consider and reject?', 'How will we know in twelve months whether this worked?', 'What would make you walk away?'],
  cfo: ['What is the payback period?', 'Where does the four million actually go?', 'Your synergy case looks aggressive. Defend it.', 'What happens to the P&L if volume comes in 30% lower?', 'Why not just wait a year?'],
  ceo: ['Give me the headline. What do you need from me?', 'Why does this matter to our strategy?', 'What is the risk of doing nothing?', 'Who else have you talked to about this?', 'What do I tell the board?'],
  moderator: ['Give us your hot take: what is overhyped in diagnostics right now?', 'Where will the next big exit come from?', 'Is AI going to replace the pathologist?', 'What is the biggest mistake investors make in this space?', 'Make a prediction for 2030.'],
};

C.DIFFICULTY = {
  warm: 'Warm: fair, open questions; light follow-ups.',
  tough: 'Tough: realistic pressure; probe every vague claim; one or two pointed challenges.',
  brutal: 'Brutal: skeptical and interrupting; challenge numbers, assumptions and credibility; little patience for rambling.',
};

/* ------------------------------------------------------------
   Articulation drills
   ------------------------------------------------------------ */
C.ENUNCIATION = [
  { set: 'Warm the lips and tongue', lines: ['Red leather, yellow leather.', 'The tip of the tongue, the teeth, the lips.', 'Unique New York, unique New York, you know you need unique New York.', 'Proper copper coffee pot.', 'Six thick thistle sticks.'] },
  { set: 'Boardroom consonants', lines: ['Strategic statistics show significantly specific results.', 'Particularly peculiar pecuniary particulars.', 'Regulatory requirements require rigorous review.', 'Quarterly accruals were accurately recorded.', 'Prospective, multicenter, clinical-utility evidence.'] },
  { set: 'Numbers, said cleanly', lines: ['Fourteen point six million, up thirty-eight percent.', 'Six times forward revenue, eighteen-month payback.', 'Two hundred and fifty basis points of margin expansion.', 'Sixty-two percent commercial, thirty-one Medicare, seven other.', 'Eight point two million upfront, up to fifteen in milestones.'] },
  { set: 'Diagnostics vocabulary', lines: ['Laboratory-developed tests and the in vitro clinical test pathway.', 'Proprietary laboratory analyses and gap-fill pricing.', 'Donor-derived cell-free DNA surveillance.', 'Pharmacoeconomic heterogeneity across payer segments.', 'Companion diagnostic co-development agreements.'] },
];

C.PACE_PASSAGES = [
  {
    id: 'ic-open', title: 'IC opening',
    text: 'We recommend investing fifteen million dollars in the Series B. Two reasons. First, the test is already covered by Medicare, so the reimbursement risk is behind us. Second, our transplant program gives them the validation cohort they need, which shortens their path to commercial payers by a year. The biggest risk is competition from the two incumbents. We mitigate it with a distribution agreement that gives us exclusivity in our region. We are asking for approval today, subject to final legal review.',
  },
  {
    id: 'board-miss', title: 'Board update: a miss',
    text: 'The partnership is forty percent below plan at month nine. That is on me. I championed it and I underestimated how long payer contracting would take. Here is what we have learned. The clinical demand is real: ordering physicians are up every month. The bottleneck is coverage. We have a plan to close the gap in two quarters, and I need one thing from this committee: approval to extend the agreement by six months on the same terms.',
  },
  {
    id: 'thesis', title: 'Investment thesis',
    text: 'Our thesis is simple. In diagnostics, the winners are decided by reimbursement, not by science. Great assays fail every year because nobody planned the path to payment. We invest in companies that have already cleared that path, or can with our help. We make money when coverage turns a promising test into a growing business. And we will know we are wrong if coverage decisions stop moving volume. So far, they move it every time.',
  },
  {
    id: 'intro', title: 'Thirty-second introduction',
    text: 'I lead corporate development and investing for a large academic health system. My job is to find diagnostics and device companies with strong science and help them reach patients faster. Last year that meant closing three partnerships, one of which doubled a startup\'s testing volume in six months. I am here because the next decade of diagnostics will be won on distribution, and I want to hear how you are thinking about it.',
  },
];

C.PAUSE_LADDER = [
  'The answer is yes. / We should do this deal. / Here is why.',
  'Revenue grew thirty-eight percent. / Margins did not. / That is the issue.',
  'I have one concern. / It is the payer mix. / Everything else is solved.',
  'We missed the plan. / I own that. / Here is what changes.',
  'Three things matter. / Coverage. / Distribution. / And the team.',
  'My recommendation is to wait. / Not because the asset is weak. / Because the price is wrong.',
];

C.INFLECTION = [
  'We are ready to move forward.',
  'The number is fourteen million.',
  'I recommend we approve the deal.',
  'That is outside our risk tolerance.',
  'We will have the answer by Friday.',
  'This is the right partner for us.',
];

C.WORD_SWAPS = [
  ['I think we should maybe consider…', 'I recommend…'],
  ['I just wanted to check in on…', 'I\'m following up on…'],
  ['Does that make sense?', 'What questions do you have?'],
  ['Sorry, quick question…', 'One question:'],
  ['I\'m not sure, but…', 'My current view is…'],
  ['We\'ll try to get it done by Friday.', 'We\'ll deliver it Friday.'],
  ['It\'s kind of a big risk.', 'It\'s a material risk.'],
  ['I feel like the numbers are off.', 'The numbers don\'t reconcile: revenue is $2M below plan.'],
  ['Hopefully this helps.', 'This gives you what you need for the decision.'],
  ['To be honest…', '(Drop it. Everything you say should be honest.)'],
  ['Basically, what happened was…', 'Here\'s what happened:'],
  ['I was wondering if we could…', 'I propose we…'],
  ['Sorry to bother you.', 'Thanks for making the time.'],
  ['I might be wrong, but…', 'Here\'s where I land, and what would change my mind.'],
  ['We need to circle back on that.', 'I\'ll come back to you on that by Thursday.'],
  ['Let me give you some background first…', 'Bottom line: … Here\'s the context.'],
  ['Sorry for the delay.', 'Thanks for your patience.'],
  ['Just to piggyback on that…', 'Building on Priya\'s point…'],
  ['In my humble opinion…', 'My view:'],
  ['We could potentially explore…', 'We should test…'],
  ['It\'s a pretty good opportunity.', 'It\'s a strong opportunity: 3x return in the base case.'],
  ['A lot of physicians are ordering it.', '412 physicians ordered it last quarter, up 22%.'],
  ['I\'ll be brief.', '(Just be brief.)'],
  ['Any thoughts?', 'Do you support moving to diligence?'],
];

C.CONCISION_GYM = [
  {
    long: 'So I think, basically, what we\'re seeing in the data is that there\'s a pretty significant opportunity here, because the test seems to be getting a lot of traction with physicians, and the reimbursement situation, which was kind of a question mark before, looks like it might be getting resolved, so I would probably say we should consider moving forward with the next phase of diligence if everyone is comfortable with that.',
    budget: 35,
  },
  {
    long: 'I just wanted to give everyone a quick update on where things stand with the partnership, and to be honest the numbers haven\'t been quite where we had hoped they would be at this point, mostly because the payer contracting process has taken a lot longer than any of us really expected, but we do have some ideas about what we can do to get things back on track.',
    budget: 35,
  },
  {
    long: 'In terms of my background, I started out in banking, where I learned a lot about valuation and deal structuring, and then I moved into corporate development, where I\'ve been working on a variety of different transactions and partnerships across the organization, and I think that combination of experiences has really prepared me well for a role like this one, where you need both the analytical side and the relationship side.',
    budget: 40,
  },
  {
    long: 'Before I get into the recommendation, I want to walk you through some of the background on the company, the market they\'re operating in, the competitive landscape, and some of the work our team did over the past six weeks, because I think it\'s important context for understanding why we ended up where we did on this.',
    budget: 25,
  },
];

C.WARMUPS = [
  { id: 'breath', name: 'Box breathing', minutes: 2, why: 'Slows your heart rate and your speech before a high-stakes moment.' },
  { id: 'vocal', name: 'Vocal warm-up', minutes: 3, why: 'Wakes up resonance and range so your voice doesn\'t start thin.' },
  { id: 'enunciation', name: 'Enunciation reps', minutes: 2, why: 'Crisp consonants make you sound sharper and more certain.' },
  { id: 'pause-ladder', name: 'Pause ladder', minutes: 2, why: 'Trains silence as a tool instead of a gap to fill.' },
  { id: 'inflection', name: 'Downward inflection', minutes: 2, why: 'Statements that end down sound like decisions.' },
  { id: 'swaps', name: 'Word swaps', minutes: 2, why: 'Replace weak phrases with ones that carry authority.' },
  { id: 'pace', name: 'Pace reader', minutes: 3, why: 'Feel 140 words a minute in your body.' },
  { id: 'concision', name: 'Concision gym', minutes: 3, why: 'Say it in half the words.' },
];

C.VOCAL_STEPS = [
  { s: 20, t: 'Shoulder rolls and a slow neck stretch. Unclench your jaw.' },
  { s: 20, t: 'Hum on "mmm" at a comfortable pitch. Feel the buzz in your lips and nose.' },
  { s: 20, t: 'Lip trills ("brrr") sliding from low to high and back down.' },
  { s: 20, t: 'Sirens on "ng", sliding through your full range.' },
  { s: 20, t: 'Say "ma-me-mi-mo-mu" five times, exaggerating the mouth shapes.' },
  { s: 20, t: 'Count to ten projecting to the back of a large room, without shouting.' },
  { s: 20, t: 'Say your opening line three times: low and slow, then normal, then with energy.' },
];

C.PREGAME = [
  { s: 64, t: 'Box breathing: in 4, hold 4, out 4, hold 4.' },
  { s: 30, t: 'Stand tall, feet planted, shoulders down. Take up a little more space than feels natural.' },
  { s: 30, t: 'Say your first two sentences out loud, slowly. They\'re the ones that set the tone.' },
  { s: 20, t: 'Name the one thing you want them to remember, and the one decision you want.' },
  { s: 16, t: 'Set your intention: slower, shorter, warmer. Pause before you answer.' },
];

/* ------------------------------------------------------------
   Micro-lessons
   ------------------------------------------------------------ */
C.LESSONS = [
  {
    id: 'what-is-ep', pillar: 'gravitas', title: 'What executive presence is', min: 2,
    key: 'Presence is a set of visible behaviors, and behaviors can be practiced.',
    body: [
      'Senior leaders form a view of your readiness in the first minutes of a meeting, and they rarely change it. What they react to is mostly behavior: how you carry the room, how you speak, and how you look doing it.',
      'Most frameworks land on three layers. Gravitas: composure, conviction, decisiveness. Communication: clear, concise, structured. Appearance: posture, eye contact, polish. Gravitas carries the most weight, but communication is how people see it.',
      'Each of those layers breaks into small, observable habits: the first sentence of an answer, the pause before a reply, whether your statements end on a down note. That is good news, because habits can be trained with reps and feedback.',
    ],
    tryIt: { kind: 'scenario', id: 'ic-rec' },
  },
  {
    id: 'bluf', pillar: 'communication', title: 'Answer first', min: 3,
    key: 'Lead with the conclusion. Context comes second, if at all.',
    body: [
      'Analytical people are trained to build to a conclusion: data, analysis, then the answer. Executives listen the other way around. They want the answer first so they know how to hear the rest.',
      'The fix is BLUF, Bottom Line Up Front, also called the Pyramid Principle. Your first sentence is the recommendation, the answer, or the ask. Then two or three supporting points. Then detail only if they ask for it.',
      'Test it: if you were cut off after your first sentence, would they know what you want? If not, your answer starts in the wrong place.',
      'A useful opener when you feel the pull to give background first: "Bottom line: … Here\'s why."',
    ],
    tryIt: { kind: 'scenario', id: 'status-60' },
  },
  {
    id: 'three', pillar: 'communication', title: 'The power of three and signposting', min: 2,
    key: 'Preview the shape, walk it, then land it.',
    body: [
      'Listeners can\'t scroll back. Signposts tell them where they are: "Two reasons." "First…" "Second…" "So the decision is…"',
      'Three is the natural ceiling for spoken points. Two is often stronger. If you have five reasons, pick the two that would change the decision.',
      'End where you started: restate the recommendation in one sentence. It feels repetitive to you; it sounds clear to them.',
    ],
    tryIt: { kind: 'scenario', id: 'close-meeting' },
  },
  {
    id: 'concision', pillar: 'communication', title: 'Say less, land more', min: 2,
    key: 'Stop when you\'re done. Silence after a point gives it weight.',
    body: [
      'Over-talking usually comes from wanting to be thorough or to pre-empt objections. To senior listeners it can read as uncertainty.',
      'Three habits help. Cut qualifiers ("just", "really", "kind of"). Use one example, not three. And stop. Most people dilute a strong answer by adding a weaker second one.',
      'Aim for sentences under 20 words. Long sentences are where fillers and hedges hide.',
    ],
    tryIt: { kind: 'drill', id: 'concision' },
  },
  {
    id: 'hedges', pillar: 'language', title: 'Hedges leak authority', min: 3,
    key: 'Be precise about uncertainty instead of vague about everything.',
    body: [
      '"I think", "kind of", "maybe" and "just" feel polite. Stacked together, they tell the room you aren\'t sure, even when you are.',
      'Confidence isn\'t pretending to be certain. It\'s calibrated certainty. Replace blanket hedges with one precise statement of what you know and what you don\'t: "I\'m confident on the market size. The open question is payer mix, and we\'ll know in two weeks."',
      'Try "what would change my mind" instead of "I might be wrong". It sounds rigorous, not unsure.',
    ],
    tryIt: { kind: 'drill', id: 'swaps' },
  },
  {
    id: 'pace', pillar: 'voice', title: 'Pace: slower than you think', min: 2,
    key: 'Aim for 130–160 words a minute, and slow down for numbers.',
    body: [
      'Nerves speed people up, and speed reads as nerves. Most strong executive speakers sit between 130 and 160 words a minute in high-stakes settings.',
      'Slow down most for numbers, names and your key sentence. A number said slowly sounds like a fact. Said fast, it sounds like a guess.',
      'Change pace on purpose. Going briefly faster through context and slower through the point gives your delivery shape.',
    ],
    tryIt: { kind: 'drill', id: 'pace' },
  },
  {
    id: 'pauses', pillar: 'voice', title: 'The pause is the tool', min: 2,
    key: 'Replace every filler with a silent beat.',
    body: [
      'Fillers ("um", "uh", "so", "like") are what your brain does while it plans the next words. Silence does the same job and reads as command.',
      'Use three pauses on purpose: before you answer a hard question, before your key sentence, and after it, so it lands.',
      'A pause of one to two seconds feels huge to you and normal to the listener. Practice until it feels comfortable.',
    ],
    tryIt: { kind: 'drill', id: 'pause-ladder' },
  },
  {
    id: 'inflection', pillar: 'voice', title: 'End statements down', min: 2,
    key: 'Rising endings turn statements into questions.',
    body: [
      'Upspeak, where a statement ends on a rising pitch, asks for approval. Ending on a falling pitch signals that you have finished and you mean it.',
      'Practice on your key sentences: drop the pitch on the last stressed word and let the sentence settle. Then hold eye contact for a beat.',
      'Variety matters too. A voice that stays in a narrow pitch range sounds flat, however good the content. Lift for contrast, drop for conclusions.',
    ],
    tryIt: { kind: 'drill', id: 'inflection' },
  },
  {
    id: 'tough-q', pillar: 'communication', title: 'Handling tough questions', min: 3,
    key: 'Pause, answer the question asked, then stop.',
    body: [
      'Under challenge, most people talk faster and longer. Do the opposite. Take a breath, and if it helps, repeat the question back to buy a beat and show you heard it.',
      'Answer the actual question in the first sentence: yes, no, a number or a position. Then give one reason. Then stop and let them come back.',
      'If the question carries a false premise, correct it calmly before answering: "The payback is 18 months, not three years. Here\'s the math."',
      'Never argue with the emotion. Acknowledge it ("It\'s a fair concern") and move to substance.',
    ],
    tryIt: { kind: 'scenario', id: 'valuation-push' },
  },
  {
    id: 'dont-know', pillar: 'gravitas', title: '"I don\'t know" with authority', min: 2,
    key: 'Not knowing is fine. Bluffing isn\'t.',
    body: [
      'Senior audiences can spot a bluff, and one is enough to damage your credibility on everything else.',
      'The pattern: say plainly that you don\'t have it, share what you do know that is relevant, and commit to a specific follow-up time. Then keep it.',
      '"I don\'t have that number here. I know commercial is the majority. I\'ll send the exact split by Thursday."',
    ],
    tryIt: { kind: 'scenario', id: 'no-unknown' },
  },
  {
    id: 'altitude', pillar: 'communication', title: 'Executive altitude', min: 3,
    key: 'Translate detail into money, risk, people and decisions.',
    body: [
      'Experts tend to answer at the level where they did the work. Executives listen at the level where they make decisions.',
      'For every point, ask "so what?" twice. "The assay has 94% sensitivity." So what? "It catches rejection earlier than biopsy." So what? "Fewer graft losses, and about $40K saved per avoided biopsy pathway."',
      'Adjust to the audience. CFOs want return and payback. Physicians want evidence and patient impact. Boards want risk and accountability.',
    ],
    tryIt: { kind: 'scenario', id: 'ic-rec' },
  },
  {
    id: 'bad-news', pillar: 'gravitas', title: 'Delivering bad news', min: 2,
    key: 'Headline, ownership, cause, plan, ask.',
    body: [
      'Leaders lose trust when bad news arrives late, buried or softened. They gain it when it comes early and straight.',
      'Lead with the fact. Own your part in one sentence, with no long apology. Give the main cause, the plan, and what you need.',
      'Keep your voice steady and your pace slow. How you deliver the news tells them whether the situation is under control.',
    ],
    tryIt: { kind: 'scenario', id: 'board-bad-news' },
  },
  {
    id: 'disagree', pillar: 'influence', title: 'Disagreeing up', min: 2,
    key: 'Agree on the goal, disagree on the path, offer an option.',
    body: [
      'Silence in the meeting and dissent in the hallway costs you both influence and respect. Senior leaders value people who disagree well.',
      'Start with the shared goal. State your disagreement directly ("I see it differently"). Give one reason with a number. Offer an alternative, and invite a decision.',
      'Keep it about the idea, never the person, and keep your tone curious rather than combative.',
    ],
    tryIt: { kind: 'scenario', id: 'disagree-up' },
  },
  {
    id: 'story', pillar: 'communication', title: 'Stories that stick', min: 3,
    key: 'Situation, complication, resolution, plus one vivid detail.',
    body: [
      'Data persuades the analytical brain. Stories get remembered and repeated. The best executive communicators use both: a number, then a story that makes it real.',
      'Use the SCR shape: the situation, the complication that made it hard, and how it was resolved. Keep it under 45 seconds.',
      'One specific detail, like a name, a moment or a quote, does more than any adjective.',
    ],
    tryIt: { kind: 'scenario', id: 'deal-story' },
  },
  {
    id: 'video', pillar: 'physical', title: 'Presence on video', min: 2,
    key: 'Lens at eye level, light in front, look at the lens on key points.',
    body: [
      'Raise the camera to eye level; looking down at a laptop camera reads as looking down on people.',
      'Put the light source in front of you, not behind. Frame from mid-chest up with a little space above your head.',
      'Look at the lens, not the faces, when you make your key point. To them, that is eye contact.',
      'Energy drops on video, so bring about 20% more than feels natural.',
    ],
    tryIt: { kind: 'tool', id: 'visual' },
  },
  {
    id: 'body', pillar: 'physical', title: 'Stillness reads as confidence', min: 2,
    key: 'Plant your feet, still your hands, gesture with purpose.',
    body: [
      'Fidgeting, swaying and self-touching (face, hair, pen) leak nerves. Stillness reads as calm authority.',
      'Ground yourself: feet hip-width, weight even. Seated, sit forward with forearms on the table.',
      'Gestures should match words: open palms when inviting, a single chop for a key point. Then let your hands rest.',
    ],
    tryIt: { kind: 'tool', id: 'visual' },
  },
  {
    id: 'listening', pillar: 'influence', title: 'Listening is presence too', min: 2,
    key: 'Paraphrase before you answer.',
    body: [
      'The most present person in the room is often the one who listens best. Rushing to answer signals you were waiting to talk.',
      'Before responding to something important, paraphrase it: "So the concern is the payback period, not the strategy." It buys time, shows respect and makes sure you answer the real question.',
      'Watch the room: phones out, side glances, leaning back. Those are signals to shorten, ask a question or move to the decision.',
    ],
    tryIt: { kind: 'spar', id: 'ceo' },
  },
  {
    id: 'pregame', pillar: 'gravitas', title: 'Your pre-game routine', min: 2,
    key: 'Two minutes of preparation changes the first two minutes of the meeting.',
    body: [
      'Athletes and performers warm up. Executives often go straight from one call to the next and arrive scattered.',
      'Before a high-stakes moment: two minutes of box breathing, a grounded posture, your first two sentences said out loud, and one intention (slower, shorter, warmer).',
      'Use the Pre-game routine in the Toolkit before big meetings until it becomes habit.',
    ],
    tryIt: { kind: 'tool', id: 'pregame' },
  },
];

/* ------------------------------------------------------------
   Badges
   ------------------------------------------------------------ */
C.BADGES = [
  { id: 'first', name: 'First rep', desc: 'Complete your first practice rep.' },
  { id: 'streak3', name: 'Three-day streak', desc: 'Practice three days in a row.' },
  { id: 'streak7', name: 'Seven-day streak', desc: 'Practice seven days in a row.' },
  { id: 'streak30', name: 'Thirty-day streak', desc: 'Practice thirty days in a row.' },
  { id: 'bluf5', name: 'Answer first', desc: 'Lead with the answer in five reps.' },
  { id: 'clean60', name: 'Clean minute', desc: 'Speak 60+ seconds with zero fillers.' },
  { id: 'nohedge', name: 'No hedges', desc: 'An 80+ word rep with zero hedges.' },
  { id: 'pocket5', name: 'In the pocket', desc: 'Land your target pace in five reps.' },
  { id: 'spar1', name: 'Into the arena', desc: 'Finish a sparring session.' },
  { id: 'spar5', name: 'Battle-tested', desc: 'Finish five sparring sessions.' },
  { id: 'runback', name: 'Run it back', desc: 'Improve a retry by 10+ points.' },
  { id: 'score85', name: 'Boardroom ready', desc: 'Score 85+ on a rep.' },
  { id: 'reps25', name: 'Twenty-five reps', desc: 'Complete 25 reps.' },
  { id: 'reps100', name: 'Century', desc: 'Complete 100 reps.' },
  { id: 'field5', name: 'Field tested', desc: 'Log five real meetings.' },
  { id: 'camera', name: 'Camera ready', desc: 'Run a visual presence check.' },
  { id: 'prep3', name: 'Prepared', desc: 'Build three meeting preps.' },
];

C.TIPS = C.LESSONS.map((l) => ({ text: l.key, lesson: l.id }));

/* ------------------------------------------------------------
   DX Daily curriculum (from data/curriculum.json) for teach-back reps
   [id, module, title, scope]
   ------------------------------------------------------------ */
C.DX = /*DX_CURRICULUM*/[];
// The DX Daily log shows lesson E2 on 2026-11-05; episodes advance one lesson a day.
C.dxEstimate = function (date) {
  if (!C.DX.length) return null;
  const anchor = new Date('2026-11-05T12:00:00');
  const idx0 = C.DX.findIndex((x) => x[0] === 'E2');
  const days = Math.round((date - anchor) / 86400000);
  const n = C.DX.length;
  return C.DX[(((idx0 + days) % n) + n) % n];
};
