"""AI model helpers and the external model JSON contract.

Expected external model output:

{
  "source": "mock",
  "model_version": "mock-v1",
  "framework": "html",
  "styling": "tailwind",
  "description": "Login screen",
  "generated_code": null,
  "elements": [
    {
      "id": "button-1",
      "type": "button",
      "confidence": 0.98,
      "label": "Submit",
      "bounds": {
        "x": 120,
        "y": 260,
        "width": 180,
        "height": 48
      },
      "attributes": {
        "variant": "primary"
      }
    }
  ],
  "metadata": {
    "canvas_width": 1000,
    "canvas_height": 600
  }
}
"""

import base64
import io
import json
import os
import re
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from pydantic import AliasChoices, BaseModel, ConfigDict, Field, ValidationError

ROBOFLOW_DEFAULT_MODEL_ID = "object-detection-4affw/2"
# Use Roboflow's hosted inference endpoint by default.
# `inference_sdk` treats `serverless.roboflow.com` as a v1 server and will try
# to register/load models via `/model/add`, which requires additional auth.
ROBOFLOW_DEFAULT_API_URL = "https://detect.roboflow.com"
ROBOFLOW_DEFAULT_THRESHOLD = 0.4

# Per-class confidence thresholds. Shahwaiz's 4-class object-detection-4affw model
# has very different calibration per class:
#   - navbar / footer / section are "container regions" (top bar / bottom bar /
#     middle page body excluding header & footer). They're shape-shaped, easy
#     to learn from ~311 training images, and come back at 0.2–0.9 confidence.
#   - card is the catch-all "every other content unit" class — buttons, text,
#     images, inputs, links all squashed into one label. High intra-class
#     variance + small training set ⇒ model is structurally UNDER-confident on
#     this class and returns 0.03–0.4 even for clear hits. A single global
#     threshold cannot accommodate both calibrations, which is why a 0.25
#     filter silently dropped every card the user drew.
# Override any of these via env: ROBOFLOW_CONFIDENCE_THRESHOLD_<CLASS>=0.05
_DEFAULT_PER_CLASS_THRESHOLDS = {
    "card": 0.03,
    "navbar": 0.20,
    "footer": 0.20,
    "section": 0.20,
}

# Class-aware NMS: when two same-class predictions overlap (IoU > this), keep
# only the higher-confidence one. Collapses duplicate-section detections that
# the old single-threshold filter was deduping by accident.
_DEFAULT_NMS_IOU = 0.5

# Sanity guard: a `card` whose bbox covers more than this fraction of the
# image is almost certainly the model confusing itself with the surrounding
# `section`. Drop these — real cards are always smaller than their parent
# section.
_MAX_CARD_AREA_RATIO = 0.85

GEMINI_PRIMARY_MODEL = "gemini-2.5-pro"
GEMINI_FALLBACK_MODEL = "gemini-2.5-flash"


class ExternalModelElement(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: Optional[str] = None
    type: str
    confidence: float = 0.0
    bounds: Dict[str, float]
    label: Optional[str] = None
    attributes: Dict[str, Any] = Field(default_factory=dict)


class ExternalModelOutput(BaseModel):
    model_config = ConfigDict(extra="allow")

    source: str = "mock"
    model_version: Optional[str] = None
    framework: Optional[str] = None
    styling: Optional[str] = None
    description: Optional[str] = None
    generated_code: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("generated_code", "generatedCode", "code"),
    )
    elements: List[ExternalModelElement] = Field(
        default_factory=list,
        validation_alias=AliasChoices("elements", "detectedElements"),
    )
    metadata: Dict[str, Any] = Field(default_factory=dict)


def _sort_key(element: Dict[str, Any]) -> float:
    bounds = element.get("bounds") or {}
    return float(bounds.get("y", 0))


def _strip_code_fences(code: str) -> str:
    cleaned = code.strip()
    cleaned = re.sub(r"^```[\w]*\n?", "", cleaned)
    cleaned = re.sub(r"\n?```$", "", cleaned)
    return cleaned.strip()


def coerce_external_model_output(
    external_output: Any,
) -> Optional[ExternalModelOutput]:
    if external_output is None:
        return None

    if isinstance(external_output, ExternalModelOutput):
        return external_output

    if isinstance(external_output, str):
        try:
            external_output = json.loads(external_output)
        except json.JSONDecodeError as error:
            print(f"Warning: invalid external model JSON: {error}")
            return None

    if not isinstance(external_output, dict):
        return None

    try:
        return ExternalModelOutput.model_validate(external_output)
    except ValidationError as error:
        print(f"Warning: invalid external model output: {error}")
        return None


def external_elements_from_output(external_output: Any) -> List[Dict[str, Any]]:
    resolved_output = coerce_external_model_output(external_output)
    if not resolved_output or not resolved_output.elements:
        return []

    return [element.model_dump(exclude_none=True) for element in resolved_output.elements]


