# Daily Diagnostics Audio Overviews — Cloud (computer-off)

Generates **three** NotebookLM-style two-host podcast episodes every morning and
uploads them to your Google Drive **`Daily Audio`** folder — running entirely on
**GitHub's servers**, so your computer can be off.

Shows: `dx-daily` (full 4-pillar brief), `dx-deal-sourcer`, `dx-public-equities`.

## How it works

For each show, once a day, a GitHub Actions job:
1. **Researches + writes a script** — calls **Gemini's free tier**
   (`gemini-2.5-flash`) with **Google Search grounding** using `prompts/<show>.md`
   → a two-host (Alex + Sam) podcast script. No per-call bill.
2. **Generates audio** — `edge-tts` (Microsoft Edge's neural voices, **free, no
   API key**) synthesizes each Alex/Sam turn with its own voice, then ffmpeg
   (bundled) concatenates them into one compact `.mp3`.
3. **Uploads to Drive** — `rclone` copies it to `Daily Audio/<show>-<date>.mp3`.

> **Note on "the skills":** GitHub's runners can't reach your Claude Cowork
> plugin skills or Google connectors. So each show is a *self-contained research
> prompt distilled from the skill* (in `prompts/`), run against Gemini's Google
> Search grounding. The intelligence is faithful; the plumbing is standalone.

---

## Setup — two secrets

Both the research and the audio now run for **free**, so there are only two
secrets to add (**Settings → Secrets and variables → Actions → New repository
secret**).

### 1. `GEMINI_API_KEY` — free-tier research + scriptwriting
- Create a key at <https://aistudio.google.com/apikey>.
- Copy it into a secret named `GEMINI_API_KEY`.
- **Billing:** the `gemini-2.5-flash` text model and Google Search grounding are
  used on the **free tier** — no per-call bill. Free tier has daily request caps,
  which comfortably cover three shows a day. (Note: this is Gemini *text*, which
  is free — unlike Gemini *TTS*, which needs prepaid credits. Audio doesn't use
  Gemini at all; it uses `edge-tts`.)

> **Audio has no key and no bill either.** `edge-tts` uses Microsoft Edge's free
> read-aloud voices, so the `GEMINI_API_KEY` above is only for the research step.
> There is no longer any `ANTHROPIC_API_KEY` — the pipeline is fully free.

### 2. `RCLONE_CONF` — uploads audio to your Drive
**Important correction:** I originally suggested a *service account*, but your
Drive is a consumer Gmail account, and service accounts **can't own files there**
(no storage quota) — uploads would fail. The reliable path is **rclone with an
OAuth token to your own account** (files land in your Drive, use your 15 GB). One-time:

1. Install rclone locally: <https://rclone.org/downloads/> (Windows: the .exe).
2. In a terminal run `rclone config` → `n` (new remote) → name it exactly
   **`gdrive`** → storage type **`drive`** (Google Drive).
3. Leave `client_id`/`client_secret` blank for the quick path (or create your own
   OAuth client for higher rate limits — see rclone's Drive docs).
4. Scope: choose **`1` (full access)** or `drive.file`. `y` to auto-config →
   a browser opens → sign in as **mlaique.ai@gmail.com** and allow. (If you see
   an "unverified app" screen, click **Advanced → Go to rclone**.)
5. `n` to "team drive", then `y` to confirm.
6. Find the config file: run `rclone config file` → open it → copy its **entire
   contents** (the `[gdrive]` block with the token) into a secret named
   `RCLONE_CONF`.

That token lets the workflow upload as you, with no browser and no PC on.

---

## Repo setup

1. Create a **private** GitHub repo (e.g. `daily-dx-audio`).
2. Push these files to it (from this folder):
   ```bash
   git init && git add . && git commit -m "Daily diagnostics audio"
   git branch -M main
   git remote add origin https://github.com/<you>/daily-dx-audio.git
   git push -u origin main
   ```
3. Add the two secrets above.
4. **Actions tab → enable workflows** if prompted.

## Test it before trusting the schedule
- **Actions tab → "Daily Audio Overviews" → Run workflow** (the
  `workflow_dispatch` button) → runs all three shows now.
- Watch the logs. On success, check the `Daily Audio` folder in Drive.
- Every run also saves the `.mp3` as a **downloadable Actions artifact** as a
  fallback, even if the Drive upload step fails.

## Schedule / timezone
GitHub cron is **UTC**. The default `12 10 * * *` ≈ 6:12am US-Eastern. Edit the
`cron:` line in `.github/workflows/daily-audio.yml` for your timezone.
> GitHub's scheduled runs can lag 5–15 min under load, and Actions disables
> schedules on repos with **no activity for 60 days** — a manual run or commit
> resets that.

## Cost summary
| Item | Rough cost |
|---|---|
| Gemini research (3 shows/day) | **free** (free-tier `gemini-2.5-flash` + grounding) |
| edge-tts (audio) | **free** (no key, no bill) |
| GitHub Actions | free (well under the 2,000 free min/month) |
| Google Drive | free (your 15 GB; ~6 MB/episode as MP3) |

## Customize
- **Voices:** set `EDGE_VOICE_A` / `EDGE_VOICE_B` env in the workflow (Alex / Sam).
  List all voices with `edge-tts --list-voices`. Defaults: `en-US-AvaNeural` /
  `en-US-AndrewNeural`.
- **Pace:** set `EDGE_RATE` (e.g. `+8%`) to speed up or slow down delivery.
- **Research model:** change `TEXT_MODEL` (default `gemini-2.5-flash`).
- **Add a show:** drop a `prompts/<name>.md` and add `<name>` to the matrix.
