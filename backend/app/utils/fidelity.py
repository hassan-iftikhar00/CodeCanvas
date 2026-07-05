"""
Fidelity scoring — cyclic self-verification of generated code.

Closes the pipeline loop: after Gemini generates code from the detected sketch
elements, we render that code headless (Playwright), turn the screenshot back
into line-art (Canny edges — the detector is trained on sketches, not real
UIs), run the SAME Roboflow detector on it, and match the re-detected boxes
against the original sketch's boxes. The match quality is a single 0-1 score
the UI can show next to the generated code, plus a per-element mismatch
report (missing / extra elements) that a future auto-repair pass can feed
back to Gemini.

The HTML wrappers here are Python ports of the iframe builders in
src/components/canvas/LivePreview.tsx (buildReactDocument / buildHtmlDocument /
buildVueDocument), minus the postMessage console plumbing. Keep them in sync:
if the preview harness changes how it mounts generated code, mirror it here so
the score measures the same rendering the user sees.

Playwright is an OPTIONAL dependency. Nothing in this module imports it at
module load; render_code_to_png raises FidelityUnavailableError with install
instructions when it is missing, and the /api/fidelity endpoint surfaces that
as a 503 instead of crashing the server.

Env knobs:
  FIDELITY_IOU_THRESHOLD  — min IoU for an original/rendered box pair to count
                            as a match (default 0.25; renders never reproduce
                            sketch geometry pixel-perfectly, so this is looser
                            than the 0.5 used against ground-truth labels)
  FIDELITY_EDGE_MODE      — "on" (default) converts the screenshot to Canny
                            line-art before re-detection; "off" sends the raw
                            screenshot (useful for tuning experiments)
  FIDELITY_RENDER_SETTLE_MS — extra wait after network idle so Babel + the
                            Tailwind CDN JIT finish painting (default 1200)
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple


class FidelityUnavailableError(RuntimeError):
    """Raised when the headless-render dependency (Playwright) is missing."""


# ---------------------------------------------------------------------------
# Box matching (class-aware greedy IoU, adapted from scripts/eval_pipeline.py)
# ---------------------------------------------------------------------------


@dataclass
class FidelityBox:
    cls: str
    x: float  # top-left
    y: float
    w: float
    h: float
    confidence: float = 0.0
    label: Optional[str] = None
    matched: bool = False


def _iou(a: FidelityBox, b: FidelityBox) -> float:
    ix1, iy1 = max(a.x, b.x), max(a.y, b.y)
    ix2, iy2 = min(a.x + a.w, b.x + b.w), min(a.y + a.h, b.y + b.h)
    iw, ih = ix2 - ix1, iy2 - iy1
    if iw <= 0 or ih <= 0:
        return 0.0
    inter = iw * ih
    union = a.w * a.h + b.w * b.h - inter
    return inter / union if union > 0 else 0.0


def elements_to_fidelity_boxes(elements: List[Dict[str, Any]]) -> List[FidelityBox]:
    """Convert the API's element dicts ({type, bounds, confidence, label})."""
    boxes: List[FidelityBox] = []
    for el in elements:
        bounds = el.get("bounds") or {}
        boxes.append(
            FidelityBox(
                cls=str(el.get("type") or "").lower(),
                x=float(bounds.get("x", 0)),
                y=float(bounds.get("y", 0)),
                w=float(bounds.get("width", 0)),
                h=float(bounds.get("height", 0)),
                confidence=float(el.get("confidence") or 0.0),
                label=el.get("label"),
            )
        )
    return boxes


def default_iou_threshold() -> float:
    return float(os.getenv("FIDELITY_IOU_THRESHOLD", "0.25"))


def _box_summary(b: FidelityBox) -> Dict[str, Any]:
    out: Dict[str, Any] = {
        "type": b.cls,
        "bounds": {"x": round(b.x), "y": round(b.y), "width": round(b.w), "height": round(b.h)},
    }
    if b.label:
        out["label"] = b.label
    return out


_CONTAINER_CLASSES = ("navbar", "footer", "section")
_CROSS_CLASS_DUP_IOU = 0.8


