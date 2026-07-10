# Daily NotebookLM-style Audio Briefing

A GitHub Action that runs every morning and turns your scheduled tasks into a
**two-host audio overview** — the same conversational "Audio Overview" format
[NotebookLM](https://notebooklm.google.com) produces.

NotebookLM has no public API, so this generates the equivalent audio itself:
it writes a two-host dialogue script and synthesizes it with a text-to-speech
API using two alternating voices.

## How it works

1. You keep your tasks in **`tasks.json`** (see `tasks.example.json`).
2. `.github/workflows/daily-audio.yml` runs daily (and on demand) and calls
   `scripts/generate_briefing.py`.
3. The script always writes:
   - `out/briefing.md` — a readable rundown of the day.
   - `out/script.txt` — the spoken two-host script.
   - `out/daily-briefing.mp3` — the audio (**only when a TTS key is set**).
4. The results are uploaded as a workflow **artifact** named `daily-briefing`,
   downloadable from the run's summary page.

## Setup

### 1. Add your tasks

Copy the template and edit it with your real schedule:

```bash
cp tasks.example.json tasks.json
```

```json
{
  "owner": "Your name",
  "timezone": "UTC",
  "tasks": [
    { "time": "9:00 AM", "title": "Team standup", "detail": "Daily sync." },
    { "time": "1:00 PM", "title": "Focus block", "detail": "Deep work." }
  ]
}
```

> `tasks.json` is git-ignored so your personal schedule stays out of the repo.
> If you don't commit one, the workflow falls back to `tasks.example.json`.

> **Note:** I couldn't read your Claude Desktop scheduled tasks (Routines)
> automatically — that requires an interactive approval this remote session
> can't grant. Paste them into `tasks.json` and the briefing will use them.

### 2. Enable audio (optional but recommended)

The audio uses the OpenAI text-to-speech API. Add your key as a repository
secret so the Action can use it:

- **Settings → Secrets and variables → Actions → New repository secret**
- Name: `OPENAI_API_KEY`, value: your key.

Without the secret the workflow still runs and produces the text briefing and
script — it just skips the MP3.

### 3. Adjust the schedule

Edit the cron line in `.github/workflows/daily-audio.yml`
(`0 12 * * *` = 12:00 UTC). [crontab.guru](https://crontab.guru) helps.

## Run it now

- **Actions** tab → **Daily NotebookLM-style Audio Briefing** → **Run workflow**.
- Or locally:

  ```bash
  python3 scripts/generate_briefing.py          # text only
  OPENAI_API_KEY=sk-... python3 scripts/generate_briefing.py   # + audio
  ```

## Customizing

Environment variables read by the script:

| Variable         | Default            | Purpose                          |
| ---------------- | ------------------ | -------------------------------- |
| `OPENAI_API_KEY` | _(unset)_          | Enables audio synthesis.         |
| `TTS_MODEL`      | `gpt-4o-mini-tts`  | TTS model.                       |
| `TTS_VOICE_A`    | `alloy`            | Voice for host **Alex**.         |
| `TTS_VOICE_B`    | `shimmer`          | Voice for host **Sam**.          |
