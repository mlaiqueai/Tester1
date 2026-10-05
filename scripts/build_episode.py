#!/usr/bin/env python3
"""Build today's DX Daily episode:

  1. research    scripts/research.py: market prices + recent news (free, keyless feeds)
  2. lesson      next lesson from data/curriculum.json not yet taught this cycle
                 (log: data/lessons_taught.csv — the workflow appends to it)
  3. brief       Gemini: analyst notes — what matters and why, with sources. Uses live
                 Google Search when the key's tier allows it (paid/prepaid projects get
                 5,000 free searches/month); otherwise works from the feeds alone.
  4. script      Gemini: Alex/Sam dialogue, ~1,000 words (6-7 min), incl. a teach-in

Writes to <out_dir>: script.txt, briefing.md, lesson_id.txt

Usage:  python build_episode.py <out_dir>
Env:    GEMINI_API_KEY      Google AI Studio key
        GEMINI_MODELS       comma-separated model ids, tried in order
        GROUNDING           auto (default) | off
        RUN_DATE            YYYY-MM-DD (Central date; default today)
        ALLOW_TEMPLATE=1    if Gemini is unusable, ship a plain readout instead of failing
"""
import csv
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import research  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CURRICULUM = os.path.join(ROOT, "data", "curriculum.json")
LESSON_LOG = os.path.join(ROOT, "data", "lessons_taught.csv")

API = "https://generativelanguage.googleapis.com/v1beta/models"
MODELS = [m.strip() for m in os.environ.get(
    "GEMINI_MODELS",
    "gemini-flash-latest,gemini-3.8-flash,gemini-3.7-flash,gemini-3.5-flash,gemini-flash-lite-latest",
).split(",") if m.strip()]
GROUNDING = os.environ.get("GROUNDING", "auto").lower() != "off"

LAST_ERROR = ""

WORDS_MIN, WORDS_MAX = 900, 1150   # ~5.3-6.8 min: edge-tts reads ~170 words/min

READER = ("Muddassir, who leads Corporate Development for the diagnostics vertical at an "
          "Academic Medical Center (AMC): its lab (DLMP) develops tests, its commercialization "
          "arm (AMC-MCS) distributes partner assays, and its innovation engine incubates new "
          "ones. Focus areas: GI, infectious disease, heme/onc, renal, neurology, transplant, "
          "and therapeutics-adjacent diagnostics. He has a structured-finance background and is "
          "fluent in diagnostics, so don't over-explain standard acronyms.")


# ------------------------------ lessons ------------------------------
def pick_lesson():
    lessons = json.load(open(CURRICULUM, encoding="utf-8"))
    taught = {}
    if os.path.exists(LESSON_LOG):
        for row in csv.DictReader(open(LESSON_LOG, encoding="utf-8")):
            taught[row["lesson_id"]] = taught.get(row["lesson_id"], 0) + 1
    passes = min(taught.get(l["id"], 0) for l in lessons)   # completed full cycles
    return next(l for l in lessons if taught.get(l["id"], 0) <= passes)


def lesson_text(lesson):
    lines = [f"LESSON {lesson['id']} — {lesson['title']} (module: {lesson['module']})"]
    for key, label in (("scope", "Scope"), ("why", "Why it matters"), ("questions", "Questions to answer")):
        if lesson.get(key):
            lines.append(f"{label}: {lesson[key]}")
    return "\n".join(lines)


# ------------------------------ Gemini ------------------------------
class ModelError(Exception):
    pass


class Fatal(ModelError):
    """Key/billing problem: no other model will do better."""


def _post(model, body, key):
    req = urllib.request.Request(f"{API}/{model}:generateContent", data=json.dumps(body).encode(),
                                 method="POST", headers={"Content-Type": "application/json",
                                                         "x-goog-api-key": key})
    with urllib.request.urlopen(req, timeout=300) as resp:
        return json.loads(resp.read())


