# DX Daily — computer-off diagnostics audio briefing

Every morning, GitHub's servers build a **5–7 minute two-host audio episode**
(Alex + Sam) and save it to the Google Drive folder **`Daily Audio`**. Your
computer can be off. Cost: **$0** on Gemini's free tier, or about **$2/month** if
the Gemini project has prepaid credit (which also unlocks live Google Search).

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
| 2. Script | Gemini writes an analyst brief (plus live Google Search when the key allows), then a ~850-word dialogue; auto-revises if the length is off | `scripts/build_episode.py` |
| 3. Audio | `edge-tts` (pip, free) voices each turn; ffmpeg joins them into one MP3 | `scripts/generate_audio.py` |
| 4. Schedule | GitHub Actions, early-morning slots (below) | `.github/workflows/daily-audio.yml` |
| 5. Save | `rclone` uploads to Drive `Daily Audio/` | workflow |

**Models:** Gemini via Google AI Studio (`GEMINI_API_KEY`), trying
`gemini-flash-latest`, then 3.8, 3.7 and 3.5 Flash, then Flash-Lite (override with
`GEMINI_MODELS`). The brief first tries Gemini's Google Search tool. A project with
prepaid credit gets 5,000 free searches a month. A free project can't search, so
the brief falls back to the news feeds automatically. Rough paid cost: ~$0.07/day.
A project with **depleted prepaid credit is blocked entirely, including free use**.
Either top it up, or use a key from a separate project with no billing.

If Gemini is unreachable, the run fails so a later slot can retry. Only the last
slot (or a very late run) ships a plain headline readout. The reason shows on the
run's summary page.

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
| `GEMINI_API_KEY` | research + writing (Google AI Studio key) |

`ANTHROPIC_API_KEY` is no longer used and can be deleted.

History: GitHub Models (used Jul 18–30, 2026) was retired by GitHub on July 30, 2026.

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
  (full episodes read at ~140 words/min, so ~850 words ≈ 6 min)
- **Voices / pace:** `EDGE_VOICE_A`, `EDGE_VOICE_B`, `EDGE_RATE` env vars for `generate_audio.py`
- **Curriculum:** `data/curriculum.json` (to repeat or skip a lesson, edit `data/lessons_taught.csv`)
