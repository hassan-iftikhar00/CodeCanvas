"""Tests for the Brand Kit feature (App Uplift feature H).

Covers: the BrandKit model's prompt-dict projection, the BRAND KIT block in
_build_gemini_prompt (presence, content, strict-fidelity guard), and the
brand-kit component of the generation cache key.
"""

from main import BrandKit, _generation_cache_key
from app.models.inference import ExternalModelElement, _build_gemini_prompt


def kit(**kwargs):
    return BrandKit(**kwargs)


def sample_elements():
    return [
        ExternalModelElement(
            type="navbar",
            confidence=0.9,
            bounds={"x": 0, "y": 0, "width": 1000, "height": 80},
        ),
        ExternalModelElement(
            type="card",
            confidence=0.8,
            bounds={"x": 100, "y": 200, "width": 300, "height": 60},
        ),
    ]


class TestBrandKitModel:
    def test_as_prompt_dict_drops_empty_fields(self):
        k = kit(primaryColor="#0F62FE", fontFamily="Poppins")
        assert k.as_prompt_dict() == {
            "primaryColor": "#0F62FE",
            "fontFamily": "Poppins",
        }

    def test_as_prompt_dict_empty_kit(self):
        assert kit().as_prompt_dict() == {}

    def test_all_fields_pass_through(self):
        k = kit(
            primaryColor="#111111",
            secondaryColor="#222222",
            accentColor="#333333",
            fontFamily="Inter",
        )
        assert len(k.as_prompt_dict()) == 4


class TestBrandKitPromptBlock:
    def test_no_kit_means_no_block(self):
        prompt = _build_gemini_prompt(sample_elements(), "react", "tailwind", None)
        assert "BRAND KIT" not in prompt

    def test_empty_kit_means_no_block(self):
        prompt = _build_gemini_prompt(
            sample_elements(), "react", "tailwind", None, brand_kit={}
        )
        assert "BRAND KIT" not in prompt

    def test_colors_and_font_appear(self):
        prompt = _build_gemini_prompt(
            sample_elements(),
            "react",
            "tailwind",
            None,
            brand_kit={
                "primaryColor": "#0F62FE",
                "secondaryColor": "#8899AA",
                "accentColor": "#FF9900",
                "fontFamily": "Poppins",
            },
        )
        assert "BRAND KIT" in prompt
        assert "#0F62FE" in prompt
        assert "#8899AA" in prompt
        assert "#FF9900" in prompt
        assert "Poppins" in prompt

    def test_block_carries_strict_fidelity_guard(self):
        prompt = _build_gemini_prompt(
            sample_elements(),
            "react",
            "tailwind",
            None,
            brand_kit={"primaryColor": "#0F62FE"},
        )
        assert "COLORS and TYPOGRAPHY ONLY" in prompt

    def test_partial_kit_only_lists_given_tokens(self):
        prompt = _build_gemini_prompt(
            sample_elements(),
            "react",
            "tailwind",
            None,
            brand_kit={"fontFamily": "Roboto"},
        )
        assert "Font family" in prompt
        assert "Primary color" not in prompt

    def test_tailwind_arbitrary_value_hint_present(self):
        prompt = _build_gemini_prompt(
            sample_elements(),
            "react",
            "tailwind",
            None,
            brand_kit={"primaryColor": "#123456"},
        )
        assert "bg-[#123456]" in prompt


class TestBrandKitCacheKey:
    IMG = "data:image/png;base64,AAAA"

    def test_no_kit_keeps_nokit_suffix(self):
        key = _generation_cache_key(self.IMG, "react", "canvas", None)
        assert key.endswith("|nokit")

    def test_kit_changes_key(self):
        base = _generation_cache_key(self.IMG, "react", "canvas", None)
        with_kit = _generation_cache_key(
            self.IMG, "react", "canvas", None, kit(primaryColor="#0F62FE")
        )
        assert base != with_kit

    def test_different_kits_produce_different_keys(self):
        a = _generation_cache_key(
            self.IMG, "react", "canvas", None, kit(primaryColor="#0F62FE")
        )
        b = _generation_cache_key(
            self.IMG, "react", "canvas", None, kit(primaryColor="#FF0000")
        )
        assert a != b

    def test_same_kit_is_stable(self):
        a = _generation_cache_key(
            self.IMG, "react", "canvas", None, kit(primaryColor="#0F62FE")
        )
        b = _generation_cache_key(
            self.IMG, "react", "canvas", None, kit(primaryColor="#0F62FE")
        )
        assert a == b

    def test_empty_kit_equals_no_kit(self):
        a = _generation_cache_key(self.IMG, "react", "canvas", None)
        b = _generation_cache_key(self.IMG, "react", "canvas", None, kit())
        assert a == b
