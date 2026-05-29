from __future__ import annotations

import json
from pathlib import Path

from PyQt5.QtCore import Qt, QTimer, QPropertyAnimation, QEasingCurve, QPoint, QSize, QRect
from PyQt5.QtGui import QFont, QColor, QIcon, QFontMetrics
from PyQt5.QtWidgets import (
    QApplication, QLabel, QWidget,
    QVBoxLayout, QHBoxLayout, QFrame,
)

WIDTH    = 520
MAX_H    = 420
MIN_H    = 110

_ICON_PATH = str(
    Path(__file__).parents[3] / "tauri-front" / "src-tauri" / "icons" / "icon.png"
)
_CFG_PATH = Path(__file__).parents[3] / "config.json"

# ─── Accent colour from config ──────────────────────────────────

def _load_accent() -> QColor:
    try:
        data = json.loads(_CFG_PATH.read_text("utf-8"))
        raw = data.get("accent_color", "#00B4D8").strip()
        if raw.startswith("#"):
            return QColor(raw)
        parts = [int(x) for x in raw.replace(",", " ").split()]
        if len(parts) == 3:
            return QColor(*parts)
    except Exception:
        pass
    return QColor(0, 180, 216)


def _make_click_through(widget: QWidget) -> None:
    try:
        import win32con, win32gui
        hwnd = int(widget.winId())
        ex = win32gui.GetWindowLong(hwnd, win32con.GWL_EXSTYLE)
        win32gui.SetWindowLong(
            hwnd, win32con.GWL_EXSTYLE,
            ex | win32con.WS_EX_LAYERED | win32con.WS_EX_TRANSPARENT,
        )
    except Exception:
        pass


