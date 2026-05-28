"""
registry.py — реестр category -> handler callable.

HANDLERS = {
  "APPS": apps.handle,
  "MUSIC": music.handle,
  ...
}

get_handler(category: str) -> Callable
"""

from __future__ import annotations

from typing import Callable, Dict

from openjarvis.handlers import (
    apps,
    lock,
    music,
    plans,
    search,
    shutdown,
    time_cmd,
    unknown,
    volume,
    weather,
)

HandlerFn = Callable[..., None]

HANDLERS: Dict[str, HandlerFn] = {
    "APPS": apps.handle,
    "MUSIC": music.handle,
    "SEARCH": search.handle,
    "WEATHER": weather.handle,
    "PLANS": plans.handle,
    "TIME": time_cmd.handle,
    "VOLUME": volume.handle,
    "LOCK": lock.handle,
    "SHUTDOWN": shutdown.handle,
    "UNKNOWN": unknown.handle,
}


def get_handler(category: str) -> HandlerFn:
    return HANDLERS.get(category.upper(), unknown.handle)
