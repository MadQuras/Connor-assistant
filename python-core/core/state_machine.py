from __future__ import annotations

import threading
from dataclasses import dataclass, field
from typing import Callable, Optional

from core.constants import ConnorState, COMMAND_TIMEOUT_SEC
from core.config_loader import load_config


@dataclass
class StateMachine:
    state: ConnorState = ConnorState.SLEEPING
    _timer: Optional[threading.Timer] = field(default=None, repr=False)
    on_state_change: Optional[Callable[[ConnorState, ConnorState], None]] = None

    def _timeout_sec(self) -> float:
        return float(load_config().get("command_timeout_sec", COMMAND_TIMEOUT_SEC))

    def _set(self, new: ConnorState) -> None:
        old = self.state
        if old == new:
            return
        self.state = new
        print(f"[State] {old.value} -> {new.value}")
        if self.on_state_change:
            self.on_state_change(old, new)

    def _cancel_timer(self) -> None:
        if self._timer:
            self._timer.cancel()
            self._timer = None

    def _arm_timer(self) -> None:
        self._cancel_timer()
        self._timer = threading.Timer(self._timeout_sec(), self._on_timeout)
        self._timer.daemon = True
        self._timer.start()

    def _on_timeout(self) -> None:
        print("[State] Command timeout")
        self._set(ConnorState.SLEEPING)

    def on_wake(self) -> None:
        self._set(ConnorState.AWAKENED)
        self._arm_timer()

    def on_command_start(self) -> None:
        self._cancel_timer()
        self._set(ConnorState.PROCESSING)

    def on_empty_transcription(self) -> None:
        self._set(ConnorState.AWAKENED)
        self._arm_timer()

    def on_command_complete(self) -> None:
        self._cancel_timer()
        self._set(ConnorState.SLEEPING)

    def on_sleep_command(self) -> None:
        self._cancel_timer()
        self._set(ConnorState.SLEEPING)

    def set_listening(self) -> None:
        self._set(ConnorState.LISTENING)

    def set_responding(self) -> None:
        self._set(ConnorState.RESPONDING)

    def is_accepting_command(self) -> bool:
        return self.state in (ConnorState.AWAKENED, ConnorState.LISTENING)

    def close(self) -> None:
        self._cancel_timer()
