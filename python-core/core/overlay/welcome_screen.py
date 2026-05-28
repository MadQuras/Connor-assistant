from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Callable, Optional

from PyQt5.QtCore import Qt, QTimer, QRect
from PyQt5.QtGui import QColor, QFont, QIcon, QPainter, QPen, QPixmap
from PyQt5.QtWidgets import QApplication, QWidget

_MONTHS = [
    "", "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
]
_DAYS = [
    "Понедельник", "Вторник", "Среда", "Четверг",
    "Пятница", "Суббота", "Воскресенье",
]
_GREETINGS = {
    "morning": "Доброе утро",
    "day":     "Добрый день",
    "evening": "Добрый вечер",
    "night":   "Доброй ночи",
}

_ICON_PATH = str(
    Path(__file__).parents[3] / "tauri-front" / "src-tauri" / "icons" / "icon.png"
)

_EYE_SIZE   = 160   # display size of the PNG eye (px)
_EYE_ANIM_S = 1.6   # seconds for eye to open fully


def _load_accent() -> QColor:
    try:
        cfg = json.loads(
            (Path(__file__).parents[3] / "config.json").read_text("utf-8")
        )
        return QColor(cfg.get("accent_color", "#00B4D8"))
    except Exception:
        return QColor(0, 180, 216)


def _time_of_day() -> str:
    h = datetime.now().hour
    if 5  <= h < 12: return "morning"
    if 12 <= h < 17: return "day"
    if 17 <= h < 22: return "evening"
    return "night"


