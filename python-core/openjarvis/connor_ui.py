"""
connor_ui.py — единое текстовое окно Коннора (левая панель, tag КОННОР).

Весь вывод Gemma / LLM-ответов идёт сюда; технические теги (СВОДКА, ПАМЯТЬ…) не используются.
"""

from __future__ import annotations

import threading
from pathlib import Path
from typing import Optional

from core import logger
from core.config_loader import load_config
from core.overlay import get_overlay
from openjarvis.connor_prompts import sanitize_connor_reply

CONNOR_TAG = "КОННОР"
DEFAULT_HIDE_MS = 7000
DEFAULT_TTS_SYNC_TIMEOUT_SEC = 10.0


def connor_llm_active() -> bool:
    """Локальный Ollama — ответы через Gemma, без дублирующих overlay в handlers."""
    return (load_config().get("llm_backend") or "gemini").strip().lower() == "ollama"


def _panel_hide_ms(fallback_ms: int) -> int:
    cfg = load_config()
    return int(cfg.get("connor_panel_hide_ms", fallback_ms))


def _tts_sync_timeout_sec() -> float:
    return float(load_config().get("connor_tts_sync_timeout_sec", DEFAULT_TTS_SYNC_TIMEOUT_SEC))


class _SyncedReveal:
    """Текст и звук выходят вместе; при долгом синтезе — текст по таймауту, звук догоняет."""

    def __init__(self, clean: str, hide_ms: int) -> None:
        self.clean = clean
        self.hide_ms = hide_ms
        self.overlay = get_overlay()
        self._lock = threading.Lock()
        self._text_shown = False
        self._audio_played = False

    def reveal(self, path: Optional[Path] = None, *, show_text: bool = True) -> None:
        with self._lock:
            if show_text and not self._text_shown:
                self._text_shown = True
                self.overlay.show_text(
                    self.clean, tag=CONNOR_TAG, auto_hide_ms=self.hide_ms
                )
                logger.log_system("[КОННОР] панель + TTS синхронно")

            if path and path.is_file() and not self._audio_played:
                self._audio_played = True
                from core import camb_tts
                camb_tts.play_path(path, block=False)


def _show_with_tts(
    clean: str,
    auto_hide_ms: int,
    *,
    wav_path: Optional[Path] = None,
) -> None:
    """Сначала ждём WAV, потом текст и звук одновременно."""
    hide_ms = _panel_hide_ms(auto_hide_ms)
    sync = _SyncedReveal(clean, hide_ms)

    if wav_path and wav_path.is_file():
        sync.reveal(wav_path)
        return

    done = threading.Event()

    def _synth_and_reveal() -> None:
        from core import camb_tts

        path = camb_tts.synthesize(clean)
        sync.reveal(path)
        done.set()

    def _timeout_fallback() -> None:
        if done.wait(timeout=_tts_sync_timeout_sec()):
            return
        logger.log_system("[КОННОР] TTS долго — показываем текст, звук догонит")
        sync.reveal(show_text=True)

    threading.Thread(target=_synth_and_reveal, name="connor-tts-panel", daemon=True).start()
    threading.Thread(target=_timeout_fallback, name="connor-tts-wait", daemon=True).start()


def _preload_wav(text: str) -> Optional[Path]:
    from core.tts_engine import tts_enabled

    if not tts_enabled():
        return None
    from core import camb_tts

    return camb_tts.synthesize(text)


def show_connor(
    text: str,
    auto_hide_ms: int = DEFAULT_HIDE_MS,
    *,
    speak: bool = True,
    wav_path: Optional[Path] = None,
) -> None:
    """Показать текст в панели Коннора (потокобезопасно)."""
    if not text or not str(text).strip():
        return
    clean = sanitize_connor_reply(str(text))
    if not clean:
        return

    if speak:
        from core.tts_engine import tts_enabled

        if tts_enabled():
            _show_with_tts(clean, auto_hide_ms, wav_path=wav_path)
            return

    get_overlay().show_text(clean, tag=CONNOR_TAG, auto_hide_ms=_panel_hide_ms(auto_hide_ms))


def speak_connor(
    category: str,
    original_text: str = "",
    context: str = "",
    *,
    block: bool = False,
) -> Optional[str]:
    """
    Сгенерировать реплику Коннора через LLM и показать в панели.
    По умолчанию в фоне (block=False).
    """
    def _run() -> Optional[str]:
        from openjarvis.connor_response import generate_connor_reply

        reply = generate_connor_reply(category, original_text, context=context)
        if reply:
            wav = _preload_wav(reply)
            show_connor(reply, wav_path=wav)
        return reply

    if block:
        return _run()
    threading.Thread(target=_run, name="connor-speak", daemon=True).start()
    return None


def speak_direct(text: str, auto_hide_ms: int = DEFAULT_HIDE_MS) -> None:
    """Прямой текст Gemma (без второй персонализации) → панель Коннора."""
    show_connor(text, auto_hide_ms=auto_hide_ms)
