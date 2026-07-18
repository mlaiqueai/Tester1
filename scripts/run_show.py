#!/usr/bin/env python3
"""Run one "show": pull live data from FREE keyless feeds, then use a FREE LLM
(GitHub Models) to synthesize an analytical two-host briefing that connects the
stories and derives insight — grounded strictly in the fetched facts.

  Facts (free, keyless):  Google News RSS + Stooq CSV.
  Synthesis (free):       GitHub Models (OpenAI-compatible), authenticated with
                          the repo's GITHUB_TOKEN (workflow needs
                          `permissions: models: read`).

If the model is unavailable (no token, rate limit, error), it falls back to a
plain template readout so a show always ships. Standard library only.

Usage:  python run_show.py <show_id> <output_script_path>
Env:    GITHUB_TOKEN or GH_MODELS_TOKEN (synthesis; without it → template),
        TEXT_MODEL (default openai/gpt-4o-mini),
        MODELS_ENDPOINT (default https://models.github.ai/inference/chat/completions),
        RUN_DATE (YYYY-MM-DD), HEADLINES_PER_TOPIC (default 4)
"""
import datetime as dt
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

UA = "Mozilla/5.0 (compatible; daily-audio/1.0)"
N_HEADLINES = int(os.environ.get("HEADLINES_PER_TOPIC", "4"))
MODEL = os.environ.get("TEXT_MODEL", "openai/gpt-4o-mini")
ENDPOINT = os.environ.get(
    "MODELS_ENDPOINT", "https://models.github.ai/inference/chat/completions"
)

FOCUS = ("GI, Infectious Disease, Heme/Onc, Renal, Neurology, Transplant, and "
         "Therapeutics-adjacent diagnostics")

SHOWS = {
    "dx-public-equities": {
        "title": "Daily Diagnostics Equities",
        "audience": ("an investor and corporate-development lead tracking publicly "
                     "traded diagnostics and lab companies across " + FOCUS),
        "indexes": [("the S&P 500", "^spx"), ("the Nasdaq", "^ndq")],
        "topics": [
            ("diagnostics & lab stocks", "diagnostics laboratory company stock earnings"),
            ("analyst & sector moves", "diagnostics testing company analyst rating guidance"),
            ("macro backdrop", "stock market Federal Reserve interest rates"),
        ],
        "sign_off": "That's your diagnostics equities read for today.",
    },
    "dx-daily": {
        "title": "Daily DX Intel",
        "audience": ("a diagnostics Corporate Development lead at an Academic Medical "
                     "Center, covering " + FOCUS),
        "indexes": [],
        "topics": [
            ("LDT & regulatory", "FDA laboratory developed test LDT VALID Act regulation"),
            ("reimbursement & coverage", "CMS MolDx diagnostics reimbursement coverage decision"),
            ("clinical & market trends", "diagnostics test clinical study guideline launch"),
            ("capital markets", "diagnostics company funding round IPO acquisition"),
        ],
        "sign_off": "That's today's diagnostics rundown.",
    },
    "dx-deal-sourcer": {
        "title": "Daily Deal Sourcer",
        "audience": ("a corporate-development team at an Academic Medical Center's "
                     "commercialization arm, hunting diagnostics companies with strong "
                     "assays but weak commercial infrastructure across " + FOCUS),
        "indexes": [],
        "topics": [
            ("venture & M&A", "diagnostics startup venture funding acquisition merger"),
            ("commercialization signals", "diagnostics assay company distribution partnership launch"),
        ],
        "sign_off": "That's the deal flow to chew on today.",
    },
}


