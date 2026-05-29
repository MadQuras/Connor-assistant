from __future__ import annotations

import subprocess

from core import audio_catalog

_WEATHER_URL = "https://yandex.ru/pogoda/moscow"


def handle(arg: str, original_text: str = "") -> None:
    try:
        subprocess.Popen(["cmd", "/c", "start", "", _WEATHER_URL], shell=False)
    except Exception as e:
        print(f"[Weather] browser open failed: {e}")

    # 10% chance, rotates: audio_12 → audio_13 → audio_12 → …
    audio_catalog.maybe_play("weather", "weather", "weather_done", block=False)
