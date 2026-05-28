from __future__ import annotations

import subprocess
import threading
import time

from core import audio_catalog

_WEATHER_URL = "https://yandex.ru/pogoda/moscow"


def handle(arg: str, original_text: str = "") -> None:
    try:
        subprocess.Popen(["cmd", "/c", "start", "", _WEATHER_URL], shell=False)
    except Exception as e:
        print(f"[Weather] browser open failed: {e}")

    # Play audio_12, then audio_13 after a short delay
    audio_catalog.play_key("weather", block=False)          # audio_12: "Получил данные о погоде..."

    def _play_done() -> None:
        time.sleep(1.0)
        audio_catalog.play_key("weather_done", block=False) # audio_13: "Метеосводка готова..."

    threading.Thread(target=_play_done, name="weather-audio-done", daemon=True).start()
