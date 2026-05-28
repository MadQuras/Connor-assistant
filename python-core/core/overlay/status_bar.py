from __future__ import annotations

import json
import math
from pathlib import Path

from PyQt5.QtCore import Qt, QTimer
from PyQt5.QtGui import QColor, QIcon, QPainter, QFont
from PyQt5.QtWidgets import QApplication, QWidget


def _load_accent() -> QColor:
    try:
        cfg = json.loads(
            (Path(__file__).parents[3] / "config.json").read_text("utf-8")
        )
        return QColor(cfg.get("accent_color", "#00B4D8"))
    except Exception:
        return QColor(0, 180, 216)


BG = QColor(5, 5, 14, 220)

_ICON_PATH = str(
    Path(__file__).parents[3] / "tauri-front" / "src-tauri" / "icons" / "icon.png"
)


class StatusBar(QWidget):
    """Thin bottom status bar with state text and pulsing dot."""

    HEIGHT = 38

    def __init__(self) -> None:
        super().__init__()
        self._state_text = "ОЖИДАНИЕ"
        self._listening = False
        self._pulse = 0.0
        self._phase = 0.0

        self.setWindowFlags(Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint | Qt.Tool)
        self.setAttribute(Qt.WA_TranslucentBackground)
        self.setAttribute(Qt.WA_ShowWithoutActivating)
        self.setWindowIcon(QIcon(_ICON_PATH))

        screen = QApplication.primaryScreen().geometry()
        self.setGeometry(0, screen.height() - self.HEIGHT, screen.width(), self.HEIGHT)

        self._cyan = _load_accent()

        self._timer = QTimer(self)
        self._timer.timeout.connect(self._tick)
        self._timer.start(40)

        # Accent colour watcher — reloads config every 5 seconds
        self._accent_timer = QTimer(self)
        self._accent_timer.timeout.connect(self._maybe_reload_accent)
        self._accent_timer.start(5000)

        self.show()

    def set_status(self, text: str) -> None:
        self._state_text = text.upper()
        self.update()

    def set_listening(self, active: bool) -> None:
        self._listening = active
        self.update()

    def _maybe_reload_accent(self) -> None:
        new = _load_accent()
        if new.name() != self._cyan.name():
            self._cyan = new
            self.update()

    def _tick(self) -> None:
        self._phase += 0.1
        self._pulse = 0.4 + 0.6 * (0.5 + 0.5 * math.sin(self._phase))
        self.update()

    def paintEvent(self, _event) -> None:
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing)
        w, h = self.width(), self.height()

        p.fillRect(0, 0, w, h, BG)

        border = QColor(self._cyan.red(), self._cyan.green(), self._cyan.blue(), 55)
        p.setPen(border)
        p.drawLine(0, 0, w, 0)

        dot_r = 4
        alpha = int(80 + 175 * self._pulse)
        dot_color = QColor(self._cyan.red(), self._cyan.green(), self._cyan.blue(), alpha)
        p.setBrush(dot_color)
        p.setPen(Qt.NoPen)
        p.drawEllipse(24, (h - dot_r * 2) // 2, dot_r * 2, dot_r * 2)

        font = QFont("Share Tech Mono, Consolas", 9)
        font.setLetterSpacing(QFont.AbsoluteSpacing, 2.5)
        p.setFont(font)
        p.setPen(QColor(self._cyan.red(), self._cyan.green(), self._cyan.blue(), 200))
        p.drawText(40, 0, 320, h, Qt.AlignVCenter | Qt.AlignLeft, self._state_text)

        p.end()
