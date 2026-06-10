#!/usr/bin/env python3
"""
source-rk800.raw.png:
  icon.ico       — desktop (256px полный кадр; 16–48px zoom для панели задач)
  taskbar-icon.png — трей (raw as-is)
  window-icon.png / app-icon.ico — exe + set_icon
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ICONS = ROOT / "tauri-front" / "src-tauri" / "icons"
SRC_RAW = ICONS / "source-rk800.raw.png"
MASTER = 1024
ICON_PX = 256
PANEL_CROP_FRAC = 0.36

PNG_SIZES = {
    "32x32.png": 32,
    "64x64.png": 64,
    "128x128.png": 128,
    "128x128@2x.png": 256,
    "256x256.png": 256,
}

SQUARE_SIZES = {
    "Square30x30Logo.png": 30,
    "Square44x44Logo.png": 44,
    "Square71x71Logo.png": 71,
    "Square89x89Logo.png": 89,
    "Square107x107Logo.png": 107,
    "Square142x142Logo.png": 142,
    "Square150x150Logo.png": 150,
    "Square284x284Logo.png": 284,
    "Square310x310Logo.png": 310,
    "StoreLogo.png": 50,
}

STALE = (
    "source-rk800.png",
    "source-taskbar.png",
    "source-taskbar.raw.png",
    "desktop-icon.ico",
    "desktop-icon.png",
    "tray-icon.png",
    "icon.icns",
    "bundle-icon.ico",
)


def _purge_stale() -> None:
    for name in STALE:
        path = ICONS / name
        if path.is_file():
            path.unlink()
            print(f"  removed stale: {name}")


def fit_to_square(im: Image.Image, side: int) -> Image.Image:
    w, h = im.size
    scale = side / max(w, h)
    nw = max(1, int(round(w * scale)))
    nh = max(1, int(round(h * scale)))
    scaled = im.resize((nw, nh), Image.LANCZOS)
    out = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    out.paste(scaled, ((side - nw) // 2, (side - nh) // 2), scaled)
    return out


def center_crop_square(im: Image.Image, frac: float) -> Image.Image:
    side = im.width
    crop = max(1, int(round(side * frac)))
    x0 = (side - crop) // 2
    y0 = (side - crop) // 2
    cropped = im.crop((x0, y0, x0 + crop, y0 + crop))
    return cropped.resize((side, side), Image.LANCZOS)


def _save_ico_hybrid(desktop: Image.Image, panel: Image.Image, dest: Path) -> None:
    """Большие слои — desktop; 16–48 px — panel (Windows / ярлык AppID)."""
    px_sizes = sorted({16, 24, 32, 48, 64, 128, 256}, reverse=True)
    layers = [
        (panel if s <= 48 else desktop).resize((s, s), Image.LANCZOS) for s in px_sizes
    ]
    layers[0].save(
        dest,
        format="ICO",
        sizes=[im.size for im in layers],
        append_images=layers[1:],
    )


def _save_ico(base: Image.Image, dest: Path) -> None:
    px_sizes = sorted({16, 24, 32, 48, 64, 128, 256}, reverse=True)
    layers = [base.resize((s, s), Image.LANCZOS) for s in px_sizes]
    layers[0].save(
        dest,
        format="ICO",
        sizes=[im.size for im in layers],
        append_images=layers[1:],
    )


def main() -> None:
    if not SRC_RAW.is_file():
        raise SystemExit(f"Нет {SRC_RAW.name}")

    print(f"Icons: {SRC_RAW.name}")
    _purge_stale()

    src = Image.open(SRC_RAW).convert("RGBA")
    print(f"  input: {src.size[0]}x{src.size[1]}")

    desktop = fit_to_square(src, MASTER)
    panel = center_crop_square(desktop, PANEL_CROP_FRAC)

    desktop.save(ICONS / "icon.png")
    desktop.resize((ICON_PX, ICON_PX), Image.LANCZOS).save(ICONS / "taskbar-icon.png")
    panel.resize((ICON_PX, ICON_PX), Image.LANCZOS).save(ICONS / "window-icon.png")

    # icon.ico: desktop на 256, zoom на 16–48 (ярлык + AppUserModelID → панель задач)
    _save_ico_hybrid(desktop, panel, ICONS / "icon.ico")
    _save_ico(panel, ICONS / "app-icon.ico")

    for name, size in {**PNG_SIZES, **SQUARE_SIZES}.items():
        src_img = panel if size <= 128 else desktop
        src_img.resize((size, size), Image.LANCZOS).save(ICONS / name)

    print("  icon.ico         -> desktop 256 + taskbar 16-48 (hybrid)")
    print("  taskbar-icon.png -> system tray")
    print("  window-icon.png  -> HWND set_icon + app-icon.ico exe")
    print("OK: refresh_taskbar_icon.bat")


if __name__ == "__main__":
    main()
