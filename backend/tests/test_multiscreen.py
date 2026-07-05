"""Tests for multi-screen flows (App Uplift feature A).

Covers the NAVIGATION prompt block, the cache-key screen hashing, and the
CanvasData screens passthrough (persisted snapshots must survive model_dump).
"""

from app.models.inference import _build_gemini_prompt
from main import CanvasData, GenerateCodeRequest, _generation_cache_key


SCREENS = ["Home", "Dashboard", "Settings"]


def _prompt(framework="react", screens=SCREENS, current="Home"):
    return _build_gemini_prompt(
        [], framework, "tailwind", None, screens=screens, current_screen=current
    )


class TestNavigationBlock:
    def test_block_present_with_multiple_screens(self):
        prompt = _prompt()
        assert "MULTI-SCREEN APP" in prompt
        assert '"Home", "Dashboard", "Settings"' in prompt
        assert 'generating the "Home" screen' in prompt
        assert "window.ccNavigate" in prompt

    def test_absent_for_single_screen(self):
        assert "MULTI-SCREEN" not in _prompt(screens=["Home"])
        assert "MULTI-SCREEN" not in _prompt(screens=None)
        assert "ccNavigate" not in _prompt(screens=None)

    def test_absent_without_current_screen(self):
        assert "MULTI-SCREEN" not in _prompt(current=None)

    def test_other_screens_listed_without_current(self):
        prompt = _prompt(current="Dashboard")
        # The label-match list names only the OTHER screens.
        assert '"Home", "Settings"' in prompt

    def test_framework_specific_syntax(self):
        assert "onClick={() => window.ccNavigate" in _prompt(framework="react")
        assert 'onclick="window.ccNavigate' in _prompt(framework="html")
        assert "@click.prevent" in _prompt(framework="vue")

    def test_strict_fidelity_reasserted(self):
        assert "strict fidelity still holds" in _prompt()


class TestCacheKeyScreens:
    def test_screens_change_key(self):
        base = _generation_cache_key("img", "react", "canvas", None)
        multi = _generation_cache_key(
            "img", "react", "canvas", None, screens=SCREENS, current_screen="Home"
        )
        assert base != multi

    def test_current_screen_changes_key(self):
        a = _generation_cache_key(
            "img", "react", "canvas", None, screens=SCREENS, current_screen="Home"
        )
        b = _generation_cache_key(
            "img", "react", "canvas", None, screens=SCREENS, current_screen="Dashboard"
        )
        assert a != b

    def test_single_screen_matches_no_screens(self):
        # One screen = no navigation block = same prompt as before the feature,
        # so it must share the cache namespace with legacy requests.
        legacy = _generation_cache_key("img", "react", "canvas", None)
        single = _generation_cache_key(
            "img", "react", "canvas", None, screens=["Home"], current_screen="Home"
        )
        assert legacy == single


class TestScreensPassthrough:
    def test_screens_survive_model_dump(self):
        screens = [
            {"id": "s1", "name": "Home", "canvasData": {"lines": []}, "generatedCode": "<div />"},
            {"id": "s2", "name": "Dashboard", "canvasData": None, "generatedCode": ""},
        ]
        cd = CanvasData(lines=[], screens=screens, activeScreenId="s1")
        dumped = cd.model_dump()
        assert dumped["screens"] == screens
        assert dumped["activeScreenId"] == "s1"

    def test_request_accepts_screen_fields(self):
        req = GenerateCodeRequest(
            projectId="p1",
            userId="u1",
            screens=SCREENS,
            currentScreen="Home",
        )
        assert req.screens == SCREENS
        assert req.currentScreen == "Home"

    def test_screen_fields_default_to_none(self):
        req = GenerateCodeRequest(projectId="p1", userId="u1")
        assert req.screens is None
        assert req.currentScreen is None
