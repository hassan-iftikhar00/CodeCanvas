"""Bbox sanity — never write an invalid YOLO label."""
from __future__ import annotations


MIN_NORM_SIZE = 0.012   # ≈ 8px at 640px stretch — anything smaller is undetectable


def yolo_line(cls: int, ax: float, ay: float, aw: float, ah: float,
              canvas_w: int, canvas_h: int) -> str | None:
    """Return a YOLO label line or None if the bbox is invalid.

    Caller must already have clipped the AABB to canvas bounds and applied any
    annotator jitter. This is the final gate."""
    if canvas_w <= 0 or canvas_h <= 0:
        return None
    if aw <= 0 or ah <= 0:
        return None
    cx = (ax + aw / 2) / canvas_w
    cy = (ay + ah / 2) / canvas_h
    nw = aw / canvas_w
    nh = ah / canvas_h
    if not (0.0 < cx < 1.0 and 0.0 < cy < 1.0):
        return None
    if nw < MIN_NORM_SIZE or nh < MIN_NORM_SIZE:
        return None
    if nw > 1.0 or nh > 1.0:
        return None
    # Strict: bbox must fit inside [0, 1].
    if cx - nw / 2 < 0 or cx + nw / 2 > 1 or cy - nh / 2 < 0 or cy + nh / 2 > 1:
        return None
    return f"{cls} {cx:.6f} {cy:.6f} {nw:.6f} {nh:.6f}"


def jitter_bbox(x: float, y: float, w: float, h: float,
                *, max_xy: float = 2.0, max_wh: float = 3.0) -> tuple:
    """Apply small annotator-style jitter. Matches realistic human bbox noise
    (±2 px center, ±3 px size) — NOT hostile noise."""
    import random
    return (
        x + random.uniform(-max_xy, max_xy),
        y + random.uniform(-max_xy, max_xy),
        w + random.uniform(-max_wh, max_wh),
        h + random.uniform(-max_wh, max_wh),
    )


def salience_miss(area_norm: float) -> bool:
    """Simulated annotator miss rate, function of element size only (not class).

    Real annotators miss small objects more often. Capped at 10%."""
    import random
    if area_norm < 0.004:
        return random.random() < 0.10
    if area_norm < 0.015:
        return random.random() < 0.04
    return False
