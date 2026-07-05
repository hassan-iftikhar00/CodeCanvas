"""Tests for the HITL detection editor plumbing (roadmap idea #4).

Covers the pure helpers in main.py: corrected-element conversion (the set that
replaces the Roboflow call) and the correction audit-log row builder. The
/api/detect endpoint and the Gemini tail are covered by live smoke runs.
"""

from main import (
    DetectedElement,
    _build_correction_rows,
    _corrected_elements_to_output,
)


def element(cls, x, y, w, h, conf=0.9, label=None):
    return DetectedElement(
        type=cls,
        confidence=conf,
        bounds={"x": x, "y": y, "width": w, "height": h},
        label=label,
    )


class TestCorrectedElementsToOutput:
    def test_source_is_user_corrected(self):
        output = _corrected_elements_to_output([element("navbar", 0, 0, 1000, 80)])
        assert output.source == "user-corrected"
        assert output.metadata["human_in_the_loop"] is True

    def test_elements_sorted_top_to_bottom(self):
        output = _corrected_elements_to_output(
            [
                element("footer", 0, 520, 1000, 80),
                element("navbar", 0, 0, 1000, 80),
                element("card", 100, 200, 300, 150),
            ]
        )
        assert [e.type for e in output.elements] == ["navbar", "card", "footer"]

    def test_elements_tagged_user_verified(self):
        output = _corrected_elements_to_output([element("card", 0, 0, 100, 100)])
        assert output.elements[0].attributes["user_verified"] is True

    def test_type_lowercased_and_defaulted(self):
        output = _corrected_elements_to_output([element("Navbar", 0, 0, 100, 40)])
        assert output.elements[0].type == "navbar"

    def test_label_preserved(self):
        output = _corrected_elements_to_output(
            [element("card", 0, 0, 100, 40, label="Confirm")]
        )
        assert output.elements[0].label == "Confirm"

    def test_bounds_preserved_exactly(self):
        output = _corrected_elements_to_output([element("card", 12, 34, 56, 78)])
        assert output.elements[0].bounds == {
            "x": 12,
            "y": 34,
            "width": 56,
            "height": 78,
        }


class TestBuildCorrectionRows:
    def test_relabel_row(self):
        rows = _build_correction_rows(
            "proj-1",
            "user-1",
            [
                {
                    "action": "relabel",
                    "elementType": "navbar",
                    "previousType": "card",
                    "bounds": {"x": 0, "y": 0, "width": 100, "height": 40},
                }
            ],
        )
        assert len(rows) == 1
        row = rows[0]
        assert row["project_id"] == "proj-1"
        assert row["user_id"] == "user-1"
        assert row["action"] == "relabel"
        assert row["element_type"] == "navbar"
        assert row["previous_type"] == "card"
        assert row["bounds"] == {"x": 0, "y": 0, "width": 100, "height": 40}

    def test_delete_and_add_rows(self):
        rows = _build_correction_rows(
            "p",
            "u",
            [
                {"action": "delete", "elementType": "card"},
                {"action": "add", "elementType": "footer", "bounds": {"x": 0}},
            ],
        )
        assert [r["action"] for r in rows] == ["delete", "add"]
        assert rows[0]["previous_type"] is None

    def test_unknown_action_dropped(self):
        rows = _build_correction_rows(
            "p", "u", [{"action": "resize", "elementType": "card"}]
        )
        assert rows == []

    def test_non_dict_entries_dropped(self):
        rows = _build_correction_rows("p", "u", ["garbage", 42, None])
        assert rows == []

    def test_non_dict_bounds_nulled(self):
        rows = _build_correction_rows(
            "p", "u", [{"action": "add", "elementType": "card", "bounds": "bad"}]
        )
        assert rows[0]["bounds"] is None

    def test_action_case_insensitive(self):
        rows = _build_correction_rows("p", "u", [{"action": "RELABEL"}])
        assert rows[0]["action"] == "relabel"
