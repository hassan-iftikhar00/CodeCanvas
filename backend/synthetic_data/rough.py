from __future__ import annotations

import math
import random

from PIL import Image, ImageDraw

from .style import SketchStyle, load_font


def _wobble_line(draw: ImageDraw.ImageDraw, p1, p2, *, color, width, roughness):
    x1, y1 = p1
    x2, y2 = p2
    length = math.hypot(x2 - x1, y2 - y1)
    if length < 1:
        return

    segments = max(8, int(length / 18))
    max_off = roughness * (length / 220 + 1.4)
    end_jitter = roughness * 1.3

    sx = x1 + random.uniform(-end_jitter, end_jitter)
    sy = y1 + random.uniform(-end_jitter, end_jitter)
    ex = x2 + random.uniform(-end_jitter, end_jitter)
    ey = y2 + random.uniform(-end_jitter, end_jitter)

    dx, dy = (ex - sx) / length, (ey - sy) / length
    px, py = -dy, dx

    points = [(sx, sy)]
    prev_off = 0.0
    for i in range(1, segments):
        t = i / segments
        bx = sx + (ex - sx) * t
        by = sy + (ey - sy) * t
        off = prev_off * 0.6 + random.uniform(-max_off, max_off) * 0.4
        points.append((bx + px * off, by + py * off))
        prev_off = off
    points.append((ex, ey))

    draw.line(points, fill=color, width=max(1, int(round(width))), joint="curve")


def rough_rect(draw: ImageDraw.ImageDraw, x, y, w, h, style: SketchStyle):
    color = style.pen_color
    sw = style.stroke_width
    r = style.roughness
    corners = [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
    edges = [(corners[i], corners[(i + 1) % 4]) for i in range(4)]
    passes = 2 if style.double_stroke else 1
    for _ in range(passes):
        for a, b in edges:
            _wobble_line(draw, a, b, color=color, width=sw, roughness=r)


def rough_text(draw: ImageDraw.ImageDraw, x, y, text: str, size: int,
               color: tuple, jitter: float = 1.2):
    font = load_font(size)
    jx = random.uniform(-jitter, jitter)
    jy = random.uniform(-jitter, jitter)
    draw.text((x + jx, y + jy), text, font=font, fill=color)


def rough_circle(draw: ImageDraw.ImageDraw, cx, cy, radius,
                 *, color, width, roughness):
    steps = max(24, int(radius * 1.5))
    points = []
    start_angle = random.uniform(0, math.tau)
    for i in range(steps + 1):
        t = i / steps
        a = start_angle + t * math.tau
        r = radius + random.uniform(-roughness * 1.2, roughness * 1.2)
        points.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    draw.line(points, fill=color, width=max(1, int(round(width))), joint="curve")