def create_mock_external_model_output(
    canvas_data: Optional[Dict[str, Any]] = None,
    framework: str = "html",
    styling: str = "tailwind",
    description: Optional[str] = None,
) -> ExternalModelOutput:
    canvas_width = 1000
    canvas_height = 600

    if canvas_data:
        canvas_width = int(canvas_data.get("width", canvas_width) or canvas_width)
        canvas_height = int(canvas_data.get("height", canvas_height) or canvas_height)

    card_left = max(60.0, canvas_width * 0.12)
    card_top = max(60.0, canvas_height * 0.15)
    card_width = min(max(canvas_width * 0.42, 320.0), 460.0)
    card_height = min(max(canvas_height * 0.48, 220.0), 320.0)

    heading_text = description or "Mock login screen"

    return ExternalModelOutput(
        source="mock",
        model_version="mock-v1",
        framework=framework,
        styling=styling,
        description=description,
        elements=[
            ExternalModelElement(
                id="mock-card",
                type="container",
                confidence=0.96,
                label="Card",
                bounds={
                    "x": card_left,
                    "y": card_top,
                    "width": card_width,
                    "height": card_height,
                },
                attributes={"role": "panel"},
            ),
            ExternalModelElement(
                id="mock-heading",
                type="text",
                confidence=0.99,
                label=heading_text,
                bounds={
                    "x": card_left + 24,
                    "y": card_top + 28,
                    "width": card_width - 48,
                    "height": 40,
                },
                attributes={"role": "heading", "level": 1},
            ),
            ExternalModelElement(
                id="mock-input",
                type="input",
                confidence=0.98,
                label="Email address",
                bounds={
                    "x": card_left + 24,
                    "y": card_top + 90,
                    "width": card_width - 48,
                    "height": 44,
                },
                attributes={"placeholder": "name@example.com"},
            ),
            ExternalModelElement(
                id="mock-button",
                type="button",
                confidence=0.98,
                label="Continue",
                bounds={
                    "x": card_left + 24,
                    "y": card_top + 156,
                    "width": 180,
                    "height": 48,
                },
                attributes={"variant": "primary"},
            ),
        ],
        metadata={
            "canvas_width": canvas_width,
            "canvas_height": canvas_height,
            "element_count": 4,
            "source": "mock",
        },
    )


def _decode_sketch_image(sketch_image: str) -> bytes:
    payload = sketch_image.split(",", 1)[1] if sketch_image.startswith("data:") else sketch_image
    return base64.b64decode(payload)


def _resolve_class_threshold(class_name: str, fallback: float) -> float:
    """Per-class confidence threshold: env override > built-in default > fallback."""
    env_key = f"ROBOFLOW_CONFIDENCE_THRESHOLD_{class_name.upper()}"
    raw = os.getenv(env_key)
    if raw is not None:
        try:
            return float(raw)
        except ValueError:
            pass
    return _DEFAULT_PER_CLASS_THRESHOLDS.get(class_name, fallback)


def _iou(a: "ExternalModelElement", b: "ExternalModelElement") -> float:
    """Intersection-over-union of two element bboxes."""
    ab = a.bounds or {}
    bb = b.bounds or {}
    try:
        ax = float(ab.get("x", 0)); ay = float(ab.get("y", 0))
        aw = float(ab.get("width", 0)); ah = float(ab.get("height", 0))
        bx = float(bb.get("x", 0)); by = float(bb.get("y", 0))
        bw = float(bb.get("width", 0)); bh = float(bb.get("height", 0))
    except (TypeError, ValueError):
        return 0.0
    if aw <= 0 or ah <= 0 or bw <= 0 or bh <= 0:
        return 0.0
    ix1 = max(ax, bx); iy1 = max(ay, by)
    ix2 = min(ax + aw, bx + bw); iy2 = min(ay + ah, by + bh)
    iw = ix2 - ix1; ih = iy2 - iy1
    if iw <= 0 or ih <= 0:
        return 0.0
    inter = iw * ih
    union = aw * ah + bw * bh - inter
    return inter / union if union > 0 else 0.0


def _class_aware_nms(
    elements: List["ExternalModelElement"],
    iou_threshold: float,
) -> List["ExternalModelElement"]:
    """
    Drop duplicate same-class detections via non-maximum suppression.
    Cross-class overlaps are KEPT (a card inside a section is expected — that's
    exactly Shahwaiz's intended hierarchy: section is the middle page body and
    cards are the buttons/text/images sitting inside it).
    """
    by_class: Dict[str, List[ExternalModelElement]] = {}
    for el in elements:
        by_class.setdefault((el.type or "").lower(), []).append(el)

    kept: List[ExternalModelElement] = []
    for items in by_class.values():
        items.sort(key=lambda e: e.confidence, reverse=True)
        survivors: List[ExternalModelElement] = []
        for cand in items:
            if any(_iou(cand, s) > iou_threshold for s in survivors):
                continue
            survivors.append(cand)
        kept.extend(survivors)
    return kept


