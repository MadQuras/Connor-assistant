from __future__ import annotations

import subprocess
import time
import urllib.parse

import pyautogui

from core.config_loader import load_config
from core.ocr.find_click import find_text_click_point

WINDOW_HINTS = ("yandex", "яндекс", "music.yandex", "музыка")


class YandexMusicPlayer:
    def _home_url(self) -> str:
        return load_config().get("yandex_music_url", "https://music.yandex.ru")

    def _open_url(self, url: str) -> None:
        subprocess.Popen(["cmd", "/c", "start", "", url], shell=False)

    def _focus_window(self) -> bool:
        try:
            import pygetwindow as gw

            for w in gw.getAllWindows():
                title = (w.title or "").lower()
                if any(h in title for h in WINDOW_HINTS):
                    w.activate()
                    time.sleep(0.4)
                    return True
        except Exception as e:
            print(f"[YandexMusic] focus: {e}")
        return False

    def ensure_open(self) -> bool:
        if self._focus_window():
            return True
        self._open_url(self._home_url())
        time.sleep(3.5)
        return self._focus_window()

    def play_pause(self) -> None:
        self.ensure_open()
        pyautogui.press("playpause")

    def next_track(self) -> None:
        self.ensure_open()
        pyautogui.press("nexttrack")

    def prev_track(self) -> None:
        self.ensure_open()
        pyautogui.press("prevtrack")

    def search_and_play(self, query: str) -> bool:
        if not query.strip():
            return False
        url = f"{self._home_url().rstrip('/')}/search?text={urllib.parse.quote(query)}"
        self._open_url(url)
        time.sleep(4.0)
        if not self._focus_window():
            return False

        pyautogui.press("enter")
        time.sleep(0.8)

        pt = find_text_click_point("слушать", "play", "воспроиз", "трек")
        if pt:
            pyautogui.click(pt[0], pt[1])
            return True

        pyautogui.press("enter")
        return True
