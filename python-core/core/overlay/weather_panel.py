"""weather_panel.py — визуальная карточка погоды (PyQt overlay, центр-справа)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional

from PyQt5.QtCore import Qt, QTimer, QPropertyAnimation, QEasingCurve, QPoint
from PyQt5.QtGui import QFont, QColor, QIcon
from PyQt5.QtWidgets import QApplication, QLabel, QWidget, QVBoxLayout, QHBoxLayout, QFrame

WIDTH = 500
HEIGHT = 360
_ICON_PATH = str(
    Path(__file__).parents[3] / "tauri-front" / "src-tauri" / "icons" / "icon.png"
)
_CFG_PATH = Path(__file__).parents[3] / "config.json"


def _load_accent() -> QColor:
    try:
        data = json.loads(_CFG_PATH.read_text("utf-8"))
        raw = data.get("accent_color", "#00B4D8").strip()
        if raw.startswith("#"):
            return QColor(raw)
    except Exception:
        pass
    return QColor(0, 180, 216)


def _make_click_through(widget: QWidget) -> None:
    try:
        import win32con, win32gui

        hwnd = int(widget.winId())
        ex = win32gui.GetWindowLong(hwnd, win32con.GWL_EXSTYLE)
        win32gui.SetWindowLong(
            hwnd,
            win32con.GWL_EXSTYLE,
            ex | win32con.WS_EX_LAYERED | win32con.WS_EX_TRANSPARENT,
        )
    except Exception:
        pass


class WeatherPanel(QWidget):
    """Glass weather card — inspired by QuickShell CalendarPopup right wing."""

    def __init__(self) -> None:
        super().__init__()
        self.setWindowFlags(Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint | Qt.Tool)
        self.setAttribute(Qt.WA_TranslucentBackground)
        self.setAttribute(Qt.WA_ShowWithoutActivating)
        self.setWindowIcon(QIcon(_ICON_PATH))
        self.resize(WIDTH, HEIGHT)

        screen = QApplication.primaryScreen().geometry()
        self._x_end = screen.width() - WIDTH - 24
        self._y = (screen.height() - HEIGHT) // 2
        self.move(screen.width(), self._y)

        self._accent = _load_accent()
        self._weather_accent = self._accent

        outer = QVBoxLayout(self)
        outer.setContentsMargins(0, 0, 0, 0)
        self._frame = QFrame()
        outer.addWidget(self._frame)

        inner = QVBoxLayout(self._frame)
        inner.setContentsMargins(20, 18, 20, 16)
        inner.setSpacing(8)

        hdr = QHBoxLayout()
        self._tri = QLabel("▲")
        self._title = QLabel("  КОННОР · ПОГОДА")
        self._title.setFont(QFont("Rajdhani", 13, QFont.Bold))
        hdr.addWidget(self._tri)
        hdr.addWidget(self._title)
        hdr.addStretch()
        self._city_lbl = QLabel("")
        self._city_lbl.setFont(QFont("Consolas", 9))
        hdr.addWidget(self._city_lbl)
        inner.addLayout(hdr)

        self._sep = QFrame()
        self._sep.setFrameShape(QFrame.HLine)
        inner.addWidget(self._sep)

        self._hero_lbl = QLabel("")
        self._hero_lbl.setTextFormat(Qt.RichText)
        self._hero_lbl.setAlignment(Qt.AlignCenter)
        inner.addWidget(self._hero_lbl)

        self._gauges_lbl = QLabel("")
        self._gauges_lbl.setTextFormat(Qt.RichText)
        self._gauges_lbl.setAlignment(Qt.AlignCenter)
        inner.addWidget(self._gauges_lbl)

        self._hourly_lbl = QLabel("")
        self._hourly_lbl.setTextFormat(Qt.RichText)
        self._hourly_lbl.setAlignment(Qt.AlignCenter)
        inner.addWidget(self._hourly_lbl)

        self._apply_styles()

        self._slide_in = QPropertyAnimation(self, b"pos")
        self._slide_in.setDuration(340)
        self._slide_in.setEasingCurve(QEasingCurve.OutCubic)

        self._slide_out = QPropertyAnimation(self, b"pos")
        self._slide_out.setDuration(260)
        self._slide_out.setEasingCurve(QEasingCurve.InCubic)
        self._slide_out.finished.connect(super().hide)

        self._hide_timer = QTimer(self)
        self._hide_timer.setSingleShot(True)
        self._hide_timer.timeout.connect(self._start_slide_out)

        self._click_through_done = False

    def _apply_styles(self) -> None:
        c = self._accent
        r, g, b = c.red(), c.green(), c.blue()
        hex_ = c.name()
        wa = self._weather_accent
        wr, wg, wb = wa.red(), wa.green(), wa.blue()

        self._frame.setStyleSheet(
            f"background-color: rgba(4,4,12,242);"
            f"border-left: 1.5px solid rgba({wr},{wg},{wb},0.45);"
            f"border-top: 0.5px solid rgba({wr},{wg},{wb},0.2);"
            f"border-bottom: 0.5px solid rgba({wr},{wg},{wb},0.2);"
            f"border-top-left-radius: 14px;"
            f"border-bottom-left-radius: 14px;"
        )
        self._tri.setStyleSheet(f"color: {hex_}; font-size: 9px; background: transparent;")
        self._title.setStyleSheet(
            f"color: {hex_}; letter-spacing: 4px; background: transparent;"
        )
        self._city_lbl.setStyleSheet(
            f"color: rgba({wr},{wg},{wb},0.75); letter-spacing: 2px; background: transparent;"
        )
        self._sep.setStyleSheet(f"background: rgba({r},{g},{b},0.14); max-height:1px; margin: 6px 0;")

    def _build_html(self, w: dict[str, Any]) -> None:
        accent = w.get("accent_hex", "#74c7ec")
        if accent.startswith("#"):
            wa = QColor(accent)
            self._weather_accent = wa
            self._apply_styles()

        wr, wg, wb = self._weather_accent.red(), self._weather_accent.green(), self._weather_accent.blue()
        icon = w.get("icon", "☁")
        temp = w.get("temp", "—")
        desc = w.get("desc", "")
        city = w.get("city", "")
        self._city_lbl.setText(city.upper())

        self._hero_lbl.setText(
            f'<div style="margin:8px 0 4px;">'
            f'<span style="font-size:72px; line-height:1;">{icon}</span><br>'
            f'<span style="font-size:56px; font-weight:900; color:rgb({wr},{wg},{wb});'
            f' letter-spacing:2px;">{temp}°</span><br>'
            f'<span style="font-size:13px; color:rgba({wr},{wg},{wb},0.8);'
            f' letter-spacing:3px;">{desc}</span></div>'
        )

        gauges = [
            ("ВЕТЕР", f"{w.get('wind_kmh', 0)} км/ч"),
            ("ВЛАЖН", f"{w.get('humidity', 0)}%"),
            ("ОСАДК", f"{w.get('precip_mm', 0)} мм"),
            ("ОЩУЩ", f"{w.get('feels', 0)}°"),
        ]
        cells = []
        for label, val in gauges:
            cells.append(
                f'<td style="padding:6px 14px; text-align:center;">'
                f'<div style="font-size:8px; color:rgba({wr},{wg},{wb},0.5);'
                f' letter-spacing:2px;">{label}</div>'
                f'<div style="font-size:16px; font-weight:700; color:rgb({wr},{wg},{wb});'
                f' margin-top:4px;">{val}</div></td>'
            )
        self._gauges_lbl.setText(f"<table><tr>{''.join(cells)}</tr></table>")

        hourly = w.get("hourly") or []
        hcells = []
        for h in hourly[:6]:
            hcells.append(
                f'<td style="padding:4px 8px; text-align:center; min-width:52px;">'
                f'<div style="font-size:14px;">{h.get("icon", "")}</div>'
                f'<div style="font-size:11px; color:rgba(224,247,255,0.9);">{h.get("temp", "")}°</div>'
                f'<div style="font-size:8px; color:rgba({wr},{wg},{wb},0.45);">{h.get("time", "")}</div>'
                f"</td>"
            )
        if hcells:
            self._hourly_lbl.setText(
                f'<div style="margin-top:10px; font-size:8px; color:rgba({wr},{wg},{wb},0.4);'
                f' letter-spacing:2px;">ПОЧАСОВОЙ</div>'
                f"<table><tr>{''.join(hcells)}</tr></table>"
            )
        else:
            self._hourly_lbl.setText("")

    def show_weather(self, data: dict[str, Any], auto_hide_ms: int = 12000) -> None:
        if not data:
            return
        self._hide_timer.stop()
        self._slide_out.stop()
        self._build_html(data)

        if not self.isVisible():
            super().show()
            if not self._click_through_done:
                _make_click_through(self)
                self._click_through_done = True

        self._slide_in.setStartValue(QPoint(self.x(), self._y))
        self._slide_in.setEndValue(QPoint(self._x_end, self._y))
        self._slide_in.start()

        if auto_hide_ms > 0:
            self._hide_timer.start(auto_hide_ms)

    def _start_slide_out(self) -> None:
        if self.isVisible():
            self._slide_in.stop()
            self._slide_out.setStartValue(QPoint(self.x(), self._y))
            self._slide_out.setEndValue(QPoint(QApplication.primaryScreen().geometry().width(), self._y))
            self._slide_out.start()

    def hide(self) -> None:  # type: ignore[override]
        self._hide_timer.stop()
        self._start_slide_out()
