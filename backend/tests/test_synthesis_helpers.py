"""Backend test suite (B11): the detection post-processing helpers in main.py.

These are the pure-logic functions that turn raw Roboflow boxes into the layout
Gemini sees: bbox geometry, canvas-extent inference, container reclassification /
synthesis (Decision #11), and text-to-element matching (Decision #12). They are
deterministic and dependency-light, so they make an ideal unit-test target.

main.py pulls in app.utils.preprocessing (top-level `import cv2`); conftest.py
supplies a cv2 stub when OpenCV is absent so this module imports in a lean env.
The helpers under test never touch OpenCV.
"""

import main
from main import (
    TextAnnotation,
    _attach_text_annotations,
    _bbox_overlap_ratio,
    _infer_canvas_extents,
    _synthesize_missing_containers,
)
from app.models.inference import ExternalModelElement


# --- builders --------------------------------------------------------------

def elem(type_, x, y, w, h, *, id=None, **attributes):
    """Build a detected element the way Roboflow output is modelled."""
    return ExternalModelElement(
        id=id,
        type=type_,
        bounds={"x": float(x), "y": float(y), "width": float(w), "height": float(h)},
        attributes=dict(attributes),
    )


def ann(text, x, y, w=0.0, h=0.0):
    return TextAnnotation(text=text, x=float(x), y=float(y), width=float(w), height=float(h))


def synthetic_of(elements):
    """Return the lone element flagged synthetic, or None."""
    found = [e for e in elements if (e.attributes or {}).get("synthetic")]
    return found[0] if found else None


# --- _bbox_overlap_ratio ---------------------------------------------------

class TestBboxOverlapRatio:
    def test_disjoint_boxes_overlap_zero(self):
        # a fully left of b
        assert _bbox_overlap_ratio(0, 0, 10, 10, 100, 100, 10, 10) == 0.0

    def test_full_containment_returns_one(self):
        # a entirely inside b -> all of a's area overlaps
        assert _bbox_overlap_ratio(10, 10, 10, 10, 0, 0, 100, 100) == 1.0

    def test_half_overlap(self):
        # a=(0..10), b starts at x=5 -> right half of a (50 of 100) is inside b
        assert _bbox_overlap_ratio(0, 0, 10, 10, 5, 0, 10, 10) == 0.5

    def test_quarter_overlap(self):
        # b offset by (5,5) -> only a's bottom-right quadrant (25 of 100) overlaps
        assert _bbox_overlap_ratio(0, 0, 10, 10, 5, 5, 10, 10) == 0.25

    def test_edge_touching_is_not_overlap(self):
        # a ends exactly where b begins (x=10) -> zero-width intersection
        assert _bbox_overlap_ratio(0, 0, 10, 10, 10, 0, 10, 10) == 0.0

    def test_zero_area_a_returns_zero(self):
        assert _bbox_overlap_ratio(0, 0, 0, 10, 0, 0, 10, 10) == 0.0
        assert _bbox_overlap_ratio(0, 0, 10, 0, 0, 0, 10, 10) == 0.0


# --- _infer_canvas_extents -------------------------------------------------

class TestInferCanvasExtents:
    def test_single_element_bounds(self):
        extents = _infer_canvas_extents([elem("card", 10, 20, 30, 40)], [], None)
        assert extents == (10.0, 20.0, 40.0, 60.0)  # (x, y, x+w, y+h)

    def test_union_of_multiple_elements(self):
        els = [elem("card", 10, 20, 30, 40), elem("section", 0, 0, 100, 50)]
        assert _infer_canvas_extents(els, [], None) == (0.0, 0.0, 100.0, 60.0)

    def test_annotations_extend_extents(self):
        els = [elem("card", 100, 100, 50, 50)]  # spans (100,100)-(150,150)
        # bare-point annotation at (10, 10) widens the box up-left; a point gets a
        # minimum 1px footprint.
        extents = _infer_canvas_extents(els, [ann("Hi", 10, 10)], None)
        assert extents == (10.0, 10.0, 150.0, 150.0)

    def test_degenerate_elements_are_ignored(self):
        els = [elem("card", 10, 20, 30, 40), elem("card", 5, 5, 0, 999)]  # zero width
        assert _infer_canvas_extents(els, [], None) == (10.0, 20.0, 40.0, 60.0)

    def test_empty_falls_back_to_canvas_size(self):
        assert _infer_canvas_extents([], [], (800, 450)) == (0.0, 0.0, 800.0, 450.0)

    def test_empty_with_no_canvas_size_uses_default(self):
        assert _infer_canvas_extents([], [], None) == (0.0, 0.0, 1000.0, 600.0)


# --- _synthesize_missing_containers: reclassification (stage 1) ------------

class TestReclassification:
    def test_footer_in_top_band_becomes_navbar(self):
        footer_top = elem("footer", 0, 0, 1000, 30)   # centroid y=15 (top band)
        section = elem("section", 0, 60, 1000, 500)
        result = _synthesize_missing_containers([footer_top, section], [], None)

        assert footer_top.type == "navbar"
        assert footer_top.attributes["reclassified_from"] == "footer"
        assert len(result) == 2

    def test_navbar_in_bottom_band_becomes_footer(self):
        section = elem("section", 0, 0, 1000, 500)
        navbar_bottom = elem("navbar", 0, 550, 1000, 50)  # centroid y=575 (bottom band)
        _synthesize_missing_containers([section, navbar_bottom], [], None)

        assert navbar_bottom.type == "footer"
        assert navbar_bottom.attributes["reclassified_from"] == "navbar"

    def test_no_reclassify_when_correct_slot_already_filled(self):
        navbar_real = elem("navbar", 0, 0, 1000, 30)       # real navbar at top
        footer_misplaced = elem("footer", 0, 35, 1000, 20)  # also in top band
        section = elem("section", 0, 60, 1000, 500)
        _synthesize_missing_containers([navbar_real, footer_misplaced, section], [], None)

        # the real navbar already occupies the top slot, so the stray footer is
        # left alone rather than creating a duplicate navbar.
        assert footer_misplaced.type == "footer"
        assert "reclassified_from" not in footer_misplaced.attributes


