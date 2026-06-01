from __future__ import annotations

import queue
import re
import threading
import time
from pathlib import Path
from typing import TYPE_CHECKING, Any

from core import audio_catalog
from core import logger
from core.constants import ConnorState, MODELS_DIR
from core.overlay import get_overlay
from core.state_machine import StateMachine
from core.storage.memory_store import MemoryStore

if TYPE_CHECKING:
    import numpy as np

_TEST_FILE = MODELS_DIR / "test_cmd.txt"

# Wake-word prefixes that may precede an inline command.
# "Коннор, открой музыку" → "открой музыку"
_WAKE_PREFIX_RE = re.compile(
    r"^(коннор|конор|конер|конне|конно|коно|гонор|кано|канор|ко[\-\s]нор|"
    r"кон[\-\s]нор|connor|conner|cannor|conor|кон|кoн)"
    r"[\s,\.\-!?:;]*",
    re.IGNORECASE,
)


def _strip_wake_word(text: str) -> str:
    """
    Remove the leading wake word from an utterance and return
    the remainder (stripped).  Returns '' if only the wake word
    was spoken.
    """
    m = _WAKE_PREFIX_RE.match(text.strip())
    if m:
        return text[m.end():].strip()
    return ""


class VoicePipeline:
    """VAD → STT → wake → route → handlers → TTS/overlay.

    Architecture:
      VAD thread   — collects utterances, puts them into _utt_queue (non-blocking).
      STT thread   — drains _utt_queue, runs transcribe() + routing sequentially.

    This decouples audio collection from CPU-bound inference: the VAD thread
    can start capturing the next phrase while the previous one is still being
    transcribed.  The queue is capped at 3 to discard very stale utterances.
    """

    _UTT_QUEUE_MAX = 3  # max pending utterances; extra are dropped with a log

    def __init__(self, stt: Any = None) -> None:
        self.fsm    = StateMachine()
        self._vad_listener: Any = None
        self.overlay = get_overlay()
        self.memory  = MemoryStore()
        self.fsm.on_state_change = self._on_state_change

        # Utterance queue: VAD thread → STT thread
        self._utt_queue: queue.Queue = queue.Queue(maxsize=self._UTT_QUEUE_MAX)

        # Set when Whisper model is ready
        self._stt_ready = threading.Event()
        # Set when VAD stream is open + Silero loaded — system fully ready for voice
        self._pipeline_ready = threading.Event()

        if stt is not None:
            self._stt = stt
            logger.log_system("STT получен — ожидаем завершения загрузки модели")
        else:
            self._stt = None

        logger.log_system("Pipeline инициализирован")

    # ── State machine callbacks ───────────────────────────────────────────────

    def _on_state_change(self, old: ConnorState, new: ConnorState) -> None:
        labels = {
            ConnorState.SLEEPING:   "ОЖИДАНИЕ · СКАЖИТЕ «КОННОР»",
            ConnorState.AWAKENED:   "СЛУШАЮ · ГОВОРИТЕ КОМАНДУ",
            ConnorState.LISTENING:  "СЛУШАЮ · ГОВОРИТЕ КОМАНДУ",
            ConnorState.PROCESSING: "ОБРАБОТКА · ПОДОЖДИТЕ",
            ConnorState.RESPONDING: "ОТВЕЧАЮ...",
        }
        self.overlay.show_status(labels.get(new, str(new)))
        if new == ConnorState.SLEEPING:
            self.overlay.set_listening(False)
            self.overlay.show_wave(False)
        elif new in (ConnorState.AWAKENED, ConnorState.LISTENING):
            self.overlay.set_listening(True)
            self.overlay.show_wave(True)
        elif new == ConnorState.PROCESSING:
            self.overlay.set_listening(False)

    # ── STT loader ────────────────────────────────────────────────────────────

    def _load_stt_bg(self) -> None:
        """
        Background thread: load WhisperModel AFTER Qt event loop starts.
        ctranslate2 crashes (access violation) when loaded while the Qt event
        loop is not yet running in the main thread.
        """
        try:
            from core.stt_worker import STTWorker
            logger.log_system("Загрузка Whisper [tiny] …")
            self._stt = STTWorker()
            self._stt._load()
            logger.log_system("Whisper готов — VAD начинает транскрипцию")
            self.overlay.show_status("ОЖИДАНИЕ · СКАЖИТЕ «КОННОР»")
        except Exception as exc:
            logger.log_error(f"Whisper load error: {exc}")
        finally:
            self._stt_ready.set()   # unblock _process_audio either way

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def start(self) -> None:
        logger.log_system("Запуск VAD…")

        # STT dispatch thread — pulls from _utt_queue, runs transcribe + routing
        threading.Thread(
            target=self._stt_loop, name="stt-dispatch", daemon=True
        ).start()

        from core.vad import VADListener
        self._vad_listener = VADListener(
            self.handle_audio,
            on_ready=self._pipeline_ready.set,
        )
        self._vad_listener.start()
        logger.log_system("VAD запущен — жду сигнала готовности STT")

        if self._stt is None:
            threading.Thread(
                target=self._load_stt_bg, name="stt-load", daemon=True
            ).start()

        threading.Thread(
            target=self._poll_test_cmd, name="test-cmd", daemon=True
        ).start()

    def stop(self) -> None:
        if self._vad_listener:
            self._vad_listener.stop()
        self.fsm.close()
        logger.log_system("Pipeline остановлен")

    # ── Test-command poller ───────────────────────────────────────────────────

    def _poll_test_cmd(self) -> None:
        while True:
            time.sleep(0.4)
            if _TEST_FILE.exists():
                try:
                    cmd = _TEST_FILE.read_text("utf-8").strip()
                    _TEST_FILE.unlink(missing_ok=True)
                    if cmd:
                        logger.log_system(f"[TEST] Команда: {cmd!r}")
                        self._on_command(cmd)
                except Exception as exc:
                    logger.log_error(f"test_cmd: {exc}")

    # ── STT dispatch loop (runs in dedicated thread) ──────────────────────────

    def _stt_loop(self) -> None:
        """Pull utterances from _utt_queue and process them one at a time.

        Runs in 'stt-dispatch' thread so the VAD thread is never blocked by
        Whisper inference.  Utterances queued while processing is in progress
        are handled in order; extra-stale items beyond queue capacity are
        discarded by handle_audio.
        """
        while True:
            try:
                audio = self._utt_queue.get(timeout=0.5)
            except queue.Empty:
                continue
            try:
                self._process_audio(audio)
            except Exception as exc:
                logger.log_error(f"stt_loop: {exc}")
            finally:
                self._utt_queue.task_done()

    # ── Audio ingestion (VAD thread → queue) ─────────────────────────────────

    def handle_audio(self, audio: "np.ndarray") -> None:
        """
        Called by VADListener for every utterance.  Runs in the VAD thread.
        Enqueues the utterance for the STT thread; drops it (with a log) if
        the queue is already full (3 pending) to avoid processing stale audio.
        """
        try:
            self._utt_queue.put_nowait(audio)
        except queue.Full:
            logger.log_system(
                "handle_audio: очередь полна — пропускаю фразу "
                f"(queue size={self._utt_queue.qsize()})"
            )

    def _process_audio(self, audio: "np.ndarray") -> None:
        # Block here until Whisper is ready (up to 120 s).
        # This call returns instantly once _stt_ready is set.
        if not self._stt_ready.wait(timeout=120):
            logger.log_error("Whisper не загрузился за 120s — пропускаю")
            return

        if self._stt is None:
            logger.log_error("STT недоступен (ошибка загрузки)")
            return

        # ── Transcribe ────────────────────────────────────────────────────────
        try:
            text = self._stt.transcribe(audio)
        except Exception as exc:
            logger.log_error(f"STT exception: {exc}")
            if self.fsm.is_accepting_command():
                self.fsm.on_empty_transcription()
            return

        # Log EVERY result so nothing is invisible
        logger.log_stt(text if text else "(пусто)")

        if not text.strip():
            if self.fsm.is_accepting_command():
                self.overlay.show_text(
                    audio_catalog.phrase("errors", "audio_06.wav") or "Не расслышал. Повторите",
                    tag="СИСТЕМА",
                )
                try:
                    audio_catalog.play_key("error_unknown", block=False)
                except Exception:
                    pass
                self.fsm.on_empty_transcription()
            return

        # ── Sleep command ─────────────────────────────────────────────────────
        low = text.lower()
        if any(x in low for x in ("поспи", "отойди", "спи")):
            self.fsm.on_sleep_command()
            self.overlay.show_text("Перехожу в режим ожидания. Зовите когда понадоблюсь", tag="СИСТЕМА")
            logger.log_system("Sleep команда")
            try:
                audio_catalog.play_key("sleep", block=False)
            except Exception:
                pass
            return

        # ── Wake word check ───────────────────────────────────────────────────
        if self.fsm.state == ConnorState.SLEEPING:
            from core.wake_detector import is_wake
            matched = is_wake(text)
            logger.log_wake(text, matched)
            if matched:
                inline = _strip_wake_word(text)
                self._on_wake(silent=bool(inline))
                if inline:
                    logger.log_system(f"Инлайн-команда: {inline!r}")
                    self._on_command(inline)
            else:
                logger.log_system(f"Wake не совпал для: {text!r}")
            return

        # ── Command routing ───────────────────────────────────────────────────
        if self.fsm.is_accepting_command():
            self._on_command(text)

    # ── Wake ──────────────────────────────────────────────────────────────────

    def _on_wake(self, silent: bool = False) -> None:
        import random
        self.fsm.on_wake()
        self.memory.increment_wake_count()

        if not silent:
            # Only show acknowledgement text when no inline command follows
            self.overlay.show_text("Да, лейтенант", tag="КОННОР", auto_hide_ms=6000)

            # Play a random wake audio phrase with 10% probability
            if random.random() < 0.10:
                try:
                    audio_catalog.play_key("wake")
                except Exception:
                    pass

        self.fsm.set_listening()

    # ── Command dispatch ──────────────────────────────────────────────────────

    def _on_command(self, text: str) -> None:
        self.fsm.on_command_start()
        try:
            from openjarvis.route import route_command, dispatch
            cat, arg = route_command(text)
            self.fsm.set_responding()
            try:
                dispatch(cat, arg, original_text=text)
                logger.log_handler(cat, "ok")
            except Exception as exc:
                logger.log_error(f"Handler {cat}: {exc}")
                self.overlay.show_text("Произошла ошибка. Повторите команду")
                try:
                    audio_catalog.play_key("error_unknown", block=False)
                except Exception:
                    pass
        finally:
            self.fsm.on_command_complete()
