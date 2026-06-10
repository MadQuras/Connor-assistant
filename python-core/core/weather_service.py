"""
weather_service.py — погода через Open-Meteo (без API-ключа).
"""

from __future__ import annotations

import json
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

_RU_DAYS = ("Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс")
_RU_DAYS_FULL = (
    "понедельник", "вторник", "среда", "четверг",
    "пятница", "суббота", "воскресенье",
)
_RU_MONTHS = (
    "янв", "фев", "мар", "апр", "май", "июн",
    "июл", "авг", "сен", "окт", "ноя", "дек",
)

import requests

from core import logger
from core.constants import MODELS_DIR
from core.proxy_guard import no_proxy_ctx

_CACHE_PATH = MODELS_DIR / "weather_cache.json"
_CACHE_TTL_SEC = 900
_GEO_URL = "https://geocoding-api.open-meteo.com/v1/search"
_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"

_WMO: dict[int, tuple[str, str, str]] = {
    0: ("Ясно", "☀", "#f9e2af"),
    1: ("Преимущественно ясно", "🌤", "#f9e2af"),
    2: ("Переменная облачность", "⛅", "#bac2de"),
    3: ("Пасмурно", "☁", "#bac2de"),
    45: ("Туман", "🌫", "#84afdb"),
    48: ("Туман", "🌫", "#84afdb"),
    51: ("Морось", "🌦", "#74c7ec"),
    53: ("Морось", "🌦", "#74c7ec"),
    55: ("Морось", "🌦", "#74c7ec"),
    61: ("Дождь", "🌧", "#74c7ec"),
    63: ("Дождь", "🌧", "#74c7ec"),
    65: ("Ливень", "🌧", "#74c7ec"),
    71: ("Снег", "❄", "#cdd6f4"),
    73: ("Снег", "❄", "#cdd6f4"),
    75: ("Снег", "❄", "#cdd6f4"),
    80: ("Ливень", "🌧", "#74c7ec"),
    81: ("Ливень", "🌧", "#74c7ec"),
    82: ("Ливень", "🌧", "#74c7ec"),
    95: ("Гроза", "⛈", "#f9e2af"),
    96: ("Гроза", "⛈", "#f9e2af"),
    99: ("Гроза", "⛈", "#f9e2af"),
}


def extract_city(text: str, default: str = "Москва") -> str:
    """«погода в Казани» → Казань."""
    low = (text or "").lower().strip()
    for pat in (
        r"погод[а-яё]*\s+в\s+(.+)",
        r"прогноз\s+в\s+(.+)",
        r"погод[а-яё]*\s+(.+)",
        r"в\s+(.+?)\s+погод",
    ):
        m = re.search(pat, low, re.IGNORECASE)
        if m:
            city = m.group(1).strip(" .,!?")
            city = re.sub(
                r"^(какая|какой|скажи|покажи|узнай|как)\s+",
                "",
                city,
                flags=re.IGNORECASE,
            ).strip()
            if city and len(city) > 1:
                return city[:1].upper() + city[1:]
    return default


def _wmo(code: int) -> tuple[str, str, str]:
    return _WMO.get(code, ("Облачно", "☁", "#bac2de"))


def _geocode(city: str) -> Optional[tuple[float, float, str]]:
    with no_proxy_ctx():
        r = requests.get(
            _GEO_URL,
            params={"name": city, "count": 1, "language": "ru", "format": "json"},
            timeout=12,
        )
    r.raise_for_status()
    results = r.json().get("results") or []
    if not results:
        return None
    hit = results[0]
    name = hit.get("name") or city
    admin = hit.get("admin1") or ""
    label = f"{name}, {admin}".strip(", ") if admin else name
    return float(hit["latitude"]), float(hit["longitude"]), label


