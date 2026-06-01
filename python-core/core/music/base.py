from __future__ import annotations

from typing import Protocol

from core.config_loader import load_config


class MusicPlayer(Protocol):
    def ensure_open(self) -> bool: ...
    def play_pause(self) -> None: ...
    def pause(self) -> None: ...
    def resume(self) -> None: ...
    def next_track(self) -> bool: ...
    def prev_track(self) -> bool: ...
    def search_and_play(self, query: str) -> bool: ...


def get_player() -> MusicPlayer:
    backend = (load_config().get("music_backend") or "lune").strip().lower()
    if backend in ("yandex", "яндекс", "yandex_music"):
        from core.music.yandex import YandexMusicPlayer
        return YandexMusicPlayer()
    from core.music.lune import LuneMusicPlayer
    return LuneMusicPlayer()
