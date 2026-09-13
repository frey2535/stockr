#!/usr/bin/env python3
"""Resize public/logo-512.png into Android mipmaps and a dark splash."""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public" / "logo-512.png"
RES = ROOT / "android" / "app" / "src" / "main" / "res"
NAVY = (13, 17, 23, 255)

SIZES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}

SPLASH = {
    "drawable": (480, 800),
    "drawable-port-mdpi": (320, 480),
    "drawable-port-hdpi": (480, 800),
    "drawable-port-xhdpi": (720, 1280),
    "drawable-port-xxhdpi": (960, 1600),
    "drawable-port-xxxhdpi": (1280, 1920),
    "drawable-land-mdpi": (480, 320),
    "drawable-land-hdpi": (800, 480),
    "drawable-land-xhdpi": (1280, 720),
    "drawable-land-xxhdpi": (1600, 960),
    "drawable-land-xxxhdpi": (1920, 1280),
}


def main() -> None:
    src = Image.open(SRC).convert("RGBA")
    for folder, size in SIZES.items():
        dest = RES / folder
        dest.mkdir(parents=True, exist_ok=True)
        icon = src.resize((size, size), Image.Resampling.LANCZOS)
        icon.save(dest / "ic_launcher.png")
        icon.save(dest / "ic_launcher_round.png")
        # Foreground sits on adaptive background; keep a little padding
        pad = int(size * 0.18)
        inner = src.resize((size - pad * 2, size - pad * 2), Image.Resampling.LANCZOS)
        fg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        fg.paste(inner, (pad, pad), inner)
        fg.save(dest / "ic_launcher_foreground.png")

    mark = src.resize((256, 256), Image.Resampling.LANCZOS)
    for folder, (w, h) in SPLASH.items():
        dest = RES / folder
        dest.mkdir(parents=True, exist_ok=True)
        canvas = Image.new("RGBA", (w, h), NAVY)
        x = (w - mark.width) // 2
        y = (h - mark.height) // 2
        canvas.paste(mark, (x, y), mark)
        canvas.save(dest / "splash.png")

    print("Wrote Android icons and splash from public/logo-512.png")


if __name__ == "__main__":
    main()
