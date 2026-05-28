"""
logger.py — real-time event log written to models/logs.jsonl.

Each line is a JSON object:
  {"ts": "15:16:30", "type": "STT"|"WAKE"|"ROUTE"|"HANDLER"|"SYSTEM"|"ERROR", "text": "..."}

The Tauri frontend polls read_logs() every 2 s and shows the last 50 entries.
Max file size is capped at ~200 KB by rotating when >2000 lines.
"""
from __future__ import annotations

import json
import threading
from datetime import datetime
from pathlib import Path

from core.constants import MODELS_DIR

_LOG_FILE = MODELS_DIR / "logs.jsonl"
_MAX_LINES = 2000
_KEEP_LINES = 1500   # keep this many after rotation
_lock = threading.Lock()


def _now() -> str:
    return datetime.now().strftime("%H:%M:%S")


def _write(entry: dict) -> None:
    with _lock:
        try:
            _LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
            # ensure_ascii=True keeps the file ASCII-safe for cross-platform reading;
            # Russian text is preserved as \uXXXX escapes which JSON.parse decodes fine.
            with _LOG_FILE.open("a", encoding="utf-8") as f:
                f.write(json.dumps(entry, ensure_ascii=True) + "\n")
            _rotate_if_needed()
        except Exception as exc:
            print(f"[Logger] write error: {exc}")


def _rotate_if_needed() -> None:
    try:
        lines = _LOG_FILE.read_text("utf-8").splitlines()
        if len(lines) > _MAX_LINES:
            _LOG_FILE.write_text(
                "\n".join(lines[-_KEEP_LINES:]) + "\n", "utf-8"
            )
    except Exception:
        pass


# ── Public API ────────────────────────────────────────────────

def log_stt(text: str) -> None:
    _write({"ts": _now(), "type": "STT", "text": text})


def log_wake(text: str, matched: bool) -> None:
    _write({"ts": _now(), "type": "WAKE", "text": f"{'✓' if matched else '✗'} {text}"})


def log_route(category: str, arg: str, via: str = "") -> None:
    suffix = f" [{via}]" if via else ""
    _write({"ts": _now(), "type": "ROUTE", "text": f"{category} ← {arg!r}{suffix}"})


def log_handler(category: str, result: str = "ok") -> None:
    _write({"ts": _now(), "type": "HANDLER", "text": f"{category} → {result}"})


def log_system(msg: str) -> None:
    _write({"ts": _now(), "type": "SYSTEM", "text": msg})


def log_error(msg: str) -> None:
    _write({"ts": _now(), "type": "ERROR", "text": msg})
