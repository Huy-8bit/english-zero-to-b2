"""Measure uploaded audio before sending it to a billable transcription API."""
from __future__ import annotations

import math
import subprocess
import tempfile

from .errors import AIBadInput, AIConfigError


def audio_duration(audio: bytes, max_seconds: float) -> float:
    # Browser WebM often has no duration header. Packet timestamps also work for
    # these recordings. The uploaded bytes are bounded by the caller; ffprobe is
    # time bounded, has no network protocols and never receives a user filename.
    with tempfile.NamedTemporaryFile(suffix=".audio") as source:
        source.write(audio)
        source.flush()
        try:
            result = subprocess.run(
                ["ffprobe", "-v", "error", "-protocol_whitelist", "file,pipe", "-select_streams", "a:0",
                 "-show_entries", "packet=pts_time,duration_time", "-of", "csv=p=0", source.name],
                capture_output=True, timeout=10, check=False,
            )
        except FileNotFoundError:
            raise AIConfigError("ffprobe required for audio upload validation") from None
        except subprocess.TimeoutExpired:
            raise AIBadInput("Không đọc được file âm thanh trong thời gian cho phép.") from None
    if result.returncode:
        raise AIBadInput("File không chứa âm thanh hợp lệ.")
    start, end = math.inf, -math.inf
    for line in result.stdout.decode("utf-8", errors="replace").splitlines():
        fields = line.split(",")
        try:
            timestamp, duration = float(fields[0]), float(fields[1])
        except (ValueError, IndexError):
            continue
        if not math.isfinite(timestamp) or not math.isfinite(duration) or duration < 0:
            continue
        start = min(start, timestamp)
        end = max(end, timestamp + duration)
    seconds = end - start
    if not math.isfinite(seconds) or seconds <= 0:
        raise AIBadInput("Không xác định được thời lượng âm thanh.")
    if seconds > max_seconds + 0.25:
        raise AIBadInput(f"Ghi âm quá dài (tối đa {max_seconds:g} giây).")
    return seconds
