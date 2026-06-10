from __future__ import annotations

import queue
import threading
import time
from pathlib import Path
from typing import TYPE_CHECKING, Any

from core import audio_catalog
from core import logger
from core.constants import ConnorState, MODELS_DIR
from core.command_text import strip_wake_marks
from core.overlay import get_overlay
from core.state_machine import StateMachine
from core.storage.memory_store import MemoryStore

if TYPE_CHECKING:
    import numpy as np

_TEST_FILE = MODELS_DIR / "test_cmd.txt"

def _strip_wake_word(text: str) -> str:
    """Команда после wake-слова (начало или конец фразы)."""
    return strip_wake_marks(text)


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
            ConnorState.DISMISSED:  "ОТОШЁЛ · СКАЖИТЕ «КОННОР, ВЕРНИСЬ»",
            ConnorState.AWAKENED:   "СЛУШАЮ · ГОВОРИТЕ КОМАНДУ",
            ConnorState.LISTENING:  "СЛУШАЮ · ГОВОРИТЕ КОМАНДУ",
            ConnorState.PROCESSING: "ОБРАБОТКА · ПОДОЖДИТЕ",
            ConnorState.RESPONDING: "ОТВЕЧАЮ...",
        }
        self.overlay.show_status(labels.get(new, str(new)))
        if new == ConnorState.SLEEPING:
            self.overlay.set_listening(False)
            self.overlay.show_wave(False)
        elif new == ConnorState.DISMISSED:
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

        try:
            from core.activity_tracker import ActivityTracker

            ActivityTracker.get().start()
        except Exception as exc:
            logger.log_error(f"ActivityTracker: {exc}")

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

        After each utterance is processed, if the queue still contains 2+
        items, all but the most recent one are drained — these are background-
        noise captures or commands from before the user said the last thing.
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
                # Drain stale items if the queue backed up during a slow transcription.
                # Keep only the most recent item (the last thing the user said).
                stale = self._utt_queue.qsize() - 1
                for _ in range(max(stale, 0)):
                    try:
                        self._utt_queue.get_nowait()
                        self._utt_queue.task_done()
                    except queue.Empty:
                        break
                if stale > 0:
                    logger.log_system(
                        f"stt_loop: дренаж {stale} устаревших фраз из очереди"
                    )

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

        # ── Dismissed mode: только «Коннор, вернись» ─────────────────────────
        if self.fsm.is_dismissed():
            from core.wake_detector import is_wake
            from core.dismiss import is_return_phrase, strip_return_phrase

            if is_wake(text):
                cmd = strip_wake_marks(text)
                if is_return_phrase(cmd or text):
                    self._handle_return()
                    rest = strip_return_phrase(cmd) if cmd else ""
                    if rest and not is_return_phrase(rest):
                        logger.log_system(f"После возврата: {rest!r}")
                        self._on_command(rest)
            else:
                logger.log_system(f"Dismissed — игнор: {text!r}")
            return

        # ── Sleep command (обычный сон, будить словом «Коннор») ───────────────
        low = text.lower()
        if any(x in low for x in ("поспи", "спи")) and "вернись" not in low:
            self.fsm.on_sleep_command()
            self.overlay.show_text(
                "Перехожу в режим ожидания. Зовите «Коннор», когда понадоблюсь",
                tag="СИСТЕМА",
            )
            logger.log_system("Sleep команда")
            try:
                audio_catalog.play_key("sleep", block=False)
            except Exception:
                pass
            return

        # ── Dismiss inline (до wake-routing) ─────────────────────────────────
        from core.dismiss import is_dismiss_phrase
        if is_dismiss_phrase(low):
            self._enter_dismiss()
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
            cmd = strip_wake_marks(text)
            if cmd:
                self._on_command(cmd)
            else:
                self.fsm.on_empty_transcription()

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

    def _enter_dismiss(self) -> None:
        self.fsm.on_dismiss()
        self.overlay.show_text(
            "Ухожу. Скажите «Коннор, вернись», когда понадоблюсь",
            tag="СИСТЕМА",
            auto_hide_ms=8000,
        )
        logger.log_system("Dismiss — режим «отойди пока»")
        try:
            audio_catalog.play_key("sleep", block=False)
        except Exception:
            pass

    def _handle_return(self) -> None:
        self.fsm.on_return()
        self.fsm.set_listening()
        self.overlay.show_text("Снова на связи", tag="КОННОР", auto_hide_ms=5000)
        logger.log_system("Return — вышел из dismiss")

    # ── Command dispatch ──────────────────────────────────────────────────────

    def _on_command(self, text: str) -> None:
        """Маршрутизация и handlers — в фоне, STT-поток не блокируется."""
        threading.Thread(
            target=self._run_command,
            args=(text,),
            daemon=True,
            name="connor-cmd",
        ).start()

    def _run_command(self, text: str) -> None:
        from core.dismiss import is_dismiss_phrase

        if is_dismiss_phrase(text):
            self._enter_dismiss()
            return

        self.fsm.on_command_start()
        try:
            from openjarvis.route import route_command, dispatch
            from openjarvis.connor_ui import speak_direct

            cat, arg = route_command(text)
            self.fsm.set_responding()
            if cat == "DISMISS":
                self._enter_dismiss()
                logger.log_handler("DISMISS", "ok")
                return
            if cat == "__HANDLED__":
                logger.log_handler("TOOL", "ok-inline")
                return
            if cat == "__SPEAK__":
                speak_direct(arg)
                logger.log_handler("SPEAK", "ok")
                return
            try:
                dispatch(cat, arg, original_text=text)
                logger.log_handler(cat, "ok")
            except Exception as exc:
                logger.log_error(f"Handler {cat}: {exc}")
                self.overlay.show_text("Произошла ошибка. Повторите команду", tag="КОННОР")
                try:
                    audio_catalog.play_key("error_unknown", block=False)
                except Exception:
                    pass
        finally:
            self.fsm.on_command_complete()
