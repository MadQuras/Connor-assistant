from __future__ import annotations

import threading
from typing import Optional

import numpy as np

from core import logger
from core.config_loader import load_config

# Minimum RMS below which we skip Whisper entirely (true silence).
_MIN_RMS_RAW = 0.003


def _rms(audio: np.ndarray) -> float:
    return float(np.sqrt(np.mean(np.square(audio)))) if len(audio) else 0.0


def _peak_normalize(audio: np.ndarray, target: float = 0.8) -> np.ndarray:
    """
    Scale audio so the loudest sample reaches `target` amplitude.
    This gives Whisper a well-levelled signal without clipping.
    If the audio is near-silent we leave it as-is.
    """
    peak = float(np.abs(audio).max())
    if peak > 0.01:
        return (audio * (target / peak)).astype(np.float32)
    return audio


class STTWorker:
    """Wraps faster-whisper. Thread-safe: _load() uses a lock."""

    def __init__(self, model_size: Optional[str] = None) -> None:
        self._model = None
        self._size  = model_size or load_config().get("whisper_model", "base")
        self._lock  = threading.Lock()

    def _load(self) -> None:
        """Load the Whisper model exactly once, thread-safely."""
        with self._lock:
            if self._model is not None:
                return
            from faster_whisper import WhisperModel
            logger.log_system(f"Загрузка faster-whisper [{self._size}]…")
            self._model = WhisperModel(self._size, device="cpu", compute_type="int8")
            logger.log_system("faster-whisper готов")

    def transcribe(self, audio: np.ndarray, language: str = "ru") -> str:
        if audio is None or len(audio) == 0:
            return ""

        if audio.dtype != np.float32:
            audio = audio.astype(np.float32)

        rms = _rms(audio)
        if rms < _MIN_RMS_RAW:
            logger.log_system(f"STT пропущено — RMS {rms:.4f} < порога {_MIN_RMS_RAW}")
            return ""

        # Peak-normalise to 80 % — gives Whisper a clean, well-levelled signal.
        # Audio arriving here is raw (no VAD gain applied) so no prior clipping.
        audio = _peak_normalize(audio, target=0.8)

        logger.log_system(f"STT вызван: {len(audio)/16000:.2f}s, RMS={rms:.4f}")

        self._load()  # no-op if already loaded; thread-safe

        segments, info = self._model.transcribe(
            audio,
            language=language,
            beam_size=5,                        # was 1 — wider search = much better accuracy
            temperature=[0.0, 0.2, 0.4],        # fallback temperatures on poor output
            log_prob_threshold=-0.5,            # was -1.0 — reject low-confidence garbage
            no_speech_threshold=0.6,
            compression_ratio_threshold=2.4,    # detect hallucinated repetitions
            condition_on_previous_text=False,
            vad_filter=False,                   # our VAD already filtered; avoid double-pass
        )

        text = " ".join(s.text.strip() for s in segments if s.text.strip()).strip()
        logger.log_system(
            f"STT результат: {text!r} "
            f"(lang={info.language}, prob={info.language_probability:.2f})"
        )
        return text
