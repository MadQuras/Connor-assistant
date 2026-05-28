from __future__ import annotations

import os
import subprocess

from core import audio_catalog
from core.config_loader import load_config
from core.overlay import get_overlay
from core.storage.memory_store import MemoryStore
from core.system.apps_launcher import launch_app

GAME_HINTS = ("игра", "game", "dota", "дота", "steam", "стим")


def _open_folder(path: str) -> bool:
    if not path or not os.path.exists(path):
        return False
    os.startfile(path)
    return True


def _clear_recycle_bin() -> bool:
    try:
        subprocess.run(
            ["powershell", "-NoProfile", "-Command",
             "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"],
            check=False, capture_output=True, text=True,
        )
        return True
    except Exception:
        return False


def handle(arg: str, original_text: str = "") -> None:
    ov = get_overlay()
    query = (arg or original_text or "").strip()
    low = query.lower()

    if "корзин" in low and ("очист" in low or "очисти" in low):
        if not _clear_recycle_bin():
            ov.show_text("Не удалось очистить корзину", tag="ОШИБКА", auto_hide_ms=6000)
            audio_catalog.play_key("error_unknown")
        return

    if any(x in low for x in ("загрузк", "загруз")):
        _open_folder(os.path.join(os.path.expanduser("~"), "Downloads"))
        return

    if "документ" in low and "рабоч" not in low:
        _open_folder(os.path.join(os.path.expanduser("~"), "Documents"))
        return

    if "рабоч" in low:
        path = load_config().get("working_folder_path", "")
        if not _open_folder(path):
            ov.show_text(
                "Рабочая папка не настроена.\nУкажите путь в настройках Коннора.",
                tag="ОШИБКА", auto_hide_ms=8000,
            )
            audio_catalog.play_key("error_unknown")
        return

    if not query:
        ov.show_text("Какое приложение открыть?", tag="КОННОР", auto_hide_ms=6000)
        audio_catalog.play_key("error_unknown")
        return

    ok = launch_app(query)
    if ok:
        d = MemoryStore().load()
        d["last_app"] = query
        MemoryStore().save(d)
        is_game = any(hint in low for hint in GAME_HINTS)
        if is_game:
            audio_catalog.play_key("game_open", block=False)   # audio_17: "Игра найдена. Запускаю"
            audio_catalog.play_key("game_done", block=False)   # audio_05: "Готово. Приложение запущено"
        else:
            audio_catalog.play_key("app_open", block=False)    # audio_03: "Приложение найдено. Открываю"
        audio_catalog.play_key("app_executing", block=False)   # audio_02: "Выполняю, хотя андроиды справились бы лучше"
    else:
        ov.show_text(
            f"Приложение «{query}» не найдено.\nПопробуйте запустить сканирование.",
            tag="ОШИБКА", auto_hide_ms=8000,
        )
        audio_catalog.play_key("error_unknown")
