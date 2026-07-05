"""Tests for app/utils/fidelity.py — box matching math and HTML wrappers.

No Playwright required: render_code_to_png is not exercised here (it lazy-imports
playwright and is covered by manual / end-to-end runs).
"""

import pytest

from app.utils.fidelity import (
    FidelityBox,
    build_render_html,
    elements_to_fidelity_boxes,
    score_fidelity,
    _strip_code_fences,
)


def box(cls, x, y, w, h, conf=0.9, label=None):
    return FidelityBox(cls=cls, x=x, y=y, w=w, h=h, confidence=conf, label=label)


def element(cls, x, y, w, h, conf=0.9, label=None):
    return {
        "type": cls,
        "confidence": conf,
        "bounds": {"x": x, "y": y, "width": w, "height": h},
        "label": label,
    }


class TestScoreFidelity:
    def test_perfect_match_scores_one(self):
        original = [box("navbar", 0, 0, 1000, 80), box("card", 100, 200, 300, 150)]
        rendered = [box("navbar", 0, 0, 1000, 80), box("card", 100, 200, 300, 150)]
        report = score_fidelity(original, rendered, iou_threshold=0.25)
        assert report["score"] == 1.0
        assert report["counts"] == {"tp": 2, "fp": 0, "fn": 0}
        assert report["missing"] == []
        assert report["extra"] == []

    def test_missing_element_lowers_score(self):
        original = [box("navbar", 0, 0, 1000, 80), box("card", 100, 200, 300, 150)]
        rendered = [box("navbar", 0, 0, 1000, 80)]
        report = score_fidelity(original, rendered, iou_threshold=0.25)
        # F1 = 2*1 / (2*1 + 0 + 1)
        assert report["score"] == pytest.approx(2 / 3, abs=1e-4)
        assert len(report["missing"]) == 1
        assert report["missing"][0]["type"] == "card"

    def test_extra_element_lowers_score(self):
        original = [box("navbar", 0, 0, 1000, 80)]
        rendered = [box("navbar", 0, 0, 1000, 80), box("card", 400, 400, 200, 100)]
        report = score_fidelity(original, rendered, iou_threshold=0.25)
        assert report["score"] == pytest.approx(2 / 3, abs=1e-4)
        assert len(report["extra"]) == 1
        assert report["extra"][0]["type"] == "card"

    def test_class_mismatch_is_not_a_match(self):
        # Same geometry, different class: FP for the rendered class, FN for the original.
        original = [box("footer", 0, 500, 1000, 100)]
        rendered = [box("card", 0, 500, 1000, 100)]
        report = score_fidelity(original, rendered, iou_threshold=0.25)
        assert report["score"] == 0.0
        assert report["counts"] == {"tp": 0, "fp": 1, "fn": 1}

    def test_shifted_box_matches_above_threshold(self):
        # Rendered layout rarely reproduces sketch geometry exactly; a modest
        # shift must still count at the relaxed threshold.
        original = [box("card", 100, 100, 300, 200)]
        rendered = [box("card", 140, 130, 300, 200)]
        report = score_fidelity(original, rendered, iou_threshold=0.25)
        assert report["score"] == 1.0
        assert report["matched"][0]["iou"] > 0.25

    def test_disjoint_box_does_not_match(self):
        original = [box("card", 0, 0, 100, 100)]
        rendered = [box("card", 500, 500, 100, 100)]
        report = score_fidelity(original, rendered, iou_threshold=0.25)
        assert report["score"] == 0.0

    def test_greedy_prefers_higher_confidence_detection(self):
        original = [box("card", 100, 100, 200, 100)]
        good = box("card", 100, 100, 200, 100, conf=0.9)
        weak = box("card", 120, 110, 200, 100, conf=0.3)
        report = score_fidelity(original, [weak, good], iou_threshold=0.25)
        assert report["counts"]["tp"] == 1
        assert report["counts"]["fp"] == 1
        # The high-confidence box claimed the match.
        assert report["matched"][0]["rendered"]["bounds"]["x"] == 100

    def test_empty_rendered_scores_zero(self):
        original = [box("navbar", 0, 0, 1000, 80)]
        report = score_fidelity(original, [], iou_threshold=0.25)
        assert report["score"] == 0.0
        assert report["counts"]["fn"] == 1

    def test_both_empty_scores_zero(self):
        report = score_fidelity([], [], iou_threshold=0.25)
        assert report["score"] == 0.0

    def test_rescoring_resets_match_flags(self):
        original = [box("card", 0, 0, 100, 100)]
        rendered = [box("card", 0, 0, 100, 100)]
        first = score_fidelity(original, rendered, iou_threshold=0.25)
        second = score_fidelity(original, rendered, iou_threshold=0.25)
        assert first["score"] == second["score"] == 1.0

    def test_cross_class_duplicate_card_is_suppressed(self):
        # Footer double-detected as footer + card on the same box (known
        # detector behaviour): the duplicate card must not count as an extra.
        original = [box("footer", 0, 520, 1000, 80)]
        rendered = [
            box("footer", 3, 519, 993, 80, conf=0.27),
            box("card", 3, 519, 993, 80, conf=0.25),
        ]
        report = score_fidelity(original, rendered, iou_threshold=0.25)
        assert report["score"] == 1.0
        assert report["extra"] == []

    def test_nested_card_inside_section_is_not_suppressed(self):
        # A genuine card inside a section overlaps it only slightly by IoU.
        original = [box("section", 0, 100, 1000, 400), box("card", 100, 200, 200, 100)]
        rendered = [box("section", 0, 100, 1000, 400), box("card", 100, 200, 200, 100)]
        report = score_fidelity(original, rendered, iou_threshold=0.25)
        assert report["score"] == 1.0
        assert report["counts"]["tp"] == 2

    def test_bottom_bar_detected_as_navbar_matches_footer(self):
        # navbar/footer semantics are positional; a wide bar re-detected at the
        # bottom as "navbar" must be snapped to footer before matching.
        original = [box("footer", 0, 520, 1000, 80)]
        rendered = [box("navbar", 2, 519, 996, 79)]
        report = score_fidelity(
            original, rendered, iou_threshold=0.25, canvas_height=600
        )
        assert report["score"] == 1.0

    def test_bar_reclassification_needs_canvas_height(self):
        # Without canvas_height the class labels are taken at face value.
        original = [box("footer", 0, 520, 1000, 80)]
        rendered = [box("navbar", 2, 519, 996, 79)]
        report = score_fidelity(original, rendered, iou_threshold=0.25)
        assert report["score"] == 0.0

    def test_middle_bar_keeps_its_class(self):
        original = [box("navbar", 0, 250, 1000, 80)]
        rendered = [box("navbar", 0, 250, 1000, 80)]
        report = score_fidelity(
            original, rendered, iou_threshold=0.25, canvas_height=600
        )
        assert report["score"] == 1.0

    def test_label_carried_into_missing_report(self):
        original = [box("card", 0, 0, 100, 40, label="Confirm")]
        report = score_fidelity(original, [], iou_threshold=0.25)
        assert report["missing"][0]["label"] == "Confirm"


