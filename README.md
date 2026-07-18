# Daily Diagnostics Audio Overviews — Cloud (computer-off)

Generates **three** NotebookLM-style two-host podcast episodes every morning and
uploads them to your Google Drive **`Daily Audio`** folder — running entirely on
**GitHub's servers**, so your computer can be off.

Shows: `dx-daily` (full 4-pillar brief), `dx-deal-sourcer`, `dx-public-equities`.

## How it works

For each show, once a day, a GitHub Actions job:
1. **Gathers live facts from free, keyless feeds** — `scripts/run_show.py` pulls
   fresh data:
   - **Google News RSS** (`news.google.com/rss/search`) — headlines per topic.
   - **Stooq** (`stooq.com` CSV) — index levels + day-over-day % moves (equities).
2. **Synthesizes an analytical script with a free LLM** — the fetched data is
   handed to **GitHub Models** (`openai/gpt-4o-mini` by default), which writes a
   two-host (Alex + Sam) dialogue that **connects the stories and derives insight**,
   grounded strictly in the fetched facts (no invented numbers). Authenticated
   with the repo's built-in `GITHUB_TOKEN` — **free, no external key**. If the
   model is ever unavailable, it falls back to a plain template so the show still
   ships.
3. **Generates audio** — `edge-tts` (Microsoft Edge's neural voices, **free, no
   API key**) synthesizes each Alex/Sam turn with its own voice, then ffmpeg
   (bundled) concatenates them into one compact `.mp3`.
4. **Uploads to Drive** — `rclone` copies it to `Daily Audio/<show>-<date>.mp3`.

> **Free, but with real synthesis.** The facts come from free live feeds; a free
> LLM (GitHub Models, via the built-in Actions token) turns them into an
> analytical briefing. No paid API, no billing wall. Per-show topics and audience
> framing live in the `SHOWS` dict at the top of `scripts/run_show.py`.

---

## Setup — one secret

The LLM synthesis uses **GitHub Models** with the repo's **built-in
`GITHUB_TOKEN`** (the workflow grants it `models: read`) — no external key. Audio
is keyless too. So the **only** secret you add is `RCLONE_CONF` for the Google
Drive upload (**Settings → Secrets and variables → Actions → New repository
secret**).

> **No paid keys.** No `ANTHROPIC_API_KEY`, no `GEMINI_API_KEY`. If either is
> still present from an earlier version, it's unused and can be deleted.
>
> **If GitHub Models is disabled** for your org, or the built-in token is
> refused, create a fine-grained **Personal Access Token** with the
> **`models: read`** permission and add it as a secret named `GH_MODELS_TOKEN`
> (the script prefers it over `GITHUB_TOKEN`). Otherwise each show falls back to
> a plain headline-readout template.

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
| LLM synthesis (GitHub Models) | **free** (built-in token; modest daily rate limits) |
| edge-tts (audio) | **free** (no key, no bill) |
| GitHub Actions | free (well under the 2,000 free min/month) |
| Google Drive | free (your 15 GB) |

**The whole pipeline is $0 and needs no paid API key.**

## Customize
- **LLM:** set `TEXT_MODEL` in the workflow (default `openai/gpt-4o-mini`; e.g.
  `openai/gpt-4o`, `meta/Llama-3.3-70B-Instruct`). Higher-tier models have lower
  free daily limits — fine for 3 shows/day.
- **Voices:** set `EDGE_VOICE_A` / `EDGE_VOICE_B` env in the workflow (Alex / Sam).
  List all voices with `edge-tts --list-voices`. Defaults: `en-US-AvaNeural` /
  `en-US-AndrewNeural`.
- **Pace:** set `EDGE_RATE` (e.g. `+8%`) to speed up or slow down delivery.
- **Topics / audience:** edit the `SHOWS` dict at the top of `scripts/run_show.py`
  (news queries, indexes, and the per-show audience framing the LLM writes for);
  `HEADLINES_PER_TOPIC` env (default 4).
- **Add a show:** add an entry to `SHOWS` and add `<name>` to the matrix.
