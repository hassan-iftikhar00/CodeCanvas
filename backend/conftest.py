"""Pytest bootstrap for the backend test suite (B11).

Two jobs:

1. Put the backend root on sys.path so `import app.utils.rate_limit`, `import
   main`, etc. resolve no matter how pytest is invoked.

2. Provide a stand-in `cv2` module ONLY when OpenCV is not installed. `main.py`
   imports `app.utils.preprocessing`, which does a top-level `import cv2`, so
   without this the whole module is unimportable in a lean test environment and
   the pure-logic helpers (container synthesis, text matching) cannot be tested.
   The stub is a guard, not a fake: the helpers under test never call OpenCV, and
   if some test ever does, the stub raises a clear error instead of silently
   passing. When real OpenCV is present (CI, a full backend env) nothing is
   shadowed and the real library is used.
"""

import importlib.util
import os
import sys
import types

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


if importlib.util.find_spec("cv2") is None:
    def _cv2_unavailable(*_args, **_kwargs):
        raise RuntimeError(
            "cv2 is stubbed for tests because OpenCV is not installed; a test "
            "that needs real image processing must run in a full backend env."
        )

    _cv2_stub = types.ModuleType("cv2")
    _cv2_stub.__getattr__ = lambda _name: _cv2_unavailable  # PEP 562
    sys.modules["cv2"] = _cv2_stub