def _roboflow_to_element(prediction: Dict[str, Any]) -> Optional[ExternalModelElement]:
    try:
        cx = float(prediction["x"])
        cy = float(prediction["y"])
        w = float(prediction["width"])
        h = float(prediction["height"])
    except (KeyError, TypeError, ValueError):
        return None

    class_name = str(prediction.get("class") or prediction.get("class_name") or "container")
    confidence = float(prediction.get("confidence", 0.0))
    detection_id = prediction.get("detection_id") or prediction.get("id")

    return ExternalModelElement(
        id=str(detection_id) if detection_id else None,
        type=class_name,
        confidence=confidence,
        label=class_name.capitalize(),
        bounds={
            "x": cx - w / 2.0,
            "y": cy - h / 2.0,
            "width": w,
            "height": h,
        },
        attributes={"roboflow_class": class_name},
    )


def detect_with_roboflow(
    sketch_image: str,
    canvas_size: Optional[Tuple[int, int]] = None,
    *,
    api_key: Optional[str] = None,
    model_id: Optional[str] = None,
    api_url: Optional[str] = None,
    confidence_threshold: Optional[float] = None,
) -> Optional[ExternalModelOutput]:
    """Call Roboflow with a base64 sketch and return an ExternalModelOutput, or None on failure."""
    api_key = api_key or os.getenv("ROBOFLOW_API_KEY")
    if not api_key or not sketch_image:
        return None

    try:
        from inference_sdk import InferenceHTTPClient
    except ImportError as error:
        print(f"Roboflow inference-sdk not installed: {error}")
        return None

    threshold = (
        confidence_threshold
        if confidence_threshold is not None
        else float(os.getenv("ROBOFLOW_CONFIDENCE_THRESHOLD", ROBOFLOW_DEFAULT_THRESHOLD))
    )
    resolved_model_id = model_id or os.getenv("ROBOFLOW_MODEL_ID", ROBOFLOW_DEFAULT_MODEL_ID)
    resolved_api_url = api_url or os.getenv("ROBOFLOW_API_URL", ROBOFLOW_DEFAULT_API_URL)

    try:
        image_bytes = _decode_sketch_image(sketch_image)
    except (ValueError, base64.binascii.Error) as error:
        print(f"Roboflow: could not decode sketch image: {error}")
        return None

    try:
        from PIL import Image
    except ImportError as error:
        print(f"Pillow not installed: {error}")
        return None

    # Composite RGBA → RGB onto a WHITE background.
    # The Konva canvas exports PNGs with a transparent background. PIL's plain
    # .convert("RGB") fills transparent pixels with BLACK, and Roboflow's
    # preprocessor does the same thing on its end. Result: dark sketch lines
    # rendered onto black → effectively invisible → model returns 0 predictions
    # even on a sketch that looks fine when previewed in Windows / Mac (those
    # OSes composite alpha over white before display, hiding the bug).
    try:
        raw_image = Image.open(io.BytesIO(image_bytes))
        has_alpha = raw_image.mode in ("RGBA", "LA") or (
            raw_image.mode == "P" and "transparency" in raw_image.info
        )
        if has_alpha:
            rgba = raw_image.convert("RGBA")
            background = Image.new("RGB", rgba.size, (255, 255, 255))
            background.paste(rgba, mask=rgba.split()[3])  # alpha channel as mask
            pil_image = background
        else:
            pil_image = raw_image.convert("RGB")
    except Exception as error:
        print(f"Roboflow: could not open sketch image: {error}")
        return None

    debug = os.getenv("DEBUG_AI_PROMPT", "").lower() in ("1", "true", "yes", "on")

    # In debug mode, dump the white-composited PNG that's about to be sent to
    # Roboflow. Critically: we save the COMPOSITED version, not the raw bytes,
    # so what you see locally is exactly what the model sees (no more "looks
    # fine in my image viewer but the model can't detect anything" mismatch).
    if debug:
        try:
            debug_dir = os.path.join(
                os.path.dirname(os.path.abspath(__file__)), "..", "..", "debug"
            )
            os.makedirs(debug_dir, exist_ok=True)
            debug_path = os.path.join(debug_dir, "last_sketch.png")
            pil_image.save(debug_path, format="PNG")
            print(
                f"[debug] sketch PNG saved to {os.path.abspath(debug_path)} "
                f"({pil_image.width}x{pil_image.height}, mode={pil_image.mode}, "
                f"alpha={'composited' if has_alpha else 'n/a'})"
            )
        except Exception as dump_error:
            print(f"[debug] could not save sketch PNG: {dump_error}")

    # Roboflow's hosted inference applies its OWN confidence floor (default 0.4)
    # before sending predictions back. Override it down to a small value so we
    # can see everything the model considered, then apply our own threshold
    # (ROBOFLOW_CONFIDENCE_THRESHOLD) on the client side for actual filtering.
    server_confidence_floor = float(
        os.getenv("ROBOFLOW_SERVER_CONFIDENCE", "0.05")
    )

    try:
        client = InferenceHTTPClient(api_url=resolved_api_url, api_key=api_key)
        try:
            from inference_sdk import InferenceConfiguration
            client.configure(
                InferenceConfiguration(confidence_threshold=server_confidence_floor)
            )
        except Exception as cfg_error:
            print(f"Roboflow: could not set custom confidence (using SDK defaults): {cfg_error}")
        result = client.infer(pil_image, model_id=resolved_model_id)
    except Exception as error:
        print(f"Roboflow inference failed: {error}")
        return None

    predictions = result.get("predictions") if isinstance(result, dict) else None
    if debug:
        print(
            f"[debug] Roboflow API URL={resolved_api_url} model={resolved_model_id} "
            f"threshold={threshold}"
        )
        print(f"[debug] Roboflow raw result keys: {list(result.keys()) if isinstance(result, dict) else type(result).__name__}")
        print(f"[debug] Roboflow raw predictions: {len(predictions) if predictions else 0}")
        if predictions:
            for i, p in enumerate(predictions, 1):
                cls = p.get("class") or p.get("class_name") or "?"
                conf = p.get("confidence", 0)
                print(f"  raw {i}. class={cls} confidence={conf:.3f}")

    if not predictions:
        if debug:
            print("[debug] Roboflow returned no predictions at all → returning None")
        return None

    # Image dimensions (in pixel space Roboflow returns bounds in) — used by the
    # oversized-card sanity guard.
    image_meta = result.get("image") if isinstance(result, dict) else None
    img_w = float(image_meta.get("width") or 0) if isinstance(image_meta, dict) else 0.0
    img_h = float(image_meta.get("height") or 0) if isinstance(image_meta, dict) else 0.0
    image_area = img_w * img_h

    nms_iou = float(os.getenv("ROBOFLOW_NMS_IOU", _DEFAULT_NMS_IOU))

    # Pass 1: convert + per-class threshold + oversize-card guard.
    # Thresholds are per-class because card / navbar / footer / section have
    # very different confidence calibrations (see _DEFAULT_PER_CLASS_THRESHOLDS).
    pre_nms: List[ExternalModelElement] = []
    rejected_low_conf = 0
    rejected_oversize_card = 0
    parse_errors = 0
    if debug:
        print("[debug] per-class thresholds:")
        for cls in ("navbar", "footer", "section", "card"):
            print(f"    {cls}: {_resolve_class_threshold(cls, threshold):.2f}")
    for prediction in predictions:
        element = _roboflow_to_element(prediction)
        if element is None:
            parse_errors += 1
            continue
        cls = (element.type or "").lower()
        cls_threshold = _resolve_class_threshold(cls, threshold)
        if element.confidence < cls_threshold:
            rejected_low_conf += 1
            if debug:
                print(
                    f"[debug] reject {cls} conf={element.confidence:.3f} "
                    f"< per-class threshold {cls_threshold:.2f}"
                )
            continue
        if cls == "card" and image_area > 0:
            b = element.bounds or {}
            cw = float(b.get("width", 0)); ch = float(b.get("height", 0))
            ratio = (cw * ch) / image_area if image_area > 0 else 0.0
            if ratio > _MAX_CARD_AREA_RATIO:
                rejected_oversize_card += 1
                if debug:
                    print(
                        f"[debug] reject oversized card: covers {ratio:.0%} of image "
                        f"(model is confusing it with the section container)"
                    )
                continue
        pre_nms.append(element)

    # Pass 2: class-aware NMS to collapse duplicate same-class detections.
    elements = _class_aware_nms(pre_nms, nms_iou)

    if debug:
        nms_dropped = len(pre_nms) - len(elements)
        print(
            f"[debug] After per-class threshold: kept={len(pre_nms)} "
            f"low-conf-rejected={rejected_low_conf} "
            f"oversize-card-rejected={rejected_oversize_card} "
            f"parse-errors={parse_errors}"
        )
        print(
            f"[debug] After class-aware NMS (iou>{nms_iou}): kept={len(elements)} "
            f"(dropped {nms_dropped} same-class duplicates)"
        )

    if not elements:
        if debug:
            print("[debug] All predictions filtered out → returning None")
        return None

    elements.sort(key=lambda el: el.bounds.get("y", 0.0))

    metadata: Dict[str, Any] = {
        "model_id": resolved_model_id,
        "raw_prediction_count": len(predictions),
        "filtered_prediction_count": len(elements),
        "confidence_threshold": threshold,
    }
    if canvas_size:
        metadata["canvas_width"], metadata["canvas_height"] = canvas_size
    if isinstance(image_meta, dict):
        metadata["image_width"] = image_meta.get("width")
        metadata["image_height"] = image_meta.get("height")

    return ExternalModelOutput(
        source="roboflow",
        model_version=resolved_model_id,
        elements=elements,
        metadata=metadata,
    )


