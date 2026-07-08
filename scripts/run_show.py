#!/usr/bin/env python3
"""Run one "show": call Claude (with live web search) to research the topic and
write a two-host podcast script, saved to the given output path.

Runs in GitHub Actions (or anywhere) with only the `anthropic` package.
The research prompt for each show lives in prompts/<show>.md.

Usage:  python run_show.py <show_id> <output_script_path>
Env:    ANTHROPIC_API_KEY (required), RUN_DATE (YYYY-MM-DD, optional),
        CLAUDE_MODEL (optional, default claude-sonnet-5)
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-5")
MAX_SEARCHES = int(os.environ.get("MAX_SEARCHES", "12"))


def load_prompt(show_id, run_date):
    path = os.path.join(HERE, "prompts", f"{show_id}.md")
    if not os.path.exists(path):
        sys.exit(f"ERROR: prompt not found: {path}")
    with open(path, encoding="utf-8") as f:
        body = f.read()
    return body.replace("{{RUN_DATE}}", run_date)


def run(show_id, out_path):
    run_date = os.environ.get("RUN_DATE", "").strip() or "today"
    prompt = load_prompt(show_id, run_date)
    import anthropic  # imported lazily so the module is testable without the dep
    client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY

    messages = [{"role": "user", "content": prompt}]
    tools = [{"type": "web_search_20250305", "name": "web_search", "max_uses": MAX_SEARCHES}]

    # Server-side web search runs inside the API. A long research turn can come
    # back as stop_reason="pause_turn"; resend the accumulated turn to continue.
    final_text = ""
    for _ in range(6):
        resp = client.messages.create(
            model=MODEL, max_tokens=8000, messages=messages, tools=tools,
        )
        final_text = "".join(
            b.text for b in resp.content if getattr(b, "type", None) == "text"
        )
        if resp.stop_reason == "pause_turn":
            messages.append({"role": "assistant", "content": resp.content})
            continue
        break

    script = extract_script(final_text)
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
