"""
player_detector.py — авто-детект установленного музыкального плеера.

Вызывается один раз при старте из main.py.  Проверяет наличие Lune и
Яндекс Музыки на диске и обновляет music_backend в config.json если он
ещё не выбран вручную.

Логика:
  - Только Lune установлен          → music_backend = "lune"
  - Только Яндекс Музыка установлена → music_backend = "yandex"
  - Оба установлены, config пустой   → music_backend = "lune" (приоритет
    оффлайн-плееру) + сообщение в overlay «Оба плеера найдены. Выберите в Настройках.»
  - Ничего нет                       → не трогаем config, логируем
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

from core import logger
from core.config_loader import load_config, save_config


# ── Пути Lune ─────────────────────────────────────────────────────────────────
def _lune_paths() -> list[Path]:
    local = os.environ.get("LOCALAPPDATA", "")
    appdata = os.environ.get("APPDATA", "")
    return [
        Path(local) / "Programs" / "Lune" / "Lune.exe",
        Path(appdata) / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Lune.lnk",
    ]


def _lune_installed() -> bool:
    return any(p.exists() for p in _lune_paths())


# ── Пути Яндекс Музыки (десктопное приложение) ───────────────────────────────
def _yandex_paths() -> list[Path]:
    local = os.environ.get("LOCALAPPDATA", "")
    appdata = os.environ.get("APPDATA", "")
    return [
        # Официальное десктопное приложение Яндекс Музыки
        Path(local) / "Programs" / "YandexMusic" / "YandexMusic.exe",
        Path(local) / "YandexMusic" / "YandexMusic.exe",
        Path(local) / "Yandex" / "YandexMusic" / "YandexMusic.exe",
        # Start Menu ярлыки
        Path(appdata) / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "YandexMusic.lnk",
        Path(appdata) / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Яндекс Музыка.lnk",
    ]


def _yandex_installed() -> bool:
    return any(p.exists() for p in _yandex_paths())


# ── Публичный API ─────────────────────────────────────────────────────────────

def detect_and_apply() -> Optional[str]:
    """
    Определить установленный плеер и записать music_backend в config.json.

    Возвращает итоговое значение music_backend ('lune' | 'yandex' | None).
    Не перезаписывает config, если пользователь уже выбрал бэкенд вручную.
    """
    cfg = load_config()
    current = (cfg.get("music_backend") or "").strip().lower()

    lune = _lune_installed()
    yandex = _yandex_installed()

    logger.log_system(
        f"[PlayerDetector] Lune={lune}, Yandex={yandex}, config={current!r}"
    )

    if not lune and not yandex:
        logger.log_system(
            "[PlayerDetector] Ни один плеер не найден. "
            "Установите Lune или Яндекс Музыку."
        )
        return current or None

    # Если пользователь уже сделал осознанный выбор — не трогаем
    if current in ("lune", "yandex"):
        # Но проверяем, что выбранный плеер действительно есть
        if current == "lune" and not lune:
            logger.log_system(
                "[PlayerDetector] config=lune, но Lune не установлен — "
                "переключаю на yandex"
            )
            save_config({"music_backend": "yandex"})
            return "yandex"
        if current == "yandex" and not yandex:
            logger.log_system(
                "[PlayerDetector] config=yandex, но Яндекс Музыка не установлена — "
                "переключаю на lune"
            )
            save_config({"music_backend": "lune"})
            return "lune"
        return current

    # music_backend пуст или содержит что-то нераспознанное — авто-выбор
    if lune and not yandex:
        logger.log_system("[PlayerDetector] Авто-выбор: lune")
        save_config({"music_backend": "lune"})
        return "lune"

    if yandex and not lune:
        logger.log_system("[PlayerDetector] Авто-выбор: yandex")
        save_config({"music_backend": "yandex"})
        return "yandex"

    # Оба установлены — выбираем Lune как оффлайн-плеер по умолчанию
    logger.log_system(
        "[PlayerDetector] Найдены оба плеера — выбираю Lune по умолчанию. "
        "Для смены откройте Настройки."
    )
    save_config({"music_backend": "lune"})

    # Покажем подсказку через overlay (если уже инициализирован)
    try:
        from core.overlay import get_overlay
        ov = get_overlay()
        ov.show_text(
            "Найдены Lune и Яндекс Музыка. Выберите плеер в Настройках.",
            tag="СИСТЕМА",
            auto_hide_ms=8000,
        )
    except Exception:
        pass

    return "lune"
