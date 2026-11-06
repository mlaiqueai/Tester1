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
- **Drills, progress and data:** 8 articulation drills, streaks, levels, badges and trend charts.
  Practice data is saved privately to the page (owner-only rules) and syncs across devices.

## Build

```
python3 presence-app/build.py
```

Writes `dist/green-room.html` (the page that gets published) and `dist/standalone.html` (the same
page with an HTML skeleton, for local testing; Claude features are off there).

Source lives in `src/`: `content.js` (skills, scenarios, personas, drills, lessons), `analysis.js`
(text and audio scoring), `store.js` (storage), `ai.js` (coach prompts), and the UI files.
