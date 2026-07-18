# Daily Diagnostics Audio Overviews — Cloud (computer-off)

Generates **three** NotebookLM-style two-host podcast episodes every morning and
uploads them to your Google Drive **`Daily Audio`** folder — running entirely on
**GitHub's servers**, so your computer can be off.

Shows: `dx-daily` (full 4-pillar brief), `dx-deal-sourcer`, `dx-public-equities`.

## How it works

For each show, once a day, a GitHub Actions job:
1. **Builds a script from live free feeds** — `scripts/run_show.py` pulls fresh
   data from **keyless, no-bill sources** and assembles a two-host (Alex + Sam)
   script with a Python template (no LLM, no API key):
   - **Google News RSS** (`news.google.com/rss/search`) — fresh headlines for
     each show's topics.
   - **Stooq** (`stooq.com` CSV) — free index levels + day-over-day % moves
     (used by the equities show).
2. **Generates audio** — `edge-tts` (Microsoft Edge's neural voices, **free, no
   API key**) synthesizes each Alex/Sam turn with its own voice, then ffmpeg
   (bundled) concatenates them into one compact `.mp3`.
3. **Uploads to Drive** — `rclone` copies it to `Daily Audio/<show>-<date>.mp3`.

> **No LLM, by design.** Research and narration are both keyless: the facts come
> straight from free live feeds and a deterministic template turns them into the
> dialogue. Nothing can hit a billing wall. The tradeoff is that each episode is
> a **live data readout** (today's numbers + headlines with sources) rather than
> a synthesized analytical take. Topics/queries per show live in `SHOWS` at the
> top of `scripts/run_show.py` — edit freely.

---

## Setup — one secret

Research (live free feeds) and audio (`edge-tts`) both need **no API key**, so
the **only** secret is `RCLONE_CONF` for the Google Drive upload
(**Settings → Secrets and variables → Actions → New repository secret**).

> **No LLM keys at all.** There's no `ANTHROPIC_API_KEY` and no `GEMINI_API_KEY` —
> the pipeline never calls a paid model, so it can't hit a billing wall. If a
> `GEMINI_API_KEY` secret is still present from an earlier version, it's unused
> and can be deleted.

### `RCLONE_CONF` — uploads audio to your Drive
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
3. Add the `RCLONE_CONF` secret above.
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
| Live data (Google News RSS + Stooq) | **free** (keyless HTTP) |
| edge-tts (audio) | **free** (no key, no bill) |
| GitHub Actions | free (well under the 2,000 free min/month) |
| Google Drive | free (your 15 GB; ~6 MB/episode as MP3) |

**The whole pipeline is $0 and needs no LLM/API key.**

## Customize
- **Voices:** set `EDGE_VOICE_A` / `EDGE_VOICE_B` env in the workflow (Alex / Sam).
  List all voices with `edge-tts --list-voices`. Defaults: `en-US-AvaNeural` /
  `en-US-AndrewNeural`.
- **Pace:** set `EDGE_RATE` (e.g. `+8%`) to speed up or slow down delivery.
- **Topics / headlines:** edit the `SHOWS` dict at the top of `scripts/run_show.py`
  (news queries, which indexes to quote); `HEADLINES_PER_TOPIC` env (default 3).
- **Add a show:** add an entry to `SHOWS` and add `<name>` to the matrix.