def generate(system, turns, key, search=False, max_tokens=16384):
    """turns: [(role, text)] with role 'user'/'model'. Returns (text, model, sources, searched)."""
    body = {"systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": r, "parts": [{"text": t}]} for r, t in turns],
            "generationConfig": {"temperature": 0.6, "maxOutputTokens": max_tokens}}
    errors = []
    for model in MODELS:
        use_search = search
        for attempt in range(3):
            b = dict(body, tools=[{"google_search": {}}]) if use_search else body
            try:
                r = _post(model, b, key)
                cand = (r.get("candidates") or [{}])[0]
                parts = cand.get("content", {}).get("parts", [])
                text = "".join(p.get("text", "") for p in parts if not p.get("thought"))
                if not text.strip():
                    errors.append(f"{model}: empty reply ({cand.get('finishReason')})")
                    break
                g = cand.get("groundingMetadata") or {}
                sources = [(c["web"].get("title", ""), c["web"].get("uri", ""))
                           for c in g.get("groundingChunks", []) if c.get("web")]
                return text, model, sources, bool(g.get("webSearchQueries"))
            except urllib.error.HTTPError as e:
                detail = e.read().decode("utf-8", "replace")
                msg = (re.search(r'"message":\s*"([^"]+)', detail) or [None, detail[:200]])[1]
                errors.append(f"{model}{' +search' if use_search else ''}: HTTP {e.code} {msg}")
                if e.code == 402 or (e.code == 403 and "API key" in detail):
                    raise Fatal(errors[-1])           # depleted prepaid credits / bad key
                if use_search and e.code in (400, 429):
                    use_search = False                # tier doesn't allow search: go without
                    continue
                if e.code in (429, 500, 503) and attempt < 2:
                    time.sleep(20 * (attempt + 1))
                    continue
                break                                 # 404 retired model, etc.: next model
            except (urllib.error.URLError, TimeoutError, ValueError, KeyError) as e:
                errors.append(f"{model}: {e}")
                if attempt < 2:
                    time.sleep(5)
                    continue
                break
    raise ModelError(" | ".join(errors[-6:]))


# ------------------------------ prompts ------------------------------
SYS_ANALYST = ("You are a senior diagnostics-industry analyst who writes tight, factual "
               "morning briefs for a corporate development executive.")
SYS_WRITER = ("You are the writers' room for a smart daily audio briefing with two hosts: "
              "Alex, a curious host who asks the questions a sharp listener would, and Sam, "
              "a diagnostics analyst and gifted teacher.")


def brief_prompt(packet, run_date, search):
    source_rule = (
        "- Use Google Search to verify the most important items and to find significant "
        "diagnostics news from the past 3 days that the packet missed — especially venture rounds, "
        "M&A, private equity, IPOs, FDA/CMS decisions, and earnings. Get the specifics (amounts, "
        "investors, terms, dates). Never invent anything you couldn't find."
        if search else
        "- Use ONLY facts in the research packet. Never invent companies, deals, amounts, or dates.")
    return f"""{packet}

Write today's analyst brief ({run_date}) for {READER}

Rules:
{source_rule}
- Skip items that aren't about the diagnostics, lab, or life-science-tools business.
- For each point: the fact, then the "so what" for the AMC — does it touch what DLMP develops,
  what AMC-MCS could distribute, or what the innovation engine should incubate?
- In public markets, use the MARKET DATA numbers and connect moves to the news where supported.
- If a section has nothing meaningful, write "Quiet today."

Format (markdown, about 500-750 words before Sources):
## Top takeaways
(3 bullets, most decision-relevant first)
## Public markets
## Private markets
## Regulation & reimbursement
## Clinical & market trends
## Watch list
(2-3 items, with dates when known)
## Sources
(one line per item you used: headline — outlet, date)"""


