from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from pathlib import Path

from PIL import ImageFont


HAND_PEN_COLORS = [
    (20, 20, 20),
    (35, 40, 55),
    (15, 35, 80),
    (55, 55, 55),
    (40, 25, 15),
    (25, 25, 90),
    (10, 30, 60),
]

DIGITAL_PEN_COLORS = [
    (30, 30, 30),
    (50, 50, 60),
    (60, 60, 60),
    (40, 50, 90),
    (20, 20, 20),
]

ACCENT_PEN_COLORS = [
    (160, 30, 30),
    (30, 90, 160),
    (40, 100, 40),
    (130, 60, 130),
]

PAPER_COLORS_HAND = [
    (252, 252, 250),
    (250, 248, 240),
    (245, 245, 240),
    (252, 250, 235),
    (248, 250, 252),
    (255, 253, 245),
]

HAND_FONTS = [
    "C:/Windows/Fonts/segoesc.ttf",
    "C:/Windows/Fonts/segoepr.ttf",
    "C:/Windows/Fonts/comic.ttf",
    "C:/Windows/Fonts/comicbd.ttf",
    "C:/Windows/Fonts/inkfree.ttf",
    "C:/Windows/Fonts/BRADHITC.TTF",
    "C:/Windows/Fonts/ITCKRIST.TTF",
]

CLEAN_FONTS = [
    "C:/Windows/Fonts/segoeui.ttf",
    "C:/Windows/Fonts/arial.ttf",
    "C:/Windows/Fonts/calibri.ttf",
    "C:/Windows/Fonts/tahoma.ttf",
    "C:/Windows/Fonts/verdana.ttf",
]


@dataclass
class Hotspot:
    """A region of locally elevated messiness within an image.

    Real sketches are not uniformly noisy — corrections cluster in one corner,
    erasures in another. Hotspots model that: artifact generators query
    SketchStyle.local_messiness(x, y) at the position they're painting and see
    elevated values inside hotspot regions, baseline elsewhere.
    """
    x: float
    y: float
    radius: float
    boost: float


@dataclass
class SketchStyle:
    mode: str
    pen_color: tuple
    accent_color: tuple | None
    paper_color: tuple
    stroke_width: float
    roughness: float
    double_stroke: bool
    ruled: bool
    grid: bool
    digital: bool
    pen_variant: str
    # Categorical style type matching the three real-data styles in Shahwaiz's
    # Roboflow dataset: "clean" (Type A — clean structured UI), "dense_hand"
    # (Type B — hand-drawn with zigzag text + crossed image placeholders),
    # "sparse_sketch" (Type C — early-stage wireframe). Drives rendering
    # decisions in layouts.py.
    style_type: str = "clean"
    # Repurposed: now expresses density / expressiveness *within* a style type,
    # not human-correction-noise. Higher values inside dense_hand → more cards
    # per section + more zigzag fills. Inside clean → near-zero.
    messiness: float = 0.3
    # Regional density variation (one section busier than another).
    hotspots: list[Hotspot] = field(default_factory=list)
    # True iff zero artifacts/decorations should be drawn (Type A defaults to
    # this; other types occasionally).
    pristine: bool = False

    def local_messiness(self, px: float, py: float) -> float:
        """Messiness at a given canvas position. Sum of base + hotspot falloff,
        clamped to [0, 1]."""
        if self.pristine:
            return 0.0
        m = self.messiness
        for h in self.hotspots:
            dx = px - h.x
            dy = py - h.y
            dist2 = dx * dx + dy * dy
            r2 = h.radius * h.radius
            if dist2 < r2:
                falloff = 1.0 - math.sqrt(dist2) / h.radius
                m += h.boost * falloff
        return max(0.0, min(1.0, m))

    def artifact_scale(self, base: float = 0.4, slope: float = 1.4,
                       px: float | None = None, py: float | None = None) -> float:
        """Probability multiplier for artifact generators. If px/py provided,
        uses local_messiness at that position; otherwise uses base scalar."""
        if self.pristine:
            return 0.0
        m = self.local_messiness(px, py) if px is not None and py is not None else self.messiness
        return base + slope * m

    def intensity_scale(self, base: float = 0.7, slope: float = 0.6) -> float:
        """Magnitude multiplier for jitter / fade / noise intensity."""
        if self.pristine:
            return base
        return base + slope * self.messiness


STYLE_TYPE_WEIGHTS = [("clean", 40), ("dense_hand", 40), ("sparse_sketch", 20)]

# Per-type biases. Each type produces images consistent with one of the three
# real-data styles, instead of every image being a continuous blend.
TYPE_BIAS = {
    "clean": {
        "pristine_prob": 0.55,
        "digital_prob": 0.85,
        "messiness_max": 0.18,
    },
    "dense_hand": {
        "pristine_prob": 0.05,
        "digital_prob": 0.10,
        "messiness_max": 0.85,
    },
    "sparse_sketch": {
        "pristine_prob": 0.18,
        "digital_prob": 0.20,
        "messiness_max": 0.55,
    },
}


def _sample_type() -> str:
    names = [t for t, _ in STYLE_TYPE_WEIGHTS]
    weights = [w for _, w in STYLE_TYPE_WEIGHTS]
    return random.choices(names, weights=weights)[0]


def _sample_messiness() -> float:
    return random.betavariate(2, 5)