def _build_gemini_prompt(
    elements: List[ExternalModelElement],
    framework: str,
    styling: str,
    description: Optional[str],
    extra_text: Optional[List[str]] = None,
) -> str:
    element_lines = []
    for index, element in enumerate(elements, start=1):
        bounds = element.bounds or {}
        attrs = element.attributes or {}
        label_text = attrs.get("label_text")
        positioned_texts = attrs.get("positioned_texts") or []
        synthetic = attrs.get("synthetic") is True

        suffix_parts: List[str] = []
        if synthetic:
            suffix_parts.append(
                " [SYNTHESIZED — the detector missed this region; "
                "we inferred it from text/card positions]"
            )
        if label_text:
            suffix_parts.append(f' — contains text: "{label_text}"')

        line = (
            f"{index}. {element.type} "
            f"(confidence={element.confidence:.2f}, "
            f"x={bounds.get('x', 0):.0f}, y={bounds.get('y', 0):.0f}, "
            f"w={bounds.get('width', 0):.0f}, h={bounds.get('height', 0):.0f})"
            f"{''.join(suffix_parts)}"
        )

        if positioned_texts:
            line += (
                "\n   inner text labels (positions are inside this container — "
                "use them to infer the layout / visual order):"
            )
            for pt in positioned_texts:
                line += (
                    f"\n     - \"{pt.get('text', '')}\" "
                    f"at (x={float(pt.get('x', 0)):.0f}, y={float(pt.get('y', 0)):.0f}, "
                    f"w={float(pt.get('width', 0)):.0f}, h={float(pt.get('height', 0)):.0f})"
                )

        element_lines.append(line)
    elements_block = "\n".join(element_lines) if element_lines else "(no elements detected)"

    extra_text_block = ""
    if extra_text:
        joined = "\n".join(f'- "{t}"' for t in extra_text)
        extra_text_block = (
            "\nAdditional text the user wrote on the canvas (place these somewhere sensible if they don't fit a specific component):\n"
            f"{joined}\n"
        )

    framework_instructions = {
        "react": "Return a single default-exported React functional component. Use JSX and Tailwind utility classes for all styling. No external imports beyond React.",
        "html": "Return a complete standalone HTML document with Tailwind via the CDN script tag https://cdn.tailwindcss.com. No external CSS files.",
        "vue": "Return a single Vue 3 single-file component with <template> and <script> blocks. Use Tailwind utility classes for styling.",
    }
    framework_rule = framework_instructions.get(framework, framework_instructions["react"])

    description_block = f"User description: {description}\n" if description else ""

    return (
        "You are a senior frontend engineer. Generate production-ready UI code from the detected sketch components below.\n\n"
        f"Target framework: {framework}\n"
        f"Styling: {styling}\n"
        f"{description_block}\n"
        "Detected components (ordered top to bottom):\n"
        f"{elements_block}\n"
        f"{extra_text_block}\n"
        "How the detector was trained (read this carefully — the labels are not what their names suggest):\n"
        "- `navbar` = the top horizontal bar region. CONTAINER, not content.\n"
        "- `footer` = the bottom horizontal bar region. CONTAINER, not content.\n"
        "- `section` = the entire middle band of the page between navbar and footer. CONTAINER, not content.\n"
        "- `card` = ANY single content element. The model was deliberately trained to label EVERY content unit as `card` — every button, text label, heading, paragraph, input field, image, icon, or link is a `card`. The detector does NOT distinguish between these subtypes; it only marks \"this is one piece of content\". Your job is to infer the real semantic role of each `card` from:\n"
        "    * its position — `card` inside `navbar` bounds → it's a logo or nav link; inside `footer` → footer link/copyright; inside `section` → main content.\n"
        "    * its size and aspect ratio — small wide rectangle → button; long thin horizontal rectangle → input field; squarish or landscape with no text → image / media placeholder; wide short with text → heading or paragraph.\n"
        "    * its attached `contains text` annotation — short action-style text (\"Submit\", \"Sign up\", \"Buy now\", \"Login\") → button; trailing colon (\"Email:\", \"Password:\") → label for an adjacent input; longer phrase → heading or paragraph; single word like \"Home\"/\"Pricing\"/\"About\" inside a navbar → nav link.\n"
        "  Render each `card` as the appropriate semantic element (h1/h2/p/a/button/input/img), NEVER literally as a generic <div className=\"card\">.\n"
        "- A container (navbar/footer/section) MAY have no `card` children if the detector missed them. In that case, the container's `inner text labels` block lists the user's text annotations with their positions — use those positions to lay them out.\n"
        "- An element marked `[SYNTHESIZED]` was NOT returned by the detector — the pipeline inferred it from clustered text/card positions. Treat it as a real container.\n\n"
        "Layout rules:\n"
        "- Compose the components in the order given (which is top-to-bottom on the canvas). A `navbar` MUST render at the top of the page; a `footer` MUST render at the bottom; everything else goes between them in canvas-y order.\n"
        "- Inside a navbar, multiple cards / text labels are nav items — arrange them horizontally, with the leftmost one (smallest x) typically being the brand/logo and the rightmost ones being the nav links.\n"
        "- Inside a section with stacked cards / text labels (similar x, increasing y), arrange them vertically. Group an `Email:`-style label with the wide-thin card immediately below or beside it as a labelled input.\n"
        "- A `card` whose attached text is an action verb is a `<button>`. A `card` immediately below a label-style text and shaped wide-thin is an `<input>`. A long text-only annotation in a section is a heading or paragraph.\n"
        "- When a component is annotated with `contains text: \"...\"`, that text is the COMPLETE intended copy. Use it verbatim. Do NOT prefix, suffix, or augment it with boilerplate (no \"©\", \"All rights reserved\", \"Welcome to\", taglines, slogans, default headings). If the user wrote `\"This is the footer\"`, the footer's only visible text is `\"This is the footer\"`.\n"
        "- For components WITHOUT a `contains text:` annotation, use minimal, sensible default content appropriate to the inferred role (an unlabelled button can say \"Submit\"; an unlabelled heading can say \"Welcome\"). Keep defaults short and avoid inventing branding/copyright text.\n"
        "- The \"Additional text the user wrote on the canvas\" list (if present) is unbound text — place each item somewhere reasonable, verbatim, no augmentation.\n"
        "- The output should be visually polished and responsive.\n\n"
        f"Output rules:\n- {framework_rule}\n"
        "- Return ONLY the code. No prose, no markdown fences, no explanations."
    )


