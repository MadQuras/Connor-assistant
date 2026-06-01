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
        self._model      = None
        self._load_error = False   # set True after first failed load; stops retrying
        self._size       = model_size or load_config().get("whisper_model", "base")
        self._lock       = threading.Lock()

    def _load(self) -> None:
        """Load the Whisper model exactly once, thread-safely."""
        with self._lock:
            if self._model is not None:
                return
            import os
            from core.proxy_guard import no_proxy_ctx
            os.environ["HF_HUB_OFFLINE"] = "0"  # allow download on first run
            try:
                with no_proxy_ctx():
                    from faster_whisper import WhisperModel
                    logger.log_system(f"Загрузка faster-whisper [{self._size}]…")
                    self._model = WhisperModel(self._size, device="cpu", compute_type="int8")
                logger.log_system("faster-whisper готов")
            except Exception:
                self._load_error = True
                raise

    def transcribe(self, audio: np.ndarray, language: str = "ru") -> str:
        if audio is None or len(audio) == 0:
            return ""

        if self._load_error:
            return ""  # model failed to load — don't spam retries

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

        try:
            self._load()  # no-op if already loaded; thread-safe
        except Exception as exc:
            self._load_error = True
            logger.log_error(f"STT модель не загружена (повторы остановлены): {exc}")
            return ""

        segments, info = self._model.transcribe(
            audio,
            language=language,
            # beam_size=3: ~40% faster than 5 with negligible accuracy loss
            # for short command phrases (< 5 words).
            beam_size=3,
            # initial_prompt biases Whisper toward the Connor command vocabulary,
            # reducing hallucinations (e.g. "Киола" → "сколько") and speeding
            # up decoding by narrowing the search space.
            initial_prompt=(
                "Коннор открой закрой найди пауза громче тише погода время "
                "следующий предыдущий трек музыка заблокируй выключи запомни"
            ),
            # Single temperature pass — avoids expensive retry loops.
            # If output quality is poor, Whisper falls back internally.
            temperature=0.0,
            log_prob_threshold=-0.5,
            no_speech_threshold=0.6,
            compression_ratio_threshold=2.4,
            condition_on_previous_text=False,
            vad_filter=False,
        )

        text = " ".join(s.text.strip() for s in segments if s.text.strip()).strip()
        logger.log_system(
            f"STT результат: {text!r} "
            f"(lang={info.language}, prob={info.language_probability:.2f})"
        )

        # Detect Whisper hallucinations: a word repeated excessively
        # (e.g. "тихо тихо тихо..." × 60 or "тететете..." × 20).
        # These happen when the model loops on background noise.
        if text:
            words = text.split()
            if len(words) > 8:
                unique = set(words)
                most_common_count = max(words.count(w) for w in unique)
                repeat_ratio = most_common_count / len(words)
                if repeat_ratio > 0.65 or len(unique) <= 2:
                    logger.log_system(
                        f"STT: галлюцинация обнаружена "
                        f"(слов={len(words)}, уникальных={len(unique)}, "
                        f"ratio={repeat_ratio:.2f}) — игнорирую"
                    )
                    return ""

        return text
