"""Tests for incremental regeneration (App Uplift feature D).

Covers the pure pieces: envelope-normalized detection-set diffing and the
delta prompt builder. The live Gemini patch behaviour is covered by smoke
runs (it depends on model output).
"""

from app.models.inference import (
    ExternalModelElement,
    build_incremental_prompt,
    diff_detection_sets,
)


def el(cls, x, y, w, h, label=None):
    return {
        "type": cls,
        "confidence": 0.9,
        "bounds": {"x": x, "y": y, "width": w, "height": h},
        "label": label,
    }


def model_el(cls, x, y, w, h, label=None, attributes=None):
    return ExternalModelElement(
        type=cls,
        confidence=0.9,
        bounds={"x": x, "y": y, "width": w, "height": h},
        label=label,
        attributes=attributes or {},
    )


BASE = [
    el("navbar", 0, 0, 1000, 80),
    el("card", 100, 150, 300, 60),
    el("card", 100, 250, 300, 60),
    el("footer", 0, 520, 1000, 80),
]


class TestDiffDetectionSets:
    def test_identical_sets_all_matched(self):
        diff = diff_detection_sets(BASE, [model_el(**_kw(e)) for e in BASE])
        assert len(diff["matched"]) == 4
        assert diff["added"] == []
        assert diff["removed"] == []

    def test_added_element_detected(self):
        new = BASE + [el("card", 100, 350, 300, 60)]
        diff = diff_detection_sets(BASE, new)
        assert len(diff["added"]) == 1
        assert diff["removed"] == []

    def test_removed_element_detected(self):
        diff = diff_detection_sets(BASE, BASE[:-1])
        assert diff["added"] == []
        assert len(diff["removed"]) == 1
        assert diff["removed"] == [3]

    def test_crop_shift_does_not_create_phantom_changes(self):
        # Same layout, but the second run's export cropped differently:
        # every coordinate shifted by (37, 12) and scaled by 1.3.
        shifted = [
            el(
                e["type"],
                e["bounds"]["x"] * 1.3 + 37,
                e["bounds"]["y"] * 1.3 + 12,
                e["bounds"]["width"] * 1.3,
                e["bounds"]["height"] * 1.3,
            )
            for e in BASE
        ]
        diff = diff_detection_sets(BASE, shifted)
        assert diff["added"] == []
        assert diff["removed"] == []
        assert len(diff["matched"]) == 4

    def test_type_change_reads_as_remove_plus_add(self):
        new = list(BASE)
        new[1] = el("section", 100, 150, 300, 60)
        diff = diff_detection_sets(BASE, new)
        assert 1 in diff["removed"]
        assert 1 in diff["added"]

    def test_empty_old_set_all_added(self):
        diff = diff_detection_sets([], BASE)
        assert diff["matched"] == []
        assert len(diff["added"]) == 4

    def test_empty_new_set_all_removed(self):
        diff = diff_detection_sets(BASE, [])
        assert diff["matched"] == []
        assert len(diff["removed"]) == 4

    def test_greedy_matching_prefers_best_overlap(self):
        # Two same-class cards; each new card should match its own original,
        # not cross over.
        old = [el("card", 0, 0, 100, 50), el("card", 0, 200, 100, 50)]
        new = [el("card", 0, 205, 100, 50), el("card", 0, 2, 100, 50)]
        diff = diff_detection_sets(old, new)
        assert sorted(diff["matched"]) == [(0, 1), (1, 0)]


def _kw(e):
    return {
        "cls": e["type"],
        "x": e["bounds"]["x"],
        "y": e["bounds"]["y"],
        "w": e["bounds"]["width"],
        "h": e["bounds"]["height"],
        "label": e.get("label"),
    }


class TestBuildIncrementalPrompt:
    def new_elements(self):
        return [
            model_el("navbar", 0, 0, 1000, 80),
            model_el(
                "card", 100, 150, 300, 60, attributes={"label_text": "Submit"}
            ),
            model_el("card", 100, 250, 300, 60),
        ]

    def test_remove_references_cc_id(self):
        prompt = build_incremental_prompt(
            "<div>old</div>",
            "react",
            self.new_elements(),
            {"matched": [(0, 0)], "removed": [2], "added": []},
        )
        assert 'data-cc-id="cc-3"' in prompt
        assert "REMOVE" in prompt

    def test_add_lists_position_and_label(self):
        prompt = build_incremental_prompt(
            "<div>old</div>",
            "react",
            self.new_elements(),
            {"matched": [(0, 0)], "removed": [], "added": [1]},
        )
        assert "ADD" in prompt
        assert '"Submit"' in prompt

    def test_full_new_list_included_for_restamping(self):
        prompt = build_incremental_prompt(
            "<div>old</div>",
            "react",
            self.new_elements(),
            {"matched": [(0, 0)], "removed": [], "added": [1]},
        )
        assert "RE-STAMP" in prompt
        assert "1. navbar" in prompt
        assert "3. card" in prompt

    def test_previous_code_embedded(self):
        prompt = build_incremental_prompt(
            "UNIQUE_MARKER_12345",
            "react",
            self.new_elements(),
            {"matched": [], "removed": [], "added": [0]},
        )
        assert "UNIQUE_MARKER_12345" in prompt

    def test_byte_identical_rule_present(self):
        prompt = build_incremental_prompt(
            "<div>old</div>",
            "html",
            self.new_elements(),
            {"matched": [(0, 0)], "removed": [1], "added": []},
        )
        assert "byte-identical" in prompt
        assert "valid html file" in prompt
