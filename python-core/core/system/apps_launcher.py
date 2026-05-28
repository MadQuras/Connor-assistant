from __future__ import annotations

import os
import shutil
import subprocess

APP_MAP = {
    "chrome": "chrome",
    "хром": "chrome",
    "яндекс": "msedge",
    "браузер": "msedge",
    "блокнот": "notepad",
    "notepad": "notepad",
    "steam": "steam",
    "стим": "steam",
    "дота": "steam",
    "dota": "steam",
    "калькулятор": "calc",
    "calc": "calc",
    "загрузки": "downloads",
    "документы": "documents",
}


def resolve_name(spoken: str) -> str:
    key = spoken.lower().strip()
    return APP_MAP.get(key, key)


def launch_app(name: str) -> bool:
    target = resolve_name(name)
    if target == "calc":
        subprocess.Popen(["calc.exe"], shell=False)
        return True
    if target == "notepad":
        subprocess.Popen(["notepad.exe"], shell=False)
        return True
    if target == "downloads":
        os.startfile(os.path.join(os.path.expanduser("~"), "Downloads"))
        return True
    if target == "documents":
        os.startfile(os.path.join(os.path.expanduser("~"), "Documents"))
        return True

    exe = shutil.which(target)
    if exe:
        subprocess.Popen([exe], shell=False)
        return True

    try:
        os.startfile(target)
        return True
    except OSError:
        pass

    try:
        subprocess.Popen(f'start "" "{target}"', shell=True)
        return True
    except OSError:
        return False
