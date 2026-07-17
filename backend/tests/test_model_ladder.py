"""Tests for the env-driven Gemini model ladder + forceModel plumbing.

Covers: GEMINI_MODELS parsing, the forceModel component of the generation
cache key, and the /api/llm-status pool snapshot shape (no key material).
"""

import time

from main import _generation_cache_key
from app.models import inference
from app.models.inference import (
    _parse_gemini_models,
    _record_model_success,
    _success_count_today,
    get_llm_pool_status,
)


IMG = "data:image/png;base64,AAAA"


class TestLadderParsing:
    def test_default_ladder(self, monkeypatch):
        monkeypatch.delenv("GEMINI_MODELS", raising=False)
        models = _parse_gemini_models()
        assert models[0] == "gemini-3.5-flash"
        assert "gemini-3-flash-preview" in models
        assert len(models) == 3

    def test_env_override(self, monkeypatch):
        monkeypatch.setenv("GEMINI_MODELS", "gemini-9-turbo, gemini-8-mini")
        assert _parse_gemini_models() == ("gemini-9-turbo", "gemini-8-mini")

    def test_whitespace_and_empties_stripped(self, monkeypatch):
        monkeypatch.setenv("GEMINI_MODELS", " a ,, b , ")
        assert _parse_gemini_models() == ("a", "b")

    def test_blank_env_falls_back_to_default(self, monkeypatch):
        monkeypatch.setenv("GEMINI_MODELS", " , ,")
        models = _parse_gemini_models()
        assert models[0] == "gemini-3.5-flash"

    def test_primary_is_first_ladder_entry(self):
        # GEMINI_PRIMARY_MODEL is derived at import time from the same parser.
        assert inference.GEMINI_PRIMARY_MODEL == inference._GEMINI_MODELS[0]


class TestForceModelCacheKey:
    def test_default_is_auto_segment(self):
        key = _generation_cache_key(IMG, "react", "canvas", None)
        assert key.endswith("|auto")

    def test_force_model_changes_key(self):
        auto = _generation_cache_key(IMG, "react", "canvas", None)
        forced = _generation_cache_key(
            IMG, "react", "canvas", None, force_model="gemini-3.5-flash"
        )
        assert auto != forced
        assert forced.endswith("|gemini-3.5-flash")

    def test_different_forced_models_differ(self):
        a = _generation_cache_key(
            IMG, "react", "canvas", None, force_model="gemini-3.5-flash"
        )
        b = _generation_cache_key(
            IMG, "react", "canvas", None, force_model="gemini-3-flash-preview"
        )
        assert a != b

    def test_same_forced_model_is_stable(self):
        a = _generation_cache_key(
            IMG, "react", "canvas", None, force_model="gemini-3.5-flash"
        )
        b = _generation_cache_key(
            IMG, "react", "canvas", None, force_model="gemini-3.5-flash"
        )
        assert a == b


class TestSuccessCounter:
    def setup_method(self):
        inference._key_model_success_counts.clear()

    def test_counts_increment(self):
        _record_model_success(0, "gemini-3.5-flash")
        _record_model_success(0, "gemini-3.5-flash")
        assert _success_count_today(0, "gemini-3.5-flash") == 2

    def test_counts_are_per_key_and_model(self):
        _record_model_success(0, "gemini-3.5-flash")
        _record_model_success(1, "gemini-3.5-flash")
        _record_model_success(0, "gemini-3-flash-preview")
        assert _success_count_today(0, "gemini-3.5-flash") == 1
        assert _success_count_today(1, "gemini-3.5-flash") == 1
        assert _success_count_today(0, "gemini-3-flash-preview") == 1

    def test_stale_days_dropped(self):
        inference._key_model_success_counts[("2000-01-01", 0, "gemini-3.5-flash")] = 7
        _record_model_success(0, "gemini-3.5-flash")
        assert ("2000-01-01", 0, "gemini-3.5-flash") not in (
            inference._key_model_success_counts
        )


class TestPoolStatus:
    def test_shape_and_no_key_material(self, monkeypatch):
        monkeypatch.setenv("GEMINI_API_KEY", "secret-key-value-1")
        monkeypatch.setenv("GEMINI_API_KEY_2", "secret-key-value-2")
        status = get_llm_pool_status()
        assert status["ladder"] == list(inference._GEMINI_MODELS)
        assert len(status["keys"]) >= 2
        flat = repr(status)
        assert "secret-key-value-1" not in flat
        assert "secret-key-value-2" not in flat
        first = status["keys"][0]
        assert first["slot"] == 1
        assert first["env"] == "GEMINI_API_KEY"
        for model_name in inference._GEMINI_MODELS:
            entry = first["models"][model_name]
            assert "cooldown_remaining_s" in entry
            assert "success_count_today" in entry

    def test_cooldown_reflected(self, monkeypatch):
        monkeypatch.setenv("GEMINI_API_KEY", "secret-key-value-1")
        model_name = inference._GEMINI_MODELS[0]
        inference._apply_model_cooldown(0, model_name, 120)
        try:
            status = get_llm_pool_status()
            remaining = status["keys"][0]["models"][model_name][
                "cooldown_remaining_s"
            ]
            assert 0 < remaining <= 120
        finally:
            inference._model_cooldowns.pop((0, model_name), None)

    def test_last_success_ts_surface(self, monkeypatch):
        monkeypatch.setenv("GEMINI_API_KEY", "secret-key-value-1")
        inference._key_last_used[0] = time.time()
        try:
            status = get_llm_pool_status()
            assert status["keys"][0]["last_success_ts"] is not None
        finally:
            inference._key_last_used.pop(0, None)
