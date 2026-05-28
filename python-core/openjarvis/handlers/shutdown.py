from __future__ import annotations

from core import audio_catalog
from core.config_loader import load_config
from core.overlay import get_overlay
from core.system.power import shutdown_pc


def _confirm_shutdown() -> bool:
    try:
        import tkinter as tk
        from tkinter import messagebox

        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        ok = messagebox.askyesno("Connor", "Вы уверены, что хотите выключить компьютер?")
        root.destroy()
        return bool(ok)
    except Exception as e:
        print(f"[Shutdown] confirm dialog failed: {e}")
        return False


def handle(arg: str, original_text: str = "") -> None:
    cfg = load_config()
    auto = bool(cfg.get("auto_confirm_dangerous_commands", False))
    ov = get_overlay()

    if auto:
        ov.show_text("Автоподтверждение включено. Выключаю компьютер")
        audio_catalog.play_key("shutdown_do")
        shutdown_pc(delay_sec=5)
        return

    ov.show_text(audio_catalog.phrase("shutdown", "audio_19.wav") or "Подтвердите выключение")
    audio_catalog.play_key("shutdown_warn", block=False)  # non-blocking so dialog appears promptly
    if _confirm_shutdown():
        audio_catalog.play_key("shutdown_do")
        shutdown_pc(delay_sec=10)
    else:
        # audio_01: "Ваш приказ противоречил моим инструкциям" — plays only on denial
        ov.show_text("Ваш приказ противоречил моим инструкциям. Выключение отменено", tag="КОННОР")
        try:
            from core import tts_player
            from core.constants import AUDIO_DIR
            tts_player.play_named("system", "audio_01.wav", block=False)
        except Exception:
            pass
