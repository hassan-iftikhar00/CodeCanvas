"""Construction artifacts — residue from the act of sketching.

This module is the realism backbone of v3. Rather than enumerating model failure
modes, it simulates artifacts that real humans leave behind when drawing:
erasure ghosts, overdrawn shapes, paper damage, abandoned attempts, fatigue
drift. The model learns that these are noise, not signal.

All generators in this module produce TIER 3 elements (faded, not annotated)
or pixel-level effects (no Element at all). Annotations come only from Tier 1
and Tier 2 elements produced by layouts.py.

Firing probability is gated by style.messiness — clean sketches see almost no
artifacts, messy sketches see clusters of them simultaneously. That correlation
is the whole point: independent injection produces unrealistic combinations of
neat geometry with chaotic noise.
"""
from __future__ import annotations

import math
import random
from typing import List

from PIL import Image, ImageDraw, ImageFilter

from .style import SketchStyle


# ---------------------------------------------------------------------------
# Tier 3 elements (drawn but never annotated).
# ---------------------------------------------------------------------------

def _fade_color(base: tuple, paper: tuple, fade: float) -> tuple:
    """Blend pen color toward paper color. fade ∈ [0,1]: 0 = solid, 1 = invisible."""
    return tuple(
        int(base[i] * (1 - fade) + paper[i] * fade)
        for i in range(3)
    )


def _draw_faded_rect(draw: ImageDraw.ImageDraw, x, y, w, h, *,
                     style: SketchStyle, fade: float, sides=(True, True, True, True),
                     angle: float = 0.0):
    """Internal: render a rectangle with optional missing sides at a given fade level."""
    from .rough import _rect_corners, _line_draw

    color = _fade_color(style.pen_color, style.paper_color, fade)
    sw = max(1.0, style.stroke_width * (0.6 + 0.4 * (1 - fade)))
    roughness = style.roughness * (1.2 - 0.4 * fade)

    corners = _rect_corners(x, y, w, h, angle)
    all_edges = [(corners[i], corners[(i + 1) % 4]) for i in range(4)]
    edges = [all_edges[i] for i in range(4) if sides[i]]
    _line_draw(draw, edges, color=color, width=sw, roughness=roughness,
               digital=style.digital, double=False)


# ---------------------------------------------------------------------------
# Pixel-level artifacts (no Element produced).
# ---------------------------------------------------------------------------

