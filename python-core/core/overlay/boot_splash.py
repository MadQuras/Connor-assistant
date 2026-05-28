from __future__ import annotations

import json
from pathlib import Path

from PyQt5.QtCore import Qt, QTimer
from PyQt5.QtGui import (
    QColor, QIcon, QPainter, QPen, QBrush, QFont, QPixmap,
)
from PyQt5.QtWidgets import QApplication, QWidget


def _load_accent() -> QColor:
    try:
        cfg = json.loads(
            (Path(__file__).parents[3] / "config.json").read_text("utf-8")
        )
        return QColor(cfg.get("accent_color", "#00B4D8"))
    except Exception:
        return QColor(0, 180, 216)


CYAN  = _load_accent()
BG    = QColor(4, 5, 14)
WHITE = QColor(224, 247, 255, 200)

_ICON_PATH = str(
    Path(__file__).parents[3] / "tauri-front" / "src-tauri" / "icons" / "icon.png"
)

_MINI_EYE = 48   # size of static PNG icon above the title


class BootSplash(QWidget):
    """
    Boot overlay — text-only phase (no programmatic eye animation).
    Shows "КОННОР  RK800", then scrolls through BOOT_LINES one by one.
    Holds on the last line ('ОЖИДАНИЕ…') until _ready_event is set,
    then flips it to 'ГОТОВ' and stops.
    """

    W, H = 560, 360

    BOOT_LINES = [
        ("VAD SILERO",    "OK"),
        ("WHISPER STT",   "OK"),
        ("AUDIO ENGINE",  "OK"),
        ("CORE MODULE",   "OK"),
        ("СИСТЕМА",       "ГОТОВ"),
    ]

    def __init__(self) -> None:
        super().__init__()
        self.setWindowFlags(
            Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint | Qt.Tool
        )
        self.setAttribute(Qt.WA_TranslucentBackground)
        self.setAttribute(Qt.WA_ShowWithoutActivating)
        self.setWindowIcon(QIcon(_ICON_PATH))

        screen = QApplication.primaryScreen().geometry()
        self.setGeometry(
            (screen.width()  - self.W) // 2,
            (screen.height() - self.H) // 2,
            self.W, self.H,
        )

        self._boot_step    = 0
        self._boot_results: list[str] = [""] * len(self.BOOT_LINES)
        self._waiting_ready = False
        self._ready_event   = None

        # Load static icon
        self._icon_pix = QPixmap(_ICON_PATH)

        self._timer = QTimer(self)
        self._timer.timeout.connect(self._tick)
        self.hide()

    # ── Public API ────────────────────────────────────────────────────────────

    def show(self, message: str = "") -> None:          # type: ignore[override]
        self._boot_step     = 0
        self._boot_results  = [""] * len(self.BOOT_LINES)
        self._waiting_ready = False
        super().show()
        self._timer.start(320)   # one line per 320 ms

    def set_ready_event(self, event) -> None:
        """Pass a threading.Event; boot holds on last line until it is set."""
        self._ready_event = event

    # ── Tick ──────────────────────────────────────────────────────────────────

    def _tick(self) -> None:
        total = len(self.BOOT_LINES)

        # All lines except last: fill normally
        if self._boot_step < total - 1:
            self._boot_results[self._boot_step] = self.BOOT_LINES[self._boot_step][1]
            self._boot_step += 1
            self.update()
            return

        # Last line: hold until pipeline ready
        if self._boot_step == total - 1:
            if self._ready_event is not None:
                if not self._waiting_ready:
                    self._boot_results[self._boot_step] = "ОЖИДАНИЕ..."
                    self._waiting_ready = True
                    self._timer.setInterval(150)
                    self.update()
                elif self._ready_event.is_set():
                    self._boot_results[self._boot_step] = self.BOOT_LINES[self._boot_step][1]
                    self._boot_step += 1
                    self.update()
                    self._timer.stop()
            else:
                # No event: finish immediately
                self._boot_results[self._boot_step] = self.BOOT_LINES[self._boot_step][1]
                self._boot_step += 1
                self.update()
                self._timer.stop()

    # ── Paint ─────────────────────────────────────────────────────────────────

    def paintEvent(self, _event) -> None:
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing)
        p.fillRect(self.rect(), BG)

        # Outer border
        p.setPen(QPen(QColor(CYAN.red(), CYAN.green(), CYAN.blue(), 45), 1))
        p.setBrush(Qt.NoBrush)
        p.drawRect(1, 1, self.W - 2, self.H - 2)

        # Corner marks
        s = 12
        p.setPen(QPen(CYAN, 1.2))
        for px, py, dx, dy in [
            (4, 4, 1, 1), (self.W - 4, 4, -1, 1),
            (4, self.H - 4, 1, -1), (self.W - 4, self.H - 4, -1, -1),
        ]:
            p.drawLine(px, py, px + dx * s, py)
            p.drawLine(px, py, px, py + dy * s)

        # Static PNG icon (mini)
        if not self._icon_pix.isNull():
            ix = (self.W - _MINI_EYE) // 2
            iy = 16
            sc = self._icon_pix.scaled(
                _MINI_EYE, _MINI_EYE,
                Qt.KeepAspectRatio, Qt.SmoothTransformation,
            )
            p.drawPixmap(ix, iy, sc)

        # Title
        f_title = QFont("Consolas", 15)
        f_title.setBold(True)
        f_title.setLetterSpacing(QFont.AbsoluteSpacing, 6)
        p.setFont(f_title)
        p.setPen(CYAN)
        p.drawText(0, 74, self.W, 28, Qt.AlignCenter, "КОННОР  RK800")

        # Separator
        p.setPen(QPen(QColor(CYAN.red(), CYAN.green(), CYAN.blue(), 35), 0.5))
        p.drawLine(40, 110, self.W - 40, 110)

        # Boot lines
        lf = QFont("Consolas", 10)
        p.setFont(lf)
        y = 120
        done = self._boot_step

        for i, (label, _result) in enumerate(self.BOOT_LINES):
            if i >= done:
                break
            p.setPen(QColor(255, 255, 255, 100))
            p.drawText(60, y, 200, 18, Qt.AlignLeft | Qt.AlignVCenter, label)
            p.setPen(CYAN)
            p.drawText(self.W - 140, y, 100, 18,
                       Qt.AlignRight | Qt.AlignVCenter, self._boot_results[i])
            y += 20

        # Progress bar (fixed position below last possible line)
        bar_base_y = 120 + len(self.BOOT_LINES) * 20
        bx, by, bw, bh = 60, bar_base_y + 10, self.W - 120, 2
        pct = self._boot_step / len(self.BOOT_LINES)
        p.setPen(Qt.NoPen)
        p.setBrush(QBrush(QColor(CYAN.red(), CYAN.green(), CYAN.blue(), 28)))
        p.drawRect(bx, by, bw, bh)
        p.setBrush(QBrush(CYAN))
        p.drawRect(bx, by, int(bw * pct), bh)

        p.end()