def generate_with_gemini(
    elements: List[ExternalModelElement],
    framework: str,
    styling: str,
    description: Optional[str],
    *,
    api_key: Optional[str] = None,
    extra_text: Optional[List[str]] = None,
) -> Optional[str]:
    """Call Gemini to synthesize code from detected elements. Returns code string or None on failure."""
    api_key = api_key or os.getenv("GEMINI_API_KEY")
    if not api_key or not elements:
        return None

    try:
        import google.generativeai as genai
    except ImportError as error:
        print(f"google-generativeai not installed: {error}")
        return None

    try:
        genai.configure(api_key=api_key)
    except Exception as error:
        print(f"Gemini configure failed: {error}")
        return None

    prompt = _build_gemini_prompt(elements, framework, styling, description, extra_text=extra_text)

    for model_name in (GEMINI_PRIMARY_MODEL, GEMINI_FALLBACK_MODEL):
        try:
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(prompt)
            text = getattr(response, "text", None)
            if text:
                return _strip_code_fences(text)
            print(f"Gemini [{model_name}] returned empty response")
        except Exception as error:
            print(f"Gemini [{model_name}] failed: {error}")

    # TODO(H5 follow-up): when both Gemini models fail (typically free-tier
    # quota exhaustion: 429 GenerateRequestsPerDayPerProjectPerModel), fall
    # through to OpenRouter as a *generation* fallback (separate from the
    # OpenRouter chat-refinement path in main.py — different system prompt,
    # different model pool). This breaks CLAUDE_CONTEXT decision #2 ("Gemini
    # only for code generation") so it's a real architectural change and
    # needs an explicit go-ahead. Until then, callers fall back to the
    # template generator in CodeGenerator._template_based_generation, which
    # produces a near-empty shell for the 4-class output.
    return None


