from core.system.apps_launcher import launch_app
from core.system.volume_control import set_volume_relative, set_volume_percent
from core.system.power import lock_workstation, shutdown_pc

__all__ = [
    "launch_app",
    "set_volume_relative",
    "set_volume_percent",
    "lock_workstation",
    "shutdown_pc",
]