class WelcomeScreen(QWidget):
    """
    Fullscreen welcome overlay.

    Sequence
    --------
    1. Eye-opening animation: PNG icon clips open (eyelids slide apart), ~1.6 s
    2. Greeting text fades in: ДОБРЫЙ ВЕЧЕР / ЛЕЙТЕНАНТ / date / time
    3. Holds for `show_ms` total (from first pixel shown), then fades out
    4. Calls on_done() when completely hidden
    5. Clickable at any point to skip immediately
    """

    def __init__(self, show_ms: int = 15000, on_done: Optional[Callable] = None) -> None:
        super().__init__()
        self._on_done  = on_done
        self._show_ms  = show_ms
        self._alpha    = 255          # window-level opacity handled manually
        self._eye_t    = 0.0          # 0 → 1  (eye opening progress)
        self._text_a   = 0            # 0-255  (text opacity)
        self._phase    = "eye"        # "eye" | "text" | "fadeout"
        self._started_ms = 0

        self._accent = _load_accent()
        tod = _time_of_day()
        self._greeting = _GREETINGS[tod].upper()

        now = datetime.now()
        self._time_str = now.strftime("%H:%M")
        self._date_str = (
            f"{_DAYS[now.weekday()]}, {now.day} {_MONTHS[now.month]} {now.year}"
        )
        try:
            cfg = json.loads(
                (Path(__file__).parents[3] / "config.json").read_text("utf-8")
            )
            self._user = cfg.get("user_name", "ЛЕЙТЕНАНТ").upper()
        except Exception:
            self._user = "ЛЕЙТЕНАНТ"

        # Load PNG eye icon
        self._eye_pix = QPixmap(_ICON_PATH)
        if self._eye_pix.isNull():
            self._eye_pix = None

        # Window setup — fullscreen, always on top
        self.setWindowFlags(
            Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint | Qt.Tool
        )
        self.setAttribute(Qt.WA_TranslucentBackground)
        self.setAttribute(Qt.WA_ShowWithoutActivating)
        self.setWindowIcon(QIcon(_ICON_PATH))

        screen = QApplication.primaryScreen().geometry()
        self.setGeometry(screen)      # TRUE FULLSCREEN

        self._W = screen.width()
        self._H = screen.height()

        # Single 16 ms tick drives everything
        self._timer = QTimer(self)
        self._timer.timeout.connect(self._tick)

        self._hold_timer = QTimer(self)
        self._hold_timer.setSingleShot(True)
        self._hold_timer.timeout.connect(self._start_fadeout)

    # ── Public ───────────────────────────────────────────────────────────────

    def show_welcome(self) -> None:
        from PyQt5.QtCore import QTime
        self._started_ms = QTime.currentTime().msecsSinceStartOfDay()
        super().show()
        self._timer.start(16)

    # ── Click to skip ────────────────────────────────────────────────────────

    def mousePressEvent(self, _event) -> None:
        if self._phase != "fadeout":
            self._phase = "fadeout"
            self._timer.stop()
            self._hold_timer.stop()
            self._fadeout_timer = QTimer(self)
            self._fadeout_timer.timeout.connect(self._tick_fadeout)
            self._fadeout_timer.start(16)

    # ── Tick ─────────────────────────────────────────────────────────────────

    def _tick(self) -> None:
        if self._phase == "eye":
            self._eye_t = min(1.0, self._eye_t + 16 / (_EYE_ANIM_S * 1000))
            if self._eye_t >= 1.0:
                self._phase = "text"
            self.update()

        elif self._phase == "text":
            self._text_a = min(255, self._text_a + 8)
            self.update()
            if self._text_a >= 255:
                self._timer.stop()
                # Schedule fadeout so total visible time = show_ms
                from PyQt5.QtCore import QTime
                elapsed = QTime.currentTime().msecsSinceStartOfDay() - self._started_ms
                remaining = max(500, self._show_ms - elapsed)
                self._hold_timer.start(remaining)

    def _start_fadeout(self) -> None:
        self._phase = "fadeout"
        self._fadeout_timer = QTimer(self)
        self._fadeout_timer.timeout.connect(self._tick_fadeout)
        self._fadeout_timer.start(16)

    def _tick_fadeout(self) -> None:
        self._alpha = max(0, self._alpha - 10)
        self.setWindowOpacity(self._alpha / 255)
        self.update()
        if self._alpha <= 0:
            self._fadeout_timer.stop()
            self.hide()
            if self._on_done:
                self._on_done()

    # ── Paint ────────────────────────────────────────────────────────────────

    def paintEvent(self, _event) -> None:
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing)
        r, g, b = self._accent.red(), self._accent.green(), self._accent.blue()
        W, H = self._W, self._H

        # Background
        p.fillRect(self.rect(), QColor(4, 5, 14))

        # ── Eye PNG (always visible during eye + text phases) ─────────────
        if self._eye_pix is not None:
            ex = (W - _EYE_SIZE) // 2
            ey = int(H * 0.18)

            # Eyelid clip: starts at height=0 from center, expands to full
            t = self._eye_t
            # ease-out: t_ease = 1 - (1-t)^2
            t_ease = 1.0 - (1.0 - t) ** 2
            clip_h = int(_EYE_SIZE * t_ease)
            clip_y = ey + (_EYE_SIZE - clip_h) // 2

            p.setClipRect(QRect(ex, clip_y, _EYE_SIZE, max(1, clip_h)))
            scaled = self._eye_pix.scaled(
                _EYE_SIZE, _EYE_SIZE,
                Qt.KeepAspectRatio, Qt.SmoothTransformation,
            )
            p.drawPixmap(ex, ey, scaled)
            p.setClipping(False)

            # Eyelid lines (top & bottom bar that slide apart)
            lid_alpha = max(0, int(255 * (1.0 - t_ease)))
            if lid_alpha > 0:
                p.fillRect(0, 0, W, clip_y, QColor(4, 5, 14))
                p.fillRect(0, clip_y + clip_h, W, H - (clip_y + clip_h), QColor(4, 5, 14))

        # ── Greeting text (fades in after eye opens) ──────────────────────
        ta = self._text_a
        if ta <= 0:
            p.end()
            return

        cy_text = int(H * 0.42)   # vertical start of text block

        # Greeting (large)
        f_greet = QFont("Consolas", max(28, H // 22))
        f_greet.setBold(True)
        f_greet.setLetterSpacing(QFont.AbsoluteSpacing, 8)
        p.setFont(f_greet)
        p.setPen(QColor(r, g, b, ta))
        p.drawText(0, cy_text, W, 60, Qt.AlignCenter, self._greeting)

        # User name
        f_name = QFont("Consolas", max(13, H // 52))
        f_name.setLetterSpacing(QFont.AbsoluteSpacing, 6)
        p.setFont(f_name)
        p.setPen(QColor(r, g, b, int(ta * 0.55)))
        p.drawText(0, cy_text + 66, W, 26, Qt.AlignCenter, self._user)

        # Separator
        p.setPen(QPen(QColor(r, g, b, int(ta * 0.15)), 0.5))
        p.drawLine(W // 2 - 180, cy_text + 102, W // 2 + 180, cy_text + 102)

        # System label
        f_sys = QFont("Consolas", 9)
        f_sys.setLetterSpacing(QFont.AbsoluteSpacing, 3)
        p.setFont(f_sys)
        p.setPen(QColor(r, g, b, int(ta * 0.35)))
        p.drawText(0, cy_text + 112, W, 20, Qt.AlignCenter, "СИСТЕМА КОННОРА  ·  CYBERLIFE")

        # Date
        f_date = QFont("Consolas", 12)
        p.setFont(f_date)
        p.setPen(QColor(224, 247, 255, int(ta * 0.55)))
        p.drawText(0, cy_text + 144, W, 24, Qt.AlignCenter, self._date_str)

        # Time (big)
        f_time = QFont("Consolas", max(48, H // 14))
        f_time.setBold(True)
        p.setFont(f_time)
        p.setPen(QColor(r, g, b, ta))
        p.drawText(0, cy_text + 168, W, 80, Qt.AlignCenter, self._time_str)

        # Bottom hint
        f_hint = QFont("Consolas", 8)
        f_hint.setLetterSpacing(QFont.AbsoluteSpacing, 2)
        p.setFont(f_hint)
        p.setPen(QColor(r, g, b, int(ta * 0.2)))
        p.drawText(0, H - 30, W, 20, Qt.AlignCenter, "НАЖМИТЕ ДЛЯ ПРОПУСКА")

        # Corner marks
        s = 18
        p.setPen(QPen(QColor(r, g, b, int(ta * 0.35)), 1.5))
        for px, py, dx, dy in [
            (8, 8, 1, 1), (W - 8, 8, -1, 1),
            (8, H - 8, 1, -1), (W - 8, H - 8, -1, -1),
        ]:
            p.drawLine(px, py, px + dx * s, py)
            p.drawLine(px, py, px, py + dy * s)

        p.end()
