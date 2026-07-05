"""Tests for the Element↔Code Linker prompt rule (App Uplift feature C).

The prompt must instruct Gemini to stamp data-cc-id="cc-N" on every rendered
component's root tag, numbered by the component's position in the detected
list. The frontend maps detectedElements[i] ↔ cc-(i+1), so the numbering
convention in the prompt is load-bearing.
"""

from app.models.inference import ExternalModelElement, _build_gemini_prompt


def elements(n=3):
    return [
        ExternalModelElement(
            type="card",
            confidence=0.8,
            bounds={"x": 10, "y": 10 + i * 100, "width": 200, "height": 60},
        )
        for i in range(n)
    ]


class TestComponentIdRule:
    def test_rule_present_in_prompt(self):
        prompt = _build_gemini_prompt(elements(), "react", "tailwind", None)
        assert "COMPONENT IDS" in prompt
        assert "data-cc-id" in prompt

    def test_numbering_convention_spelled_out(self):
        prompt = _build_gemini_prompt(elements(), "react", "tailwind", None)
        assert 'data-cc-id="cc-1"' in prompt
        assert 'data-cc-id="cc-2"' in prompt

    def test_rule_present_for_all_frameworks(self):
        for fw in ("react", "html", "vue"):
            prompt = _build_gemini_prompt(elements(), fw, "tailwind", None)
            assert "COMPONENT IDS" in prompt, fw

    def test_elements_numbered_from_one(self):
        # The chip mapping relies on the list being 1-based in the prompt.
        prompt = _build_gemini_prompt(elements(2), "react", "tailwind", None)
        assert "\n1. card" in prompt or prompt.find("1. card") != -1
        assert "2. card" in prompt

    def test_rule_forbids_invented_ids(self):
        prompt = _build_gemini_prompt(elements(), "react", "tailwind", None)
        assert "Never invent ids" in prompt
