"""Unit tests for deterministic role hints + alignment annotation."""

from dataclasses import dataclass, field
from typing import Any, Dict, Optional

from app.utils.role_inference import (
    annotate_alignment,
    annotate_role_hints,
)


@dataclass
class El:
    type: str
    bounds: Dict[str, float]
    attributes: Optional[Dict[str, Any]] = field(default_factory=dict)
    confidence: float = 0.9


def make(type_, x, y, w, h, text=None, **attrs):
    a = dict(attrs)
    if text is not None:
        a["label_text"] = text
    return El(type=type_, bounds={"x": x, "y": y, "width": w, "height": h}, attributes=a)


def hint(el):
    return (el.attributes or {}).get("role_hint")


# ── role hints: text keywords ────────────────────────────────────────────────

def test_password_label_is_input():
    els = [make("card", 100, 100, 400, 40, text="Password")]
    annotate_role_hints(els)
    assert hint(els[0]) == "input"


def test_confirm_password_is_input_not_button():
    # "Confirm" alone is an action verb, but "Confirm password" is a field.
    els = [make("card", 100, 100, 400, 40, text="Confirm password")]
    annotate_role_hints(els)
    assert hint(els[0]) == "input"


def test_name_and_address_are_inputs():
    els = [
        make("card", 100, 100, 400, 40, text="Name"),
        make("card", 100, 160, 400, 40, text="Address"),
    ]
    annotate_role_hints(els)
    assert hint(els[0]) == "input"
    assert hint(els[1]) == "input"


def test_trailing_colon_label_is_input():
    els = [make("card", 100, 100, 300, 60, text="Favourite color:")]
    annotate_role_hints(els)
    assert hint(els[0]) == "input"


def test_action_verb_is_button():
    for label in ("Submit", "Sign up", "Buy now", "Learn more", "Confirm"):
        els = [make("card", 100, 100, 150, 50, text=label)]
        annotate_role_hints(els)
        assert hint(els[0]) == "button", label


def test_create_account_is_button_even_when_wide_thin():
    # Live case: "Create Account" drawn as a wide bar fell through to the
    # wide-thin rule and rendered as an <input>.
    els = [make("card", 1095, 753, 515, 92, text="Create Account")]
    annotate_role_hints(els)
    assert hint(els[0]) == "button"
    assert els[0].attributes["role_hint_firm"] is True


def test_image_marker_labels_are_image_placeholders():
    # Mirrors the synthetic dataset's IMAGE_LABELS: an image card drawn as a
    # box holding a marker word, not as an X-cross.
    for label in ("[ image ]", "img", "photo", "[ X ]", "img placeholder"):
        els = [make("card", 100, 100, 200, 150, text=label)]
        annotate_role_hints(els)
        assert hint(els[0]) == "image placeholder", label
        assert els[0].attributes["role_hint_firm"] is True, label


def test_image_marker_beats_wide_thin_input_rule():
    # Wide-thin shape would say input; the marker word wins.
    els = [make("card", 50, 100, 500, 50, text="[ image ]")]
    annotate_role_hints(els)
    assert hint(els[0]) == "image placeholder"


def test_image_word_inside_sentence_is_not_a_marker():
    els = [make("card", 100, 100, 400, 60, text="Upload your image here today")]
    annotate_role_hints(els)
    assert hint(els[0]) != "image placeholder"


def test_long_sentence_gets_no_hint():
    els = [make("card", 100, 100, 400, 60, text="Welcome to our store, browse below")]
    annotate_role_hints(els)
    assert hint(els[0]) is None


# ── role hints: geometry ─────────────────────────────────────────────────────

def test_wide_thin_labelled_row_is_input():
    els = [make("card", 50, 100, 500, 50, text="Whatever Label")]
    annotate_role_hints(els)
    assert hint(els[0]) == "input"
    # Non-field label: shape-only guess, must stay soft so the drawn text
    # (e.g. a short heading) can override it.
    assert els[0].attributes["role_hint_firm"] is False


def test_sidebar_menu_rows_are_nav_items_not_inputs():
    # Live case: dashboard sidebar (tall section) with Home/Projects/
    # Analytics/Settings rows — the wide-thin rule made them text inputs.
    sidebar = make("section", 5, 4, 495, 1001, text="Dashboard")
    labels = ("Home", "Projects", "Analytics", "Settings")
    rows = [
        make("card", 46, 204 + i * 100, 409, 80, text=lbl)
        for i, lbl in enumerate(labels)
    ]
    els = [sidebar] + rows
    annotate_role_hints(els)
    for row, lbl in zip(rows, labels):
        assert hint(row) == "nav item (sidebar menu link)", lbl
        assert row.attributes["role_hint_firm"] is True, lbl


def test_field_label_in_tall_section_stays_input():
    # A tall form column: field-style labels beat the sidebar rule.
    column = make("section", 0, 0, 400, 900)
    row = make("card", 40, 100, 320, 60, text="Password")
    els = [column, row]
    annotate_role_hints(els)
    assert hint(row) == "input"


def test_wide_section_rows_do_not_get_sidebar_hint():
    # Normal (wide) section: short-labelled rows keep the wide-thin input path.
    section = make("section", 0, 0, 1200, 700)
    row = make("card", 100, 100, 500, 50, text="Whatever Label")
    els = [section, row]
    annotate_role_hints(els)
    assert hint(row) == "input"


