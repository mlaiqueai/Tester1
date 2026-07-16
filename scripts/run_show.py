#!/usr/bin/env python3
"""Run one "show": call Gemini (free tier, with Google Search grounding) to
research the topic and write a two-host podcast script, saved to the given path.

Uses the Gemini API's free tier — no per-call bill — with the `gemini-2.5-flash`
text model and built-in Google Search grounding for fresh daily research.
Standard library only (urllib); the research prompt for each show lives in
prompts/<show>.md.

Usage:  python run_show.py <show_id> <output_script_path>
Env:    GEMINI_API_KEY (required), RUN_DATE (YYYY-MM-DD, optional),
        TEXT_MODEL (optional, default gemini-2.5-flash)
"""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL = os.environ.get("TEXT_MODEL", "gemini-2.5-flash")
API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"


def load_prompt(show_id, run_date):
    path = os.path.join(HERE, "prompts", f"{show_id}.md")
    if not os.path.exists(path):
        sys.exit(f"ERROR: prompt not found: {path}")
    with open(path, encoding="utf-8") as f:
        body = f.read()
    return body.replace("{{RUN_DATE}}", run_date)


def call_gemini(prompt, key):
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        # Google Search grounding keeps the research fresh (free-tier daily cap).
        "tools": [{"google_search": {}}],
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 8192,
            # Spend the whole output budget on the script, not hidden reasoning.
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }
    url = API_URL.format(model=MODEL, key=key)
    body = json.dumps(payload).encode("utf-8")

    # Free tier can return 429 (rate/daily cap) or transient 5xx — back off a bit.
    last_err = ""
    for attempt in range(4):
        req = urllib.request.Request(
            url, data=body, headers={"Content-Type": "application/json"}, method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "replace")[:600]
            last_err = f"HTTP {e.code}: {detail}"
            if e.code in (429, 500, 503) and attempt < 3:
                wait = 2 ** (attempt + 1)
                print(f"  Gemini {last_err} — retrying in {wait}s", file=sys.stderr)
                time.sleep(wait)
                continue
            sys.exit(f"ERROR: Gemini API {last_err}")
        except urllib.error.URLError as e:
            last_err = str(e)
            if attempt < 3:
                time.sleep(2 ** (attempt + 1))
                continue
            sys.exit(f"ERROR: network error calling Gemini API: {last_err}")
    sys.exit(f"ERROR: Gemini API failed after retries: {last_err}")


def extract_text(resp):
    candidates = resp.get("candidates") or []
    if not candidates:
        feedback = resp.get("promptFeedback")
        sys.exit(f"ERROR: no candidates from Gemini (blocked?): {json.dumps(feedback)[:600]}")
    parts = (candidates[0].get("content") or {}).get("parts") or []
    text = "".join(p.get("text", "") for p in parts)
    if not text.strip():
        reason = candidates[0].get("finishReason", "unknown")
        sys.exit(f"ERROR: empty text from Gemini (finishReason={reason})")
    return text


def run(show_id, out_path):
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not key:
        sys.exit("ERROR: GEMINI_API_KEY not set.")
    run_date = os.environ.get("RUN_DATE", "").strip() or "today"
    prompt = load_prompt(show_id, run_date)
    print(f"Researching + writing {show_id} with {MODEL} (Google Search grounding)...")

    text = extract_text(call_gemini(prompt, key))
    script = extract_script(text)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(script)
    print(f"OK  {show_id}: wrote {len(script)} chars of dialogue -> {out_path}")


def extract_script(text):
    m = re.search(r"<SCRIPT>(.*?)</SCRIPT>", text, re.DOTALL)
    body = (m.group(1) if m else text).strip()
    # Keep only lines that look like "Name: ..." dialogue.
    lines = [ln.strip() for ln in body.splitlines()
             if re.match(r"^(Alex|Sam)\s*:", ln.strip())]
    if not lines:
        sys.exit("ERROR: no Alex/Sam dialogue found in model output:\n" + text[:1500])
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("Usage: python run_show.py <show_id> <output_script_path>")
    run(sys.argv[1], sys.argv[2])
