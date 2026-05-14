from __future__ import annotations

import math
import random

from PIL import ImageDraw

from .style import SketchStyle, load_font


def _wobble_line(draw, p1, p2, *, color, width, roughness):
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


def _sharp_line(draw, p1, p2, *, color, width):
    draw.line([p1, p2], fill=color, width=max(1, int(round(width))))


def _rect_corners(x, y, w, h, angle_deg: float = 0.0):
    corners = [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
    if abs(angle_deg) < 0.05:
        return corners
    cx, cy = x + w / 2, y + h / 2
    rad = math.radians(angle_deg)
    cos_r, sin_r = math.cos(rad), math.sin(rad)
    out = []
    for px, py in corners:
        dx, dy = px - cx, py - cy
        out.append((cx + dx * cos_r - dy * sin_r,
                    cy + dx * sin_r + dy * cos_r))
    return out


def aabb_of_rotated_rect(x, y, w, h, angle_deg: float):
    if abs(angle_deg) < 0.05:
        return x, y, w, h
    corners = _rect_corners(x, y, w, h, angle_deg)
    xs = [c[0] for c in corners]
    ys = [c[1] for c in corners]
    return min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys)


def clip_bbox_to_canvas(x, y, w, h, canvas_w, canvas_h):
    """Clip an axis-aligned bbox to canvas bounds. Returns None if degenerate."""
    x1 = max(0.0, x)
    y1 = max(0.0, y)
    x2 = min(float(canvas_w), x + w)
    y2 = min(float(canvas_h), y + h)
    if x2 - x1 < 1 or y2 - y1 < 1:
        return None
    return x1, y1, x2 - x1, y2 - y1


def _line_draw(draw, edges, *, color, width, roughness, digital, double):
    if digital or roughness < 0.05:
        for a, b in edges:
            _sharp_line(draw, a, b, color=color, width=width)
        return
    passes = 2 if double else 1
    for _ in range(passes):
        for a, b in edges:
            _wobble_line(draw, a, b, color=color, width=width, roughness=roughness)


def rough_rect(draw: ImageDraw.ImageDraw, x, y, w, h, style: SketchStyle,
               angle: float = 0.0, *, color_override=None):
    color = color_override if color_override is not None else style.pen_color
    sw = style.stroke_width
    corners = _rect_corners(x, y, w, h, angle)
    edges = [(corners[i], corners[(i + 1) % 4]) for i in range(4)]
    _line_draw(draw, edges, color=color, width=sw, roughness=style.roughness,
               digital=style.digital, double=style.double_stroke)


def rough_rect_partial(draw, x, y, w, h, style: SketchStyle, sides: tuple,
                       angle: float = 0.0, *, color_override=None):
    """Draw only specified sides — for incomplete rectangles."""
    color = color_override if color_override is not None else style.pen_color
    sw = style.stroke_width
    corners = _rect_corners(x, y, w, h, angle)
    all_edges = [(corners[i], corners[(i + 1) % 4]) for i in range(4)]
    edges = [all_edges[i] for i in range(4) if sides[i]]
    _line_draw(draw, edges, color=color, width=sw, roughness=style.roughness,
               digital=style.digital, double=style.double_stroke)


def rough_text(draw: ImageDraw.ImageDraw, x, y, text: str, size: int,
               color: tuple, *, digital: bool = False, jitter: float = 1.0):
    font = load_font(size, digital=digital)
    if digital:
        draw.text((x, y), text, font=font, fill=color)
        return
    jx = random.uniform(-jitter, jitter)
    jy = random.uniform(-jitter, jitter)
    draw.text((x + jx, y + jy), text, font=font, fill=color)


def rough_scribble(draw, x, y, w, h, *, color, width, segments=None):
    """Random short stroke inside a region — decorative noise."""
    segments = segments or random.randint(3, 6)
    pts = []
    cx, cy = x + w / 2, y + h / 2
    for _ in range(segments):
        pts.append((cx + random.uniform(-w / 2, w / 2),
                    cy + random.uniform(-h / 2, h / 2)))
    if len(pts) >= 2:
        draw.line(pts, fill=color, width=max(1, int(round(width))), joint="curve")