class SketchDetector:
    """
    Sketch detection wrapper. Primary path is Roboflow (see detect_with_roboflow);
    this class provides the OpenCV contour fallback when Roboflow is unavailable
    or returns no predictions.
    """

    def __init__(self, model_path: str = None):
        # Kept for backward-compatible constructor signature; no local model is loaded.
        self.model_path = model_path

    def detect(
        self,
        preprocessed_image: np.ndarray,
        external_output: Optional[Any] = None,
    ) -> List[Dict[str, Any]]:
        resolved_external_elements = external_elements_from_output(external_output)
        if resolved_external_elements:
            return resolved_external_elements

        return self._fallback_detection(preprocessed_image)

    def detect_from_external_output(
        self,
        external_output: Any,
    ) -> List[Dict[str, Any]]:
        """Normalize a model JSON payload into detected element dictionaries."""
        return external_elements_from_output(external_output)

    def _fallback_detection(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """
        Simple contour-based detection as fallback before model is trained
        This is just for development - replace with your trained CNN!
        """
        import cv2

        # Convert to grayscale
        if len(image.shape) == 3:
            gray = cv2.cvtColor((image * 255).astype(np.uint8), cv2.COLOR_RGB2GRAY)
        else:
            gray = (image * 255).astype(np.uint8)

        # Find contours
        _, thresh = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY_INV)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        elements = []
        for contour in contours:
            area = cv2.contourArea(contour)
            if area < 100:  # Filter small noise
                continue

            x, y, w, h = cv2.boundingRect(contour)
            aspect_ratio = w / h if h > 0 else 1

            # Simple heuristic classification
            if 0.3 <= aspect_ratio <= 0.7 and area < 5000:
                elem_type = "button"
            elif aspect_ratio > 3 and h < 50:
                elem_type = "input"
            elif aspect_ratio > 1.5:
                elem_type = "container"
            else:
                elem_type = "text"

            elements.append({
                "type": elem_type,
                "confidence": 0.75,  # Placeholder confidence
                "bounds": {"x": float(x), "y": float(y), "width": float(w), "height": float(h)},
                "label": f"{elem_type.capitalize()}"
            })

        return elements