# --------------------------- free data feeds ---------------------------
def _get(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def fetch_index(symbol):
    """Return (last_close, pct_change) day-over-day, or None on any failure."""
    url = f"https://stooq.com/q/d/l/?s={urllib.parse.quote(symbol)}&i=d"
    try:
        rows = _get(url).decode("utf-8", "replace").strip().splitlines()
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
            return last, (last - closes[-2]) / closes[-2] * 100.0
    except Exception as e:  # noqa: BLE001
        print(f"  index {symbol} unavailable: {e}", file=sys.stderr)
    return None


def _clean(text):
    return re.sub(r"\s+", " ", html.unescape(text or "")).strip()


def fetch_headlines(query, n):
    """Return up to n (headline, source) tuples from Google News RSS, or []."""
    url = ("https://news.google.com/rss/search?q=" + urllib.parse.quote(query)
           + "&hl=en-US&gl=US&ceid=US:en")
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


def gather(cfg):
    quoted = []
    for name, sym in cfg["indexes"]:
        r = fetch_index(sym)
        if r:
            quoted.append((name, r[0], r[1]))
    topics, seen = [], set()
    for label, query in cfg["topics"]:
        fresh = []
        for title, source in fetch_headlines(query, N_HEADLINES + 3):
            k = title.lower()
            if k in seen:
                continue
            seen.add(k)
            fresh.append((title, source))
            if len(fresh) >= N_HEADLINES:
                break
        if fresh:
            topics.append((label, fresh))
    return quoted, topics


# --------------------------- LLM synthesis ---------------------------
SYSTEM = (
    "You are the writers' room for a sharp daily briefing podcast with two hosts: "
    "Alex, a curious host who asks good questions, and Sam, an expert analyst who "
    "explains what things mean. You turn a packet of factual data into a natural, "
    "insightful spoken conversation."
)


def packet_text(cfg, run_date, quoted, topics):
    lines = [f"BRIEFING DATA — {cfg['title']} — {run_date}", ""]
    if quoted:
        lines.append("MARKET LEVELS (daily close, day-over-day change):")
        for name, close, pct in quoted:
            d = "up" if pct >= 0 else "down"
            lines.append(f"- {name}: {close:,.0f} ({d} {abs(pct):.1f}%)")
        lines.append("")
    lines.append("HEADLINES (from today's news search):")
    for label, heads in topics:
        lines.append(f"[{label}]")
        for title, source in heads:
            lines.append(f"- {title}" + (f" ({source})" if source else ""))
        lines.append("")
    return "\n".join(lines).strip()


def instructions(cfg):
    return (
        f"Write today's episode of \"{cfg['title']}\" for {cfg['audience']}.\n\n"
        "Rules:\n"
        "- Use ONLY the facts in the data packet above. Do NOT invent numbers, "
        "companies, deals, or events. If the data is thin, say what's notable and "
        "move on — never fabricate.\n"
        "- Do not just read headlines. CONNECT them: find the throughline, explain "
        "what it means for the audience, and flag what to watch or do next.\n"
        "- Lead with the single most important takeaway. End with two or three "
        "concrete watch-items or implications.\n"
        "- Natural, conversational, NPR-deep-dive tone. Roughly 550-850 words.\n"
        "- Spell out an acronym the first time it appears.\n"
        "- Output ONLY the dialogue. Every line must begin with 'Alex:' or 'Sam:'. "
        "No headings, no stage directions, no markdown, no bullet points."
    )


def call_llm(user, token):
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": user},
        ],
        "temperature": 0.6,
        "max_tokens": 2000,
    }
    data = json.dumps(payload).encode()
    last = ""
    for attempt in range(3):
        req = urllib.request.Request(
            ENDPOINT, data=data, method="POST",
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Authorization": f"Bearer {token}",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                body = json.loads(resp.read())
            return body["choices"][0]["message"]["content"]
        except urllib.error.HTTPError as e:
            last = f"HTTP {e.code}: {e.read().decode('utf-8', 'replace')[:400]}"
            if e.code in (429, 500, 503) and attempt < 2:
                time.sleep(2 ** (attempt + 1))
                continue
            print(f"  GitHub Models {last}", file=sys.stderr)
            return None
        except (urllib.error.URLError, KeyError, IndexError, ValueError) as e:
            last = str(e)
            if attempt < 2:
                time.sleep(2 ** (attempt + 1))
                continue
            print(f"  GitHub Models error: {last}", file=sys.stderr)
            return None
    return None


DIALOGUE = re.compile(r"^\s*(?:\*\*|\*|-)?\s*(Alex|Sam)(?:\*\*)?\s*:\s*(.+)$")


def parse_dialogue(text):
    out = []
    for raw in text.splitlines():
        m = DIALOGUE.match(raw.strip())
        if m:
            said = _clean(m.group(2)).lstrip("*_ ").strip()  # drop stray markdown
            if said:
                out.append((m.group(1), said))
    return out


# --------------------------- template fallback ---------------------------
def template_script(cfg, run_date, quoted, topics):
    lines = []
    A = lambda s: lines.append(("Alex", s))  # noqa: E731
    B = lambda s: lines.append(("Sam", s))   # noqa: E731
    A(f"Good morning. Here's your {cfg['title']} briefing for {run_date}.")
    if quoted:
        B("First, where the major indexes landed.")
        for name, close, pct in quoted:
            d = "up" if pct >= 0 else "down"
            name = name[:1].upper() + name[1:]
            A(f"{name} finished at {close:,.0f}, {d} {abs(pct):.1f} percent.")
    speakers, turn, any_news = [A, B], 0, False
    for label, heads in topics:
        any_news = True
        speakers[turn % 2](f"On {label}:")
        turn += 1
        for title, source in heads:
            tail = f" That's from {source}." if source else ""
            speakers[turn % 2](f"{title}.{tail}")
            turn += 1
    if not quoted and not any_news:
        B("Live data sources were unreachable this run — back tomorrow with a fresh update.")
    A(cfg["sign_off"])
    return lines


# --------------------------- orchestration ---------------------------
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

    print(f"Gathering live free data for {show_id}...")
    quoted, topics = gather(cfg)
    token = (os.environ.get("GH_MODELS_TOKEN") or os.environ.get("GITHUB_TOKEN") or "").strip()

    lines = None
    if token and (quoted or topics):
        print(f"Synthesizing with GitHub Models ({MODEL})...")
        user = packet_text(cfg, run_date, quoted, topics) + "\n\n" + instructions(cfg)
        out = call_llm(user, token)
        if out:
            lines = parse_dialogue(out)
            if len(lines) < 4:
                print("  model output unusable; using template.", file=sys.stderr)
                lines = None
    if not lines:
        why = "no token" if not token else ("no data" if not (quoted or topics)
                                            else "model unavailable")
        print(f"Falling back to template ({why}).")
        lines = template_script(cfg, run_date, quoted, topics)

    text = "\n".join(f"{who}: {said}" for who, said in lines) + "\n"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"----- TRANSCRIPT: {show_id} -----")
    print(text, end="")
    print("----- END TRANSCRIPT -----")
    print(f"OK  {show_id}: wrote {len(lines)} lines / {len(text)} chars -> {out_path}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("Usage: python run_show.py <show_id> <output_script_path>")
    run(sys.argv[1], sys.argv[2])