def rough_cross(draw, x, y, w, h, *, color, width):
    """Draw an X mark inside a rectangle (cross-out)."""
    sw = max(1, int(round(width)))
    pad = min(w, h) * 0.1
    draw.line([(x + pad, y + pad), (x + w - pad, y + h - pad)],
              fill=color, width=sw)
    draw.line([(x + w - pad, y + pad), (x + pad, y + h - pad)],
              fill=color, width=sw)


def rough_arrow(draw, p1, p2, *, color, width):
    """Simple arrow with arrowhead."""
    sw = max(1, int(round(width)))
    draw.line([p1, p2], fill=color, width=sw)
    angle = math.atan2(p2[1] - p1[1], p2[0] - p1[0])
    head_len = 10 + width
    head_angle = math.radians(30)
    h1 = (p2[0] - head_len * math.cos(angle - head_angle),
          p2[1] - head_len * math.sin(angle - head_angle))
    h2 = (p2[0] - head_len * math.cos(angle + head_angle),
          p2[1] - head_len * math.sin(angle + head_angle))
    draw.line([p2, h1], fill=color, width=sw)
    draw.line([p2, h2], fill=color, width=sw)


def measure_text(text: str, size: int, *, digital: bool):
    """Return tight (w, h) bounds of rendered text — used for naked-text bboxes."""
    from PIL import Image
    font = load_font(size, digital=digital)
    img = Image.new("RGB", (1, 1))
    d = ImageDraw.Draw(img)
    bbox = d.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def zigzag_text_lines(draw: ImageDraw.ImageDraw, x: float, y: float,
                      w: float, h: float, style: SketchStyle,
                      *, line_spacing: int | None = None,
                      amplitude: float = 2.5):
    """Fill a card region with horizontal zigzag lines — the real sketching
    convention for paragraph / body-text content in hand-drawn wireframes.

    Each line has a randomized width (mimics text wrap) and slight per-line
    variation. The output IS the card content; the card's bbox stays the same.
    """
    pad_x = max(4, int(w * 0.06))
    pad_y = max(3, int(h * 0.10))
    inner_x = x + pad_x
    inner_w = w - 2 * pad_x
    inner_y = y + pad_y
    inner_h = h - 2 * pad_y
    if inner_w < 16 or inner_h < 8:
        return

    if line_spacing is None:
        line_spacing = max(7, int(inner_h / max(2, min(6, int(inner_h / 11)))))

    color = style.pen_color
    width = max(1, int(round(style.stroke_width * 0.7)))

    line_y = inner_y
    line_idx = 0
    while line_y + amplitude * 2 <= inner_y + inner_h:
        # Final line often shorter, mid lines closer to full width.
        is_last = (line_y + line_spacing + amplitude * 2 > inner_y + inner_h)
        if is_last:
            line_w = inner_w * random.uniform(0.30, 0.75)
        else:
            line_w = inner_w * random.uniform(0.65, 1.0)

        n_segments = max(4, int(line_w / 7))
        pts = []
        for j in range(n_segments + 1):
            t = j / n_segments
            px = inner_x + t * line_w
            py = line_y + (amplitude if j % 2 == 0 else -amplitude)
            if not style.digital:
                px += random.uniform(-0.6, 0.6)
                py += random.uniform(-0.6, 0.6)
            pts.append((px, py))
        if len(pts) >= 2:
            draw.line(pts, fill=color, width=width, joint="curve")

        line_y += line_spacing + random.uniform(-0.5, 0.5)
        line_idx += 1
        if line_idx > 24:
            break


def placeholder_image_mark(draw: ImageDraw.ImageDraw, x: float, y: float,
                           w: float, h: float, style: SketchStyle):
    """Draw a large X through a rectangle — sketching convention for an
    image placeholder. The card outline must already be drawn separately;
    this only adds the cross."""
    pad = min(w, h) * 0.05
    color = style.pen_color
    sw = max(1, int(round(style.stroke_width)))

    if style.digital or style.roughness < 0.05:
        draw.line([(x + pad, y + pad), (x + w - pad, y + h - pad)],
                  fill=color, width=sw)
        draw.line([(x + w - pad, y + pad), (x + pad, y + h - pad)],
                  fill=color, width=sw)
        return

    _wobble_line(draw, (x + pad, y + pad), (x + w - pad, y + h - pad),
                 color=color, width=sw, roughness=style.roughness)
    _wobble_line(draw, (x + w - pad, y + pad), (x + pad, y + h - pad),
                 color=color, width=sw, roughness=style.roughness)
