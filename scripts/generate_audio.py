#!/usr/bin/env python3
"""Turn a two-host Alex/Sam script into podcast audio using edge-tts
(Microsoft Edge's neural voices — free, no API key, runs on a plain runner).

edge-tts has no single-call multi-speaker mode, so we split the script into
per-speaker turns, synthesize each with that speaker's voice, and concatenate
the segments into one MP3 with ffmpeg (bundled via imageio-ffmpeg).

Usage:  python generate_audio.py <script_path> <output_audio_path>
Env:    EDGE_VOICE_A / EDGE_VOICE_B (voices for Alex / Sam), EDGE_RATE (optional, e.g. "+8%")
"""
import asyncio
import os
import re
import subprocess
import sys
import tempfile

SPEAKER_A, SPEAKER_B = "Alex", "Sam"
VOICE_A = os.environ.get("EDGE_VOICE_A", "en-US-AvaNeural")      # Alex — curious host
VOICE_B = os.environ.get("EDGE_VOICE_B", "en-US-AndrewNeural")   # Sam — expert analyst
RATE = os.environ.get("EDGE_RATE", "+0%")

LINE = re.compile(r"^(Alex|Sam)\s*:\s*(.+)$")


def parse_lines(dialogue):
    segments = []
    for ln in dialogue.splitlines():
        m = LINE.match(ln.strip())
        if m:
            segments.append((m.group(1), m.group(2).strip()))
    return segments


async def synth_segment(text, voice, path):
    import edge_tts
    await edge_tts.Communicate(text, voice, rate=RATE).save(path)


def ffmpeg_exe():
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def concat_to(out_path, segment_paths):
    """Concatenate MP3 segments into out_path, re-encoding for a clean join."""
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as f:
        for p in segment_paths:
            # ffmpeg concat list format; escape single quotes in the path
            f.write("file '%s'\n" % os.path.abspath(p).replace("'", "'\\''"))
        list_path = f.name
    try:
        subprocess.run(
            [ffmpeg_exe(), "-y", "-loglevel", "error", "-f", "concat",
             "-safe", "0", "-i", list_path, "-b:a", "128k", out_path],
            check=True,
        )
    finally:
        os.unlink(list_path)


def main(script_path, out_path):
    with open(script_path, encoding="utf-8") as f:
        dialogue = f.read().strip()
    if not dialogue:
        sys.exit(f"ERROR: {script_path} is empty.")

    segments = parse_lines(dialogue)
    if not segments:
        sys.exit(f"ERROR: no Alex/Sam dialogue found in {script_path}.")

    print(f"edge-tts: synthesizing {len(segments)} turns "
          f"(Alex={VOICE_A}, Sam={VOICE_B}) -> {out_path}")

    tmpdir = tempfile.mkdtemp(prefix="edgetts-")
    seg_paths = []
    for i, (who, text) in enumerate(segments):
        voice = VOICE_A if who == SPEAKER_A else VOICE_B
        seg = os.path.join(tmpdir, f"{i:03d}.mp3")
        asyncio.run(synth_segment(text, voice, seg))
        if not os.path.exists(seg) or os.path.getsize(seg) == 0:
            sys.exit(f"ERROR: edge-tts produced no audio for turn {i} ({who}).")
        seg_paths.append(seg)

    concat_to(out_path, seg_paths)
    print(f"OK  {out_path}  ({os.path.getsize(out_path)/1024:.0f} KB, "
          f"{len(segments)} turns)")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("Usage: python generate_audio.py <script_path> <output_audio_path>")
    main(sys.argv[1], sys.argv[2])