def _suppress_cross_class_duplicates(rendered: List[FidelityBox]) -> List[FidelityBox]:
    """Drop rendered `card` boxes that near-exactly coincide with a rendered
    container box (navbar/footer/section).

    The detector's cross-class NMS intentionally keeps overlaps (a card INSIDE
    a section is real hierarchy), but a card whose box is ~identical to a
    container's is the known footer-as-card double detection — one element seen
    as two classes. For scoring purposes that is one detection, not an invented
    extra. Genuine nested cards survive: a card inside a section has a small
    IoU with the section (card area / section area), far below 0.8.
    """
    containers = [b for b in rendered if b.cls in _CONTAINER_CLASSES]
    kept: List[FidelityBox] = []
    for b in rendered:
        if b.cls == "card" and any(
            _iou(b, c) >= _CROSS_CLASS_DUP_IOU for c in containers
        ):
            continue
        kept.append(b)
    return kept


def _reclassify_bars_by_position(
    rendered: List[FidelityBox], canvas_height: float
) -> None:
    """Snap navbar/footer labels to what their position says they are.

    The class semantics ARE positional — navbar is the top horizontal bar,
    footer the bottom one (see CLAUDE.md class table) — but the detector
    sometimes swaps them on re-detected renders (a wide bar at the bottom
    comes back as `navbar`). Trusting position over the class logit here is
    applying the class definition, not inflating the score. Bars in the
    middle third keep whatever class they came with.
    """
    if canvas_height <= 0:
        return
    for b in rendered:
        if b.cls not in ("navbar", "footer"):
            continue
        cy = (b.y + b.h / 2) / canvas_height
        if cy < 1 / 3:
            b.cls = "navbar"
        elif cy > 2 / 3:
            b.cls = "footer"


def score_fidelity(
    original: List[FidelityBox],
    rendered: List[FidelityBox],
    iou_threshold: Optional[float] = None,
    canvas_height: Optional[float] = None,
) -> Dict[str, Any]:
    """Match rendered boxes against the original sketch boxes, per class.

    Greedy: within each class, highest-confidence rendered boxes claim their
    best-IoU unmatched original first. Score is the F1 over matches —
    2*TP / (2*TP + FP + FN) — so both missing elements (FN) and invented
    elements (FP) pull it down symmetrically.

    ``canvas_height`` (when known) lets navbar/footer detections be snapped to
    their positional definition before matching — see
    _reclassify_bars_by_position.
    """
    threshold = iou_threshold if iou_threshold is not None else default_iou_threshold()
    if canvas_height:
        _reclassify_bars_by_position(rendered, canvas_height)
    rendered = _suppress_cross_class_duplicates(rendered)

    # Reset match flags so a box list can be scored more than once.
    for b in original:
        b.matched = False
    for b in rendered:
        b.matched = False

    per_class: Dict[str, Dict[str, int]] = {}
    matched_pairs: List[Dict[str, Any]] = []

    for cls in sorted({b.cls for b in original} | {b.cls for b in rendered}):
        cls_orig = [b for b in original if b.cls == cls]
        cls_rend = sorted(
            (b for b in rendered if b.cls == cls),
            key=lambda b: b.confidence,
            reverse=True,
        )
        stats = {"tp": 0, "fp": 0, "fn": 0}
        for r in cls_rend:
            best, best_iou = None, 0.0
            for o in cls_orig:
                if o.matched:
                    continue
                v = _iou(r, o)
                if v > best_iou:
                    best, best_iou = o, v
            if best is not None and best_iou >= threshold:
                best.matched = True
                r.matched = True
                stats["tp"] += 1
                matched_pairs.append(
                    {"original": _box_summary(best), "rendered": _box_summary(r), "iou": round(best_iou, 3)}
                )
            else:
                stats["fp"] += 1
        stats["fn"] = sum(1 for o in cls_orig if not o.matched)
        per_class[cls] = stats

    tp = sum(s["tp"] for s in per_class.values())
    fp = sum(s["fp"] for s in per_class.values())
    fn = sum(s["fn"] for s in per_class.values())
    score = (2 * tp) / (2 * tp + fp + fn) if (tp + fp + fn) else 0.0

    return {
        "score": round(score, 4),
        "iou_threshold": threshold,
        "counts": {"tp": tp, "fp": fp, "fn": fn},
        "per_class": per_class,
        "matched": matched_pairs,
        "missing": [_box_summary(o) for o in original if not o.matched],
        "extra": [_box_summary(r) for r in rendered if not r.matched],
    }


