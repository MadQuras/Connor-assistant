"""dismiss.py — handler «отойди пока» (FSM переключает pipeline)."""

from __future__ import annotations

# FSM переключается в pipeline._enter_dismiss() до/вместо dispatch.


def handle(arg: str, original_text: str = "") -> None:
    pass