# --- _synthesize_missing_containers: synthesis (stage 2) -------------------

class TestContainerSynthesis:
    def test_two_top_labels_synthesize_navbar(self):
        anns = [
            ann("Home", 100, 5, 40, 10),
            ann("About", 300, 5, 40, 10),
            ann("Privacy", 100, 900, 40, 10),  # lone bottom label, anchors extents
        ]
        result = _synthesize_missing_containers([], anns, None)

        synth = synthetic_of(result)
        assert synth is not None
        assert synth.type == "navbar"
        assert synth.id == "synthetic-navbar"
        # only the navbar is synthesized; one bottom label is not enough for a footer
        assert sum(1 for e in result if (e.attributes or {}).get("synthetic")) == 1

    def test_two_bottom_labels_synthesize_footer(self):
        anns = [
            ann("Privacy", 100, 895, 40, 10),
            ann("Terms", 300, 895, 40, 10),
            ann("Home", 100, 5, 40, 10),  # lone top label, anchors extents
        ]
        result = _synthesize_missing_containers([], anns, None)

        synth = synthetic_of(result)
        assert synth is not None
        assert synth.type == "footer"
        assert synth.id == "synthetic-footer"

    def test_single_label_does_not_synthesize(self):
        anns = [ann("Home", 100, 5, 40, 10), ann("Privacy", 100, 895, 40, 10)]
        result = _synthesize_missing_containers([], anns, None)
        assert synthetic_of(result) is None

    def test_existing_navbar_and_footer_left_untouched(self):
        els = [
            elem("navbar", 0, 0, 1000, 40),
            elem("section", 0, 50, 1000, 500),
            elem("footer", 0, 560, 1000, 40),
        ]
        result = _synthesize_missing_containers(els, [], None)
        assert len(result) == 3
        assert synthetic_of(result) is None

    def test_orphan_cards_in_top_band_synthesize_wrapping_navbar(self):
        card1 = elem("card", 50, 10, 80, 30)    # bottom edge y=40
        card2 = elem("card", 200, 10, 80, 30)
        section = elem("section", 0, 300, 1000, 250)  # far below, does not contain cards
        result = _synthesize_missing_containers([card1, card2, section], [], None)

        synth = synthetic_of(result)
        assert synth is not None
        assert synth.type == "navbar"
        # the synthesized navbar grows to wrap the orphan cards so Gemini nests them
        assert synth.bounds["y"] <= 10
        assert synth.bounds["y"] + synth.bounds["height"] >= 40

    def test_output_is_sorted_top_to_bottom(self):
        card1 = elem("card", 50, 10, 80, 30)
        card2 = elem("card", 200, 10, 80, 30)
        section = elem("section", 0, 300, 1000, 250)
        result = _synthesize_missing_containers([card1, card2, section], [], None)

        ys = [e.bounds["y"] for e in result]
        assert ys == sorted(ys)


# --- _attach_text_annotations ----------------------------------------------

class TestAttachTextAnnotations:
    def test_single_match_sets_label_text(self):
        card = elem("card", 0, 0, 100, 40)
        unmatched = _attach_text_annotations([card], [ann("Submit", 10, 10, 50, 20)])

        assert card.attributes["label_text"] == "Submit"
        assert unmatched == []

    def test_two_matches_on_same_element_use_positioned_mode(self):
        card = elem("card", 0, 0, 200, 100)
        anns = [ann("Email", 10, 10, 50, 20), ann("Password", 10, 50, 50, 20)]
        unmatched = _attach_text_annotations([card], anns)

        positioned = card.attributes.get("positioned_texts")
        assert positioned is not None
        assert [p["text"] for p in positioned] == ["Email", "Password"]
        # multi-label must NOT collapse into a single label_text (Decision #12)
        assert "label_text" not in card.attributes
        assert unmatched == []

    def test_unmatched_annotation_is_returned(self):
        card = elem("card", 0, 0, 50, 50)
        unmatched = _attach_text_annotations([card], [ann("Faraway", 500, 500, 20, 20)])

        assert unmatched == ["Faraway"]
        assert "label_text" not in card.attributes

    def test_bare_point_matches_smallest_enclosing_element(self):
        section = elem("section", 0, 0, 200, 200)
        card = elem("card", 10, 10, 40, 40)
        # point (20,20) sits inside both; the smaller card should win
        _attach_text_annotations([section, card], [ann("Hi", 20, 20)])

        assert card.attributes["label_text"] == "Hi"
        assert "label_text" not in section.attributes

    def test_area_match_prefers_smallest_container(self):
        section = elem("section", 0, 0, 200, 200)
        card = elem("card", 0, 0, 60, 60)
        _attach_text_annotations([section, card], [ann("X", 5, 5, 20, 20)])

        assert card.attributes["label_text"] == "X"
        assert "label_text" not in section.attributes

    def test_empty_annotations_change_nothing(self):
        card = elem("card", 0, 0, 100, 100)
        assert _attach_text_annotations([card], []) == []
        assert card.attributes == {}

    def test_blank_text_is_skipped(self):
        card = elem("card", 0, 0, 100, 100)
        unmatched = _attach_text_annotations([card], [ann("   ", 10, 10, 20, 20)])

        assert unmatched == []  # blank text is neither attached nor reported
        assert "label_text" not in card.attributes
