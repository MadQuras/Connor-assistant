from __future__ import annotations

from ctypes import POINTER, cast

from comtypes import CLSCTX_ALL
from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume


def _interface():
    dev = AudioUtilities.GetSpeakers()
    iface = dev.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
    return cast(iface, POINTER(IAudioEndpointVolume))


def set_volume_relative(delta: float) -> int:
    vol = _interface()
    cur = vol.GetMasterVolumeLevelScalar()
    new = max(0.0, min(1.0, cur + delta))
    vol.SetMasterVolumeLevelScalar(new, None)
    return int(new * 100)


def set_volume_percent(percent: int) -> None:
    vol = _interface()
    vol.SetMasterVolumeLevelScalar(max(0, min(100, percent)) / 100.0, None)
