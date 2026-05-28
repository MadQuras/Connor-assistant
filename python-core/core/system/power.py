from __future__ import annotations

import ctypes
import subprocess

from core.config_loader import load_config


def lock_workstation() -> None:
    ctypes.windll.user32.LockWorkStation()


def shutdown_pc(delay_sec: int = 10) -> None:
    if not load_config().get("allow_shutdown", True):
        print("[Power] Shutdown blocked by config")
        return
    subprocess.Popen(["shutdown", "/s", "/t", str(delay_sec)], shell=False)


def abort_shutdown() -> None:
    subprocess.Popen(["shutdown", "/a"], shell=False)
