"""
player_detector.py — авто-детект установленного музыкального плеера.

Вызывается один раз при старте из main.py.  Проверяет наличие Lune,
Яндекс Музыки и Spotify на диске и обновляет music_backend в config.json
если он ещё не выбран вручную.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

from core import logger
from core.config_loader import load_config, save_config

_VALID_BACKENDS = ("lune", "yandex", "spotify")
_FALLBACK_ORDER = ("spotify", "yandex", "lune")


def _lune_paths() -> list[Path]:
    local = os.environ.get("LOCALAPPDATA", "")
    appdata = os.environ.get("APPDATA", "")
    return [
        Path(local) / "Programs" / "Lune" / "Lune.exe",
        Path(appdata) / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Lune.lnk",
    ]


def _lune_installed() -> bool:
    return any(p.exists() for p in _lune_paths())


def _yandex_paths() -> list[Path]:
    local = os.environ.get("LOCALAPPDATA", "")
    appdata = os.environ.get("APPDATA", "")
    return [
        Path(local) / "Programs" / "YandexMusic" / "YandexMusic.exe",
        Path(local) / "YandexMusic" / "YandexMusic.exe",
        Path(local) / "Yandex" / "YandexMusic" / "YandexMusic.exe",
        Path(appdata) / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "YandexMusic.lnk",
        Path(appdata) / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Яндекс Музыка.lnk",
    ]


def _yandex_installed() -> bool:
    return any(p.exists() for p in _yandex_paths())


def _spotify_installed() -> bool:
    exe = Path(os.environ.get("APPDATA", "")) / "Spotify" / "Spotify.exe"
    return exe.is_file()


def _installed_backends() -> list[str]:
    found: list[str] = []
    if _lune_installed():
        found.append("lune")
    if _yandex_installed():
        found.append("yandex")
    if _spotify_installed():
        found.append("spotify")
    return found


def _pick_auto_backend(installed: list[str]) -> str:
    if len(installed) == 1:
        return installed[0]
    if "lune" in installed:
        return "lune"
    if "spotify" in installed:
        return "spotify"
    return "yandex"


def _pick_fallback(installed: list[str]) -> str:
    for name in _FALLBACK_ORDER:
        if name in installed:
            return name
    return installed[0]


def detect_and_apply() -> Optional[str]:
    """
    Определить установленный плеер и записать music_backend в config.json.

    Возвращает итоговое значение music_backend ('lune' | 'yandex' | 'spotify' | None).
    Не перезаписывает config, если пользователь уже выбрал бэкенд вручную.
    """
    cfg = load_config()
    current = (cfg.get("music_backend") or "").strip().lower()
    installed = _installed_backends()

    logger.log_system(
        f"[PlayerDetector] installed={installed}, config={current!r}"
    )

    if not installed:
        logger.log_system(
            "[PlayerDetector] Ни один плеер не найден. "
            "Установите Lune, Яндекс Музыку или Spotify."
        )
        return current or None

    if current in _VALID_BACKENDS:
        if current in installed:
            return current
        fallback = _pick_fallback(installed)
        logger.log_system(
            f"[PlayerDetector] config={current}, но плеер не установлен — "
            f"переключаю на {fallback}"
        )
        save_config({"music_backend": fallback})
        return fallback

    chosen = _pick_auto_backend(installed)
    logger.log_system(f"[PlayerDetector] Авто-выбор: {chosen}")
    save_config({"music_backend": chosen})

    if len(installed) > 1:
        names = {
            "lune": "Lune",
            "yandex": "Яндекс Музыка",
            "spotify": "Spotify",
        }
        found = ", ".join(names[b] for b in installed)
        try:
            from core.overlay import get_overlay

            get_overlay().show_text(
                f"Найдены плееры: {found}. Выберите в Настройках.",
                tag="СИСТЕМА",
                auto_hide_ms=8000,
            )
        except Exception:
            pass

    return chosen
