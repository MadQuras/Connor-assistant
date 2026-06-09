"""system_monitor.py — CPU/RAM для overlay и dashboard."""

from __future__ import annotations

from typing import Any


def get_stats() -> dict[str, Any]:
    cpu = 0.0
    ram_pct = 0.0
    ram_used_gb = 0.0
    ram_total_gb = 0.0
    try:
        import psutil  # type: ignore

        cpu = float(psutil.cpu_percent(interval=0.2))
        mem = psutil.virtual_memory()
        ram_pct = float(mem.percent)
        ram_used_gb = mem.used / (1024**3)
        ram_total_gb = mem.total / (1024**3)
    except Exception:
        pass
    return {
        "cpu": round(cpu, 1),
        "ram_pct": round(ram_pct, 1),
        "ram_used_gb": round(ram_used_gb, 1),
        "ram_total_gb": round(ram_total_gb, 1),
    }
