"""
activity_tracker.py — учёт времени за активным окном (Windows).
"""

from __future__ import annotations

import json
import threading
import time
from datetime import date, datetime
from pathlib import Path
from typing import Any, Optional

from core import logger
from core.constants import MODELS_DIR

_STATE_PATH = MODELS_DIR / "activity_state.json"
_POLL_SEC = 5
_SAVE_EVERY = 2
_CONNOR_APPS = frozenset(
    a.lower()
    for a in (
        "connor-tray-v2.exe",
        "python.exe",
        "pythonw.exe",
        "connor.exe",
    )
)
_IDLE_SEC = 120


def _today_key() -> str:
    return date.today().isoformat()


def _format_duration(secs: int) -> str:
    secs = max(0, int(secs))
    h, rem = divmod(secs, 3600)
    m = rem // 60
    if h > 0:
        return f"{h}ч {m}м"
    if m > 0:
        return f"{m}м"
    return "0м"


def _format_duration_large(secs: int) -> str:
    secs = max(0, int(secs))
    h, rem = divmod(secs, 3600)
    m, s = divmod(rem, 60)
    if h > 0:
        return f"{h}ч {m:02d}м"
    return f"{m}м {s:02d}с"


def _slot_index(now: datetime | None = None) -> int:
    now = now or datetime.now()
    return now.hour * 2 + (1 if now.minute >= 30 else 0)


def _idle_seconds() -> int:
    try:
        import ctypes

        class LASTINPUTINFO(ctypes.Structure):
            _fields_ = [("cbSize", ctypes.c_uint), ("dwTime", ctypes.c_uint)]

        li = LASTINPUTINFO()
        li.cbSize = ctypes.sizeof(LASTINPUTINFO)
        if not ctypes.windll.user32.GetLastInputInfo(ctypes.byref(li)):
            return 0
        tick = ctypes.windll.kernel32.GetTickCount()
        return max(0, int((tick - li.dwTime) / 1000))
    except Exception:
        return 0


def _foreground_app() -> tuple[str, str]:
    """(process_name, window_title)"""
    try:
        import ctypes
        from ctypes import wintypes

        user32 = ctypes.windll.user32
        hwnd = user32.GetForegroundWindow()
        if not hwnd:
            return "Desktop", "Desktop"

        pid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))

        length = user32.GetWindowTextLengthW(hwnd)
        buf = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, buf, length + 1)
        title = (buf.value or "").strip() or "Unknown"

        try:
            import psutil

            name = psutil.Process(pid.value).name()
        except Exception:
            name = title[:32] or "Unknown"

        return name, title
    except Exception:
        return "Unknown", "Unknown"


def _app_label(app: str, title: str) -> str:
    if title and title != app:
        return f"{app} · {title[:48]}"
    return app