def fetch_weather(city: str = "Москва", *, force: bool = False) -> Optional[dict[str, Any]]:
    """Получить погоду; кэш 15 мин."""
    city = (city or "Москва").strip()
    if not force and _CACHE_PATH.is_file():
        try:
            cached = json.loads(_CACHE_PATH.read_text(encoding="utf-8"))
            if (
                cached.get("city_query", "").lower() == city.lower()
                and time.time() - cached.get("fetched_at", 0) < _CACHE_TTL_SEC
            ):
                return cached
        except Exception:
            pass

    try:
        geo = _geocode(city)
        if not geo:
            logger.log_error(f"[Weather] город не найден: {city}")
            return None
        lat, lon, label = geo
        params = {
            "latitude": lat,
            "longitude": lon,
            "current": (
                "temperature_2m,relative_humidity_2m,apparent_temperature,"
                "precipitation,weather_code,wind_speed_10m"
            ),
            "hourly": "temperature_2m,weather_code",
            "daily": "weather_code,temperature_2m_max,temperature_2m_min",
            "timezone": "auto",
            "forecast_days": 5,
        }
        with no_proxy_ctx():
            r = requests.get(_FORECAST_URL, params=params, timeout=15)
        r.raise_for_status()
        data = r.json()
        cur = data.get("current") or {}
        code = int(cur.get("weather_code", 3))
        desc, icon, accent = _wmo(code)

        hourly_raw = data.get("hourly") or {}
        h_times = hourly_raw.get("time") or []
        h_temps = hourly_raw.get("temperature_2m") or []
        h_codes = hourly_raw.get("weather_code") or []
        hourly_by_date: dict[str, list[dict[str, Any]]] = {}
        for i, t in enumerate(h_times):
            day_key = t[:10] if len(t) >= 10 else ""
            if not day_key:
                continue
            hh = t[11:16] if len(t) >= 16 else t
            c = int(h_codes[i]) if i < len(h_codes) else code
            d, ic, hx = _wmo(c)
            hourly_by_date.setdefault(day_key, []).append(
                {
                    "time": hh,
                    "temp": round(float(h_temps[i])) if i < len(h_temps) else 0,
                    "icon": ic,
                    "desc": d,
                    "hex": hx,
                }
            )

        daily_raw = data.get("daily") or {}
        d_dates = daily_raw.get("time") or []
        d_max = daily_raw.get("temperature_2m_max") or []
        d_min = daily_raw.get("temperature_2m_min") or []
        d_codes = daily_raw.get("weather_code") or []

        forecast: list[dict[str, Any]] = []
        now = datetime.now()
        for i, d_key in enumerate(d_dates[:5]):
            try:
                dt = datetime.strptime(d_key, "%Y-%m-%d")
            except ValueError:
                dt = now
            dc = int(d_codes[i]) if i < len(d_codes) else code
            dd, dic, dhex = _wmo(dc)
            day_h = hourly_by_date.get(d_key, [])
            forecast.append(
                {
                    "id": i,
                    "day": _RU_DAYS[dt.weekday()],
                    "day_full": _RU_DAYS_FULL[dt.weekday()],
                    "date": f"{dt.day:02d} {_RU_MONTHS[dt.month - 1]}",
                    "max": round(float(d_max[i])) if i < len(d_max) else 0,
                    "min": round(float(d_min[i])) if i < len(d_min) else 0,
                    "desc": dd,
                    "icon": dic,
                    "hex": dhex,
                    "hourly": day_h,
                }
            )

        today_hourly = forecast[0]["hourly"] if forecast else []

        result: dict[str, Any] = {
            "city_query": city,
            "city": label,
            "temp": round(float(cur.get("temperature_2m", 0))),
            "feels": round(float(cur.get("apparent_temperature", 0))),
            "humidity": int(cur.get("relative_humidity_2m", 0)),
            "wind_kmh": round(float(cur.get("wind_speed_10m", 0))),
            "precip_mm": float(cur.get("precipitation", 0)),
            "desc": desc,
            "icon": icon,
            "accent_hex": accent,
            "current_icon": icon,
            "current_hex": accent,
            "hourly": today_hourly,
            "forecast": forecast,
            "fetched_at": time.time(),
        }
        MODELS_DIR.mkdir(parents=True, exist_ok=True)
        _CACHE_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        logger.log_system(f"[Weather] {label}: {result['temp']}°C, {desc}")
        return result
    except Exception as e:
        logger.log_error(f"[Weather] fetch: {e}")
        return None