def _sample_hotspots(canvas_w: int, canvas_h: int, base_messiness: float) -> list[Hotspot]:
    """Sample 0–2 hotspots based on base messiness. Higher messiness → more
    likely to also have localized hotspots."""
    if canvas_w <= 0 or canvas_h <= 0:
        return []
    if base_messiness < 0.12:
        weights = [85, 13, 2]
    elif base_messiness < 0.35:
        weights = [55, 35, 10]
    else:
        weights = [25, 50, 25]
    n = random.choices([0, 1, 2], weights=weights)[0]
    hotspots: list[Hotspot] = []
    diag = math.hypot(canvas_w, canvas_h)
    for _ in range(n):
        hotspots.append(Hotspot(
            x=random.uniform(canvas_w * 0.15, canvas_w * 0.85),
            y=random.uniform(canvas_h * 0.15, canvas_h * 0.85),
            radius=random.uniform(diag * 0.10, diag * 0.22),
            boost=random.uniform(0.25, 0.55),
        ))
    return hotspots


def random_style(canvas_w: int = 0, canvas_h: int = 0,
                 style_type: str | None = None) -> SketchStyle:
    """Sample a style. The categorical style_type drives all downstream
    decisions so each image cleanly inhabits one of the three real-data styles
    (clean / dense_hand / sparse_sketch) instead of being a continuous blend."""
    if style_type is None:
        style_type = _sample_type()
    bias = TYPE_BIAS[style_type]

    is_pristine = random.random() < bias["pristine_prob"]
    if is_pristine:
        messiness = 0.0
        hotspots: list[Hotspot] = []
    else:
        messiness = min(_sample_messiness(), bias["messiness_max"])
        hotspots = _sample_hotspots(canvas_w, canvas_h, messiness)

    use_digital = random.random() < bias["digital_prob"]

    if use_digital:
        return SketchStyle(
            mode="digital",
            pen_color=random.choice(DIGITAL_PEN_COLORS),
            accent_color=random.choice(ACCENT_PEN_COLORS) if (not is_pristine and random.random() < 0.10) else None,
            paper_color=(255, 255, 255),
            stroke_width=random.uniform(1.5, 3.0),
            roughness=messiness * 0.3,
            double_stroke=False,
            ruled=False,
            grid=False,
            digital=True,
            pen_variant="fineliner",
            style_type=style_type,
            messiness=messiness,
            hotspots=hotspots,
            pristine=is_pristine,
        )

    if style_type == "sparse_sketch":
        pen_variant = random.choices(
            ["pencil", "ballpoint", "fineliner"], weights=[4, 4, 2]
        )[0]
    else:
        pen_variant = random.choices(
            ["ballpoint", "marker", "pencil", "fineliner"], weights=[5, 2, 2, 3]
        )[0]

    if pen_variant == "marker":
        stroke_width = random.uniform(3.0, 5.0)
        roughness = random.uniform(0.6, 1.2) + 0.6 * messiness
        double_stroke = False
    elif pen_variant == "pencil":
        stroke_width = random.uniform(1.0, 1.8)
        roughness = random.uniform(1.4, 2.5) + 0.4 * messiness
        double_stroke = random.random() < 0.7
    elif pen_variant == "fineliner":
        stroke_width = random.uniform(1.3, 2.0)
        roughness = random.uniform(0.8, 1.6) + 0.5 * messiness
        double_stroke = random.random() < 0.4
    else:
        stroke_width = random.uniform(1.6, 2.8)
        roughness = random.uniform(1.0, 2.0) + 0.5 * messiness
        double_stroke = random.random() < 0.55

    return SketchStyle(
        mode="hand",
        pen_color=random.choice(HAND_PEN_COLORS),
        accent_color=random.choice(ACCENT_PEN_COLORS) if (not is_pristine and random.random() < 0.12) else None,
        paper_color=random.choice(PAPER_COLORS_HAND),
        stroke_width=stroke_width,
        roughness=roughness,
        double_stroke=double_stroke,
        ruled=random.random() < (0.04 + 0.12 * messiness) and not is_pristine,
        grid=random.random() < (0.02 + 0.08 * messiness) and not is_pristine,
        digital=False,
        pen_variant=pen_variant,
        style_type=style_type,
        messiness=messiness,
        hotspots=hotspots,
        pristine=is_pristine,
    )


_hand_cache: dict[int, ImageFont.ImageFont] = {}
_clean_cache: dict[int, ImageFont.ImageFont] = {}
_resolved_hand: str | None = None
_resolved_clean: str | None = None


def _first_existing(paths) -> str | None:
    for p in paths:
        if Path(p).exists():
            return p
    return None


def load_font(size: int, *, digital: bool = False) -> ImageFont.ImageFont:
    global _resolved_hand, _resolved_clean
    cache = _clean_cache if digital else _hand_cache
    if size in cache:
        return cache[size]
    if digital:
        if _resolved_clean is None:
            _resolved_clean = _first_existing(CLEAN_FONTS) or ""
        path = _resolved_clean or None
    else:
        if _resolved_hand is None:
            _resolved_hand = _first_existing(HAND_FONTS) or ""
        path = _resolved_hand or None
    if path:
        try:
            font = ImageFont.truetype(path, size)
            cache[size] = font
            return font
        except Exception:
            pass
    font = ImageFont.load_default()
    cache[size] = font
    return font


def text_bounds(text: str, size: int, *, digital: bool):
    """Return (w, h) of the rendered text at the given size."""
    from PIL import Image, ImageDraw
    font = load_font(size, digital=digital)
    img = Image.new("RGB", (1, 1))
    draw = ImageDraw.Draw(img)
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]
