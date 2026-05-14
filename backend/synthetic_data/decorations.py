"""Unannotated decorative noise — trains the model NOT to hallucinate cards.

Every function returns a list of Element objects with annotate=False. They are
drawn on the image but NOT written to YOLO labels — exactly the "hard negative"
training signal that addresses the 46 FP card issue.
"""
from __future__ import annotations

import random
from typing import List

from .layouts import (CLASS_CARD, Element, FOOTER_LABELS, HEADING_LABELS,
                      NAV_LABELS, PARAGRAPH_LABELS)


DECORATION_KINDS = [
    "page_title_outside",
    "footnote_outside",
    "side_note",
    "scribble_arrow",
    "crossed_card",
    "ghost_rect",
    "dimension_arrow",
    "random_scribble",
]

PAGE_TITLE_TEXTS = [
    "Wireframe v2", "Mock-up", "Sketch v1", "Draft",
    "Login Screen", "Landing Page", "Dashboard",
    "Page 1", "Screen 3", "Final design",
]
SIDE_NOTE_TEXTS = [
    "TODO", "fix later", "?", "check this",
    "needs revision", "see fig 2", "30px", "rounded",
    "blue", "primary", "<-- here", "centered",
]


def _decoration(x, y, w, h, *, label="", role="decoration", kind="generic"):
    """Build an Element flagged as non-annotated decoration."""
    el = Element(
        cls=CLASS_CARD,
        x=x, y=y, w=w, h=h,
        label=label,
        angle=random.uniform(-3, 3) if random.random() < 0.4 else 0.0,
        annotate=False,
        role=role,
        decoration_kind=kind,
    )
    return el


def page_title_outside(canvas_w, canvas_h, top_margin) -> Element:
    """Text rendered above any container — looks like a heading but isn't a card."""
    label = random.choice(PAGE_TITLE_TEXTS)
    y = max(2, top_margin - 24)
    h = 22
    w = min(canvas_w * 0.5, 240)
    x = random.choice([
        8,
        (canvas_w - w) / 2,
        canvas_w - w - 8,
    ])
    return _decoration(x, y, w, h, label=label, role="page_title",
                       kind="page_title_outside")


def footnote_outside(canvas_w, canvas_h, bot_margin) -> Element:
    """Tiny annotation below any container."""
    label = random.choice(["* draft", "v0.3", "p.1", "see notes",
                           "rev. 2", "shahwaiz/dev"])
    y = min(canvas_h - 4, bot_margin + 4)
    h = 16
    w = 140
    x = random.choice([6, canvas_w - w - 6])
    return _decoration(x, y, w, h, label=label, role="footnote",
                       kind="footnote_outside")


def side_note(canvas_w, canvas_h, container_x, container_y, container_w,
              container_h) -> Element | None:
    """Handwritten note in the page margin, near a container."""
    label = random.choice(SIDE_NOTE_TEXTS)
    h = 18
    w = max(36, len(label) * 9)
    on_left = container_x > w + 12
    on_right = (canvas_w - container_x - container_w) > w + 12
    if on_left and (not on_right or random.random() < 0.5):
        x = container_x - w - 8
    elif on_right:
        x = container_x + container_w + 8
    else:
        return None
    y = container_y + random.randint(0, max(1, container_h - h))
    return _decoration(x, y, w, h, label=label, role="side_note",
                       kind="side_note")


def crossed_card_inside_section(sx, sy, sw, sh) -> Element:
    """A rectangle drawn then crossed out — should NOT be detected as a card."""
    w = random.randint(60, min(140, max(60, sw - 20)))
    h = random.randint(28, min(60, max(28, sh - 20)))
    x = sx + random.randint(10, max(11, sw - w - 10))
    y = sy + random.randint(10, max(11, sh - h - 10))
    return _decoration(x, y, w, h, role="crossed", kind="crossed_card")


def ghost_rect_inside_section(sx, sy, sw, sh) -> Element:
    """An incomplete rectangle (3 sides only) — should NOT be detected."""
    w = random.randint(50, min(120, max(50, sw - 20)))
    h = random.randint(24, min(50, max(24, sh - 20)))
    x = sx + random.randint(10, max(11, sw - w - 10))
    y = sy + random.randint(10, max(11, sh - h - 10))
    sides = [True, True, True, True]
    sides[random.randint(0, 3)] = False
    el = _decoration(x, y, w, h, role="ghost", kind="ghost_rect")
    el.partial_sides = tuple(sides)
    return el


def random_scribble(canvas_w, canvas_h) -> Element:
    """Random doodle stroke somewhere in the margins."""
    w = random.randint(30, 80)
    h = random.randint(20, 50)
    x = random.randint(0, canvas_w - w)
    y = random.randint(0, canvas_h - h)
    return _decoration(x, y, w, h, role="scribble", kind="random_scribble")


def dimension_arrow(canvas_w, canvas_h) -> Element:
    """An arrow with a small text annotation — like a designer's dimension mark."""
    horizontal = random.random() < 0.5
    if horizontal:
        w = random.randint(80, 180)
        h = 20
    else:
        w = 30
        h = random.randint(80, 180)
    x = random.randint(0, canvas_w - w)
    y = random.randint(0, canvas_h - h)
    el = _decoration(x, y, w, h, label=random.choice(["32px", "100%", "16dp"]),
                     role="dimension", kind="dimension_arrow")
    el.arrow_horizontal = horizontal
    return el


def add_decorations(containers: List[Element], cards: List[Element],
                    canvas_w: int, canvas_h: int) -> List[Element]:
    """Decide which decorations to apply to this image. Returns a list of
    non-annotated Elements that the renderer will draw."""
    decorations: List[Element] = []
    if not containers and not cards:
        return decorations

    top_margin = min((c.y for c in containers), default=canvas_h)
    bot_margin = max((c.y + c.h for c in containers), default=0)

    if random.random() < 0.15 and top_margin > 30:
        decorations.append(page_title_outside(canvas_w, canvas_h, top_margin))

    if random.random() < 0.10 and bot_margin < canvas_h - 20:
        decorations.append(footnote_outside(canvas_w, canvas_h, bot_margin))

    if random.random() < 0.18 and containers:
        target = random.choice(containers)
        note = side_note(canvas_w, canvas_h, target.x, target.y,
                         target.w, target.h)
        if note is not None:
            decorations.append(note)

    sections = [c for c in containers if c.cls == 3]  # CLASS_SECTION
    if sections and random.random() < 0.08:
        sec = random.choice(sections)
        if sec.w > 100 and sec.h > 60:
            decorations.append(crossed_card_inside_section(sec.x, sec.y,
                                                           sec.w, sec.h))

    if sections and random.random() < 0.06:
        sec = random.choice(sections)
        if sec.w > 100 and sec.h > 60:
            decorations.append(ghost_rect_inside_section(sec.x, sec.y,
                                                         sec.w, sec.h))

    if random.random() < 0.07:
        decorations.append(random_scribble(canvas_w, canvas_h))

    if random.random() < 0.05:
        decorations.append(dimension_arrow(canvas_w, canvas_h))

    return decorations