class CodeGenerator:
    """
    Code generation wrapper. Primary path is Gemini (see generate_with_gemini);
    this class provides the template-based fallback when Gemini is unavailable
    or the external output already contains code.
    """

    def __init__(self, model_path: str = None):
        self.model_path = model_path

    def generate(
        self,
        elements: List[Dict],
        framework: str,
        description: str = None,
        external_output: Optional[Any] = None,
    ) -> str:
        resolved_output = coerce_external_model_output(external_output)
        if resolved_output:
            if resolved_output.framework:
                framework = resolved_output.framework

            if resolved_output.description and not description:
                description = resolved_output.description

            if resolved_output.generated_code:
                return _strip_code_fences(resolved_output.generated_code)

            if resolved_output.elements:
                elements = [
                    element.model_dump(exclude_none=True)
                    for element in resolved_output.elements
                ]

        return self._template_based_generation(elements, framework, description)

    def _template_based_generation(self, elements: List[Dict], framework: str, description: str) -> str:
        """
        Template-based code generation
        This is a reasonable FYP approach if you focus CNN training on sketch detection
        """
        if framework == "react":
            return self._generate_react(elements, description)
        elif framework == "html":
            return self._generate_html(elements, description)
        elif framework == "vue":
            return self._generate_vue(elements, description)
        else:
            return self._generate_react(elements, description)

    def _generate_react(self, elements: List[Dict], description: str) -> str:
        """
        Generate a usable React + Tailwind component as the LAST-RESORT fallback when
        Gemini is unavailable. Handles the 4 Roboflow classes (navbar/footer/section/
        card) plus the legacy contour-fallback classes (button/input/text/container).
        Cards are inferred to button / input / heading / paragraph / image based on
        attached text + bbox aspect ratio.
        """
        sorted_elements = sorted(elements, key=_sort_key)

        body_lines: List[str] = []
        if description:
            body_lines.append(f"      {{/* {description} */}}")
        for elem in sorted_elements:
            body_lines.append(self._render_element_react(elem))

        body = "\n".join(line for line in body_lines if line)

        return (
            "export default function GeneratedComponent() {\n"
            "  return (\n"
            "    <div className=\"min-h-screen flex flex-col bg-white text-gray-900\">\n"
            f"{body}\n"
            "    </div>\n"
            "  );\n"
            "}"
        )

    def _render_element_react(self, elem: Dict) -> str:
        elem_type = (elem.get('type') or '').lower()
        attrs = elem.get('attributes') or {}
        label_text = (attrs.get('label_text') or '').strip()
        positioned = attrs.get('positioned_texts') or []
        bounds = elem.get('bounds') or {}
        try:
            w = float(bounds.get('width', 0)); h = float(bounds.get('height', 0))
        except (TypeError, ValueError):
            w = h = 0.0
        aspect = (w / h) if h > 0 else 1.0

        if elem_type == 'navbar':
            items = [pt.get('text', '') for pt in positioned] or (
                [t.strip() for t in label_text.split('/')] if label_text else []
            )
            items = [t for t in items if t]
            if items:
                links = "".join(
                    f'<a href="#" className="hover:text-blue-600">{t}</a>' for t in items[1:]
                )
                brand = items[0]
                return (
                    '      <header className="flex items-center justify-between px-6 py-4 border-b">\n'
                    f'        <span className="font-bold text-lg">{brand}</span>\n'
                    f'        <nav className="flex gap-6 text-sm">{links}</nav>\n'
                    '      </header>'
                )
            return (
                '      <header className="flex items-center justify-between px-6 py-4 border-b">\n'
                '        <span className="font-bold text-lg">Brand</span>\n'
                '        <nav className="flex gap-6 text-sm"><a href="#">Home</a></nav>\n'
                '      </header>'
            )

        if elem_type == 'footer':
            items = [pt.get('text', '') for pt in positioned] or (
                [t.strip() for t in label_text.split('/')] if label_text else []
            )
            items = [t for t in items if t]
            inner = " ".join(f'<span>{t}</span>' for t in items) if items else '<span>Footer</span>'
            return (
                '      <footer className="mt-auto flex items-center justify-center gap-4 px-6 py-4 border-t text-sm text-gray-600">\n'
                f'        {inner}\n'
                '      </footer>'
            )

        if elem_type == 'section':
            if positioned:
                inner = "\n".join(
                    f'        <p className="text-gray-700">{pt.get("text", "")}</p>'
                    for pt in positioned
                )
            elif label_text:
                inner = f'        <p className="text-gray-700">{label_text}</p>'
            else:
                inner = '        {/* section content */}'
            return (
                '      <section className="flex-1 px-6 py-10">\n'
                f'{inner}\n'
                '      </section>'
            )

        if elem_type == 'card':
            text = label_text
            text_lower = text.lower()
            ACTION_HINTS = (
                'submit', 'sign up', 'signup', 'log in', 'login', 'register',
                'subscribe', 'continue', 'send', 'buy', 'add', 'save', 'go',
            )
            is_action = bool(text) and any(hint in text_lower for hint in ACTION_HINTS)
            looks_like_input = (aspect > 3 and h > 0 and not text)
            looks_like_image = (w * h > 30000 and not text and 0.6 <= aspect <= 1.8)

            if is_action:
                return (
                    f'      <button className="rounded-md bg-blue-600 px-6 py-2 text-white font-medium hover:bg-blue-700 self-center my-2">{text}</button>'
                )
            if text and looks_like_input:
                return (
                    f'      <input type="text" placeholder="{text}" className="rounded-md border border-gray-300 px-3 py-2 mx-auto my-2 w-72" />'
                )
            if looks_like_input:
                return (
                    '      <input type="text" placeholder="Enter text" className="rounded-md border border-gray-300 px-3 py-2 mx-auto my-2 w-72" />'
                )
            if looks_like_image:
                return (
                    '      <div className="bg-gray-100 rounded-md mx-auto my-2 h-40 w-64 flex items-center justify-center text-gray-400">Image</div>'
                )
            if text:
                if len(text) > 30:
                    return f'      <p className="text-gray-700 text-center my-2">{text}</p>'
                return f'      <h2 className="text-xl font-semibold text-center my-2">{text}</h2>'
            return '      <div className="border border-gray-200 rounded-md p-4 mx-auto my-2 w-64 text-center text-gray-400">Item</div>'

        # Legacy classes from the OpenCV contour fallback (no Roboflow involvement).
        label = elem.get('label') or elem_type.capitalize()
        if elem_type == 'button':
            return f'      <button className="rounded-md bg-blue-600 px-6 py-2 text-white font-medium hover:bg-blue-700 self-center my-2">{label}</button>'
        if elem_type == 'input':
            return f'      <input type="text" placeholder="{label}" className="rounded-md border border-gray-300 px-3 py-2 mx-auto my-2 w-72" />'
        if elem_type == 'text':
            return f'      <p className="text-gray-700 my-2">{label}</p>'
        if elem_type == 'container':
            return '      <div className="rounded-md border border-gray-200 p-4 my-2">{/* container */}</div>'
        return f'      <div className="border border-gray-200 rounded-md p-2 my-1 text-sm text-gray-500">{label}</div>'

    def _generate_html(self, elements: List[Dict], description: str) -> str:
        """Generate HTML code"""
        sorted_elements = sorted(elements, key=_sort_key)

        code = "<!DOCTYPE html>\n<html>\n<head>\n"
        code += "  <title>Generated UI</title>\n"
        code += "  <script src=\"https://cdn.tailwindcss.com\"></script>\n"
        code += "</head>\n<body>\n"
        code += "  <div class=\"flex flex-col gap-4 p-8 max-w-md mx-auto\">\n"

        for elem in sorted_elements:
            elem_type = elem.get('type', 'div')
            label = elem.get('label', elem_type.capitalize())

            if elem_type == 'button':
                code += f"    <button class=\"rounded-lg bg-blue-600 px-6 py-3 text-white font-semibold hover:bg-blue-700\">{label}</button>\n"
            elif elem_type == 'input':
                code += f"    <input type=\"text\" placeholder=\"{label}\" class=\"rounded-lg border border-gray-300 px-4 py-2\" />\n"
            elif elem_type == 'text':
                code += f"    <p class=\"text-gray-700\">{label}</p>\n"
            elif elem_type == 'container':
                code += (
                    "    <div class=\"rounded-xl border border-gray-200 bg-white p-6 shadow-sm\">\n"
                    "      <!-- Container content -->\n"
                    "    </div>\n"
                )

        code += "  </div>\n</body>\n</html>"
        return code

    def _generate_vue(self, elements: List[Dict], description: str) -> str:
        """Generate Vue component code"""
        code = "<template>\n"
        code += "  <div class=\"flex flex-col gap-4 p-8 max-w-md mx-auto\">\n"

        sorted_elements = sorted(elements, key=_sort_key)

        for elem in sorted_elements:
            elem_type = elem.get('type', 'div')
            label = elem.get('label', elem_type.capitalize())

            if elem_type == 'button':
                code += f"    <button class=\"rounded-lg bg-blue-600 px-6 py-3 text-white font-semibold hover:bg-blue-700\">{label}</button>\n"
            elif elem_type == 'input':
                code += f"    <input type=\"text\" placeholder=\"{label}\" class=\"rounded-lg border border-gray-300 px-4 py-2\" />\n"
            elif elem_type == 'text':
                code += f"    <p class=\"text-gray-700\">{label}</p>\n"
            elif elem_type == 'container':
                code += (
                    "    <div class=\"rounded-xl border border-gray-200 bg-white p-6 shadow-sm\">\n"
                    "      <!-- Container content -->\n"
                    "    </div>\n"
                )

        code += "  </div>\n</template>\n\n"
        code += "<script>\nexport default {\n  name: 'GeneratedComponent'\n}\n</script>"

        return code