class TextPanel(QWidget):
    """
    Left-side overlay — slides in from the left when Connor speaks.

    Tags:
      ВРЕМЯ  — huge clock (52 px) + date, instant display
      others — typewriter effect that starts AFTER the slide-in finishes

    Height adapts to content (MIN_H … MAX_H).
    Accent colour auto-reloads from config.json every second.
    """

    PADDING = 18

    def __init__(self) -> None:
        super().__init__()
        self.setWindowFlags(
            Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint | Qt.Tool
        )
        self.setAttribute(Qt.WA_TranslucentBackground)
        self.setAttribute(Qt.WA_ShowWithoutActivating)
        self.setWindowIcon(QIcon(_ICON_PATH))

        screen = QApplication.primaryScreen().geometry()
        self._y = (screen.height() - MIN_H) // 2
        # Start at adaptive min size; will resize before each show
        self.resize(WIDTH, MIN_H)
        self.move(-WIDTH, self._y)

        self._cyan = _load_accent()

        # ── Build widget tree ────────────────────────────────────
        outer = QVBoxLayout(self)
        outer.setContentsMargins(0, 0, 0, 0)

        self._frame = QFrame()
        outer.addWidget(self._frame)

        inner = QVBoxLayout(self._frame)
        inner.setContentsMargins(self.PADDING, self.PADDING, self.PADDING, 14)
        inner.setSpacing(0)

        hdr = QHBoxLayout()
        self._tri_lbl = QLabel("▲")
        self._name_lbl = QLabel("  КОННОР")
        self._name_lbl.setFont(QFont("Rajdhani", 14, QFont.Bold))
        hdr.addWidget(self._tri_lbl)
        hdr.addWidget(self._name_lbl)
        hdr.addStretch()
        inner.addLayout(hdr)

        self._sep_top = QFrame()
        self._sep_top.setFrameShape(QFrame.HLine)
        inner.addWidget(self._sep_top)

        self._tag_lbl = QLabel("")
        self._tag_lbl.setFont(QFont("Consolas", 9, QFont.Bold))
        inner.addWidget(self._tag_lbl)

        self._text_lbl = QLabel("")
        self._text_lbl.setWordWrap(True)
        self._text_lbl.setAlignment(Qt.AlignTop | Qt.AlignLeft)
        self._text_lbl.setTextFormat(Qt.RichText)
        self._text_lbl.setFont(QFont("Consolas", 14))
        self._text_lbl.setStyleSheet(
            "color: rgba(224,247,255,0.92); background: transparent; line-height: 1.6;"
        )
        inner.addWidget(self._text_lbl)
        inner.addStretch()

        self._sep_bot = QFrame()
        self._sep_bot.setFrameShape(QFrame.HLine)
        inner.addWidget(self._sep_bot)

        # Apply initial colours
        self._apply_accent()

        # ── Animations ───────────────────────────────────────────
        self._slide_in  = QPropertyAnimation(self, b"pos")
        self._slide_in.setDuration(320)
        self._slide_in.setEasingCurve(QEasingCurve.OutCubic)
        # Start typewriter AFTER slide-in completes
        self._slide_in.finished.connect(self._on_slide_in_done)

        self._slide_out = QPropertyAnimation(self, b"pos")
        self._slide_out.setDuration(260)
        self._slide_out.setEasingCurve(QEasingCurve.InCubic)
        self._slide_out.finished.connect(super().hide)

        # ── Timers ───────────────────────────────────────────────
        self._hide_timer = QTimer(self)
        self._hide_timer.setSingleShot(True)
        self._hide_timer.timeout.connect(self._start_slide_out)

        self._type_timer = QTimer(self)
        self._type_timer.timeout.connect(self._type_tick)
        self._type_text:    str = ""
        self._pending_text: str = ""   # text waiting for slide-in to complete
        self._type_idx:     int = 0

        self._accent_timer = QTimer(self)
        self._accent_timer.timeout.connect(self._maybe_reload_accent)
        self._accent_timer.start(1000)

        self._click_through_done = False
        self._current_tag: str   = ""

    # ── Accent colour ────────────────────────────────────────────

    def _apply_accent(self) -> None:
        c = self._cyan
        r, g, b = c.red(), c.green(), c.blue()
        hex_  = c.name()
        ca    = f"rgba({r},{g},{b}"

        self._frame.setStyleSheet(
            f"background-color: rgba(4,4,12,242);"
            f"border-right: 1.5px solid {ca},0.50);"
            f"border-top: 0.5px solid {ca},0.18);"
            f"border-bottom: 0.5px solid {ca},0.18);"
            f"border-top-right-radius: 12px;"
            f"border-bottom-right-radius: 12px;"
        )
        self._tri_lbl.setStyleSheet(
            f"color: {hex_}; font-size: 9px; background: transparent;"
        )
        self._name_lbl.setStyleSheet(
            f"color: {hex_}; letter-spacing: 5px; background: transparent;"
        )
        self._sep_top.setStyleSheet(
            f"background: {ca},0.14); max-height:1px; margin: 8px 0;"
        )
        self._tag_lbl.setStyleSheet(
            f"color: {ca},0.50); letter-spacing: 3px;"
            f"background: transparent; margin-bottom: 6px;"
        )
        self._sep_bot.setStyleSheet(
            f"background: {ca},0.10); max-height:1px; margin: 8px 0;"
        )

    def _maybe_reload_accent(self) -> None:
        new = _load_accent()
        if new.name() != self._cyan.name():
            self._cyan = new
            self._apply_accent()
            if self._current_tag == "ВРЕМЯ" and self._text_lbl.text():
                self._show_time_rich(self._type_text or self._text_lbl.text())

    # ── Height calculation ───────────────────────────────────────

    def _calc_height(self, text: str) -> int:
        """Compute window height that fits `text` at Consolas 14, word-wrapped."""
        fm = QFontMetrics(QFont("Consolas", 14))
        usable_w = WIDTH - 2 * self.PADDING - 4
        total_text_px = 0
        for line in text.split("\n"):
            if not line:
                total_text_px += fm.lineSpacing()
                continue
            rect = fm.boundingRect(
                QRect(0, 0, usable_w, 9999),
                Qt.TextWordWrap | Qt.AlignLeft,
                line,
            )
            total_text_px += rect.height() + 4   # small inter-line gap

        HEADER_H = 82   # logo row + sep + tag label + top padding
        FOOTER_H = 30   # bottom sep + bottom padding
        h = total_text_px + HEADER_H + FOOTER_H
        return max(MIN_H, min(MAX_H, h))

    def _resize_for(self, text: str) -> None:
        """Resize window to fit text, repositioning vertically on screen."""
        h = self._calc_height(text)
        screen = QApplication.primaryScreen().geometry()
        self._y = (screen.height() - h) // 2
        self.resize(WIDTH, h)

    # ── Public API ───────────────────────────────────────────────

    def show_text(self, text: str, auto_hide_ms: int = 6000, tag: str = "ОТВЕТ") -> None:
        self._current_tag = tag.upper()
        self._tag_lbl.setText(self._current_tag)
        self._hide_timer.stop()
        self._slide_out.stop()
        self._type_timer.stop()
        self._pending_text = ""

        if not self.isVisible():
            super().show()
            if not self._click_through_done:
                _make_click_through(self)
                self._click_through_done = True

        if self._current_tag == "ВРЕМЯ":
            # Clock: adapt height for two lines, show immediately (no typewriter)
            self._resize_for(text)
            self._show_time_rich(text)
        else:
            # Regular text: resize first, clear label, then typewrite after slide-in
            self._resize_for(text)
            self._text_lbl.setText("")
            self._pending_text = text

        self._slide_in.setStartValue(QPoint(-WIDTH, self._y))
        self._slide_in.setEndValue(QPoint(0, self._y))
        self._slide_in.start()

        self._hide_timer.start(auto_hide_ms)

    def hide(self) -> None:  # type: ignore[override]
        self._hide_timer.stop()
        self._start_slide_out()

    # ── Private ──────────────────────────────────────────────────

    def _on_slide_in_done(self) -> None:
        """Called when slide-in animation finishes — kick off typewriter."""
        if self._pending_text and self._current_tag != "ВРЕМЯ":
            self._start_typewriter(self._pending_text)
            self._pending_text = ""

    def _show_time_rich(self, text: str) -> None:
        """Render time in large HTML. text format: 'HH:MM\nDay, DD Month YYYY'"""
        self._type_timer.stop()
        self._type_text = text
        r, g, b = self._cyan.red(), self._cyan.green(), self._cyan.blue()
        lines = text.split("\n", 1)
        time_part = lines[0].strip()
        date_part = lines[1].strip() if len(lines) > 1 else ""
        html = (
            f'<span style="font-size:52px; font-weight:900; '
            f'color:rgb({r},{g},{b}); letter-spacing:4px;">{time_part}</span>'
        )
        if date_part:
            html += (
                f'<br><span style="font-size:14px; font-weight:400; '
                f'color:rgba({r},{g},{b},0.7); letter-spacing:2px;">{date_part}</span>'
            )
        self._text_lbl.setText(html)

    def _start_slide_out(self) -> None:
        self._type_timer.stop()
        self._pending_text = ""
        if self.isVisible():
            self._slide_in.stop()
            self._slide_out.setStartValue(QPoint(self.x(), self._y))
            self._slide_out.setEndValue(QPoint(-WIDTH, self._y))
            self._slide_out.start()

    def _start_typewriter(self, text: str) -> None:
        self._type_text = text
        self._type_idx  = 0
        self._text_lbl.setText("")
        # ~28 ms per character — visible and comfortable on screen
        self._type_timer.start(28)

    def _type_tick(self) -> None:
        self._type_idx += 1
        self._text_lbl.setText(self._type_text[: self._type_idx])
        if self._type_idx >= len(self._type_text):
            self._type_timer.stop()
