"""Regression tests for CanvasData persistence passthrough.

The pydantic CanvasData model is what /api/predict persists into
iterations.canvas_data (and mirrors onto projects.canvas_data). It used to
define only strokes/lines/width/height, which silently STRIPPED shapes
(rectangles), componentGroups (templates), and the uploadedSketch stub from
every generation iteration — so restoring a version wiped the drawing.
"""

from main import CanvasData


def test_shapes_survive_model_dump():
    cd = CanvasData(
        lines=[{"points": [1, 2, 3, 4], "color": "#000", "width": 2}],
        shapes=[{"type": "rectangle", "x": 10, "y": 20, "width": 100, "height": 40}],
        componentGroups=[{"id": "g1", "shapes": [{"type": "rectangle"}]}],
        width=1000,
        height=600,
    )
    dumped = cd.model_dump()
    assert dumped["shapes"] == [
        {"type": "rectangle", "x": 10, "y": 20, "width": 100, "height": 40}
    ]
    assert dumped["componentGroups"][0]["id"] == "g1"
    assert dumped["lines"][0]["points"] == [1, 2, 3, 4]


def test_uploaded_sketch_stub_survives_model_dump():
    stub = {
        "dataUrl": "data:image/png;base64,AAA",
        "source": "upload-photo",
        "width": 800,
        "height": 600,
    }
    cd = CanvasData(lines=[], shapes=[], componentGroups=[], uploadedSketch=stub)
    assert cd.model_dump()["uploadedSketch"] == stub


def test_passthrough_fields_default_to_none():
    dumped = CanvasData().model_dump()
    assert dumped["shapes"] is None
    assert dumped["componentGroups"] is None
    assert dumped["uploadedSketch"] is None
    # Existing defaults untouched.
    assert dumped["width"] == 1000
    assert dumped["height"] == 600
