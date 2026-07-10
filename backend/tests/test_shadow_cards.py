"""Tests for _drop_container_shadow_cards (inference.py).

The detector sometimes returns a container box twice: once as its real class
(section/navbar/footer) and once as a `card` on nearly the same pixels.
Class-aware NMS keeps both (different classes), and the phantom card later
renders as an invented element (unlabelled squarish card → image placeholder).
These tests pin the cross-class dedup: shadow cards die, true containment
(small card inside a big container) survives.
"""

from dataclasses import dataclass, field
from typing import Dict

from app.models.inference import _drop_container_shadow_cards


@dataclass
class El:
    type: str
    bounds: Dict[str, float]
    confidence: float = 0.8
    attributes: Dict = field(default_factory=dict)


def box(type_, x, y, w, h):
    return El(type_, {"x": x, "y": y, "width": w, "height": h})


def test_card_shadowing_section_is_dropped():
    # Real case: signup-form container detected as section AND card (IoU ~0.97).
    section = box("section", 1058, 228, 598, 644)
    shadow = box("card", 1060, 232, 592, 638)
    kept = _drop_container_shadow_cards([section, shadow])
    assert kept == [section]


def test_card_inside_section_is_kept():
    # True containment: IoU = card area / section area, far below 0.8.
    section = box("section", 0, 0, 800, 600)
    inner = box("card", 100, 100, 300, 80)
    kept = _drop_container_shadow_cards([section, inner])
    assert kept == [section, inner]


def test_card_shadowing_navbar_is_dropped():
    navbar = box("navbar", 0, 0, 1200, 100)
    shadow = box("card", 4, 2, 1190, 98)
    other = box("card", 20, 20, 100, 60)
    kept = _drop_container_shadow_cards([navbar, shadow, other])
    assert kept == [navbar, other]


def test_no_containers_means_no_drops():
    a = box("card", 0, 0, 500, 400)
    b = box("card", 10, 10, 480, 380)  # heavy card-card overlap: NMS's job, not ours
    kept = _drop_container_shadow_cards([a, b])
    assert kept == [a, b]


def test_containers_never_dropped():
    section = box("section", 0, 0, 800, 600)
    footer = box("footer", 0, 550, 800, 50)
    kept = _drop_container_shadow_cards([section, footer])
    assert kept == [section, footer]


def test_partial_overlap_below_threshold_survives():
    # Card overlapping ~half the section: real content, not a shadow.
    section = box("section", 0, 0, 800, 600)
    card = box("card", 0, 0, 800, 300)
    kept = _drop_container_shadow_cards([section, card])
    assert kept == [section, card]


# ── positional bar snap ──────────────────────────────────────────────────────

from app.models.inference import snap_positional_bars  # noqa: E402


def test_bottom_navbar_snaps_to_footer():
    # Live case: footer bar (links + copyright) detected as navbar 0.70 —
    # the prompt then forces it to render at the TOP of the page.
    top = box("navbar", 523, 15, 1803, 142)
    body = box("section", 1057, 231, 594, 640)
    bottom = box("navbar", 592, 897, 1810, 302)
    snap_positional_bars([top, body, bottom])
    assert top.type == "navbar"
    assert bottom.type == "footer"


def test_top_footer_snaps_to_navbar():
    top = box("footer", 0, 10, 800, 80)
    body = box("section", 0, 120, 800, 700)
    snap_positional_bars([top, body])
    assert top.type == "navbar"


def test_middle_bar_keeps_detected_class():
    top = box("navbar", 0, 0, 800, 60)
    middle = box("navbar", 0, 400, 800, 60)
    bottom = box("footer", 0, 900, 800, 60)
    snap_positional_bars([top, middle, bottom])
    assert middle.type == "navbar"


def test_cards_and_sections_never_snapped():
    bottom_card = box("card", 0, 900, 800, 60)
    bottom_section = box("section", 0, 700, 800, 260)
    snap_positional_bars([box("navbar", 0, 0, 800, 60), bottom_section, bottom_card])
    assert bottom_card.type == "card"
    assert bottom_section.type == "section"


def test_snap_empty_list_is_noop():
    snap_positional_bars([])  # must not raise
