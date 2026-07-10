#!/usr/bin/env python3
"""Generate a NotebookLM-style daily audio briefing from your scheduled tasks.

What it does
------------
1. Reads your scheduled tasks from ``tasks.json`` (falls back to
   ``tasks.example.json`` so a fresh checkout still produces output).
2. Builds a two-host conversational script — the same "Audio Overview" format
   NotebookLM uses, with two hosts trading lines back and forth.
3. Always writes ``out/briefing.md`` (readable rundown) and ``out/script.txt``
   (the spoken script), so the GitHub Action produces something even without a
   TTS key.
4. When ``OPENAI_API_KEY`` is set, synthesizes each line with two alternating
   voices via the OpenAI text-to-speech API and stitches them into a single
   ``out/daily-briefing.mp3`` using ffmpeg.

This is a practical stand-in for NotebookLM's audio: NotebookLM has no public
API, so we generate the equivalent two-host audio ourselves.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import pathlib
import subprocess
import sys
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "out"
SEG = OUT / "segments"

HOST_A = "Alex"
HOST_B = "Sam"
VOICE_A = os.environ.get("TTS_VOICE_A", "alloy")
VOICE_B = os.environ.get("TTS_VOICE_B", "shimmer")
TTS_MODEL = os.environ.get("TTS_MODEL", "gpt-4o-mini-tts")
OPENAI_URL = "https://api.openai.com/v1/audio/speech"


def load_tasks() -> tuple[dict, str | None]:
    for name in ("tasks.json", "tasks.example.json"):
        p = ROOT / name
        if p.exists():
            return json.loads(p.read_text()), name
    return {"tasks": []}, None


def _today_str() -> str:
    # %-d is not portable to Windows; the Action runs on Linux so it's fine.
    try:
        return dt.date.today().strftime("%A, %B %-d, %Y")
    except ValueError:
        return dt.date.today().strftime("%A, %B %d, %Y")


def fmt_task(t: dict) -> tuple[str, str, str]:
    when = str(t.get("time") or t.get("schedule") or "").strip()
    title = str(t.get("title") or t.get("name") or "Untitled task").strip()
    detail = str(t.get("detail") or t.get("notes") or "").strip()
    return when, title, detail


def build_dialogue(data: dict) -> tuple[str, list[tuple[str, str]]]:
    today = _today_str()
    tasks = data.get("tasks", []) or []
    owner = str(data.get("owner", "")).strip()
    lines: list[tuple[str, str]] = []

    def A(s: str) -> None:
        lines.append((HOST_A, s))

    def B(s: str) -> None:
        lines.append((HOST_B, s))

    greeting = f"Welcome to your daily briefing for {today}."
    if owner:
        greeting += f" Great to have you with us, {owner}."
    A(greeting)

    if not tasks:
        B("Here's the good news: your schedule is completely clear today. "
          "Nothing on the books — so it's yours to spend however you like.")
        A("That's the whole briefing. Enjoy the open day, and we'll see you tomorrow.")
        return today, lines

    count = len(tasks)
    B(f"We've got {count} thing{'s' if count != 1 else ''} on the schedule today. "
      "Let's walk through them one at a time.")

    for i, t in enumerate(tasks, 1):
        when, title, detail = fmt_task(t)
        lead = f"At {when}, " if when else ""
        A(f"Up next, item {i}: {lead}{title}.")
        B(detail if detail else "No extra notes on that one — pretty self-explanatory.")

    A("And that's everything on the calendar for today.")
    B("You've got the full picture now. Go make it a good one — see you tomorrow.")
    return today, lines


def write_text_outputs(today: str, data: dict, lines: list[tuple[str, str]]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    script_lines = [f"{who}: {text}" for who, text in lines]
    (OUT / "script.txt").write_text("\n\n".join(script_lines) + "\n")

    tasks = data.get("tasks", []) or []
    md = [f"# Daily briefing — {today}", ""]
    if tasks:
        md.append(f"**{len(tasks)} scheduled task(s):**")
        md.append("")
        for t in tasks:
            when, title, detail = fmt_task(t)
            bullet = f"- **{when + ' — ' if when else ''}{title}**"
            md.append(bullet)
            if detail:
                md.append(f"  - {detail}")
    else:
        md.append("_No scheduled tasks today._")
    md += ["", "---", "", "## Audio script", ""]
    md += script_lines
    (OUT / "briefing.md").write_text("\n".join(md) + "\n")


def synthesize(lines: list[tuple[str, str]], api_key: str) -> bool:
    """Render each line to MP3 with an alternating voice; concatenate via ffmpeg.

    Returns True if an MP3 was produced, False otherwise.
    """
    if not _have_ffmpeg():
        print("ffmpeg not found on PATH — skipping audio, text outputs only.",
              file=sys.stderr)
        return False

    SEG.mkdir(parents=True, exist_ok=True)
    seg_paths: list[pathlib.Path] = []
    for idx, (who, text) in enumerate(lines):
        voice = VOICE_A if who == HOST_A else VOICE_B
        seg = SEG / f"{idx:03d}.mp3"
        try:
            audio = _tts(text, voice, api_key)
        except urllib.error.HTTPError as e:
            print(f"TTS request failed ({e.code}): {e.read().decode(errors='ignore')}",
                  file=sys.stderr)
            return False
        except urllib.error.URLError as e:
            print(f"TTS request failed: {e}", file=sys.stderr)
            return False
        seg.write_bytes(audio)
        seg_paths.append(seg)
        print(f"  synthesized line {idx + 1}/{len(lines)} ({who}, {voice})")

    concat_list = SEG / "concat.txt"
    concat_list.write_text("".join(f"file '{p.name}'\n" for p in seg_paths))
    out_mp3 = OUT / "daily-briefing.mp3"
    subprocess.run(
        ["ffmpeg", "-y", "-f", "concat", "-safe", "0",
         "-i", str(concat_list), "-c", "copy", str(out_mp3)],
        check=True,
        cwd=str(SEG),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    print(f"Wrote {out_mp3}")
    return True


def _tts(text: str, voice: str, api_key: str) -> bytes:
    body = json.dumps({
        "model": TTS_MODEL,
        "voice": voice,
        "input": text,
        "response_format": "mp3",
    }).encode()
    req = urllib.request.Request(
        OPENAI_URL,
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return resp.read()


def _have_ffmpeg() -> bool:
    try:
        subprocess.run(["ffmpeg", "-version"], check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except (OSError, subprocess.CalledProcessError):
        return False


def main() -> int:
    data, source = load_tasks()
    if source is None:
        print("No tasks.json or tasks.example.json found.", file=sys.stderr)
    else:
        print(f"Loaded tasks from {source} ({len(data.get('tasks', []) or [])} task(s)).")

    today, lines = build_dialogue(data)
    write_text_outputs(today, data, lines)
    print(f"Wrote {OUT / 'briefing.md'} and {OUT / 'script.txt'}")

    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        print("OPENAI_API_KEY not set — produced text briefing + script only "
              "(no audio). Add the secret to generate the MP3.")
        return 0

    print("Synthesizing audio...")
    if not synthesize(lines, api_key):
        print("Audio synthesis skipped/failed — text outputs are still available.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
