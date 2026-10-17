import io
import wave

import pytest

from app.ai.audio_validation import audio_duration
from app.ai.errors import AIBadInput
from app.ai.media import write


def wav(seconds=1):
    stream = io.BytesIO()
    with wave.open(stream, 'wb') as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(8000)
        out.writeframes(b'\0\0' * int(8000 * seconds))
    return stream.getvalue()


def test_actual_audio_duration():
    assert audio_duration(wav(1.5), 2) == pytest.approx(1.5, abs=0.01)


def test_reject_long_audio_and_invalid_bytes():
    with pytest.raises(AIBadInput):
        audio_duration(wav(3), 1)
    with pytest.raises(AIBadInput):
        audio_duration(b'not an audio file', 120)


def test_media_writes_cannot_escape_root():
    with pytest.raises(ValueError):
        write('speaking/../../outside.wav', wav())
    with pytest.raises(ValueError):
        write('/tmp/outside.wav', wav())
