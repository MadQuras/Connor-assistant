from __future__ import annotations

import subprocess

from core import audio_catalog
from core.config_loader import load_config
from core.weather_service import extract_city

# Slug для yandex.ru/pogoda/{slug}
_YANDEX_SLUGS = {
    "москва": "moscow",
    "moscow": "moscow",
    "санкт-петербург": "saint-petersburg",
    "спб": "saint-petersburg",
    "петербург": "saint-petersburg",
    "казань": "kazan",
    "новосибирск": "novosibirsk",
    "екатеринбург": "yekaterinburg",
}


def _yandex_slug(city: str) -> str:
    key = city.lower().strip()
    return _YANDEX_SLUGS.get(key, "moscow")


def yandex_weather_url(city: str | None = None) -> str:
    cfg = load_config()
    name = (city or cfg.get("weather_city") or "Москва").strip()
    slug = _yandex_slug(name)
    return f"https://yandex.ru/pogoda/{slug}"


def handle(arg: str, original_text: str = "") -> None:
    city = extract_city(original_text or arg)
    url = yandex_weather_url(city)

    try:
        subprocess.Popen(["cmd", "/c", "start", "", url], shell=False)
    except Exception as e:
        print(f"[Weather] browser open failed: {e}")

    audio_catalog.maybe_play("weather", "weather", "weather_done", block=False)
