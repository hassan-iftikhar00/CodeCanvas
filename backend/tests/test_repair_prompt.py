"""Tests for build_repair_prompt / _position_phrase in app/models/inference.py."""

from app.models.inference import _position_phrase, build_repair_prompt


def el(cls, x, y, w, h, label=None):
    out = {"type": cls, "bounds": {"x": x, "y": y, "width": w, "height": h}}
    if label:
        out["label"] = label
    return out


class TestPositionPhrase:
    def test_top_full_width(self):
        phrase = _position_phrase({"x": 0, "y": 0, "width": 1000, "height": 80}, 1000, 600)
        assert "top" in phrase
        assert "spanning the full width" in phrase

    def test_bottom_right(self):
        phrase = _position_phrase({"x": 800, "y": 500, "width": 150, "height": 80}, 1000, 600)
        assert "bottom" in phrase
        assert "right" in phrase

    def test_middle_center(self):
        phrase = _position_phrase({"x": 400, "y": 250, "width": 200, "height": 100}, 1000, 600)
        assert "middle" in phrase
        assert "center" in phrase

    def test_zero_dims_do_not_crash(self):
        assert _position_phrase({}, 0, 0)


class TestBuildRepairPrompt:
    def test_missing_and_extra_sections(self):
        prompt = build_repair_prompt(
            "export default function App() {}",
            "react",
            [el("card", 100, 200, 300, 150, label="Confirm")],
            [el("navbar", 0, 0, 1000, 80)],
            1000,
            600,
        )
        assert "MISSING" in prompt
        assert "EXTRA" in prompt
        assert 'labeled "Confirm"' in prompt
        assert "x=100, y=200, w=300, h=150" in prompt
        assert "1000x600" in prompt
        assert "CURRENT CODE:" in prompt
        assert "export default function App() {}" in prompt

    def test_missing_only_omits_extra_section(self):
        prompt = build_repair_prompt(
            "code", "html", [el("footer", 0, 520, 1000, 80)], [], 1000, 600
        )
        assert "MISSING" in prompt
        assert "EXTRA" not in prompt

    def test_rules_forbid_unrelated_changes(self):
        prompt = build_repair_prompt("code", "vue", [], [el("card", 0, 0, 10, 10)], 1000, 600)
        assert "ONLY the discrepancies" in prompt
        assert "byte-identical" in prompt
        assert "valid vue file" in prompt
