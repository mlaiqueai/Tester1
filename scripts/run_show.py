#!/usr/bin/env python3
"""Run one "show": pull live market/news data from FREE, keyless sources and
assemble a two-host (Alex + Sam) podcast script — no LLM, no API key, no bill.

Live data comes from:
  - Google News RSS  (news.google.com/rss/search?q=...)  — fresh headlines for
    any topic, no key, no rate limit.
  - Stooq CSV        (stooq.com/q/d/l/?s=^spx&i=d)        — free index history,
    no key, used to compute day-over-day % moves.

The script is built by a deterministic Python template, so it can never hit a
billing wall and runs headless on GitHub Actions with your computer off.
Standard library only.

Usage:  python run_show.py <show_id> <output_script_path>
Env:    RUN_DATE (YYYY-MM-DD, optional), HEADLINES_PER_TOPIC (optional, default 3)
"""
import datetime as dt
import html
import os
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

UA = "Mozilla/5.0 (compatible; daily-audio/1.0)"
N_HEADLINES = int(os.environ.get("HEADLINES_PER_TOPIC", "3"))

# Per-show config: which indexes to quote and which news topics to pull.
# `query` strings are plain Google News searches — edit freely.
SHOWS = {
    "dx-public-equities": {
        "title": "Daily Public Equity",
        "indexes": [("the S&P 500", "^spx"), ("the Nasdaq", "^ndq"), ("the Dow", "^dji")],
        "topics": [
            ("what's moving markets", "stock market S&P 500 Nasdaq movers today"),
            ("the macro backdrop", "Federal Reserve interest rates inflation economy"),
        ],
        "sign_off": "That's your market snapshot. Have a good trading day.",
    },
    "dx-daily": {
        "title": "Daily DX Intel",
        "indexes": [],
        "topics": [
            ("the regulatory watch", "FDA laboratory developed test LDT regulation"),
            ("diagnostics market moves", "diagnostics company assay test launch approval"),
            ("reimbursement and coverage", "CMS MolDx diagnostics reimbursement coverage"),
            ("capital markets", "diagnostics company funding round IPO acquisition"),
        ],
        "sign_off": "That's today's diagnostics rundown. Back tomorrow.",
    },
    "dx-deal-sourcer": {
        "title": "Daily Deal Sourcer",
        "indexes": [],
        "topics": [
            ("venture and M&A", "diagnostics startup venture funding acquisition merger"),
            ("commercialization signals", "diagnostics assay company distribution partnership deal"),
        ],
        "sign_off": "That's the deal flow for today.",
    },
}


def _get(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def fetch_index(symbol):
    """Return (last_close, pct_change) day-over-day, or None on any failure."""
    url = f"https://stooq.com/q/d/l/?s={urllib.parse.quote(symbol)}&i=d"
    try:
        rows = _get(url).decode("utf-8", "replace").strip().splitlines()
        # Header: Date,Open,High,Low,Close,Volume — need the last two closes.
        closes = []
        for line in rows[1:]:
            parts = line.split(",")
            if len(parts) >= 5:
                try:
                    closes.append(float(parts[4]))
                except ValueError:
                    pass
        if len(closes) >= 2 and closes[-2] != 0:
            last = closes[-1]
            pct = (last - closes[-2]) / closes[-2] * 100.0
            return last, pct
    except Exception as e:  # noqa: BLE001 — any failure just skips this index
        print(f"  index {symbol} unavailable: {e}", file=sys.stderr)
    return None


def _clean(text):
    text = html.unescape(text or "")
    return re.sub(r"\s+", " ", text).strip()


def fetch_headlines(query, n):
    """Return up to n (headline, source) tuples from Google News RSS, or []."""
    url = (
        "https://news.google.com/rss/search?q="
        + urllib.parse.quote(query)
        + "&hl=en-US&gl=US&ceid=US:en"
    )
    try:
        root = ET.fromstring(_get(url))
    except Exception as e:  # noqa: BLE001
        print(f"  news '{query}' unavailable: {e}", file=sys.stderr)
        return []

    out = []
    for item in root.iter("item"):
        title = _clean(item.findtext("title"))
        src_el = item.find("source")
        source = _clean(src_el.text) if src_el is not None else ""
        # Google News titles often end with " - Source"; trim it if redundant.
        if source and title.endswith(f" - {source}"):
            title = title[: -(len(source) + 3)].strip()
        elif " - " in title and not source:
            title, _, source = title.rpartition(" - ")
            title, source = title.strip(), source.strip()
        if title:
            out.append((title, source))
        if len(out) >= n:
            break
    return out


def build_script(show_id, cfg, run_date):
    a, b = [], []  # collect (speaker, text) lines
    lines = []

    def A(s):
        lines.append(("Alex", s))

    def B(s):
        lines.append(("Sam", s))

    A(f"Good morning. Here's your {cfg['title']} briefing for {run_date}.")

    # --- Market numbers (equities show) ---
    quoted = []
    for name, sym in cfg["indexes"]:
        r = fetch_index(sym)
        if r:
            quoted.append((name, r[0], r[1]))
    if quoted:
        B("Let's start with where the major indexes landed.")
        for name, close, pct in quoted:
            direction = "up" if pct >= 0 else "down"
            name = name[:1].upper() + name[1:]  # "the S&P 500" -> "The S&P 500"
            A(f"{name} finished at {close:,.0f}, {direction} {abs(pct):.1f} percent.")
        B("Now to the stories behind the moves.")

    # --- News topics (deduped across the whole show) ---
    speakers = [A, B]
    turn = 0
    got_any_news = False
    seen = set()
    for label, query in cfg["topics"]:
        fresh = []
        for title, source in fetch_headlines(query, N_HEADLINES + 3):
            key = title.lower()
            if key in seen:
                continue
            seen.add(key)
            fresh.append((title, source))
            if len(fresh) >= N_HEADLINES:
                break
        if not fresh:
            continue
        got_any_news = True
        speakers[turn % 2](f"On {label}:")
        turn += 1
        for title, source in fresh:
            tail = f" That's from {source}." if source else ""
            speakers[turn % 2](f"{title}.{tail}")
            turn += 1

    if not quoted and not got_any_news:
        # Extremely defensive: every free source was unreachable this run.
        B("Live data sources were unreachable this run, so there's nothing to "
          "report — we'll be back tomorrow with a fresh update.")

    A(cfg["sign_off"])
    return lines


def run(show_id, out_path):
    cfg = SHOWS.get(show_id)
    if not cfg:
        sys.exit(f"ERROR: unknown show '{show_id}'. Known: {', '.join(SHOWS)}")
    run_date = os.environ.get("RUN_DATE", "").strip()
    if run_date:
        try:
            run_date = dt.date.fromisoformat(run_date).strftime("%A, %B %-d, %Y")
        except ValueError:
            pass
    else:
        run_date = "today"

    print(f"Building {show_id} from live free feeds (Google News RSS + Stooq)...")
    lines = build_script(show_id, cfg, run_date)
    text = "\n".join(f"{who}: {said}" for who, said in lines) + "\n"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"OK  {show_id}: wrote {len(lines)} lines / {len(text)} chars -> {out_path}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("Usage: python run_show.py <show_id> <output_script_path>")
    run(sys.argv[1], sys.argv[2])
