from __future__ import annotations

import sys
from typing import Optional

from PyQt5.QtCore import QObject, pyqtSignal
from PyQt5.QtWidgets import QApplication

from core.overlay.text_panel import TextPanel
from core.overlay.wave_panel import WavePanel
from core.overlay.weather_panel import WeatherPanel


class _Signals(QObject):
    show_text       = pyqtSignal(str, int, str)   # text, auto_hide_ms, tag
    start_auto_hide = pyqtSignal(int)
    show_wave       = pyqtSignal(bool)
    show_weather    = pyqtSignal(object, int)      # data dict, auto_hide_ms


class OverlayController:
    """
    Controls the two floating PyQt5 overlays that sit above all windows:
      - TextPanel     — slides in from the left with Connor's responses
      - WeatherPanel  — glass weather card (center-right)
      - WavePanel     — microphone activity visualiser (top-right)

    Boot screen and welcome screen are now rendered by the Tauri front-end.
    All boot/welcome methods are kept as no-ops for backwards-compatibility.
    """

    _instance: Optional["OverlayController"] = None

    def __init__(self) -> None:
        self.app  = QApplication.instance() or QApplication(sys.argv)
        # Keep event loop alive even when all overlay windows are hidden
        self.app.setQuitOnLastWindowClosed(False)
        self.sigs = _Signals()
        self.text = TextPanel()
        self.weather = WeatherPanel()
        self.wave = WavePanel()

        self.sigs.show_text.connect(self._on_show_text)
        self.sigs.start_auto_hide.connect(self._on_start_auto_hide)
        self.sigs.show_wave.connect(self._on_show_wave)
        self.sigs.show_weather.connect(self._on_show_weather)

    @classmethod
    def get(cls) -> "OverlayController":
        if cls._instance is None:
            cls._instance = OverlayController()
        return cls._instance

    # ── Internal Qt-thread handlers ───────────────────────────────────────────

    def _on_show_text(self, text: str, ms: int, tag: str) -> None:
        self.text.show_text(text, ms, tag or "ОТВЕТ")

    def _on_start_auto_hide(self, ms: int) -> None:
        self.text.start_auto_hide(ms)

    def _on_show_wave(self, visible: bool) -> None:
        if visible:
            self.wave.show_wave()
        else:
            self.wave.hide_wave()

    def _on_show_weather(self, data: object, ms: int) -> None:
        if isinstance(data, dict):
            self.weather.show_weather(data, auto_hide_ms=ms)

    # ── Public thread-safe API ────────────────────────────────────────────────

    def show_text(self, text: str, auto_hide_ms: int = 6000, tag: str = "ОТВЕТ") -> None:
        if not text:
            return
        self.sigs.show_text.emit(text, auto_hide_ms, tag)

    def start_auto_hide(self, ms: int) -> None:
        if ms > 0:
            self.sigs.start_auto_hide.emit(ms)

    def show_wave(self, visible: bool) -> None:
        self.sigs.show_wave.emit(visible)

    def show_weather(self, data: dict, auto_hide_ms: int = 12000) -> None:
        if data:
            self.sigs.show_weather.emit(data, auto_hide_ms)

    # ── Legacy no-ops (boot/welcome now in Tauri) ─────────────────────────────

    def show_status(self, _text: str = "") -> None:        pass
    def set_listening(self, _active: bool = False) -> None: pass
    def show_boot(self, _v: bool = False, _m: str = "") -> None: pass
    def show_welcome_screen(self, *_, **__) -> None:       pass
    def set_boot_ready_event(self, _event=None) -> None:   pass

    # ── Event loop ────────────────────────────────────────────────────────────

    def run_loop(self) -> None:
        self.app.exec_()


def get_overlay() -> OverlayController:
    return OverlayController.get()
