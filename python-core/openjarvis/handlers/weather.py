from __future__ import annotations

from core import audio_catalog, logger
from core.overlay import get_overlay
from core.weather_service import extract_city, fetch_weather


def handle(arg: str, original_text: str = "") -> None:
    city = (arg or "").strip() or extract_city(original_text or arg)
    data = fetch_weather(city)
    if data:
        get_overlay().show_weather(data, auto_hide_ms=12000)
    else:
        logger.log_error(f"[Weather] нет данных для {city}")
        get_overlay().show_text(
            f"Не удалось получить погоду для {city}",
            tag="ПОГОДА",
            auto_hide_ms=8000,
        )

    audio_catalog.maybe_play("weather", "weather", "weather_done", block=False)
