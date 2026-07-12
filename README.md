# Daily Diagnostics Audio Overviews — Cloud (computer-off)

Generates **three** NotebookLM-style two-host podcast episodes every morning and
uploads them to your Google Drive **`Daily Audio`** folder — running entirely on
**GitHub's servers**, so your computer can be off.

Shows: `dx-daily` (full 4-pillar brief), `dx-deal-sourcer`, `dx-public-equities`.

## How it works

For each show, once a day, a GitHub Actions job:
1. **Researches + writes a script** — calls Claude (with live web search) using
   `prompts/<show>.md` → a two-host (Alex + Sam) podcast script.
2. **Generates audio** — `edge-tts` (Microsoft Edge's neural voices, **free, no
   API key**) synthesizes each Alex/Sam turn with its own voice, then ffmpeg
   (bundled) concatenates them into one compact `.mp3`.
3. **Uploads to Drive** — `rclone` copies it to `Daily Audio/<show>-<date>.mp3`.

> **Note on "the skills":** GitHub's runners can't reach your Claude Cowork
> plugin skills or Google connectors. So each show is a *self-contained research
> prompt distilled from the skill* (in `prompts/`), run against Claude's web
> search. The intelligence is faithful; the plumbing is standalone.

---

## Setup — two secrets

Audio now uses **`edge-tts`**, which needs **no API key** — so there are only
two secrets to add (**Settings → Secrets and variables → Actions → New
repository secret**).

### 1. `ANTHROPIC_API_KEY` — lets headless Claude do the research
- Go to <https://console.anthropic.com> → **Settings → API Keys → Create Key**.
- Copy it into a secret named `ANTHROPIC_API_KEY`.
- **Billing:** this is pay-as-you-go API usage, **separate from your Claude
  subscription**. Rough cost ≈ **$0.30–0.60 per show** (web searches + tokens),
  so **~$1–2/day** for all three. Set a monthly cap under **Billing → Limits**.

> **Audio has no key and no bill.** `edge-tts` uses Microsoft Edge's free
> read-aloud voices. (This replaced Gemini TTS, which required prepaid billing
> credits.) No `GEMINI_API_KEY` needed.

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
| Anthropic API (3 shows/day) | ~$1–2/day |
| edge-tts (audio) | **free** (no key, no bill) |
| GitHub Actions | free (well under the 2,000 free min/month) |
| Google Drive | free (your 15 GB; ~6 MB/episode as MP3) |

## Customize
- **Voices:** set `EDGE_VOICE_A` / `EDGE_VOICE_B` env in the workflow (Alex / Sam).
  List all voices with `edge-tts --list-voices`. Defaults: `en-US-AvaNeural` /
  `en-US-AndrewNeural`.
- **Pace:** set `EDGE_RATE` (e.g. `+8%`) to speed up or slow down delivery.
- **Cheaper/pricier research:** change `CLAUDE_MODEL` (default `claude-sonnet-5`).
- **Add a show:** drop a `prompts/<name>.md` and add `<name>` to the matrix.