class ActivityTracker:
    _instance: Optional["ActivityTracker"] = None

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._state: dict[str, Any] = self._load()
        self._last_app = ""
        self._last_title = ""
        self._last_label = ""
        self._ticks = 0
        self._started = False
        self._stop = threading.Event()

    @classmethod
    def get(cls) -> "ActivityTracker":
        if cls._instance is None:
            cls._instance = ActivityTracker()
        return cls._instance

    def _load(self) -> dict[str, Any]:
        if _STATE_PATH.is_file():
            try:
                return json.loads(_STATE_PATH.read_text(encoding="utf-8"))
            except Exception:
                pass
        return {"days": {}, "last_date": _today_key()}

    def _save(self) -> None:
        MODELS_DIR.mkdir(parents=True, exist_ok=True)
        _STATE_PATH.write_text(
            json.dumps(self._state, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def _ensure_day(self, key: str) -> dict[str, Any]:
        days = self._state.setdefault("days", {})
        if key not in days:
            days[key] = {
                "total_sec": 0,
                "apps": {},
                "hourly": [0] * 48,
            }
        day = days[key]
        day.setdefault("total_sec", 0)
        day.setdefault("apps", {})
        day.setdefault("hourly", [0] * 48)
        if len(day["hourly"]) < 48:
            day["hourly"] = (day["hourly"] + [0] * 48)[:48]
        return day

    def _resolve_target(self, app: str, title: str) -> tuple[str, str, str]:
        if app.lower() in _CONNOR_APPS:
            if self._last_label:
                return self._last_app, self._last_title, self._last_label
            return app, title, _app_label(app, title)
        label = _app_label(app, title)
        self._last_app = app
        self._last_title = title
        self._last_label = label
        return app, title, label

    def _tick(self, seconds: int) -> None:
        if _idle_seconds() > _IDLE_SEC:
            return

        key = _today_key()
        with self._lock:
            if self._state.get("last_date") != key:
                self._state["last_date"] = key
            day = self._ensure_day(key)
            app, title, label = _resolve_target(*_foreground_app())

            day["total_sec"] += seconds
            apps: dict[str, int] = day["apps"]
            apps[label] = int(apps.get(label, 0)) + seconds

            slot = _slot_index()
            hourly: list[int] = day["hourly"]
            hourly[slot] = int(hourly[slot]) + seconds

            self._ticks += 1
            if self._ticks % _SAVE_EVERY == 0:
                self._save()

    def _loop(self) -> None:
        logger.log_system("[Activity] трекер запущен")
        while not self._stop.is_set():
            try:
                self._tick(_POLL_SEC)
            except Exception as exc:
                logger.log_error(f"[Activity] tick: {exc}")
            self._stop.wait(_POLL_SEC)
        with self._lock:
            self._save()

    def start(self) -> None:
        if self._started:
            return
        self._started = True
        threading.Thread(target=self._loop, name="activity-tracker", daemon=True).start()

    def stop(self) -> None:
        self._stop.set()


_RU_MONTHS = (
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
)
_RU_DAYS_SHORT = ("Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс")


def get_activity_summary() -> dict[str, Any]:
    tracker = ActivityTracker.get()
    today = date.today()
    key = today.isoformat()

    with tracker._lock:
        day = tracker._ensure_day(key)
        total = int(day.get("total_sec", 0))
        apps_raw: dict[str, int] = day.get("apps") or {}
        hourly = list(day.get("hourly") or [0] * 48)
        days_state: dict[str, Any] = tracker._state.get("days") or {}

        yesterday_key = (today.fromordinal(today.toordinal() - 1)).isoformat()
        yesterday = int(days_state.get(yesterday_key, {}).get("total_sec", 0))

        week_keys: list[str] = []
        week_secs: list[int] = []
        for i in range(6, -1, -1):
            d = today.fromordinal(today.toordinal() - i)
            wk = d.isoformat()
            week_keys.append(wk)
            week_secs.append(int(days_state.get(wk, {}).get("total_sec", 0)))

        import calendar

        month_days: list[dict[str, Any]] = []
        first = today.replace(day=1)
        pad = first.weekday() % 7
        month_max = 1
        dim = calendar.monthrange(today.year, today.month)[1]
        for dnum in range(1, dim + 1):
            dkey = date(today.year, today.month, dnum).isoformat()
            sec = int(days_state.get(dkey, {}).get("total_sec", 0))
            month_max = max(month_max, sec)
            month_days.append({"day": dnum, "sec": sec, "today": dnum == today.day})

    apps = sorted(
        [{"name": k, "sec": v, "fmt": _format_duration(v)} for k, v in apps_raw.items()],
        key=lambda x: x["sec"],
        reverse=True,
    )[:8]

    diff = total - yesterday
    max_h = max(hourly) or 1
    week_max = max(week_secs) or 1
    week_avg = sum(week_secs) // max(len(week_secs), 1)

    week_start = today.fromordinal(today.toordinal() - 6)
    week_end = today

    week_ui = []
    for i, sec in enumerate(week_secs):
        d = today.fromordinal(today.toordinal() - (6 - i))
        week_ui.append(
            {
                "label": _RU_DAYS_SHORT[d.weekday()],
                "pct": max(4, int((sec / week_max) * 100)),
                "today": d == today,
                "sec": sec,
            }
        )

    def _heat(sec: int) -> int:
        if sec <= 0:
            return 0
        ratio = sec / max(month_max, 1)
        if ratio >= 0.66:
            return 2
        if ratio >= 0.33:
            return 1
        return 1 if sec > 0 else 0

    month_ui = {
        "title": _RU_MONTHS[today.month - 1],
        "pad": pad,
        "days": [
            {"heat": _heat(d["sec"]), "today": d["today"]}
            for d in month_days
        ],
    }

    return {
        "title": "Сегодня",
        "date": key,
        "total_sec": total,
        "total_fmt": _format_duration_large(total),
        "total_short": _format_duration(total),
        "avg_fmt": _format_duration(week_avg),
        "avg_label": "Среднее за день",
        "avg_range": f"{week_start.strftime('%d %b')} – {week_end.strftime('%d %b')}",
        "yesterday_sec": yesterday,
        "yesterday_fmt": _format_duration_large(yesterday),
        "diff_sec": diff,
        "diff_fmt": _format_duration(abs(diff)),
        "diff_up": diff > 0,
        "diff_label": "к вчера",
        "apps": apps,
        "hourly": hourly,
        "max_hourly": max_h,
        "week": week_ui,
        "month": month_ui,
        "current_app": tracker._last_app or "—",
        "current_title": tracker._last_title or "",
    }