# ---------------------------------------------------------------------------
# HTML wrappers (ports of LivePreview.tsx builders)
# ---------------------------------------------------------------------------

_FENCE_RE = re.compile(r"```(?:[\w-]*)?\s*\n([\s\S]*?)```")


def _strip_code_fences(raw: str) -> str:
    m = _FENCE_RE.search(raw)
    if m:
        return m.group(1)
    return re.sub(r"^\s*```[\w-]*\s*$", "", raw, flags=re.MULTILINE)


def _js_string_literal(code: str) -> str:
    # Escaping `</` prevents a literal `</script>` inside the generated code
    # from prematurely closing the inline <script> (same trick as LivePreview).
    return json.dumps(code).replace("</", "<\\/")


def _build_react_document(raw_code: str) -> str:
    code = _strip_code_fences(raw_code)

    # Strip import/require lines — Babel-standalone runs in classic-script mode.
    code = re.sub(
        r"\bimport\b\s+(?:type\s+)?(?:(?!\bfrom\b)[\s\S])*?\bfrom\s+['\"][^'\"]*['\"]\s*;?",
        "",
        code,
    )
    code = re.sub(r"\bimport\s+['\"][^'\"]+['\"]\s*;?", "", code)
    code = re.sub(r"^\s*const\s+\w+\s*=\s*require\([^)]+\);?\s*$", "", code, flags=re.MULTILINE)

    component_name: Optional[str] = None
    m = re.search(r"export\s+default\s+function\s+(\w+)", code)
    if m:
        component_name = m.group(1)
        code = re.sub(r"export\s+default\s+function", "function", code, count=1)
    else:
        m = re.search(r"export\s+default\s+(\w+)\s*;?", code)
        if m:
            component_name = m.group(1)
            code = re.sub(r"export\s+default\s+\w+\s*;?", "", code, count=1)

    if not component_name:
        component_name = "GeneratedComponent"
        code = re.sub(r"export\s+default\s+", f"const {component_name} = ", code, count=1)

    source_literal = _js_string_literal(code)
    name_literal = json.dumps(component_name)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone@8.0.1/babel.min.js"></script>
  <style>
    * {{ box-sizing: border-box; }}
    body {{ margin: 0; font-family: system-ui, -apple-system, sans-serif; }}
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    (function () {{
      try {{
        var compiled = Babel.transform({source_literal}, {{
          presets: [['react', {{ runtime: 'classic' }}]],
          filename: 'preview.jsx'
        }}).code;
        var factory = new Function('React', 'ReactDOM', compiled + '\\nreturn ' + {name_literal} + ';');
        var Component = factory(React, ReactDOM);
        ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Component));
      }} catch (err) {{
        document.title = 'FIDELITY_RENDER_ERROR';
        document.getElementById('root').innerHTML =
          '<pre>' + (err && err.message ? err.message : String(err)) + '</pre>';
      }}
    }})();
  </script>
</body>
</html>"""


def _build_html_document(raw_code: str) -> str:
    cleaned = _strip_code_fences(raw_code)
    if "<!DOCTYPE" in cleaned or "<html" in cleaned:
        return cleaned
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    body {{ font-family: system-ui, -apple-system, sans-serif; }}
  </style>
</head>
<body>
{cleaned}
</body>
</html>"""


def _build_vue_document(raw_code: str) -> str:
    code = _strip_code_fences(raw_code)

    template_match = re.search(r"<template>([\s\S]*?)</template>", code)
    script_match = re.search(r"<script\s+setup[^>]*>([\s\S]*?)</script>", code)

    template_content = (
        template_match.group(1).strip() if template_match else "<div>No template found.</div>"
    )
    script_content = (script_match.group(1) if script_match else "").strip()
    script_content = re.sub(
        r"import\s+\{[^}]+\}\s+from\s+['\"]vue['\"]\s*;?\n?", "", script_content
    ).strip()

    declared = re.findall(r"^\s*(?:const|let|var)\s+(\w+)", script_content, flags=re.MULTILINE)
    return_statement = f"return {{ {', '.join(declared)} }};" if declared else "return {};"
    escaped_template = json.dumps(template_content)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>
  <style>
    * {{ box-sizing: border-box; }}
    body {{ margin: 0; font-family: system-ui, -apple-system, sans-serif; }}
  </style>