def script_prompt(brief, lesson, run_date):
    return f"""TODAY'S ANALYST BRIEF ({run_date}):
{brief}

TODAY'S LESSON (from the listener's business-of-diagnostics curriculum):
{lesson_text(lesson)}

Write today's episode of "DX Daily" for {READER}

Structure (target 950-1,050 words total, about 6-7 minutes spoken):
1. Cold open (~60 words): the single most important takeaway today.
2. Public markets (~170): what moved and why, with the numbers.
3. Private markets (~190): rounds, M&A, private equity, IPOs — and what they signal.
4. Regulation, reimbursement and clinical trends (~170).
5. Teach-in (~300): Alex says "Today's lesson: {lesson['title']}." Sam teaches it from first
   principles — what it is, how it works mechanically, who orders/pays/benefits, one concrete
   example, a common misconception, and what it means for the AMC. Use the lesson's questions as
   a guide and tie it to today's news if it fits naturally. Define the lesson's key terms the
   first time they appear. This segment draws on general industry knowledge, so stay accurate:
   if you're unsure of a specific figure or date, explain the mechanism instead of guessing.
6. Watch list and sign-off (~80).

Rules:
- News facts come ONLY from the brief. Never invent companies, deals, numbers, or dates.
- Write for the ear: spell numbers the way they're spoken ("nine million dollars",
  "up eight percent"); no symbols, URLs, tables, headings, or markdown.
- Natural back-and-forth with short turns (1-4 sentences). Lead with insight, not headlines.
- Every line starts with "Alex:" or "Sam:". Output only the dialogue."""


# ------------------------------ parsing ------------------------------
DIALOGUE = re.compile(r"^\s*[*_>\-\s]*(Alex|Sam)[*_]*\s*:\s*[*_]*\s*(.+)$")


def parse_dialogue(text):
    out = []
    for raw in text.splitlines():
        m = DIALOGUE.match(raw)
        if m:
            said = re.sub(r"[*_#`]+", "", m.group(2)).strip()
            if said:
                out.append((m.group(1), said))
    return out


def word_count(lines):
    return sum(len(said.split()) for _, said in lines)


# ------------------------------ template fallback ------------------------------
def template_script(packet, lesson, run_date):
    lines = [("Alex", f"Good morning. This is DX Daily for {run_date}. "
                      "Our analysis engine was unavailable today, so here's a straight readout.")]
    for raw in packet.splitlines():
        if raw.startswith("Biggest 1-day movers"):
            lines.append(("Sam", raw.replace("%", " percent") + "."))
        elif raw.startswith("- ") and "[" not in raw:
            lines.append(("Sam" if len(lines) % 2 else "Alex", raw[2:].split(" (")[0] + "."))
        if len(lines) > 16:
            break
    lines.append(("Alex", f"Today's lesson: {lesson['title']}."))
    for key in ("scope", "why", "questions"):
        if lesson.get(key):
            lines.append(("Sam", lesson[key]))
    lines.append(("Alex", "That's DX Daily. Back tomorrow."))
    return lines