class TestElementsToFidelityBoxes:
    def test_converts_api_dicts(self):
        boxes = elements_to_fidelity_boxes(
            [element("Navbar", 1, 2, 3, 4, conf=0.5, label="Home")]
        )
        assert boxes[0].cls == "navbar"  # lowercased
        assert (boxes[0].x, boxes[0].y, boxes[0].w, boxes[0].h) == (1, 2, 3, 4)
        assert boxes[0].confidence == 0.5
        assert boxes[0].label == "Home"

    def test_tolerates_missing_fields(self):
        boxes = elements_to_fidelity_boxes([{"type": "card"}])
        assert boxes[0].w == 0.0
        assert boxes[0].confidence == 0.0


class TestBuildRenderHtml:
    def test_react_named_default_export(self):
        html = build_render_html(
            "export default function App() { return <div>hi</div>; }", "react"
        )
        assert "Babel.transform" in html
        assert '"App"' in html
        assert "export default" not in html.split("Babel.transform")[0]

    def test_react_identifier_default_export(self):
        code = "function Page() { return <div/>; }\nexport default Page;"
        html = build_render_html(code, "react")
        assert '"Page"' in html

    def test_react_anonymous_arrow_export(self):
        html = build_render_html("export default () => <div>x</div>;", "react")
        assert '"GeneratedComponent"' in html

    def test_react_strips_imports(self):
        code = (
            'import React, { useState } from "react";\n'
            "export default function App() { return <div/>; }"
        )
        html = build_render_html(code, "react")
        assert 'from \\"react\\"' not in html
        assert "useState" not in html.split("<script>")[0]

    def test_react_escapes_closing_script_tag(self):
        code = "export default function App() { return <div>{'</scr' + 'ipt>'}</div>; }"
        html = build_render_html(code, "react")
        # The embedded source literal must not contain a raw </ sequence.
        assert "<\\/scr" in html or "</scr" not in html.split("Babel.transform")[1]

    def test_html_full_document_passthrough(self):
        code = "<!DOCTYPE html><html><body><p>x</p></body></html>"
        assert build_render_html(code, "html") == code

    def test_html_fragment_gets_wrapped(self):
        html = build_render_html("<button>Go</button>", "html")
        assert "<!DOCTYPE html>" in html
        assert "<button>Go</button>" in html
        assert "tailwindcss" in html

    def test_vue_template_extracted(self):
        code = "<template><div>{{ msg }}</div></template>\n<script setup>const msg = 'hi';</script>"
        html = build_render_html(code, "vue")
        assert "createApp" in html
        assert "return { msg };" in html

    def test_fenced_code_is_unwrapped(self):
        raw = "```jsx\nexport default function App() { return <div/>; }\n```"
        assert "```" not in _strip_code_fences(raw)
        html = build_render_html(raw, "react")
        assert "```" not in html
