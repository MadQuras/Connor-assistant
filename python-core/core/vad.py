from __future__ import annotations

import queue
import threading
import time
from typing import Callable, Optional

import numpy as np

from core import logger
from core.constants import SAMPLE_RATE, VAD_CHUNK_MS

CHUNK_SAMPLES = int(SAMPLE_RATE * VAD_CHUNK_MS / 1000)  # 512 @ 16 kHz / 32 ms

# ─── Gain & thresholds ───────────────────────────────────────────────────────
# Mic gain is applied before Silero/energy detection only.
# The raw (pre-gain) audio is buffered for Whisper to avoid clipping distortion.
# Raised from 4.0 → 5.5 so quiet laptop mics reach detection threshold.
_MIC_GAIN           = 5.5

# Silero probability threshold (0–1). Lower = more sensitive.
# After gain, speech probability rises significantly for real speech.
_SILERO_THRESHOLD   = 0.12

# Energy-based fallback (used when Silero is unavailable).
# After x4 gain: ambient ~0.01-0.02, quiet speech ~0.04+.
# Lowered from 0.035 to 0.022 to pick up quiet microphones.
_ENERGY_THRESHOLD   = 0.022

# Debug: log peak RMS seen in N-second windows.
_DBG_INTERVAL_SEC   = 5


class SileroVAD:
    """Silero VAD with 4× pre-gain and energy fallback."""

    def __init__(self, threshold: float = _SILERO_THRESHOLD) -> None:
        self.threshold        = threshold
        self._model           = None
        self._torch           = None
        self._energy_fallback = False

        self._queue:  queue.Queue[np.ndarray] = queue.Queue(maxsize=512)
        self._running = False
        self._stream  = None

        self._dbg_last = time.time()
        self._dbg_peak = 0.0

    # ── Model loading ─────────────────────────────────────────────────────────

    def _load_model(self) -> None:
        if self._model is not None or self._energy_fallback:
            return
        try:
            import torch
            self._torch = torch
            model, _ = torch.hub.load(
                repo_or_dir="snakers4/silero-vad",
                model="silero_vad",
                force_reload=False,
                trust_repo=True,
            )
            self._model = model
            logger.log_system("Silero VAD загружен")
        except Exception as exc:
            self._energy_fallback = True
            logger.log_system(f"Silero недоступен — energy fallback: {exc}")

    # ── Audio stream ──────────────────────────────────────────────────────────

    def _callback(self, indata, _frames, _time, status) -> None:
        if status:
            logger.log_error(f"VAD stream status: {status}")

        # Store RAW audio — no gain applied here.
        # Gain is applied only inside _speech_probability() for Silero/energy
        # detection.  The collect_utterance buffer therefore holds clean audio
        # which Whisper can transcribe without clipping distortion.
        chunk = indata[:, 0].astype(np.float32)

        try:
            self._queue.put_nowait(chunk)
        except queue.Full:
            pass  # drop — processing is falling behind

    def start_stream(self) -> None:
        import sounddevice as sd
        self._running = True
        self._stream = sd.InputStream(
            samplerate=SAMPLE_RATE,
            channels=1,
            dtype="float32",
            blocksize=CHUNK_SAMPLES,
            callback=self._callback,
        )
        self._stream.start()
        logger.log_system(
            f"Аудио поток открыт — {SAMPLE_RATE} Hz / {CHUNK_SAMPLES} samp "
            f"(raw queue, VAD gain x{_MIC_GAIN} only)"
        )

    def stop_stream(self) -> None:
        self._running = False
        if self._stream is not None:
            try:
                self._stream.stop()
                self._stream.close()
            except Exception:
                pass
            self._stream = None

    # ── Speech probability ────────────────────────────────────────────────────

    def _speech_probability(self, chunk: np.ndarray) -> float:
        # Amplify for detection only — Silero and energy threshold need a
        # louder signal.  The original (raw) chunk is buffered for Whisper.
        amplified = np.clip(chunk * _MIC_GAIN, -1.0, 1.0)
        energy = float(np.sqrt(np.mean(np.square(amplified))))

        # Rolling peak debug log every N seconds
        self._dbg_peak = max(self._dbg_peak, energy)
        now = time.time()
        if now - self._dbg_last >= _DBG_INTERVAL_SEC:
            mode = "energy-fb" if self._energy_fallback else "silero"
            logger.log_system(
                f"VAD alive — peak RMS {_DBG_INTERVAL_SEC}s: "
                f"{self._dbg_peak:.4f} ({mode}, thr={self.threshold})"
            )
            self._dbg_peak = 0.0
            self._dbg_last = now

        # Energy-only fallback
        if self._energy_fallback or self._model is None or self._torch is None:
            return 1.0 if energy >= _ENERGY_THRESHOLD else 0.0

        # Silero inference on amplified signal
        try:
            return float(
                self._model(self._torch.from_numpy(amplified), SAMPLE_RATE).item()
            )
        except Exception as exc:
            logger.log_error(f"Silero inference: {exc}")
            self._energy_fallback = True
            return 1.0 if energy >= _ENERGY_THRESHOLD else 0.0

    # ── Utterance collection ──────────────────────────────────────────────────

    def drain_queue(self) -> int:
        """Discard all currently queued chunks. Returns number of chunks dropped."""
        dropped = 0
        while True:
            try:
                self._queue.get_nowait()
                dropped += 1
            except queue.Empty:
                break
        return dropped

    def collect_utterance(
        self,
        max_silence_chunks: int = 20,
        min_speech_chunks:  int = 2,
        stop_event: Optional[threading.Event] = None,
    ) -> np.ndarray:
        """
        Accumulate chunks until end of speech.
        Starts collecting once any speech is detected.
        Stops after max_silence_chunks silent frames after speech started.
        min_speech_chunks is kept for API compatibility but no longer blocks exit —
        the _loop filter (min_samples) handles very short bursts.
        """
        buf:        list[np.ndarray] = []
        started     = False
        silence_cnt = 0

        while self._running:
            if stop_event is not None and stop_event.is_set():
                break
            try:
                chunk = self._queue.get(timeout=0.3)
            except queue.Empty:
                # If we've started collecting and hit queue drought → end of utterance
                if started:
                    break
                continue

            prob      = self._speech_probability(chunk)
            is_speech = prob >= self.threshold

            if is_speech:
                started     = True
                silence_cnt = 0
                buf.append(chunk)
            elif started:
                silence_cnt += 1
                buf.append(chunk)
                if silence_cnt >= max_silence_chunks:
                    break

        return np.concatenate(buf) if buf else np.array([], dtype=np.float32)


