from __future__ import annotations

import json
import math
from pathlib import Path

from PyQt5.QtCore import Qt, QTimer, QRect
from PyQt5.QtGui import QColor, QIcon, QPainter, QPen, QBrush, QLinearGradient
from PyQt5.QtWidgets import QApplication, QWidget


def _load_accent() -> QColor:
    try:
        cfg = json.loads(
            (Path(__file__).parents[3] / "config.json").read_text("utf-8")
        )
        return QColor(cfg.get("accent_color", "#00B4D8"))
    except Exception:
        return QColor(0, 180, 216)


_ICON_PATH = str(
    Path(__file__).parents[3] / "tauri-front" / "src-tauri" / "icons" / "icon.png"
)


def _make_click_through(widget: QWidget) -> None:
    try:
        import win32con
        import win32gui
        hwnd = int(widget.winId())
        ex = win32gui.GetWindowLong(hwnd, win32con.GWL_EXSTYLE)
        win32gui.SetWindowLong(
            hwnd, win32con.GWL_EXSTYLE,
            ex | win32con.WS_EX_LAYERED | win32con.WS_EX_TRANSPARENT,
        )
    except Exception:
        pass


class WavePanel(QWidget):
    """Animated wave visualiser shown during LISTENING state."""

    BARS = 52
    BAR_W = 4
    BAR_GAP = 2
    HEIGHT = 80

    def __init__(self) -> None:
        super().__init__()
        self.setWindowFlags(Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint | Qt.Tool)
        self.setAttribute(Qt.WA_TranslucentBackground)
        self.setAttribute(Qt.WA_ShowWithoutActivating)
        self.setWindowIcon(QIcon(_ICON_PATH))

        screen = QApplication.primaryScreen().geometry()
        total_w = self.BARS * (self.BAR_W + self.BAR_GAP) + 40
        x = (screen.width() - total_w) // 2
        # Bottom-center, above taskbar
        y = screen.height() - self.HEIGHT - 56
        self.setGeometry(x, y, total_w, self.HEIGHT)

        self._phase = 0.0
        self._amplitudes = [0.3] * self.BARS
        self._cyan = _load_accent()

        self._timer = QTimer(self)
        self._timer.timeout.connect(self._tick)

        # Accent colour watcher — reloads config every 5 seconds
        self._accent_timer = QTimer(self)
        self._accent_timer.timeout.connect(self._maybe_reload_accent)
        self._accent_timer.start(1000)

        self._click_through_applied = False
        self.hide()

    def _maybe_reload_accent(self) -> None:
        new = _load_accent()
        if new.name() != self._cyan.name():
            self._cyan = new
            self.update()

    def _tick(self) -> None:
        self._phase += 0.18
        for i in range(self.BARS):
            t = self._phase + i * 0.28
            self._amplitudes[i] = 0.12 + 0.88 * abs(
                math.sin(t) * 0.5 + math.sin(t * 1.7 + 1.1) * 0.3 + math.sin(t * 0.6 + 2.3) * 0.2
            )
        self.update()

    def show_wave(self) -> None:
        super().show()
        if not self._click_through_applied:
            _make_click_through(self)
            self._click_through_applied = True
        self._timer.start(35)

    def hide_wave(self) -> None:
        self._timer.stop()
        self.hide()

    def paintEvent(self, _event) -> None:
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)

        mid = self.height() * 0.5
        step = self.BAR_W + self.BAR_GAP
        offset = 20

        for i, amp in enumerate(self._amplitudes):
            x = offset + i * step
            bar_h = max(3, amp * (mid * 1.7))
            y1 = int(mid - bar_h / 2)

            alpha = int(30 + 180 * amp)
            color = QColor(self._cyan.red(), self._cyan.green(), self._cyan.blue(), alpha)
            pen = QPen(color, self.BAR_W, Qt.SolidLine, Qt.RoundCap)
            painter.setPen(pen)
            painter.drawLine(x, y1, x, int(y1 + bar_h))

        painter.end()
