# Daily NotebookLM-style Audio Briefings

A GitHub Action that runs **every day** and produces three **two-host audio
briefings** — the same conversational "Audio Overview" format
[NotebookLM](https://notebooklm.google.com) uses:

1. **Daily Public Equity**
2. **Daily DX Intel**
3. **Daily Overview**

NotebookLM has no public API and Anthropic has no speech API, so both the
scriptwriting and the audio are done with **Gemini**: Gemini writes each
two-host dialogue from a topic brief, then Gemini's multi-speaker
text-to-speech renders it with two distinct voices.

## How it works

1. Topics live in **`briefs.json`** (see `briefs.example.json`) — three by
   default, but add/remove freely.
2. `.github/workflows/daily-audio.yml` runs daily (and on demand) and calls
   `scripts/generate_briefing.py`.
3. For each brief the script writes, into `out/`:
   - `<id>.md` / `<id>.txt` — the readable + spoken script (always).
   - `<id>.wav` (and `.mp3` if ffmpeg is present) — the audio, **when
     `GEMINI_API_KEY` is set**.
4. All output is uploaded as a workflow **artifact** named `daily-briefings`,
   downloadable from the run summary.

## Setup

### 1. Add the Gemini key (required for audio)

**Settings → Secrets and variables → Actions → New repository secret**
- Name: `GEMINI_API_KEY`, value: your Google AI Studio / Gemini API key.

Without it the workflow still runs and writes the scripts — it just skips audio.

### 2. Customize the briefs (optional)

Copy the template and edit topics/prompts:

```bash
cp briefs.example.json briefs.json
```

Each brief has an `id`, `title`, and a `prompt` describing what the briefing
should cover. `briefs.json` is git-ignored; if absent, the workflow uses
`briefs.example.json`.

### 3. Schedule

The workflow runs at `0 12 * * *` (12:00 UTC) daily — edit the cron in
`.github/workflows/daily-audio.yml` ([crontab.guru](https://crontab.guru)).
**Scheduled runs only happen from the default branch (`main`).**

## Run it now

- **Actions** tab → **Daily NotebookLM-style Audio Briefings** → **Run workflow**.
- Or locally:

  ```bash
  python3 scripts/generate_briefing.py                       # scripts only
  GEMINI_API_KEY=... python3 scripts/generate_briefing.py    # + audio
  ```

## A note on freshness

Public-equity and DX intel are generated from the Gemini model's knowledge
using the topic prompt — they are **not** wired to a live market/news feed, so
treat them as a well-structured daily digest rather than real-time data. To make
them live, add a data source per brief (an API pull the script feeds into the
prompt) — the pipeline is structured so that's a drop-in.

## Customizing

| Variable         | Default                     | Purpose                        |
| ---------------- | --------------------------- | ------------------------------ |
| `GEMINI_API_KEY` | _(unset)_                   | Enables scriptwriting + audio. |
| `TEXT_MODEL`     | `gemini-2.5-flash`          | Model that writes the scripts. |
| `TTS_MODEL`      | `gemini-2.5-flash-preview-tts` | Multi-speaker TTS model.    |
| `TTS_VOICE_A`    | `Kore`                      | Voice for host **Alex**.       |
| `TTS_VOICE_B`    | `Puck`                      | Voice for host **Sam**.        |
