# DX Daily — computer-off diagnostics audio briefing

Every morning, GitHub's servers build a **5–7 minute two-host audio episode**
(Alex + Sam) and save it to the Google Drive folder **`Daily Audio`**. Your
computer can be off. Total cost: **$0**.

Each episode covers:
1. **Public markets** — a diagnostics/lab/tools stock basket vs. the S&P,
   Nasdaq, XBI and IHI, with the day's biggest movers.
2. **Private markets** — venture rounds, M&A, private equity, IPOs.
3. **Regulation, reimbursement & clinical trends** across GI, ID, heme/onc,
   renal, neuro, transplant and therapeutics-adjacent dx.
4. **Teach-in** — one lesson a day from the *business of diagnostics*
   curriculum (48 lessons: reimbursement, regulatory, adoption, test economics,
   competitive structure, personas, capital flows), working through in order and
   restarting after a full pass.

Drive gets two files a day: `dx-daily-YYYY-MM-DD.mp3` and
`dx-daily-YYYY-MM-DD-briefing.md` (the written analyst brief, its sources, and
the full transcript).

## Pipeline

| Step | What | Where |
|---|---|---|
| 1. Research | Yahoo Finance prices + Google News & Bing News RSS (keyless), filtered to recent, diagnostics-relevant items | `scripts/research.py` |
| 2. Script | GitHub Models writes an analyst brief, then a ~1,000-word dialogue from it; auto-revises if the length is off | `scripts/build_episode.py` |
| 3. Audio | `edge-tts` (pip, free) voices each turn; ffmpeg joins them into one MP3 | `scripts/generate_audio.py` |
| 4. Schedule | GitHub Actions, early-morning slots (below) | `.github/workflows/daily-audio.yml` |
| 5. Save | `rclone` uploads to Drive `Daily Audio/` | workflow |

**Models:** tries `openai/gpt-4.1`, then `gpt-4o`, then `gpt-4o-mini` through
GitHub Models, authenticated by the workflow's built-in token (free tier,
~8K-token input cap, which is why the research packet is size-budgeted).
Override with the `TEXT_MODELS` env var. If no model is reachable, the run fails
so a later slot can retry; only the last slot (or a very late run) ships a plain
headline readout instead.

**Lesson log:** `data/lessons_taught.csv` gets one line per episode, committed
by the workflow. That decides tomorrow's lesson, and the daily commit keeps the
repo "active" so GitHub doesn't auto-disable the schedule (it did on Sept 16,
2026, after 60 days with no commits).

## Timing

GitHub cron is UTC-only and often fires **hours** late. On this repo, July–Sept
2026 ran a median of 3.7 h late, worst 10.3 h. So the workflow has six slots
between ~00:17 and ~05:17 Central. The first one that actually runs builds the
episode and the rest exit in seconds. Typical delivery is before 6 AM Central,
but **GitHub doesn't guarantee it**. Daylight saving is handled automatically,
with no edits needed in November or March.

For exact timing, trigger the workflow from an external cron service (e.g.
cron-job.org) via the GitHub API's `workflow_dispatch`. That needs a
fine-grained token with *Actions: write* on this repo.

## Secrets

| Secret | Used for |
|---|---|
| `RCLONE_CONF` | Drive upload (the `[gdrive]` block from `rclone config file`) |
| `GITHUB_TOKEN` | built in; nothing to set |

`ANTHROPIC_API_KEY` / `GEMINI_API_KEY` are no longer used and can be deleted.

> ⚠️ The rclone config uses rclone's **shared** Google client ID, which Google is
> retiring during 2026. When uploads start failing with auth errors, create your
> own client ID (https://rclone.org/drive/#making-your-own-client-id),
> re-authorize, and update `RCLONE_CONF`.

## Run it now

**Actions → DX Daily Audio → Run workflow.** It skips if today's episode already
exists. Tick **force** to rebuild.

## Customize

- **Topics / companies:** `SECTIONS`, `TICKERS`, `BENCHMARKS` in `scripts/research.py`
- **Format / length / tone:** prompts and `WORDS_MIN/WORDS_MAX` in `scripts/build_episode.py`
  (edge-tts reads ~170 words/min, so 1,000 words ≈ 6 min)
- **Voices / pace:** `EDGE_VOICE_A`, `EDGE_VOICE_B`, `EDGE_RATE` env vars for `generate_audio.py`
- **Curriculum:** `data/curriculum.json` (to repeat or skip a lesson, edit `data/lessons_taught.csv`)