def test_wide_thin_unlabelled_row_is_input():
    els = [make("card", 50, 100, 500, 50)]
    annotate_role_hints(els)
    assert hint(els[0]) == "input"
    # No label — shape-only guess, must be soft so in-image text can override.
    assert els[0].attributes["role_hint_firm"] is False


def test_keyword_hint_is_firm():
    els = [make("card", 100, 100, 400, 40, text="Password")]
    annotate_role_hints(els)
    assert els[0].attributes["role_hint_firm"] is True


def test_large_squarish_unlabelled_card_in_section_is_image():
    section = make("section", 0, 0, 600, 400)
    card = make("card", 100, 50, 300, 250)
    els = [section, card]
    annotate_role_hints(els)
    assert hint(card) == "image placeholder"


def test_small_squarish_card_gets_no_hint():
    section = make("section", 0, 0, 600, 400)
    card = make("card", 100, 50, 40, 40)  # icon-sized
    els = [section, card]
    annotate_role_hints(els)
    assert hint(card) is None


def test_squarish_card_without_parent_gets_no_hint():
    els = [make("card", 100, 50, 300, 250)]
    annotate_role_hints(els)
    assert hint(els[0]) is None


def test_card_wrapping_other_cards_is_not_an_image():
    # Form container mis-detected as `card`: squarish, unlabelled, large — the
    # shape guess would say image placeholder, but it WRAPS real cards.
    section = make("section", 0, 0, 800, 900)
    wrapper = make("card", 100, 50, 600, 640)
    inner_a = make("card", 140, 100, 500, 80, text="Email")
    inner_b = make("card", 140, 220, 500, 80, text="Password")
    els = [section, wrapper, inner_a, inner_b]
    annotate_role_hints(els)
    assert hint(wrapper) is None
    assert hint(inner_a) == "input"
    assert hint(inner_b) == "input"


def test_marker_label_beats_wrapper_veto():
    # Firm image-marker label wins even when the box contains another card.
    section = make("section", 0, 0, 800, 900)
    wrapper = make("card", 100, 50, 600, 640, text="[ image ]")
    inner = make("card", 140, 100, 500, 80)
    els = [section, wrapper, inner]
    annotate_role_hints(els)
    assert hint(wrapper) == "image placeholder"


# ── role hints: container position ───────────────────────────────────────────

def test_card_in_navbar_is_nav_item():
    navbar = make("navbar", 0, 0, 800, 80)
    card = make("card", 20, 20, 100, 40, text="Password")  # position beats keywords
    els = [navbar, card]
    annotate_role_hints(els)
    assert "nav item" in hint(card)


def test_card_in_footer_is_footer_item():
    footer = make("footer", 0, 500, 800, 80)
    card = make("card", 20, 520, 100, 40)
    els = [footer, card]
    annotate_role_hints(els)
    assert "footer item" in hint(card)


def test_containers_get_no_role_hint():
    els = [make("navbar", 0, 0, 800, 80), make("section", 0, 80, 800, 400)]
    annotate_role_hints(els)
    assert hint(els[0]) is None
    assert hint(els[1]) is None


def test_smallest_containing_container_wins():
    outer = make("section", 0, 0, 800, 600)
    inner = make("navbar", 0, 0, 800, 100)
    card = make("card", 10, 10, 100, 40)
    els = [outer, inner, card]
    annotate_role_hints(els)
    assert "nav item" in hint(card)


# ── alignment ────────────────────────────────────────────────────────────────

def align(el):
    return (el.attributes or {}).get("child_alignment")


def test_centered_navbar_items():
    navbar = make("navbar", 0, 0, 800, 80)
    a = make("card", 320, 20, 70, 40)
    b = make("card", 410, 20, 70, 40)
    els = [navbar, a, b]
    annotate_alignment(els)
    assert align(navbar) == "center"


def test_space_between_navbar_items():
    navbar = make("navbar", 0, 0, 800, 80)
    a = make("card", 20, 20, 100, 40)
    b = make("card", 680, 20, 100, 40)
    els = [navbar, a, b]
    annotate_alignment(els)
    assert align(navbar) == "space-between"


def test_left_aligned_items():
    navbar = make("navbar", 0, 0, 800, 80)
    a = make("card", 20, 20, 80, 40)
    b = make("card", 120, 20, 80, 40)
    els = [navbar, a, b]
    annotate_alignment(els)
    assert align(navbar) == "left"


def test_right_aligned_items():
    navbar = make("navbar", 0, 0, 800, 80)
    a = make("card", 580, 20, 80, 40)
    b = make("card", 680, 20, 80, 40)
    els = [navbar, a, b]
    annotate_alignment(els)
    assert align(navbar) == "right"


def test_stacked_items():
    section = make("section", 0, 0, 800, 600)
    a = make("card", 100, 50, 400, 40)
    b = make("card", 100, 150, 400, 40)
    els = [section, a, b]
    annotate_alignment(els)
    assert align(section) == "stacked"


def test_alignment_from_positioned_texts():
    # Canvas path: container has text annotations but no card children.
    navbar = make(
        "navbar", 0, 0, 800, 80,
        positioned_texts=[
            {"text": "Logo", "x": 340, "y": 30, "width": 0, "height": 0},
            {"text": "Menu", "x": 420, "y": 30, "width": 0, "height": 0},
        ],
    )
    els = [navbar]
    annotate_alignment(els)
    assert align(navbar) == "center"


def test_empty_container_gets_no_alignment():
    els = [make("navbar", 0, 0, 800, 80)]
    annotate_alignment(els)
    assert align(els[0]) is None