</head>
<body>
  <div id="app"></div>
  <script>
    (function() {{
      const {{ createApp, ref, reactive, computed, watch, onMounted, onUnmounted }} = Vue;
      try {{
        const app = createApp({{
          template: {escaped_template},
          setup() {{
            {script_content}
            {return_statement}
          }}
        }});
        app.mount('#app');
      }} catch(err) {{
        document.title = 'FIDELITY_RENDER_ERROR';
      }}
    }})();
  </script>
</body>
</html>"""


def build_render_html(code: str, framework: str) -> str:
    fw = (framework or "html").lower()
    if fw == "react":
        return _build_react_document(code)
    if fw == "vue":
        return _build_vue_document(code)
    return _build_html_document(code)


# ---------------------------------------------------------------------------
# Headless render + sketch-domain normalization
# ---------------------------------------------------------------------------


async def render_code_to_png(
    code: str,
    framework: str,
    width: int,
    height: int,
) -> bytes:
    """Render generated code headless and return a PNG in the sketch's pixel
    space (width x height).

    The rendered page is usually TALLER than the sketch (real content flows),
    so we take a full-page screenshot at the sketch's width and scale it
    vertically to the sketch height. That keeps every element in frame and
    maps relative layout positions into the coordinate space the original
    detection boxes live in.
    """
    try:
        from playwright.async_api import async_playwright
    except ImportError as error:
        raise FidelityUnavailableError(
            "Playwright is not installed — fidelity scoring is disabled. "
            "Install with: pip install playwright && python -m playwright install chromium"
        ) from error

    html = build_render_html(code, framework)
    settle_ms = int(os.getenv("FIDELITY_RENDER_SETTLE_MS", "1200"))

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            try:
                page = await browser.new_page(
                    viewport={"width": int(width), "height": int(height)}
                )
                await page.set_content(html, wait_until="networkidle", timeout=30_000)
                # Babel compiles + Tailwind CDN JIT-generates styles after load;
                # without this settle the screenshot catches an unstyled flash.
                await page.wait_for_timeout(settle_ms)
                png = await page.screenshot(full_page=True, type="png")
            finally:
                await browser.close()
    except FidelityUnavailableError:
        raise
    except Exception as error:
        # Chromium binary missing is the common first-run failure.
        message = str(error)
        if "Executable doesn't exist" in message or "playwright install" in message:
            raise FidelityUnavailableError(
                "Playwright Chromium is not installed — run: python -m playwright install chromium"
            ) from error
        raise

    return _resize_png(png, int(width), int(height))


def _resize_png(png: bytes, width: int, height: int) -> bytes:
    import io

    from PIL import Image

    with Image.open(io.BytesIO(png)) as im:
        resized = im.convert("RGB").resize((width, height))
        out = io.BytesIO()
        resized.save(out, format="PNG")
        return out.getvalue()


def normalize_render_to_sketch_domain(png: bytes) -> bytes:
    """Convert a real-UI screenshot into line-art the detector understands.

    The Roboflow model is trained on hand-drawn / synthetic line-art sketches
    (black strokes on white), not on rendered UIs with fills and gradients
    (Decision #21). Canny edge extraction + a light dilation turns the render
    into a wireframe-like image in the same visual domain, so re-detection is
    a fair comparison. Toggle off with FIDELITY_EDGE_MODE=off for experiments.
    """
    if os.getenv("FIDELITY_EDGE_MODE", "on").lower() in ("off", "0", "false", "no"):
        return png

    import io

    import cv2
    import numpy as np
    from PIL import Image

    with Image.open(io.BytesIO(png)) as im:
        gray = np.array(im.convert("L"))

    edges = cv2.Canny(gray, 50, 150)
    # Thicken 1px edges toward hand-drawn stroke width.
    edges = cv2.dilate(edges, np.ones((2, 2), np.uint8), iterations=1)
    # Invert: white background, black lines — the sketch convention.
    line_art = 255 - edges

    out = io.BytesIO()
    Image.fromarray(line_art).convert("RGB").save(out, format="PNG")
    return out.getvalue()
