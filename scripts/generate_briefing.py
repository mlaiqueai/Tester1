#!/usr/bin/env python3
"""Generate three daily NotebookLM-style audio briefings.

For each brief defined in ``briefs.json`` (falls back to
``briefs.example.json``) this script:

1. Uses Gemini to write a natural two-host podcast dialogue from the brief's
   prompt (the "script writing" step NotebookLM does under the hood).
2. Synthesizes that dialogue with Gemini's **multi-speaker** text-to-speech
   (two distinct voices) into a per-brief audio file.

Defaults produce three files — Daily Public Equity, Daily DX Intel, and Daily
Overview — one ``.wav`` (and ``.mp3`` if ffmpeg is present) each, plus a
readable ``.md`` and the spoken ``.txt`` script.

NotebookLM has no public API and Anthropic has no speech API, so both the
scriptwriting and the audio use Gemini (``GEMINI_API_KEY``).
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

VOICE_A = os.environ.get("TTS_VOICE_A", "Kore")            # Gemini prebuilt voice
VOICE_B = os.environ.get("TTS_VOICE_B", "Puck")            # Gemini prebuilt voice
TTS_MODEL = os.environ.get("TTS_MODEL", "gemini-2.5-flash-preview-tts")
TEXT_MODEL = os.environ.get("TEXT_MODEL", "gemini-2.5-flash")
API_BASE = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"


def load_briefs() -> tuple[dict, str | None]:
    for name in ("briefs.json", "briefs.example.json"):
        p = ROOT / name
        if p.exists():
            return json.loads(p.read_text()), name
    return {"briefs": []}, None


def _today_str() -> str:
    try:
        return dt.date.today().strftime("%A, %B %-d, %Y")
    except ValueError:
        return dt.date.today().strftime("%A, %B %d, %Y")


def _post(model: str, payload: dict, api_key: str) -> dict | None:
    req = urllib.request.Request(
        API_BASE.format(model=model, key=api_key),
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"  Gemini {model} failed ({e.code}): "
              f"{e.read().decode(errors='ignore')[:400]}", file=sys.stderr)
    except urllib.error.URLError as e:
        print(f"  Gemini {model} failed: {e}", file=sys.stderr)
    return None


def write_script(brief: dict, hosts: tuple[str, str], owner: str,
                 today: str, api_key: str) -> list[tuple[str, str]]:
    """Return a list of (speaker, text) lines for this brief."""
    a, b = hosts
    title = brief.get("title", brief.get("id", "Briefing"))

    if api_key:
        prompt = (
            f"Write a natural, warm two-host podcast dialogue for a segment "
            f"titled \"{title}\" for {today}"
            + (f", addressed to the listener {owner}" if owner else "")
            + ".\n\nTopic brief:\n" + brief.get("prompt", "")
            + f"\n\nHosts are {a} and {b}. Output ONLY the dialogue, one line "
            f"per turn, each line starting with '{a}:' or '{b}:'. "
            "Alternate speakers naturally. 8 to 14 lines. No stage directions, "
            "no markdown, no headings."
        )
        body = _post(TEXT_MODEL, {"contents": [{"parts": [{"text": prompt}]}]}, api_key)
        if body:
            try:
                text = body["candidates"][0]["content"]["parts"][0]["text"]
                lines = _parse_dialogue(text, a, b)
                if lines:
                    return lines
            except (KeyError, IndexError):
                print(f"  Unexpected text response for {title}; using fallback.",
                      file=sys.stderr)

    # Fallback when no key or generation failed: a minimal spoken intro.
    return [
        (a, f"Welcome to {title} for {today}."),
        (b, brief.get("prompt", "Here's your briefing.").split(".")[0].strip() + "."),
        (a, "That's the quick version — full details require the Gemini API key."),
    ]


def _parse_dialogue(text: str, a: str, b: str) -> list[tuple[str, str]]:
    lines: list[tuple[str, str]] = []
    pat = re.compile(rf"^\s*(?:\*\*)?({re.escape(a)}|{re.escape(b)})(?:\*\*)?\s*:\s*(.+)$")
    for raw in text.splitlines():
        m = pat.match(raw.strip())
        if m:
            lines.append((m.group(1), m.group(2).strip()))
    return lines


def synthesize(lines: list[tuple[str, str]], hosts: tuple[str, str],
               out_stem: pathlib.Path, api_key: str) -> bool:
    a, b = hosts
    transcript = "\n".join(f"{who}: {text}" for who, text in lines)
    payload = {
        "contents": [{"parts": [{"text":
            f"Read this as an upbeat two-host briefing podcast.\n\n{transcript}"}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {
                "multiSpeakerVoiceConfig": {
                    "speakerVoiceConfigs": [
                        {"speaker": a,
                         "voiceConfig": {"prebuiltVoiceConfig": {"voiceName": VOICE_A}}},
                        {"speaker": b,
                         "voiceConfig": {"prebuiltVoiceConfig": {"voiceName": VOICE_B}}},
                    ]
                }
            },
        },
    }
    body = _post(TTS_MODEL, payload, api_key)
    if not body:
        return False
    try:
        part = body["candidates"][0]["content"]["parts"][0]["inlineData"]
        pcm = base64.b64decode(part["data"])
        rate = _rate_from_mime(part.get("mimeType", ""))
    except (KeyError, IndexError) as e:
        print(f"  Unexpected TTS response shape: {e}", file=sys.stderr)
        return False

    wav_path = out_stem.with_suffix(".wav")
    _write_wav(wav_path, pcm, rate)
    print(f"  wrote {wav_path.name}")
    _maybe_mp3(wav_path)
    return True


def _rate_from_mime(mime: str) -> int:
    m = re.search(r"rate=(\d+)", mime)
    return int(m.group(1)) if m else 24000


def _write_wav(path: pathlib.Path, pcm: bytes, rate: int) -> None:
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm)


def _maybe_mp3(wav_path: pathlib.Path) -> None:
    try:
        subprocess.run(["ffmpeg", "-version"], check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except (OSError, subprocess.CalledProcessError):
        return
    mp3 = wav_path.with_suffix(".mp3")
    subprocess.run(["ffmpeg", "-y", "-i", str(wav_path), "-b:a", "128k", str(mp3)],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"  wrote {mp3.name}")


def main() -> int:
    data, source = load_briefs()
    briefs = data.get("briefs", []) or []
    if source is None or not briefs:
        print("No briefs found (briefs.json / briefs.example.json).", file=sys.stderr)
        return 1
    print(f"Loaded {len(briefs)} brief(s) from {source}.")

    hosts_cfg = data.get("hosts", {}) or {}
    hosts = (hosts_cfg.get("a", "Alex"), hosts_cfg.get("b", "Sam"))
    owner = str(data.get("owner", "")).strip()
    today = _today_str()
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        print("GEMINI_API_KEY not set — writing scripts only, no audio.")

    OUT.mkdir(parents=True, exist_ok=True)
    made_audio = 0
    for brief in briefs:
        bid = brief.get("id") or re.sub(r"\W+", "-", brief.get("title", "brief").lower())
        title = brief.get("title", bid)
        print(f"- {title} ({bid})")
        lines = write_script(brief, hosts, owner, today, api_key)

        stem = OUT / bid
        script_txt = "\n\n".join(f"{who}: {text}" for who, text in lines)
        stem.with_suffix(".txt").write_text(script_txt + "\n")
        stem.with_suffix(".md").write_text(
            f"# {title} — {today}\n\n" + script_txt + "\n")

        if api_key and synthesize(lines, hosts, stem, api_key):
            made_audio += 1

    print(f"\nDone: {len(briefs)} script(s), {made_audio} audio file(s) in {OUT}/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