def add_erasure_ghost(img: Image.Image, style: SketchStyle):
    """Draw a faint rectangle, then blend a chunk of it toward paper color —
    simulates 'tried to erase a previously-drawn box.'"""
    w_img, h_img = img.size
    box_w = random.randint(40, max(60, w_img // 4))
    box_h = random.randint(20, max(30, h_img // 6))
    x = random.randint(8, max(9, w_img - box_w - 8))
    y = random.randint(8, max(9, h_img - box_h - 8))

    draw = ImageDraw.Draw(img)
    fade = random.uniform(0.55, 0.80)
    _draw_faded_rect(draw, x, y, box_w, box_h, style=style, fade=fade)

    # Smudge a portion of it toward paper, mimicking partial erasure.
    smudge_overlay = Image.new("RGB", img.size, style.paper_color)
    mask = Image.new("L", img.size, 0)
    mdraw = ImageDraw.Draw(mask)
    sw = random.randint(box_w // 3, box_w)
    sh = random.randint(box_h // 3, box_h)
    sx = x + random.randint(0, max(0, box_w - sw))
    sy = y + random.randint(0, max(0, box_h - sh))
    mdraw.rectangle([sx, sy, sx + sw, sy + sh], fill=random.randint(100, 200))
    mask = mask.filter(ImageFilter.GaussianBlur(radius=random.uniform(2.5, 5.0)))
    img.paste(smudge_overlay, (0, 0), mask)


def add_paper_damage(img: Image.Image, style: SketchStyle):
    """Coffee ring, fold line, or random gray blob — surface texture artifacts."""
    if style.digital:
        return  # White Konva canvas doesn't have paper damage.

    w_img, h_img = img.size
    kind = random.choice(["fold_line", "stain_blob", "dirt_spots"])

    draw = ImageDraw.Draw(img)
    base = style.paper_color
    darker = tuple(max(0, c - random.randint(25, 50)) for c in base)

    if kind == "fold_line":
        # Soft horizontal or vertical line — paper crease.
        horizontal = random.random() < 0.5
        offset = random.randint(40, h_img - 40) if horizontal else random.randint(40, w_img - 40)
        overlay = Image.new("RGB", img.size, darker)
        mask = Image.new("L", img.size, 0)
        mdraw = ImageDraw.Draw(mask)
        thickness = random.randint(3, 8)
        if horizontal:
            mdraw.rectangle([0, offset - thickness // 2, w_img, offset + thickness // 2],
                            fill=random.randint(60, 110))
        else:
            mdraw.rectangle([offset - thickness // 2, 0, offset + thickness // 2, h_img],
                            fill=random.randint(60, 110))
        mask = mask.filter(ImageFilter.GaussianBlur(radius=random.uniform(1.5, 3.0)))
        img.paste(overlay, (0, 0), mask)

    elif kind == "stain_blob":
        # Coffee-ring style soft circle.
        cx = random.randint(60, w_img - 60)
        cy = random.randint(60, h_img - 60)
        r = random.randint(30, min(90, min(w_img, h_img) // 4))
        overlay = Image.new("RGB", img.size, darker)
        mask = Image.new("L", img.size, 0)
        mdraw = ImageDraw.Draw(mask)
        mdraw.ellipse([cx - r, cy - r, cx + r, cy + r],
                      fill=random.randint(40, 90))
        mask = mask.filter(ImageFilter.GaussianBlur(radius=random.uniform(4.0, 9.0)))
        img.paste(overlay, (0, 0), mask)

    else:  # dirt_spots
        for _ in range(random.randint(4, 10)):
            sx = random.randint(0, w_img - 1)
            sy = random.randint(0, h_img - 1)
            r = random.randint(1, 3)
            draw.ellipse([sx, sy, sx + r, sy + r],
                         fill=darker)


def add_page_history(img: Image.Image, style: SketchStyle):
    """Faint partial-rectangle traces, as if a previous sketch was on the same
    page and partially erased."""
    if style.digital:
        return
    draw = ImageDraw.Draw(img)
    w_img, h_img = img.size
    n_traces = random.randint(1, 3)
    for _ in range(n_traces):
        bw = random.randint(50, max(80, w_img // 3))
        bh = random.randint(25, max(40, h_img // 6))
        x = random.randint(4, max(5, w_img - bw - 4))
        y = random.randint(4, max(5, h_img - bh - 4))
        fade = random.uniform(0.80, 0.93)
        # Random partial: usually 1–2 sides drawn from a ghost rectangle.
        sides = [random.random() < 0.5 for _ in range(4)]
        if not any(sides):
            sides[random.randint(0, 3)] = True
        _draw_faded_rect(draw, x, y, bw, bh, style=style, fade=fade,
                         sides=tuple(sides))


def add_smudge_streaks(img: Image.Image, style: SketchStyle):
    """Short ink-drag streaks — fast hand movement smearing wet ink."""
    if style.digital:
        return
    draw = ImageDraw.Draw(img)
    w_img, h_img = img.size
    for _ in range(random.randint(1, 3)):
        x1 = random.randint(0, w_img)
        y1 = random.randint(0, h_img)
        length = random.randint(15, 40)
        angle = random.uniform(0, math.tau)
        x2 = x1 + math.cos(angle) * length
        y2 = y1 + math.sin(angle) * length
        color = _fade_color(style.pen_color, style.paper_color,
                            fade=random.uniform(0.6, 0.85))
        draw.line([(x1, y1), (x2, y2)], fill=color,
                  width=max(1, int(style.stroke_width * 0.5)))


# ---------------------------------------------------------------------------
# Construction overlays (Tier 3 Elements — drawn, not annotated).
# ---------------------------------------------------------------------------

def _tier3_element(x, y, w, h, *, kind: str, angle: float = 0.0):
    """Build a Tier 3 element (faded, never annotated). Import is lazy to avoid
    a circular dependency between construction and layouts."""
    from .layouts import CLASS_CARD, Element
    el = Element(
        cls=CLASS_CARD,
        x=x, y=y, w=w, h=h,
        label="",
        angle=angle,
        naked=False,
        annotate=False,
        role=f"construction:{kind}",
        tier=3,
    )
    return el


def abandoned_shape(canvas_w, canvas_h, near_element=None) -> "Element | None":
    """Drew a box, didn't like it, crossed it out, moved on."""
    if near_element is not None and random.random() < 0.7:
        # Position near a real element (offset by 20-60 px).
        offset_x = random.choice([-1, 1]) * random.randint(20, 80)
        offset_y = random.choice([-1, 1]) * random.randint(20, 80)
        w = max(40, int(near_element.w * random.uniform(0.6, 1.1)))
        h = max(24, int(near_element.h * random.uniform(0.6, 1.1)))
        x = max(2, min(canvas_w - w - 2, int(near_element.x) + offset_x))
        y = max(2, min(canvas_h - h - 2, int(near_element.y) + offset_y))
    else:
        w = random.randint(50, 160)
        h = random.randint(28, 70)
        x = random.randint(4, max(5, canvas_w - w - 4))
        y = random.randint(4, max(5, canvas_h - h - 4))

    el = _tier3_element(x, y, w, h, kind="abandoned",
                        angle=random.uniform(-4, 4))
    el.partial_sides = (True, True, True, True)
    el.add_crossout = True
    return el


def open_rectangle(canvas_w, canvas_h) -> "Element":
    """Drew a rectangle but didn't close it — ran out of attention."""
    w = random.randint(50, 140)
    h = random.randint(26, 60)
    x = random.randint(4, max(5, canvas_w - w - 4))
    y = random.randint(4, max(5, canvas_h - h - 4))
    sides = [True, True, True, True]
    sides[random.randint(0, 3)] = False
    el = _tier3_element(x, y, w, h, kind="open",
                        angle=random.uniform(-3, 3))
    el.partial_sides = tuple(sides)
    return el


def overdrawn_twin(target_element) -> "Element | None":
    """Drew the element once, didn't like position, drew it again 5–15px off —
    the original ghost is still partially visible."""
    if target_element is None:
        return None
    dx = random.choice([-1, 1]) * random.randint(4, 14)
    dy = random.choice([-1, 1]) * random.randint(4, 14)
    sw = int(target_element.w * random.uniform(0.85, 1.05))
    sh = int(target_element.h * random.uniform(0.85, 1.05))
    el = _tier3_element(target_element.x + dx, target_element.y + dy,
                        sw, sh, kind="overdrawn",
                        angle=random.uniform(-2, 2))
    el.partial_sides = (True, True, True, True)
    el.fade_override = random.uniform(0.55, 0.78)
    return el


def afterthought_squeeze(canvas_w, canvas_h, real_elements) -> "Element | None":
    """A small element wedged into a gap between real ones — late addition."""
    if not real_elements:
        return None
    target = random.choice(real_elements)
    w = random.randint(25, 55)
    h = random.randint(16, 30)
    side = random.choice(["right", "below"])
    if side == "right":
        x = int(target.x + target.w + random.randint(2, 8))
        y = int(target.y + random.randint(0, max(0, int(target.h) - h)))
    else:
        x = int(target.x + random.randint(0, max(0, int(target.w) - w)))
        y = int(target.y + target.h + random.randint(2, 8))
    if x + w > canvas_w - 4 or y + h > canvas_h - 4 or x < 4 or y < 4:
        return None
    el = _tier3_element(x, y, w, h, kind="afterthought")
    el.partial_sides = (True, True, True, True)
    return el


def annotation_evolution(canvas_w, canvas_h, real_elements) -> "Element | None":
    """A scribble or short note next to an element — designer thinking aloud."""
    if not real_elements:
        return None
    target = random.choice(real_elements)
    label = random.choice(["?", "fix", "->", "TBD", "rev", "ok?", "30dp"])
    w = max(28, len(label) * 11)
    h = 18
    side = random.choice(["left", "right", "above"])
    if side == "left":
        x = int(target.x) - w - 6
    elif side == "right":
        x = int(target.x + target.w) + 6
    else:
        x = int(target.x + target.w / 2 - w / 2)
        y = int(target.y) - h - 6
        if y < 2:
            return None
        el = _tier3_element(x, y, w, h, kind="annotation")
        el.label_override = label
        el.partial_sides = (False, False, False, False)
        return el
    y = int(target.y + random.randint(0, max(0, int(target.h) - h)))
    if x < 2 or x + w > canvas_w - 2:
        return None
    el = _tier3_element(x, y, w, h, kind="annotation")
    el.label_override = label
    el.partial_sides = (False, False, False, False)
    return el


# ---------------------------------------------------------------------------
# Top-level entry points.
# ---------------------------------------------------------------------------

PIXEL_ARTIFACTS = [
    ("erasure_ghost", add_erasure_ghost, 0.45),
    ("paper_damage", add_paper_damage, 0.35),
    ("page_history", add_page_history, 0.30),
    ("smudge_streaks", add_smudge_streaks, 0.25),
]


def _hotspot_or_random(canvas_w: int, canvas_h: int, style: SketchStyle,
                       prefer_hotspot: bool = True) -> tuple[int, int]:
    """Sample a position, biased toward an existing hotspot if any. This makes
    construction artifacts cluster regionally instead of scattering uniformly —
    real sketches have messy *corners*, not messy *everywhere*."""
    if prefer_hotspot and style.hotspots and random.random() < 0.75:
        h = random.choice(style.hotspots)
        rx = random.uniform(-h.radius * 0.6, h.radius * 0.6)
        ry = random.uniform(-h.radius * 0.6, h.radius * 0.6)
        return (
            int(max(8, min(canvas_w - 8, h.x + rx))),
            int(max(8, min(canvas_h - 8, h.y + ry))),
        )
    return (random.randint(8, max(9, canvas_w - 8)),
            random.randint(8, max(9, canvas_h - 8)))


def add_pixel_artifacts(img: Image.Image, style: SketchStyle,
                        stats: dict | None = None) -> list[str]:
    """Apply pixel-level construction artifacts. Gated by pristine flag and
    scaled by per-image messiness — clean sketches see zero, messy ones see
    several clustered in hotspot regions."""
    applied: list[str] = []
    if style.pristine:
        return applied
    if style.messiness < 0.08:
        return applied
    scale = style.artifact_scale(base=0.25, slope=1.6)
    for kind, fn, base_p in PIXEL_ARTIFACTS:
        if random.random() < base_p * scale:
            fn(img, style)
            applied.append(kind)
            if stats is not None:
                stats[f"pixel_artifact:{kind}"] = stats.get(f"pixel_artifact:{kind}", 0) + 1
    return applied


def build_construction_overlays(canvas_w: int, canvas_h: int,
                                real_elements: list, style: SketchStyle,
                                stats: dict | None = None) -> list:
    """Generate Tier 3 Element overlays (drawn but not annotated).

    Firing probability uses local_messiness at the candidate overlay position,
    so overlays cluster inside hotspots and disappear in clean regions."""
    overlays: list = []
    if style.pristine:
        return overlays
    if style.messiness < 0.08 and not style.hotspots:
        return overlays

    peak_messiness = style.messiness + max(
        (h.boost for h in style.hotspots), default=0.0
    )
    n_max = 1
    if peak_messiness > 0.45:
        n_max = 2
    if peak_messiness > 0.75:
        n_max = 3

    for _ in range(n_max):
        kind = random.choices(
            ["abandoned", "open_rect", "overdrawn", "afterthought", "annotation"],
            weights=[3, 4, 2, 3, 3],
        )[0]
        el = None
        if kind == "abandoned":
            near = random.choice(real_elements) if real_elements and random.random() < 0.7 else None
            el = abandoned_shape(canvas_w, canvas_h, near_element=near)
        elif kind == "open_rect":
            el = open_rectangle(canvas_w, canvas_h)
        elif kind == "overdrawn":
            if real_elements:
                el = overdrawn_twin(random.choice(real_elements))
        elif kind == "afterthought":
            el = afterthought_squeeze(canvas_w, canvas_h, real_elements)
        elif kind == "annotation":
            el = annotation_evolution(canvas_w, canvas_h, real_elements)

        if el is None:
            continue

        # Position-conditional firing: artifact only spawns if local messiness
        # at its centre supports it. Clean regions of a moderately-messy image
        # stay clean.
        cx, cy = el.x + el.w / 2, el.y + el.h / 2
        local_fire_p = style.artifact_scale(base=0.20, slope=1.4, px=cx, py=cy)
        if random.random() > local_fire_p:
            continue

        overlays.append(el)
        if stats is not None:
            stats[f"overlay:{kind}"] = stats.get(f"overlay:{kind}", 0) + 1

    return overlays


def render_tier3(draw: ImageDraw.ImageDraw, el, style: SketchStyle):
    """Render a Tier 3 construction overlay element.

    Caller passes in elements returned by build_construction_overlays. This
    renders them with appropriate faintness and optional crossout / partial
    sides / labels."""
    from .rough import rough_cross, rough_text

    fade = getattr(el, "fade_override", random.uniform(0.40, 0.65))
    sides = getattr(el, "partial_sides", (True, True, True, True))

    if any(sides):
        _draw_faded_rect(draw, el.x, el.y, el.w, el.h,
                         style=style, fade=fade, sides=sides, angle=el.angle)

    if getattr(el, "add_crossout", False):
        color = _fade_color(style.pen_color, style.paper_color,
                            fade=fade * 0.8)
        rough_cross(draw, el.x, el.y, el.w, el.h,
                    color=color, width=style.stroke_width * 0.9)

    label = getattr(el, "label_override", None)
    if label:
        from .rough import measure_text
        fs = max(10, min(int(el.h * 0.55), 18))
        color = _fade_color(style.pen_color, style.paper_color, fade=fade * 0.7)
        tw, th = measure_text(label, fs, digital=style.digital)
        tx = el.x + el.w / 2 - tw / 2
        ty = el.y + el.h / 2 - th / 2
        rough_text(draw, tx, ty, label, fs, color,
                   digital=style.digital, jitter=1.5)
