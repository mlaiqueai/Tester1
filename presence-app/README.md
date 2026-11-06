# Green Room: executive presence & articulation coach

A phone-first practice app, published as a private claude.ai page:
https://claude.ai/artifact/WvTRtqUsXUFbrRRjoF8RkQ

- **Practice:** scenario reps (IC, LP, board, interviews, pushback), impromptu questions, and
  60-second teach-backs of the DX Daily curriculum (`data/curriculum.json`).
- **Scoring:** clarity, concision, confidence, delivery and executive impact from the transcript
  (fillers, hedges, answer-first, numbers, sentence length) and, for uploaded recordings, the audio
  (pauses, pitch range, rising endings, trailing off).
- **AI coach (Claude):** per-rep feedback and rewrites, live sparring with 7 personas, evaluation
  import (maps feedback to 23 skills and a 4-week plan), meeting prep, rewriting, visual check,
  weekly review.
- **Development plan:** every score is on the plan's eight dimensions (strategic framing, clarity,
  conciseness, assertiveness, executive confidence, decision leadership, stakeholder management,
  commercial judgment) on a 1–10 scale against baseline and target, and every rep is checked for
  Headline → Structure → Implication → Action and executive phrasing.
- **Game layer:** three stages (Strong Analyst → Strategic Business Leader → Executive) with nine
  levels; stage promotions need the scores, not just XP. Daily missions, streak XP multipliers, a
  weekly boss fight, 26 badges, Executive or Analyst? quick-fire, the Headline Builder, leadership
  quests and an executive-language collection.
- **Meeting reviews:** paste a real transcript to get the 9-category scorecard, examples, an
  executive version and one adjustment, tracked over time by meeting type.
- **Data:** saved privately to the page (owner-only rules) and synced across devices. The personal
  plan (baselines, strengths, tendencies) lives only in that private store, not in this repo.

## Build

```
python3 presence-app/build.py
```

Writes `dist/green-room.html` (the page that gets published) and `dist/standalone.html` (the same
page with an HTML skeleton, for local testing; Claude features are off there).

Source lives in `src/`: `content.js` and `plan.js` (framework, scenarios, personas, drills, games),
`analysis.js` (text and audio scoring), `store.js` (storage), `ai.js` (coach prompts), `game.js`
(XP, stages, missions, badges), and the UI files.
