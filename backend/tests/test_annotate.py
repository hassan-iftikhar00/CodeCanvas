"""Tests for the annotate-on-render refinement (App Uplift feature B).

Covers the prompt builder (targets vs region fallback, surgical rules,
cc-id preservation) and the request model validation.
"""

import pytest
from pydantic import ValidationError

from app.models.inference import build_annotation_prompt
from main import AnnotateRequest


CODE = '<div data-cc-id="cc-1">Hello</div>'


def _targets():
    return [
        {
            "ccId": "cc-2",
            "tag": "button",
            "rect": {"x": 100, "y": 40, "width": 120, "height": 36},
        },
        {
            "ccId": "cc-5",
            "rect": {"x": 300, "y": 400, "width": 200, "height": 100},
        },
    ]


class TestBuildAnnotationPrompt:
    def test_includes_note_and_code(self):
        prompt = build_annotation_prompt(
            CODE, "react", "make this red", _targets(), None, 1280, 800
        )
        assert 'USER INSTRUCTION: "make this red"' in prompt
        assert CODE in prompt
        assert "1280x800" in prompt

    def test_lists_targets_with_cc_ids_and_positions(self):
        prompt = build_annotation_prompt(
            CODE, "react", "bigger", _targets(), None, 1280, 800
        )
        assert 'data-cc-id="cc-2"' in prompt
        assert 'data-cc-id="cc-5"' in prompt
        assert "(<button>)" in prompt
        assert "MARKED ELEMENTS" in prompt
        # Region section must not appear when targets exist.
        assert "MARKED REGION" not in prompt

    def test_region_fallback_when_no_targets(self):
        region = {"x": 50, "y": 700, "width": 400, "height": 120}
        prompt = build_annotation_prompt(
            CODE, "html", "add a footer here", [], region, 1280, 800
        )
        assert "MARKED REGION" in prompt
        assert "x=50, y=700, w=400, h=120" in prompt
        assert "MARKED ELEMENTS" not in prompt

    def test_surgical_rules_present(self):
        prompt = build_annotation_prompt(
            CODE, "vue", "delete this", _targets(), None, 1000, 600
        )
        assert "byte-identical" in prompt
        assert "data-cc-id=\"cc-N\"" in prompt
        assert "never renumber" in prompt
        assert "complete, valid vue file" in prompt

    def test_this_binding_and_container_rule_present(self):
        # "make this red only" on a button must not restyle the wrapper the
        # markup also crossed: the prompt pins "this" to the marked elements
        # and forbids per-child restyling of a marked container.
        prompt = build_annotation_prompt(
            CODE, "react", "make this red only", _targets(), None, 1000, 600
        )
        assert '"this"/"it" in the instruction refer to the marked' in prompt
        assert "ONE marked area" in prompt

    def test_note_is_stripped(self):
        prompt = build_annotation_prompt(
            CODE, "react", "  center it \n", _targets(), None, 1000, 600
        )
        assert 'USER INSTRUCTION: "center it"' in prompt


class TestAnnotateRequest:
    def _base(self, **overrides):
        payload = {
            "projectId": "p1",
            "userId": "u1",
            "code": CODE,
            "note": "make it red",
            "targets": _targets(),
        }
        payload.update(overrides)
        return payload

    def test_valid_request(self):
        req = AnnotateRequest(**self._base())
        assert req.framework == "react"
        assert req.width == 1000
        assert len(req.targets) == 2

    def test_region_only_request(self):
        req = AnnotateRequest(
            **self._base(
                targets=[], region={"x": 0, "y": 0, "width": 10, "height": 10}
            )
        )
        assert req.targets == []
        assert req.region is not None

    def test_missing_note_rejected(self):
        payload = self._base()
        del payload["note"]
        with pytest.raises(ValidationError):
            AnnotateRequest(**payload)

    def test_viewport_bounds_enforced(self):
        with pytest.raises(ValidationError):
            AnnotateRequest(**self._base(width=0))
        # Tall scrolling pages are legitimate: height cap is generous.
        req = AnnotateRequest(**self._base(height=50000))
        assert req.height == 50000
