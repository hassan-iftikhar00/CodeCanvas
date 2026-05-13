from __future__ import annotations

import random
from dataclasses import dataclass
from pathlib import Path

from PIL import ImageFont


PEN_COLORS = [
    (20, 20, 20),
    (35, 40, 55),
    (15, 35, 80),
    (55, 55, 55),
    (40, 25, 15),
    (25, 25, 90),
]

PAPER_COLORS = [
    (252, 252, 250),
    (250, 248, 240),
    (245, 245, 240),
    (252, 250, 235),
    (248, 250, 252),
    (255, 253, 245),
]

FONT_CANDIDATES = [
    "C:/Windows/Fonts/segoesc.ttf",
    "C:/Windows/Fonts/segoepr.ttf",
    "C:/Windows/Fonts/comic.ttf",
    "C:/Windows/Fonts/comicbd.ttf",
    "C:/Windows/Fonts/inkfree.ttf",
    "C:/Windows/Fonts/BRADHITC.TTF",
    "C:/Windows/Fonts/ITCKRIST.TTF",
]


@dataclass
class SketchStyle:
    pen_color: tuple
    paper_color: tuple
    stroke_width: float
    roughness: float
    double_stroke: bool
    ruled: bool
    grid: bool


def random_style() -> SketchStyle:
    return SketchStyle(
        pen_color=random.choice(PEN_COLORS),
        paper_color=random.choice(PAPER_COLORS),
        stroke_width=random.uniform(1.4, 3.0),
        roughness=random.uniform(0.9, 2.2),
        double_stroke=random.random() < 0.55,
        ruled=random.random() < 0.12,
        grid=random.random() < 0.08,
    )


_font_cache: dict[int, ImageFont.FreeTypeFont] = {}
_resolved_font: str | None = None


def _resolve_font() -> str | None:
    global _resolved_font
    if _resolved_font is not None:
        return _resolved_font or None
    for candidate in FONT_CANDIDATES:
        if Path(candidate).exists():
            _resolved_font = candidate
            return candidate
    _resolved_font = ""
    return None


def load_font(size: int) -> ImageFont.ImageFont:
    if size in _font_cache:
        return _font_cache[size]
    path = _resolve_font()
    if path:
        try:
            font = ImageFont.truetype(path, size)
            _font_cache[size] = font
            return font
        except Exception:
            pass
    font = ImageFont.load_default()
    _font_cache[size] = font
    return font
