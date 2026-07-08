#!/usr/bin/env python3
"""Turn a two-host script into podcast audio via Google's official Gemini
multi-speaker TTS API. Standard library only.

Usage:  python generate_audio.py <script_path> <output_wav_path>
Env:    GEMINI_API_KEY (required), GEMINI_TTS_MODEL / GEMINI_VOICE_A / GEMINI_VOICE_B (optional)
"""
import base64
import json
import os
import sys
import urllib.error
import urllib.request
import wave

MODEL = os.environ.get("GEMINI_TTS_MODEL", "gemini-2.5-flash-preview-tts")
SPEAKER_A, SPEAKER_B = "Alex", "Sam"
VOICE_A = os.environ.get("GEMINI_VOICE_A", "Kore")
VOICE_B = os.environ.get("GEMINI_VOICE_B", "Puck")


def build_payload(dialogue):
    prompt = ("TTS the following two-host podcast conversation. Read it naturally "
              "and conversationally, like an NPR-style deep-dive podcast:\n\n" + dialogue)
    return {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {"multiSpeakerVoiceConfig": {"speakerVoiceConfigs": [
                {"speaker": SPEAKER_A, "voiceConfig": {"prebuiltVoiceConfig": {"voiceName": VOICE_A}}},
                {"speaker": SPEAKER_B, "voiceConfig": {"prebuiltVoiceConfig": {"voiceName": VOICE_B}}},
            ]}},
        },
    }


def call_api(key, payload):
    url = (f"https://generativelanguage.googleapis.com/v1beta/models/"
           f"{MODEL}:generateContent?key={key}")
    req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"),
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        sys.exit(f"ERROR: Gemini API HTTP {e.code}: {e.read().decode('utf-8','replace')[:1000]}")
    except urllib.error.URLError as e:
        sys.exit(f"ERROR: network error calling Gemini API: {e}")


def extract_audio(resp):
    try:
        parts = resp["candidates"][0]["content"]["parts"]
    except (KeyError, IndexError, TypeError):
        sys.exit(f"ERROR: unexpected API response: {json.dumps(resp)[:1000]}")
    for p in parts:
        inline = p.get("inlineData") or p.get("inline_data")
        if inline and inline.get("data"):
            mime = inline.get("mimeType") or inline.get("mime_type") or ""
            return base64.b64decode(inline["data"]), mime
    sys.exit(f"ERROR: no audio in response: {json.dumps(resp)[:1000]}")


def rate_from(mime):
    for part in mime.split(";"):
        part = part.strip()
        if part.startswith("rate="):
            try:
                return int(part.split("=", 1)[1])
            except ValueError:
                pass
    return 24000


def main(script_path, out_path):
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not key:
        sys.exit("ERROR: GEMINI_API_KEY not set.")
    with open(script_path, encoding="utf-8") as f:
        dialogue = f.read().strip()
    if not dialogue:
        sys.exit(f"ERROR: {script_path} is empty.")
    print(f"Calling Gemini TTS ({MODEL}), {len(dialogue)} chars...")
    pcm, mime = extract_audio(call_api(key, build_payload(dialogue)))
    rate = rate_from(mime)
    with wave.open(out_path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate)
        w.writeframes(pcm)
    print(f"OK  {out_path}  ({os.path.getsize(out_path)/1024:.0f} KB, "
          f"~{len(pcm)/(2*rate):.0f}s, {rate} Hz)")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("Usage: python generate_audio.py <script_path> <output_wav_path>")
    main(sys.argv[1], sys.argv[2])
