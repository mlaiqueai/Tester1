#!/usr/bin/env python3
"""Generate a NotebookLM-style daily audio briefing from your scheduled tasks.

What it does
------------
1. Reads your scheduled tasks from ``tasks.json`` (falls back to
   ``tasks.example.json`` so a fresh checkout still produces output).
2. Builds a two-host conversational script — the same "Audio Overview" format
   NotebookLM uses, with two hosts trading lines back and forth.
3. Always writes ``out/briefing.md`` (readable rundown) and ``out/script.txt``
   (the spoken script).
4. When ``GEMINI_API_KEY`` is set, synthesizes the whole conversation in one
   call with Gemini's **multi-speaker** text-to-speech (two distinct voices)
   and writes ``out/daily-briefing.wav`` (plus an ``.mp3`` if ffmpeg is
   available).

NotebookLM has no public API, so this generates the equivalent two-host audio
itself. Anthropic has no speech API, so audio uses Gemini.
"""
from __future__ import annotations

import base64
import datetime as dt
import json
import os
import pathlib
import re
import subprocess
import sys
import urllib.error
import urllib.request
import wave

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "out"

HOST_A = "Alex"
HOST_B = "Sam"
VOICE_A = os.environ.get("TTS_VOICE_A", "Kore")     # Gemini prebuilt voice
VOICE_B = os.environ.get("TTS_VOICE_B", "Puck")     # Gemini prebuilt voice
TTS_MODEL = os.environ.get("TTS_MODEL", "gemini-2.5-flash-preview-tts")
GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "{model}:generateContent?key={key}"
)


def load_tasks() -> tuple[dict, str | None]:
    for name in ("tasks.json", "tasks.example.json"):
        p = ROOT / name
        if p.exists():
            return json.loads(p.read_text()), name
    return {"tasks": []}, None


def _today_str() -> str:
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
            md.append(f"- **{when + ' — ' if when else ''}{title}**")
            if detail:
                md.append(f"  - {detail}")
    else:
        md.append("_No scheduled tasks today._")
    md += ["", "---", "", "## Audio script", ""]
    md += script_lines
    (OUT / "briefing.md").write_text("\n".join(md) + "\n")


def synthesize(lines: list[tuple[str, str]], api_key: str) -> bool:
    """Render the whole conversation via Gemini multi-speaker TTS.

    Returns True if a WAV was produced, False otherwise.
    """
    transcript = "\n".join(f"{who}: {text}" for who, text in lines)
    prompt = (
        "Read the following as a warm, upbeat two-host daily briefing podcast. "
        f"{HOST_A} and {HOST_B} are co-hosts.\n\n" + transcript
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {
                "multiSpeakerVoiceConfig": {
                    "speakerVoiceConfigs": [
                        {"speaker": HOST_A,
                         "voiceConfig": {"prebuiltVoiceConfig": {"voiceName": VOICE_A}}},
                        {"speaker": HOST_B,
                         "voiceConfig": {"prebuiltVoiceConfig": {"voiceName": VOICE_B}}},
                    ]
                }
            },
        },
    }

    url = GEMINI_URL.format(model=TTS_MODEL, key=api_key)
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            body = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"Gemini TTS failed ({e.code}): {e.read().decode(errors='ignore')}",
              file=sys.stderr)
        return False
    except urllib.error.URLError as e:
        print(f"Gemini TTS failed: {e}", file=sys.stderr)
        return False

    try:
        part = body["candidates"][0]["content"]["parts"][0]["inlineData"]
        pcm = base64.b64decode(part["data"])
        rate = _rate_from_mime(part.get("mimeType", ""))
    except (KeyError, IndexError) as e:
        print(f"Unexpected Gemini response shape: {e}\n{json.dumps(body)[:500]}",
              file=sys.stderr)
        return False

    wav_path = OUT / "daily-briefing.wav"
    _write_wav(wav_path, pcm, rate)
    print(f"Wrote {wav_path}")
    _maybe_mp3(wav_path)
    return True


def _rate_from_mime(mime: str) -> int:
    m = re.search(r"rate=(\d+)", mime)
    return int(m.group(1)) if m else 24000


def _write_wav(path: pathlib.Path, pcm: bytes, rate: int) -> None:
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)   # 16-bit PCM
        w.setframerate(rate)
        w.writeframes(pcm)


def _maybe_mp3(wav_path: pathlib.Path) -> None:
    try:
        subprocess.run(["ffmpeg", "-version"], check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except (OSError, subprocess.CalledProcessError):
        return
    mp3 = wav_path.with_suffix(".mp3")
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(wav_path), "-b:a", "128k", str(mp3)],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    print(f"Wrote {mp3}")


def main() -> int:
    data, source = load_tasks()
    if source is None:
        print("No tasks.json or tasks.example.json found.", file=sys.stderr)
    else:
        print(f"Loaded tasks from {source} ({len(data.get('tasks', []) or [])} task(s)).")

    today, lines = build_dialogue(data)
    write_text_outputs(today, data, lines)
    print(f"Wrote {OUT / 'briefing.md'} and {OUT / 'script.txt'}")

    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        print("GEMINI_API_KEY not set — produced text briefing + script only "
              "(no audio). Add the secret to generate the audio.")
        return 0

    print("Synthesizing audio with Gemini multi-speaker TTS...")
    if not synthesize(lines, api_key):
        print("Audio synthesis failed — text outputs are still available.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