# ------------------------------ main ------------------------------
def main(out_dir):
    global LAST_ERROR
    os.makedirs(out_dir, exist_ok=True)
    day = dt.date.fromisoformat(os.environ.get("RUN_DATE") or dt.date.today().isoformat())
    run_date = f"{day:%A, %B} {day.day}, {day.year}"
    key = os.environ.get("GEMINI_API_KEY", "").strip()

    packet, n_news = research.build_packet(run_date)
    lesson = pick_lesson()
    print(f"Lesson: {lesson['id']} — {lesson['title']}")

    brief, used, sources, searched = "", "template", [], False
    try:
        if not key:
            raise Fatal("no GEMINI_API_KEY")
        print("Stage 1: analyst brief" + (" (with Google Search if allowed)..." if GROUNDING else "..."))
        brief, used, sources, searched = generate(
            SYS_ANALYST, [("user", brief_prompt(packet, run_date, GROUNDING))], key, search=GROUNDING)
        if GROUNDING and not searched:   # search unavailable: make sure the brief stayed on the packet
            brief, used, _, _ = generate(
                SYS_ANALYST, [("user", brief_prompt(packet, run_date, False))], key)
        print(f"  brief by {used}: {len(brief.split())} words, live search: "
              f"{'yes, ' + str(len(sources)) + ' sources' if searched else 'no'}")

        print("Stage 2: episode script...")
        turns = [("user", script_prompt(brief, lesson, run_date))]
        draft, used, _, _ = generate(SYS_WRITER, turns, key)
        lines = parse_dialogue(draft)
        words = word_count(lines)
        print(f"  script by {used}: {len(lines)} turns, {words} words")
        if lines and not (WORDS_MIN <= words <= WORDS_MAX):
            fix = ("too short — deepen the teach-in and the private-markets analysis"
                   if words < WORDS_MIN else "too long — tighten every segment")
            print(f"  revising ({fix})...")
            revised, used2, _, _ = generate(SYS_WRITER, turns + [
                ("model", draft),
                ("user", f"That's {words} words, {fix}. Rewrite the full episode at 950-1,050 "
                         "words. Same structure and rules; output only the dialogue.")], key)
            rlines = parse_dialogue(revised)
            if len(rlines) >= 8 and abs(word_count(rlines) - 1000) < abs(words - 1000):
                lines, used = rlines, used2
                print(f"  revision kept: {word_count(lines)} words")
        if len(lines) < 8:
            raise ModelError(f"unusable script ({len(lines)} dialogue lines)")
    except ModelError as e:
        LAST_ERROR = f"Gemini unavailable — {e}"
        print(f"Synthesis failed: {e}", file=sys.stderr)
        if os.environ.get("ALLOW_TEMPLATE") != "1":
            sys.exit(1)               # let the next scheduled slot retry
        print("ALLOW_TEMPLATE=1 — shipping the plain readout.")
        lines, used, searched = template_script(packet, lesson, run_date), "template", False

    script = "\n".join(f"{who}: {said}" for who, said in lines) + "\n"
    web = "".join(f"- [{t or u}]({u})\n" for t, u in dict.fromkeys(sources)) if sources else ""
    open(os.path.join(out_dir, "script.txt"), "w", encoding="utf-8").write(script)
    open(os.path.join(out_dir, "lesson_id.txt"), "w", encoding="utf-8").write(lesson["id"])
    open(os.path.join(out_dir, "briefing.md"), "w", encoding="utf-8").write(
        f"# DX Daily — {run_date}\n\n"
        f"**Lesson {lesson['id']}:** {lesson['title']} ({lesson['module']})  \n"
        f"**Written by:** {used} · {n_news} feed items · live Google Search: "
        f"{'yes' if searched else 'no'} · {word_count(lines)} words (~{word_count(lines) / 170:.1f} min)\n\n"
        f"{brief or '_Analyst brief unavailable (template run)._'}\n\n"
        + (f"## Web sources consulted\n\n{web}\n" if web else "")
        + "## Transcript\n\n" + script.replace("\n", "\n\n"))
    print("----- TRANSCRIPT -----")
    print(script, end="")
    print(f"----- END ({len(lines)} turns, {word_count(lines)} words, written by {used}) -----")
    annotate("warning" if used == "template" else "notice",
             f"Lesson {lesson['id']} · {n_news} feed items · live search: {'yes' if searched else 'no'} · "
             f"{word_count(lines)} words (~{word_count(lines) / 170:.1f} min) · written by {used}")


def annotate(level, msg):
    """Surface a message on the Actions run summary (readable without opening logs)."""
    if os.environ.get("GITHUB_ACTIONS"):
        msg = str(msg)[:1800].replace("%", "%25").replace("\r", "").replace("\n", "%0A")
        print(f"::{level} title=DX Daily::{msg}", flush=True)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Usage: python build_episode.py <out_dir>")
    try:
        main(sys.argv[1])
    except SystemExit as e:
        if e.code not in (0, None):
            annotate("error", f"Episode not built: {LAST_ERROR or e.code}")
        raise
    except Exception:  # noqa: BLE001
        import traceback
        annotate("error", "Crashed:\n" + traceback.format_exc()[-1500:])
        raise