class VADListener:
    """Background thread: listens forever, calls on_utterance for each detected phrase."""

    def __init__(
        self,
        on_utterance: Callable[[np.ndarray], None],
        threshold: float = _SILERO_THRESHOLD,
        on_ready: Optional[Callable[[], None]] = None,
    ) -> None:
        self.on_utterance = on_utterance
        self._on_ready    = on_ready
        self.vad   = SileroVAD(threshold=threshold)
        self._thread: Optional[threading.Thread] = None
        self._stop  = threading.Event()

    def _loop(self) -> None:
        self.vad._load_model()
        self.vad.start_stream()
        # Signal that the mic is open and models are loaded — system is ready
        if self._on_ready:
            try:
                self._on_ready()
            except Exception:
                pass

        # Minimum utterance: 0.20 s (was 0.35 — shorter to catch clipped commands)
        # min_rms is on RAW audio; Silero sees x4-amplified signal, so the
        # effective detection floor is ~_ENERGY_THRESHOLD / _MIC_GAIN ≈ 0.009.
        # Setting min_rms = 0.003 keeps only truly dead-air frames while letting
        # through normal speech on quiet microphones.
        min_samples = int(SAMPLE_RATE * 0.20)
        min_rms     = 0.003
        # Voice commands are short (< 8 s).  Longer captures are almost always
        # background noise that Silero mis-classified as speech — sending them to
        # Whisper causes multi-second hallucination loops that block the STT thread.
        max_duration_s = 8.0
        # When duration is between 4-8 s, require a higher RMS to be treated as real speech.
        # (Quiet long captures = TV/music background, not commands.)
        long_rms_floor = 0.015

        while not self._stop.is_set():
            audio = self.vad.collect_utterance(
                max_silence_chunks=20,
                min_speech_chunks=3,
                stop_event=self._stop,
            )
            if len(audio) >= min_samples:
                rms = float(np.sqrt(np.mean(np.square(audio))))
                duration_s = len(audio) / SAMPLE_RATE
                logger.log_system(
                    f"VAD захватил {duration_s:.2f}s, RMS={rms:.4f}"
                )
                # 1. Hard silence gate
                if rms < min_rms:
                    logger.log_system(f"VAD пропуск — слишком тихо (RMS={rms:.4f} < {min_rms})")
                    self.vad.drain_queue()
                    continue
                # 2. Long + quiet → background noise, not a command
                if duration_s > max_duration_s:
                    logger.log_system(
                        f"VAD пропуск — слишком долго ({duration_s:.1f}s > {max_duration_s}s)"
                    )
                    self.vad.drain_queue()
                    continue
                if duration_s > 4.0 and rms < long_rms_floor:
                    logger.log_system(
                        f"VAD пропуск — длинный тихий сигнал "
                        f"({duration_s:.1f}s, RMS={rms:.4f} < {long_rms_floor})"
                    )
                    self.vad.drain_queue()
                    continue
                self.on_utterance(audio)
                # No drain_queue() here: handle_audio is non-blocking (puts into
                # _utt_queue and returns immediately), so audio is not stale.

        self.vad.stop_stream()

    def start(self) -> None:
        self._stop.clear()
        self._thread = threading.Thread(
            target=self._loop, name="vad-listener", daemon=True
        )
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=4)
