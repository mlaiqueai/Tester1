#!/usr/bin/env python3
"""Build today's DX Daily episode — all free:

  1. research    scripts/research.py: market prices + recent news (keyless feeds)
  2. lesson      next lesson from data/curriculum.json not yet taught this cycle
                 (log: data/lessons_taught.csv — the workflow appends to it)
  3. brief       GitHub Models: analyst notes — what matters and why, with sources
  4. script      GitHub Models: Alex/Sam dialogue, ~1,000 words (6-7 min), incl. a teach-in

Writes to <out_dir>: script.txt, briefing.md, lesson_id.txt

Usage:  python build_episode.py <out_dir>
Env:    GITHUB_TOKEN        token with `models: read` (the workflow's built-in token works)
        TEXT_MODELS         comma-separated GitHub Models ids, tried in order
        RUN_DATE            YYYY-MM-DD (Central date; default today)
        ALLOW_TEMPLATE=1    if no model works, ship a plain readout instead of failing
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

ENDPOINT = os.environ.get("MODELS_ENDPOINT", "https://models.github.ai/inference/chat/completions")
MODELS = [m.strip() for m in os.environ.get(
    "TEXT_MODELS", "openai/gpt-4.1,openai/gpt-4o,openai/gpt-4o-mini").split(",") if m.strip()]

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


# ------------------------------ GitHub Models ------------------------------
class ModelError(Exception):
    pass


def chat(messages, token, max_tokens):
    """Try each model in MODELS; return (text, model). Raises ModelError if all fail."""
    errors = []
    for model in MODELS:
        payload = json.dumps({"model": model, "messages": messages,
                              "temperature": 0.5, "max_tokens": max_tokens}).encode()
        for attempt in range(3):
            req = urllib.request.Request(ENDPOINT, data=payload, method="POST", headers={
                "Content-Type": "application/json", "Accept": "application/json",
                "Authorization": f"Bearer {token}", "X-GitHub-Api-Version": "2022-11-28"})
            try:
                with urllib.request.urlopen(req, timeout=180) as resp:
                    body = json.loads(resp.read())
                text = body["choices"][0]["message"]["content"] or ""
                if text.strip():
                    return text, model
                errors.append(f"{model}: empty reply")
                break
            except urllib.error.HTTPError as e:
                detail = e.read().decode("utf-8", "replace")[:300]
                errors.append(f"{model}: HTTP {e.code} {detail}")
                if e.code in (429, 500, 502, 503, 504) and attempt < 2:
                    time.sleep(10 * (attempt + 1))
                    continue
                break                      # 4xx (unknown model, too large, no access): next model
            except (urllib.error.URLError, TimeoutError, KeyError, IndexError, ValueError) as e:
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


def brief_prompt(packet, run_date):
    return f"""{packet}

Write today's analyst brief ({run_date}) for {READER}

Rules:
- Use ONLY facts in the research packet. Never invent companies, deals, amounts, or dates.
- Skip items that aren't about the diagnostics, lab, or life-science-tools business.
- For each point: the fact, then the "so what" for the AMC — does it touch what DLMP develops,
  what AMC-MCS could distribute, or what the innovation engine should incubate?
- In public markets, use the MARKET DATA numbers and connect moves to the news when the packet supports it.
- If a section has nothing meaningful, write "Quiet today."

Format (markdown, about 450-650 words before Sources):
## Top takeaways
(3 bullets, most decision-relevant first)
## Public markets
## Private markets
## Regulation & reimbursement
## Clinical & market trends
## Watch list
(2-3 items, with dates when the packet gives them)
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
    os.makedirs(out_dir, exist_ok=True)
    day = dt.date.fromisoformat(os.environ.get("RUN_DATE") or dt.date.today().isoformat())
    run_date = f"{day:%A, %B} {day.day}, {day.year}"
    token = (os.environ.get("GH_MODELS_TOKEN") or os.environ.get("GITHUB_TOKEN") or "").strip()

    packet, n_news = research.build_packet(run_date)
    lesson = pick_lesson()
    print(f"Lesson: {lesson['id']} — {lesson['title']}")

    brief, used = "", "template"
    try:
        if not token:
            raise ModelError("no GITHUB_TOKEN")
        print("Stage 1: analyst brief...")
        brief, used = chat([{"role": "system", "content": SYS_ANALYST},
                            {"role": "user", "content": brief_prompt(packet, run_date)}],
                           token, max_tokens=2000)
        print(f"  brief by {used}: {len(brief.split())} words")

        print("Stage 2: episode script...")
        sprompt = script_prompt(brief, lesson, run_date)
        msgs = [{"role": "system", "content": SYS_WRITER}, {"role": "user", "content": sprompt}]
        draft, used = chat(msgs, token, max_tokens=3000)
        lines = parse_dialogue(draft)
        words = word_count(lines)
        print(f"  script by {used}: {len(lines)} turns, {words} words")
        if lines and not (WORDS_MIN <= words <= WORDS_MAX):
            fix = ("too short — deepen the teach-in and the private-markets analysis"
                   if words < WORDS_MIN else "too long — tighten every segment")
            print(f"  revising ({fix})...")
            revised, used2 = chat(msgs + [
                {"role": "assistant", "content": draft},
                {"role": "user", "content": f"That's {words} words, {fix}. Rewrite the full episode "
                                            "at 950-1,050 words. Same structure and rules; output only the dialogue."}],
                token, max_tokens=3000)
            rlines = parse_dialogue(revised)
            if len(rlines) >= 8 and abs(word_count(rlines) - 1000) < abs(words - 1000):
                lines, used = rlines, used2
                print(f"  revision kept: {word_count(lines)} words")
        if len(lines) < 8:
            raise ModelError(f"unusable script ({len(lines)} dialogue lines)")
    except ModelError as e:
        print(f"Synthesis failed: {e}", file=sys.stderr)
        if os.environ.get("ALLOW_TEMPLATE") != "1":
            sys.exit(1)               # let the next scheduled slot retry with a model
        print("ALLOW_TEMPLATE=1 — shipping the plain readout.")
        lines, used = template_script(packet, lesson, run_date), "template"

    script = "\n".join(f"{who}: {said}" for who, said in lines) + "\n"
    open(os.path.join(out_dir, "script.txt"), "w", encoding="utf-8").write(script)
    open(os.path.join(out_dir, "lesson_id.txt"), "w", encoding="utf-8").write(lesson["id"])
    open(os.path.join(out_dir, "briefing.md"), "w", encoding="utf-8").write(
        f"# DX Daily — {run_date}\n\n"
        f"**Lesson {lesson['id']}:** {lesson['title']} ({lesson['module']})  \n"
        f"**Written by:** {used} · {n_news} news items researched · "
        f"{word_count(lines)} words (~{word_count(lines) / 170:.1f} min)\n\n"
        f"{brief or '_Analyst brief unavailable (template run)._'}\n\n"
        f"## Transcript\n\n" + script.replace("\n", "\n\n"))
    print("----- TRANSCRIPT -----")
    print(script, end="")
    print(f"----- END ({len(lines)} turns, {word_count(lines)} words, written by {used}) -----")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Usage: python build_episode.py <out_dir>")
    main(sys.argv[1])
