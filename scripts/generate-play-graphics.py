#!/usr/bin/env python3
"""Write Play Console feature graphic and phone screenshots (stdlib only)."""

from __future__ import annotations

import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "store" / "google-play" / "en-US" / "images"


def png(path: Path, width: int, height: int, pixel) -> None:
    raw = bytearray()
    for y in range(height):
        raw.append(0)
        for x in range(width):
            raw.extend(pixel(x, y))
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    path.write_bytes(
        b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")
    )


def lerp(a: int, b: int, t: float) -> int:
    return int(a + (b - a) * t)


GLYPHS = {
    "S": ["11110", "10000", "11110", "00001", "11110"],
    "T": ["11111", "00100", "00100", "00100", "00100"],
    "O": ["01110", "10001", "10001", "10001", "01110"],
    "C": ["01111", "10000", "10000", "10000", "01111"],
    "K": ["10001", "10010", "11100", "10010", "10001"],
    "R": ["11110", "10001", "11110", "10010", "10001"],
}


def paint_text(px: dict[tuple[int, int], tuple[int, int, int]], text: str, origin_x: int, origin_y: int, scale: int, color: tuple[int, int, int]) -> None:
    cursor = origin_x
    for ch in text:
        glyph = GLYPHS.get(ch)
        if not glyph:
            cursor += 3 * scale
            continue
        for row, bits in enumerate(glyph):
            for col, bit in enumerate(bits):
                if bit != "1":
                    continue
                for dy in range(scale):
                    for dx in range(scale):
                        px[(cursor + col * scale + dx, origin_y + row * scale + dy)] = color
        cursor += 6 * scale


FEATURE_PIXELS: dict[tuple[int, int], tuple[int, int, int]] = {}
paint_text(FEATURE_PIXELS, "STOCKR", 72, 170, 14, (248, 250, 252))


def feature(x: int, y: int) -> bytes:
    painted = FEATURE_PIXELS.get((x, y))
    if painted:
        return bytes(painted)
    t = x / 1023
    r, g, b = lerp(11, 20, t), lerp(31, 70, t), lerp(58, 40, t)
    if 70 <= y <= 430 and 48 <= x <= 976:
        r, g, b = lerp(r, 255, 0.06), lerp(g, 255, 0.06), lerp(b, 255, 0.06)
    if 300 <= y <= 308:
        return bytes((245, 158, 11))
    return bytes((r, g, b))


def phone(title_band: tuple[int, int], accent: tuple[int, int, int]):
    def pixel(x: int, y: int) -> bytes:
        if y < 140:
            return bytes(accent)
        if title_band[0] <= y <= title_band[1]:
            return bytes((248, 250, 252))
        if 420 <= y <= 1500 and 80 <= x <= 1000:
            row = (y - 420) // 180
            if row % 2 == 0 and 80 <= x <= 1000:
                return bytes((241, 245, 249))
            return bytes((255, 255, 255))
        return bytes((248, 250, 252))

    return pixel


def main() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    png(ROOT / "feature-graphic-1024x500.png", 1024, 500, feature)
    png(ROOT / "phone-dashboard.png", 1080, 1920, phone((160, 280), (11, 31, 58)))
    png(ROOT / "phone-scanner.png", 1080, 1920, phone((160, 280), (20, 70, 40)))
    png(ROOT / "phone-inventory.png", 1080, 1920, phone((160, 280), (58, 31, 11)))
    print(f"Wrote graphics in {ROOT}")


if __name__ == "__main__":
    main()
