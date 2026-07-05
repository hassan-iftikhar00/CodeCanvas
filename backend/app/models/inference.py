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
import time
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from pydantic import AliasChoices, BaseModel, ConfigDict, Field, ValidationError

ROBOFLOW_DEFAULT_MODEL_ID = "object-detection-4affw/2"
# Use Roboflow's hosted inference endpoint by default.
# `inference_sdk` treats `serverless.roboflow.com` as a v1 server and will try
# to register/load models via `/model/add`, which requires additional auth.
ROBOFLOW_DEFAULT_API_URL = "https://detect.roboflow.com"
ROBOFLOW_DEFAULT_THRESHOLD = 0.4

# Per-class confidence thresholds for object-detection-4affw.
#
# v2 (Fast, 311 images) was structurally under-confident on `card` (returned
# 0.03–0.4 even for clear hits) because the class is a catch-all and the
# training set was tiny. We compensated with card=0.03 + others=0.20.
#
# v4 (Small, 4,481 training-corpus images = 311 real + 2,700 synthetic +
# ~1,470 unaccounted for, likely Roboflow auto-augmentation; trained 2026-06-11) is
# well-calibrated across all four classes. Locally-verified test-set numbers
# at conf=0.20 (see backend/eval_v4.py, run 2026-06-12, n=264):
#   card    P 97.4%  R 98.8%
#   footer  P 95.1%  R 91.7%
#   navbar  P 97.0%  R 96.2%
#   section P 99.5%  R 99.5%
# So 0.20 is now the right floor across the board — the old 0.03 card floor
# would admit noise on v4. If you ever swap back to v2, restore card=0.03.
#
# Override any of these via env: ROBOFLOW_CONFIDENCE_THRESHOLD_<CLASS>=0.05
_DEFAULT_PER_CLASS_THRESHOLDS = {
    "card": 0.20,
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
    sketch_source: Optional[str] = None,
) -> Optional[ExternalModelOutput]:
    """Call Roboflow with a base64 sketch and return an ExternalModelOutput, or None on failure.

    ``sketch_source`` marks where the image came from. ``None``/``"canvas"`` is the
    Konva export path and is left byte-for-byte untouched. ``"upload-photo"`` and
    ``"upload-clean"`` route through ``preprocess_uploaded_photo`` to normalize a
    real-world photo / digital wireframe into the clean line-art the model expects.
    """
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

    # Uploaded images (photo of a paper sketch / digital wireframe) are normalized
    # here so the model sees clean line-art-on-white, like its training data. The
    # canvas export path (sketch_source None/"canvas") is intentionally skipped so
    # it stays byte-identical. Applied BEFORE the debug dump below so the saved PNG
    # reflects exactly what Roboflow receives.
    gemini_pil_image = pil_image  # what Gemini gets for text reading (uploads only)
    if sketch_source in ("upload-photo", "upload-clean"):
        try:
            from app.utils.preprocessing import preprocess_uploaded_photo

            # Binarization helps the detector but destroys faint/blurred text,
            # so Gemini gets the clean (non-binarized) copy with the exact same
            # crop geometry — its pixel space still matches the boxes below.
            processed, clean = preprocess_uploaded_photo(
                np.array(pil_image),
                binarize=(sketch_source == "upload-photo"),
                return_clean=True,
            )
            pil_image = Image.fromarray(processed)
            gemini_pil_image = Image.fromarray(clean)
        except Exception as prep_error:
            print(f"Roboflow: upload preprocessing failed, using raw image: {prep_error}")

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
    except Exception as error:
        print(f"Roboflow: could not create client: {error}")
        return None

    max_attempts = max(1, int(os.getenv("ROBOFLOW_MAX_RETRIES", "3")))
    result = None
    for attempt in range(1, max_attempts + 1):
        try:
            result = client.infer(pil_image, model_id=resolved_model_id)
            break
        except Exception as infer_error:
            err_str = str(infer_error).lower()
            # Credit exhaustion and auth failures cannot recover by retrying.
            non_retryable = any(
                k in err_str
                for k in ("credit", "401", "403", "unauthorized", "forbidden")
            )
            if non_retryable or attempt == max_attempts:
                print(f"Roboflow inference failed: {infer_error}")
                return None
            delay = 2.0 ** (attempt - 1)  # 1 s, then 2 s
            print(f"Roboflow: attempt {attempt}/{max_attempts} failed, retrying in {delay:.0f}s: {infer_error}")
            time.sleep(delay)

    if result is None:
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

    sort_reading_order(elements)

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

    # For uploads, stash the exact (processed) image Roboflow saw so the caller can
    # hand it to Gemini for text-reading. Its pixel space matches the box coords
    # above. Caller pops this before returning so the blob never reaches the browser.
    if sketch_source in ("upload-photo", "upload-clean"):
        try:
            buf = io.BytesIO()
            gemini_pil_image.save(buf, format="PNG")
            metadata["processed_image_b64"] = base64.b64encode(buf.getvalue()).decode("ascii")
        except Exception as enc_error:
            print(f"Roboflow: could not stash processed image for Gemini: {enc_error}")

    return ExternalModelOutput(
        source="roboflow",
        model_version=resolved_model_id,
        elements=elements,
        metadata=metadata,
    )


def _position_phrase(bounds: Dict[str, Any], width: float, height: float) -> str:
    """Human phrasing for a box's location, so the repair prompt can say
    'near the top, spanning the full width' instead of raw pixels alone."""
    x = float(bounds.get("x", 0))
    y = float(bounds.get("y", 0))
    w = float(bounds.get("width", 0))
    h = float(bounds.get("height", 0))
    cx = (x + w / 2) / width if width else 0.5
    cy = (y + h / 2) / height if height else 0.5

    vertical = "top" if cy < 1 / 3 else ("middle" if cy < 2 / 3 else "bottom")
    horizontal = "left" if cx < 1 / 3 else ("center" if cx < 2 / 3 else "right")
    span = ", spanning the full width" if width and w / width > 0.85 else ""
    return f"{vertical} {horizontal} of the page{span}"


def build_repair_prompt(
    code: str,
    framework: str,
    missing: List[Dict[str, Any]],
    extra: List[Dict[str, Any]],
    width: float,
    height: float,
) -> str:
    """Corrective prompt for the auto-repair pass (Decision #25 follow-up).

    The fidelity check re-rendered the generated code and re-detected its
    components with the same vision model that grounded the original
    generation. ``missing``/``extra`` are that check's mismatch report
    (element dicts with type/bounds/optional label). The instruction set is
    deliberately surgical: fix ONLY the listed discrepancies, byte-preserve
    everything else.
    """
    lines: List[str] = [
        "You previously generated UI code from a hand-drawn sketch. An automated",
        "verification step rendered your code and re-detected its components with",
        "the same vision model that analyzed the original sketch. It found the",
        "discrepancies listed below.",
        "",
        f"The layout viewport is {width:.0f}x{height:.0f} pixels.",
        "",
    ]

    if missing:
        lines.append(
            "MISSING — these sketch elements did not appear in your rendered "
            "output. ADD each one at the described position:"
        )
        for i, el in enumerate(missing, start=1):
            bounds = el.get("bounds") or {}
            label = el.get("label")
            label_part = f' labeled "{label}"' if label else ""
            lines.append(
                f"{i}. {el.get('type', 'element')}{label_part} at "
                f"x={bounds.get('x', 0):.0f}, y={bounds.get('y', 0):.0f}, "
                f"w={bounds.get('width', 0):.0f}, h={bounds.get('height', 0):.0f} "
                f"({_position_phrase(bounds, width, height)})"
            )
        lines.append("")

    if extra:
        lines.append(
            "EXTRA — these components appeared in your rendered output but are "
            "NOT in the sketch. REMOVE each one (or merge it into a legitimate "
            "neighbour if it is a duplicate):"
        )
        for i, el in enumerate(extra, start=1):
            bounds = el.get("bounds") or {}
            lines.append(
                f"{i}. {el.get('type', 'element')} at "
                f"x={bounds.get('x', 0):.0f}, y={bounds.get('y', 0):.0f}, "
                f"w={bounds.get('width', 0):.0f}, h={bounds.get('height', 0):.0f} "
                f"({_position_phrase(bounds, width, height)})"
            )
        lines.append("")

    lines += [
        "RULES:",
        "- Fix ONLY the discrepancies listed above. Do not restyle, rename,",
        "  reorder, or rewrite anything else — unchanged parts of the code must",
        "  remain byte-identical.",
        "- Do not invent content: added elements get minimal placeholder text",
        "  consistent with their type (or the label given above).",
        f"- Keep the output a complete, valid {framework} file in the same",
        "  structure as the current code (same component name, same export).",
        "- Return ONLY the complete updated code. No explanations, no markdown",
        "  fences, no commentary.",
        "",
        "CURRENT CODE:",
        code,
    ]
    return "\n".join(lines)


def build_annotation_prompt(
    code: str,
    framework: str,
    note: str,
    targets: List[Dict[str, Any]],
    region: Optional[Dict[str, Any]],
    viewport_width: float,
    viewport_height: float,
) -> str:
    """Prompt for the annotate-on-render refinement (App Uplift feature B).

    The user drew directly ON the rendered preview (red-pen markup) and wrote
    an instruction. The frontend resolved the marked region against the
    rendered elements' ``data-cc-id`` boxes, so ``targets`` names the exact
    components the markup covers ({ccId, tag?, rect{x,y,width,height}}).
    ``region`` is the markup's bounding box in the same render-viewport pixel
    space — kept as a fallback locator when no cc-id element intersected the
    markup (e.g. the user circled empty whitespace to ask for something there).

    Like the repair prompt (Decision #26), the instruction set is surgical:
    apply the note ONLY to the marked part, byte-preserve everything else,
    and never drop the data-cc-id grounding attributes (Decision #28).
    """
    lines: List[str] = [
        "You previously generated UI code from a hand-drawn sketch. The user",
        "reviewed the RENDERED page, drew a markup directly on top of it, and",
        "wrote the instruction below. Apply that instruction to the marked",
        "part of the page only.",
        "",
        f"The rendered viewport is {viewport_width:.0f}x{viewport_height:.0f} pixels.",
        "",
        f'USER INSTRUCTION: "{note.strip()}"',
        "",
    ]

    if targets:
        lines.append(
            "MARKED ELEMENTS — the markup covers these components (identified "
            "by their data-cc-id attribute in the current code):"
        )
        for i, t in enumerate(targets, start=1):
            rect = t.get("rect") or {}
            tag = t.get("tag")
            tag_part = f" (<{tag}>)" if tag else ""
            lines.append(
                f'{i}. data-cc-id="{t.get("ccId", "?")}"{tag_part} at '
                f"x={rect.get('x', 0):.0f}, y={rect.get('y', 0):.0f}, "
                f"w={rect.get('width', 0):.0f}, h={rect.get('height', 0):.0f} "
                f"({_position_phrase(rect, viewport_width, viewport_height)})"
            )
        lines.append("")
    elif region:
        lines.append(
            "MARKED REGION — the markup did not land on a tagged component. "
            "Its bounding box in the rendered page is:"
        )
        lines.append(
            f"x={region.get('x', 0):.0f}, y={region.get('y', 0):.0f}, "
            f"w={region.get('width', 0):.0f}, h={region.get('height', 0):.0f} "
            f"({_position_phrase(region, viewport_width, viewport_height)})"
        )
        lines.append(
            "Apply the instruction to whatever the code renders in that area."
        )
        lines.append("")

    lines += [
        "RULES:",
        "- Apply the instruction ONLY to the marked elements/region. Do not",
        "  restyle, rename, reorder, or rewrite anything else — unchanged parts",
        "  of the code must remain byte-identical.",
        '- Keep every data-cc-id="cc-N" attribute exactly as it is. If the',
        "  instruction asks to remove a marked element, remove its whole tagged",
        "  block; never renumber the remaining ids.",
        "- Do not invent content beyond what the instruction asks for.",
        f"- Keep the output a complete, valid {framework} file in the same",
        "  structure as the current code (same component name, same export).",
        "- Return ONLY the complete updated code. No explanations, no markdown",
        "  fences, no commentary.",
        "",
        "CURRENT CODE:",
        code,
    ]
    return "\n".join(lines)


def _cards_share_row(a: "ExternalModelElement", b: "ExternalModelElement") -> bool:
    """True when two boxes' y-intervals overlap by >= 50% of the shorter box."""
    ab, bb = a.bounds or {}, b.bounds or {}
    ay, ah = float(ab.get("y", 0.0)), float(ab.get("height", 0.0))
    by, bh = float(bb.get("y", 0.0)), float(bb.get("height", 0.0))
    overlap = min(ay + ah, by + bh) - max(ay, by)
    shorter = min(ah, bh)
    return shorter > 0 and (overlap / shorter) >= 0.5


def sort_reading_order(elements: List["ExternalModelElement"]) -> None:
    """Sort elements in reading order: top-to-bottom, left-to-right within a row.

    A plain y-sort leaves same-row boxes in arbitrary order — hand-drawn rows
    are never pixel-aligned, so a few pixels of y jitter decides which cell is
    listed first, and Gemini follows the list order when composing grids
    (two cells in one row can render swapped). Consecutive `card` runs whose
    y-intervals chain-overlap are re-sorted by x. Containers keep pure y order:
    they y-overlap their own children and must stay listed before them.
    """
    elements.sort(key=lambda el: float((el.bounds or {}).get("y", 0.0)))
    i = 0
    while i < len(elements):
        if elements[i].type != "card":
            i += 1
            continue
        j = i + 1
        while (
            j < len(elements)
            and elements[j].type == "card"
            and _cards_share_row(elements[j - 1], elements[j])
        ):
            j += 1
        if j - i > 1:
            elements[i:j] = sorted(
                elements[i:j], key=lambda el: float((el.bounds or {}).get("x", 0.0))
            )
        i = j


def _bounds_tuple(el: Any) -> Tuple[float, float, float, float]:
    bounds = (el.get("bounds") if isinstance(el, dict) else el.bounds) or {}
    return (
        float(bounds.get("x", 0)),
        float(bounds.get("y", 0)),
        float(bounds.get("width", 0)),
        float(bounds.get("height", 0)),
    )


def _element_type(el: Any) -> str:
    t = el.get("type") if isinstance(el, dict) else el.type
    return (t or "card").lower()


def _median(vals: List[float]) -> float:
    if not vals:
        return 0.0
    s = sorted(vals)
    mid = len(s) // 2
    return s[mid] if len(s) % 2 else (s[mid - 1] + s[mid]) / 2.0


def _align_old_boxes(
    old_elements: List[Any],
    new_elements: List[Any],
    old_boxes: List[Tuple[float, float, float, float]],
    new_boxes: List[Tuple[float, float, float, float]],
) -> List[Tuple[float, float, float, float]]:
    """Map old-run boxes into the new run's pixel space.

    Two detection runs of the same (or an edited) sketch live in different
    pixel spaces — the canvas export is a tight CROP of the drawn content, so
    adding or removing one element shifts and rescales every coordinate.
    Assuming most elements are unchanged, robust statistics recover the
    transform: scale = median width/height ratio over all same-class pairs
    (unchanged pairs dominate the median), translation = median center delta
    after scaling. Envelope normalization is NOT used because removing an
    element on the envelope edge (e.g. the footer) would distort every other
    coordinate.
    """
    ratios_x: List[float] = []
    ratios_y: List[float] = []
    for oi, old_el in enumerate(old_elements):
        for ni, new_el in enumerate(new_elements):
            if _element_type(old_el) != _element_type(new_el):
                continue
            ow, oh = old_boxes[oi][2], old_boxes[oi][3]
            nw, nh = new_boxes[ni][2], new_boxes[ni][3]
            if ow > 0 and 0.2 <= nw / ow <= 5.0:
                ratios_x.append(nw / ow)
            if oh > 0 and 0.2 <= nh / oh <= 5.0:
                ratios_y.append(nh / oh)
    sx = _median(ratios_x) or 1.0
    sy = _median(ratios_y) or 1.0

    scaled = [(b[0] * sx, b[1] * sy, b[2] * sx, b[3] * sy) for b in old_boxes]

    deltas_x: List[float] = []
    deltas_y: List[float] = []
    for oi, old_el in enumerate(old_elements):
        for ni, new_el in enumerate(new_elements):
            if _element_type(old_el) != _element_type(new_el):
                continue
            deltas_x.append(
                (new_boxes[ni][0] + new_boxes[ni][2] / 2)
                - (scaled[oi][0] + scaled[oi][2] / 2)
            )
            deltas_y.append(
                (new_boxes[ni][1] + new_boxes[ni][3] / 2)
                - (scaled[oi][1] + scaled[oi][3] / 2)
            )
    tx = _median(deltas_x)
    ty = _median(deltas_y)

    return [(b[0] + tx, b[1] + ty, b[2], b[3]) for b in scaled]


def _box_iou(
    a: Tuple[float, float, float, float],
    b: Tuple[float, float, float, float],
) -> float:
    ax2, ay2 = a[0] + a[2], a[1] + a[3]
    bx2, by2 = b[0] + b[2], b[1] + b[3]
    ix = max(0.0, min(ax2, bx2) - max(a[0], b[0]))
    iy = max(0.0, min(ay2, by2) - max(a[1], b[1]))
    inter = ix * iy
    union = a[2] * a[3] + b[2] * b[3] - inter
    return inter / union if union > 0 else 0.0


def diff_detection_sets(
    old_elements: List[Any],
    new_elements: List[Any],
    iou_threshold: float = 0.4,
) -> Dict[str, Any]:
    """Diff two detection sets for incremental regeneration (feature D).

    Elements may be dicts or pydantic objects with type/bounds. The old set
    is first aligned into the new set's pixel space (see ``_align_old_boxes``
    for why raw pixels can't be compared across runs), then matched with
    greedy per-class IoU.

    Returns dict with 0-based indices into the input lists:
      matched: list of (old_index, new_index) pairs
      removed: old indices with no counterpart in the new set
      added:   new indices with no counterpart in the old set
    """
    raw_old = [_bounds_tuple(e) for e in old_elements]
    new_boxes = [_bounds_tuple(e) for e in new_elements]
    old_boxes = (
        _align_old_boxes(old_elements, new_elements, raw_old, new_boxes)
        if old_elements and new_elements
        else raw_old
    )

    candidates: List[Tuple[float, int, int]] = []
    for oi, old_el in enumerate(old_elements):
        for ni, new_el in enumerate(new_elements):
            if _element_type(old_el) != _element_type(new_el):
                continue
            iou = _box_iou(old_boxes[oi], new_boxes[ni])
            if iou >= iou_threshold:
                candidates.append((iou, oi, ni))

    candidates.sort(reverse=True)
    matched: List[Tuple[int, int]] = []
    used_old: set = set()
    used_new: set = set()
    for iou, oi, ni in candidates:
        if oi in used_old or ni in used_new:
            continue
        used_old.add(oi)
        used_new.add(ni)
        matched.append((oi, ni))

    removed = [i for i in range(len(old_elements)) if i not in used_old]
    added = [i for i in range(len(new_elements)) if i not in used_new]
    return {"matched": matched, "removed": removed, "added": added}


def build_incremental_prompt(
    previous_code: str,
    framework: str,
    new_elements: List[ExternalModelElement],
    diff: Dict[str, Any],
) -> str:
    """Delta prompt for incremental regeneration (feature D, Decision #10 style).

    Instead of regenerating the whole page (which loses chat refinements and
    reshuffles everything Gemini felt like reshuffling), we hand back the
    existing code plus ONLY the changes the sketch diff found. The data-cc-id
    attributes from the Element↔Code Linker make removals precise; a final
    re-stamping rule keeps the id ↔ element-list mapping valid for the next run.
    """
    lines: List[str] = [
        "You previously generated UI code from a hand-drawn sketch. The user has",
        "since EDITED the sketch. An object detector compared the old and new",
        "sketches; apply ONLY the changes listed below to the existing code.",
        "",
    ]

    removed = diff.get("removed") or []
    added = diff.get("added") or []

    if removed:
        lines.append(
            "REMOVE — these components are no longer in the sketch. Delete each "
            "one from the code (they are identified by their data-cc-id):"
        )
        for oi in removed:
            lines.append(f'- the element with data-cc-id="cc-{oi + 1}"')
        lines.append("")

    if added:
        # Page extents for human-readable position phrases ("bottom edge,
        # spanning the full width" beats raw pixels for placement decisions).
        page_w = max(
            (float((e.bounds or {}).get("x", 0)) + float((e.bounds or {}).get("width", 0)))
            for e in new_elements
        ) or 1.0
        page_h = max(
            (float((e.bounds or {}).get("y", 0)) + float((e.bounds or {}).get("height", 0)))
            for e in new_elements
        ) or 1.0
        lines.append(
            "ADD — these components are new in the sketch. Insert each one at "
            "the described position relative to the existing layout:"
        )
        for ni in added:
            el = new_elements[ni]
            bounds = el.bounds or {}
            attrs = el.attributes or {}
            label = attrs.get("label_text") or el.label
            label_part = f' with text "{label}"' if label else ""
            role_hint = attrs.get("role_hint")
            role_part = f" (render as: {role_hint})" if role_hint else ""
            lines.append(
                f"- a {el.type}{label_part}{role_part} at x={bounds.get('x', 0):.0f}, "
                f"y={bounds.get('y', 0):.0f}, w={bounds.get('width', 0):.0f}, "
                f"h={bounds.get('height', 0):.0f} "
                f"({_position_phrase(bounds, page_w, page_h)})"
            )
        lines += [
            "",
            "The type names above are DETECTOR CLASSES, not content. `card` "
            "means one generic content unit — infer its real role from its "
            "size, aspect ratio, position and any text: a wide flat bar at the "
            "very bottom of the layout is a FOOTER bar; a wide flat bar at the "
            "top is a navbar; a small wide rectangle is a button; a long thin "
            "one is an input; a large box is an image or content panel. NEVER "
            "render the class name itself ('card', 'section') as visible text, "
            "a placeholder, or an input value.",
        ]
        lines.append("")

    lines.append(
        "For reference, the FULL component list of the edited sketch, in reading "
        "order (top-to-bottom, left-to-right within a row):"
    )
    for index, el in enumerate(new_elements, start=1):
        bounds = el.bounds or {}
        attrs = el.attributes or {}
        label = attrs.get("label_text") or el.label
        label_part = f' — text: "{label}"' if label else ""
        lines.append(
            f"{index}. {el.type} (x={bounds.get('x', 0):.0f}, y={bounds.get('y', 0):.0f}, "
            f"w={bounds.get('width', 0):.0f}, h={bounds.get('height', 0):.0f}){label_part}"
        )

    lines += [
        "",
        "RULES:",
        "- Apply ONLY the ADD/REMOVE changes listed above. Every other part of",
        "  the code must remain byte-identical — same styling, same text, same",
        "  structure, same refinements. You are patching, not regenerating.",
        "- Added elements get minimal placeholder content consistent with their",
        "  type and the text given above. Do not invent extra copy.",
        "- AFTER applying the changes, RE-STAMP every data-cc-id attribute so it",
        "  matches the FULL component list above: the component listed as 1 gets",
        '  data-cc-id="cc-1", 2 gets "cc-2", and so on. This renumbering is the',
        "  ONLY permitted edit to otherwise-unchanged elements.",
        f"- Keep the output a complete, valid {framework} file in the same",
        "  structure as the current code (same component name, same export).",
        "- Return ONLY the complete updated code. No explanations, no markdown",
        "  fences, no commentary.",
        "",
        "CURRENT CODE:",
        previous_code,
    ]
    return "\n".join(lines)


def _build_gemini_prompt(
    elements: List[ExternalModelElement],
    framework: str,
    styling: str,
    description: Optional[str],
    extra_text: Optional[List[str]] = None,
    has_image: bool = False,
    brand_kit: Optional[Dict[str, str]] = None,
    screens: Optional[List[str]] = None,
    current_screen: Optional[str] = None,
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
                " [SYNTHESIZED CONTAINER — the detector missed this region; "
                "we inferred it from text/card positions]"
            )
        if label_text:
            suffix_parts.append(f' — contains text: "{label_text}"')

        role_hint = attrs.get("role_hint")
        if role_hint:
            reason = attrs.get("role_hint_reason")
            reason_suffix = f" ({reason})" if reason else ""
            if attrs.get("role_hint_firm", True):
                suffix_parts.append(f" → RENDER AS: {role_hint}{reason_suffix}")
            else:
                # Shape-only guess — the text drawn in the attached image (if
                # any) must be allowed to override it.
                suffix_parts.append(
                    f" → likely: {role_hint}{reason_suffix} — shape-only guess; "
                    "if the attached image shows action-style text here it is a "
                    "button, heading-style text a heading. The drawn text wins."
                )

        child_alignment = attrs.get("child_alignment")
        if child_alignment:
            suffix_parts.append(
                f" — drawn child alignment: {child_alignment.upper()}"
                " (reproduce this alignment exactly)"
            )

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

    # Brand Kit: user-defined per-project design tokens (colors + font).
    # Styling-only by design — it must never loosen strict fidelity, so the
    # block explicitly scopes itself to colors/typography.
    brand_block = ""
    if brand_kit:
        brand_lines: List[str] = []
        primary = brand_kit.get("primaryColor")
        secondary = brand_kit.get("secondaryColor")
        accent = brand_kit.get("accentColor")
        font = brand_kit.get("fontFamily")
        if primary:
            brand_lines.append(
                f"- Primary color: {primary} — use for primary action buttons, "
                "active/emphasized nav links, and key accents (Tailwind arbitrary "
                f"values, e.g. bg-[{primary}], text-[{primary}], border-[{primary}])."
            )
        if secondary:
            brand_lines.append(
                f"- Secondary color: {secondary} — use for secondary buttons, "
                "borders, dividers, and subtle background tints."
            )
        if accent:
            brand_lines.append(
                f"- Accent color: {accent} — sparing highlights only (links, "
                "focus rings, small badges)."
            )
        if font:
            brand_lines.append(
                f'- Font family: "{font}" — apply to ALL text via a Tailwind '
                f"arbitrary value on the root element (font-['{font}']) with a "
                "sensible generic fallback. For React/Vue output do NOT add "
                "<link> tags, imports, or comments about loading the font — "
                "the hosting page already loads it. Only a standalone HTML "
                "document gets the matching Google Fonts <link> in <head>."
            )
        if brand_lines:
            brand_block = (
                "\nBRAND KIT (user-defined design tokens for this project — apply them consistently):\n"
                + "\n".join(brand_lines)
                + "\n- The brand kit affects COLORS and TYPOGRAPHY ONLY. It is never a reason to add, "
                "remove, resize, or rearrange components — strict fidelity still holds.\n"
            )

    # Multi-screen flows (App Uplift feature A): when the sketch is one screen
    # of a multi-screen app, wire label-matched nav elements to the host
    # shell's window.ccNavigate(screenName). Navigation is bound by label
    # match only — strict fidelity still decides WHAT exists.
    navigation_block = ""
    if screens and len(screens) > 1 and current_screen:
        other_screens = [s for s in screens if s != current_screen]
        screen_list = ", ".join(f'"{s}"' for s in screens)
        other_list = ", ".join(f'"{s}"' for s in other_screens)
        if framework == "html":
            nav_syntax = (
                "give the element href=\"#\" and "
                "onclick=\"window.ccNavigate && window.ccNavigate('ScreenName'); return false;\""
            )
        elif framework == "vue":
            nav_syntax = (
                "define a method `goTo(name) { window.ccNavigate && window.ccNavigate(name); }` "
                "in the script block and bind @click.prevent=\"goTo('ScreenName')\" on the element"
            )
        else:
            nav_syntax = (
                "add onClick={() => window.ccNavigate && window.ccNavigate('ScreenName')} "
                "to the element"
            )
        navigation_block = (
            "\nMULTI-SCREEN APP — NAVIGATION:\n"
            f"This sketch is ONE screen of a multi-screen app. The app's screens are: {screen_list}. "
            f'You are generating the "{current_screen}" screen.\n'
            "- The host shell provides a global function window.ccNavigate(screenName). Do NOT define it, "
            "do NOT add a router, do NOT render the other screens.\n"
            f"- When a button, link, or nav item's text names another screen ({other_list}) — exactly, or "
            'clearly (e.g. "Go to Dashboard", "Back to Home" for a screen named "Home") — wire it to '
            f"navigate there: {nav_syntax}. Use the screen's exact name string as the argument.\n"
            "- Elements whose text does NOT name another screen get NO navigation. Never invent nav "
            "elements that are not in the detected list — strict fidelity still holds.\n"
        )

    # When the caller attaches the actual sketch image (upload path), the detector
    # only gives boxes — it can't read text. This block tells Gemini to READ the
    # baked-in text off the image and bind it to the detected boxes, WITHOUT using
    # the image as licence to add/remove components (strict fidelity still holds).
    image_block = ""
    if has_image:
        image_block = (
            "\nIMPORTANT — AN IMAGE OF THE ORIGINAL SKETCH IS ATTACHED TO THIS REQUEST.\n"
            "The component list above came from an object detector that locates boxes but CANNOT read text. The "
            "attached image is the ground truth for the actual words the user drew. Use it as follows:\n"
            "- READ the text inside or beside each detected component (button labels, nav links, headings, "
            "paragraphs, input labels) and use that text VERBATIM as the component's copy. The box coordinates "
            "above are in the SAME pixel space as the attached image, so match each box to the text drawn at that "
            "location.\n"
            "- The detected component list still defines WHAT EXISTS and HOW MANY. Do NOT add components you see in "
            "the image that are not in the detected list, and do NOT drop any detected component. The image is for "
            "READING TEXT and confirming top-to-bottom / left-to-right order ONLY — it is not licence to redesign "
            "or embellish.\n"
            "- Reading the user's own labels off the image is NOT a strict-fidelity violation — it is using the "
            "source of truth. Inventing copy the user did not write still is. If a detected component has no "
            "readable text in the image, fall back to the short generic placeholder rule below.\n"
            "- An X-cross, or a box crossed by diagonal lines, is the wireframe convention for an image / media "
            "placeholder — render an empty <img> placeholder there, never a literal X character.\n"
            "- A box whose ONLY text is an image-marker word — \"[ image ]\", \"image\", \"img\", \"photo\", "
            "\"[ X ]\", \"img placeholder\", \"picture\" — is ALSO an image / media placeholder. The word marks the "
            "slot; render an empty <img> placeholder there, NOT the literal text.\n"
            "- A box filled with horizontal wavy / zigzag / scribbled lines is the wireframe convention for a TEXT "
            "BLOCK — render it as a short placeholder paragraph (1-2 sentences of lorem ipsum, e.g. \"Lorem ipsum "
            "dolor sit amet, consectetur adipiscing elit.\"), NOT as skeleton bars, NOT as an image placeholder.\n"
            "- A wide-thin box whose in-image text is a field-style word or phrase (Password, Confirm password, "
            "Email, Name, Address, Phone, Search, Username…) is ALWAYS an <input> with that text as its "
            "placeholder — never a <p>, heading, or plain text row.\n"
            "- Reproduce the HORIZONTAL POSITION of items as drawn in the image. If nav items are drawn clustered "
            "in the center of the bar, center them; if a button is drawn on the right edge, put it on the right. "
            "Do not re-arrange items into more conventional positions.\n"
            "- If a piece of text in the image is blurred or unreadable, do NOT guess a specific word — use the "
            "generic placeholder rule below for that component instead.\n"
        )

    return (
        "You are a senior frontend engineer. Generate production-ready UI code from the detected sketch components below.\n\n"
        f"Target framework: {framework}\n"
        f"Styling: {styling}\n"
        f"{description_block}\n"
        "Detected components (in READING ORDER: top-to-bottom, and left-to-right within each row — preserve this exact order when composing rows/grids):\n"
        f"{elements_block}\n"
        f"{extra_text_block}"
        f"{brand_block}"
        f"{navigation_block}"
        f"{image_block}\n"
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
        "- An element marked `[SYNTHESIZED CONTAINER]` was NOT returned by the detector — the pipeline inferred it from clustered text annotations in the top or bottom band of the canvas. Treat it as a real navbar/footer/section. Do not skip it and do not render its text as raw paragraph copy — its `inner text labels` block lists the user's annotations with their positions, render each item at its indicated position.\n\n"
        "Layout rules:\n"
        "- STRICT FIDELITY (most important rule, overrides every other instinct). Render ONLY the detected components above plus any unbound text below. Do NOT invent extra elements — no page titles, no headings, no subtitles, no taglines, no footer copyright lines, no branding text, no decorative dividers, no helper text, no \"this would look better with X\" additions. If the user drew three components, the output has exactly those three. The detector and canvas annotations are the source of truth; you are a renderer, not a designer. A login form drawn as just email + password + button must render as just email + password + button — not as email + password + button + a 'Sign In' heading you decided to add.\n"
        "- Compose the components in the order given (which is reading order: top-to-bottom, left-to-right within a row — same-row items must keep the listed left-to-right order). A `navbar` MUST render at the top of the page; a `footer` MUST render at the bottom; everything else goes between them in canvas-y order.\n"
        "- Inside a navbar, multiple cards / text labels are nav items — arrange them horizontally in canvas x order. Do NOT impose the conventional logo-left/links-right pattern: place the items where the user drew them. If the container line carries a `drawn child alignment` hint, that alignment is mandatory (CENTER → cluster the items in the middle; LEFT/RIGHT → push the group to that side; SPACE-BETWEEN → spread across the full width; STACKED → one per row).\n"
        "- ALIGNMENT FIDELITY: reproduce the drawn alignment exactly, even when it is unconventional. A navbar with logo and links clustered in the center must render centered — not spread to the edges because that is more common. You are a renderer, not a designer.\n"
        "- When an element line carries `RENDER AS:`, that role was computed deterministically from the drawing (label keywords, shape, position). It OVERRIDES your own inference — render exactly that element type. A `RENDER AS: input` card is ALWAYS an <input> with its label as the placeholder, never a <p> or heading. A `likely:` hint is only a shape-based default — the text drawn on/in the component (from its annotation or the attached image) wins over it.\n"
        "- Inside a footer, multiple cards / text labels are footer columns or links — when 2+ items share an overlapping y-range with distinct x positions, render them as horizontally-arranged columns (flex/grid row), NOT stacked rows. Use canvas x positions to decide column order (smallest x = leftmost column). Only stack vertically when items have similar x but increasing y (one above the other on the canvas).\n"
        "- GENERAL HORIZONTAL/VERTICAL RULE (applies to any container, including section): when 2+ sibling cards or labels share an overlapping y-range (their canvas y intervals intersect) but have clearly distinct x positions, render them as a horizontal row (flex/grid columns) in left-to-right canvas x order. Stack vertically only when siblings share similar x but increasing y. Three cards drawn side-by-side on the canvas must NEVER be rendered as three stacked rows.\n"
        "- Inside a section with stacked cards / text labels (similar x, increasing y), arrange them vertically. Group an `Email:`-style label with the wide-thin card immediately below or beside it as a labelled input.\n"
        "- A `card` whose attached text is an action verb is a `<button>`. A `card` immediately below a label-style text and shaped wide-thin is an `<input>`. A long text-only annotation in a section is a heading or paragraph.\n"
        "- When a component is annotated with `contains text: \"...\"`, that text is the COMPLETE intended copy. Use it verbatim. Do NOT prefix, suffix, or augment it with boilerplate (no \"©\", \"All rights reserved\", \"Welcome to\", taglines, slogans, default headings). If the user wrote `\"This is the footer\"`, the footer's only visible text is `\"This is the footer\"`.\n"
        "- When an element has an `inner text labels` block listing multiple positioned items, render each item as its OWN element at the indicated position. Do NOT concatenate the items into one string. Do NOT pick one and drop the others. Each positioned label is a separate piece of content the user drew.\n"
        "- For DETECTED components WITHOUT any text annotation, use a SHORT GENERIC placeholder appropriate to the inferred role (unlabelled button → \"Button\", unlabelled input → placeholder \"Enter text\", unlabelled image card → empty image placeholder, unlabelled heading-shaped card → \"Heading\"). Do NOT invent product-specific copy like \"Welcome\", \"Sign In\", \"Get started today\", \"Subscribe to our newsletter\". Generic placeholders only — if the user wanted real copy, they would have written it on the canvas.\n"
        "- The \"Additional text the user wrote on the canvas\" list (if present) is unbound text — place each item somewhere reasonable, verbatim, no augmentation.\n"
        "- The output should be visually clean and responsive, but visual polish must NEVER lead to adding elements that are not in the detection list.\n"
        "- RESPONSIVE BEHAVIOUR: the sketch depicts the DESKTOP layout. Write mobile-first Tailwind so the page degrades gracefully on small screens: horizontal rows of siblings stack vertically by default and restore the drawn side-by-side arrangement from the `md:` breakpoint up (e.g. `flex flex-col md:flex-row`, `grid grid-cols-1 md:grid-cols-3`). Navbar and footer items may wrap to multiple lines on narrow screens. Responsiveness must NEVER change WHAT is rendered: do not hide elements (`hidden`, `md:hidden`), do not add hamburger menus or mobile-only substitutes — every detected component stays visible at every viewport width, only the arrangement adapts.\n\n"
        f"Output rules:\n- {framework_rule}\n"
        "- COMPONENT IDS (required): stamp every rendered component's ROOT tag with a data-cc-id attribute "
        "matching its number in the detected components list above — the component listed as `1.` gets "
        'data-cc-id="cc-1", `2.` gets data-cc-id="cc-2", and so on. Exactly one data-cc-id per detected '
        "component, on its outermost element only (a container component like navbar/section/footer gets the id "
        "on the container tag; its child cards each carry their own id). Never invent ids for elements not in "
        "the list, never skip or renumber. These ids are machine-read for element-to-code linking.\n"
        "- Return ONLY the code. No prose, no markdown fences, no explanations."
    )


# ── Per-(key, model) state (module-level, process-scoped) ────────────────────
# Wiped on process restart — intentional. 60s RPM cooldowns recover within a
# restart window; 24h daily cooldowns re-arm on the first failed request.
#
# Cooldowns are tracked per-(key, model) — NOT per-key — because Pro and Flash
# on the same key have independent quota pools. Pro hitting per_day does not
# prevent Flash from serving on the same key, and the next request should skip
# the known-exhausted Pro instead of paying ~2s to confirm it's still 429.
_GEMINI_MODELS = (GEMINI_PRIMARY_MODEL, GEMINI_FALLBACK_MODEL)
_model_cooldowns: dict[tuple[int, str], float] = {}  # (key_index, model_name) → unix ts
_key_last_used: dict[int, float] = {}                # key_index → last_success_at


def _is_model_cooled(key_index: int, model_name: str) -> bool:
    return time.time() < _model_cooldowns.get((key_index, model_name), 0.0)


def _model_cooldown_remaining(key_index: int, model_name: str) -> int:
    return max(0, int(_model_cooldowns.get((key_index, model_name), 0.0) - time.time()))


def _apply_model_cooldown(key_index: int, model_name: str, duration: float) -> None:
    _model_cooldowns[(key_index, model_name)] = time.time() + duration


def _is_key_fully_cooled(key_index: int) -> bool:
    """A key is unusable only when EVERY model on it is currently cooling."""
    return all(_is_model_cooled(key_index, m) for m in _GEMINI_MODELS)


def _earliest_resume_ts(n: int) -> float:
    """Earliest unix ts at which any (key, model) becomes usable again.

    Caller should only invoke this when every (key, model) is currently cooling
    — otherwise the min may include a stale zero from a never-cooled pair.
    """
    return min(_model_cooldowns.get((i, m), 0.0) for i in range(n) for m in _GEMINI_MODELS)


class GeminiQuotaExhausted(Exception):
    """Raised when all configured Gemini API keys have hit their DAILY quota."""


class GeminiRateLimited(Exception):
    """Raised when a per-minute rate limit is hit — temporary, retry in ~60 s."""


def _classify_gemini_429(error: Exception) -> str:
    """Classify a Gemini 429-family error as 'per_minute', 'per_day', or 'ambiguous'.

    Uses structured isinstance check first so classification degrades gracefully
    if Google restructures their exception hierarchy. Per-minute takes precedence
    over per-day if both keywords appear in the same message — prevents escalating
    to a 24-hour cooldown during ordinary RPM spikes.
    """
    try:
        from google.api_core import exceptions as _gapi
        is_429 = isinstance(error, (_gapi.ResourceExhausted, _gapi.TooManyRequests))
    except ImportError:
        is_429 = False

    if not is_429:
        cls = type(error).__name__
        raw = str(error)
        is_429 = (
            cls in ("ResourceExhausted", "TooManyRequests")
            or "429" in raw
            or "RESOURCE_EXHAUSTED" in raw
            or "quota" in raw.lower()
        )

    if not is_429:
        return "other"

    msg = str(error).lower()
    is_per_minute = (
        "per-minute" in msg
        or "per minute" in msg
        or "perminute" in msg          # quota_id camelCase: GenerateRequestsPerMinute...
        or "generatecontent-per-minute" in msg
        or "too many requests" in msg
        or "requests per minute" in msg
        or "rate limit" in msg
    )
    is_per_day = (
        "per-day" in msg
        or "per day" in msg
        or "perday" in msg             # quota_id camelCase: GenerateRequestsPerDay...
        or "generatecontent-per-day" in msg
        or "daily" in msg
    )

    # Per-day takes precedence: Google bundles all violated limits in one error.
    # When both appear, the daily limit is the binding constraint (longer reset).
    if is_per_day:
        return "per_day"
    if is_per_minute:
        return "per_minute"
    return "ambiguous"


def generate_with_gemini(
    elements: List[ExternalModelElement],
    framework: str,
    styling: str,
    description: Optional[str],
    *,
    api_key: Optional[str] = None,
    extra_text: Optional[List[str]] = None,
    image_bytes: Optional[bytes] = None,
    prompt_override: Optional[str] = None,
    brand_kit: Optional[Dict[str, str]] = None,
    screens: Optional[List[str]] = None,
    current_screen: Optional[str] = None,
) -> str:
    """Call Gemini to synthesize code from detected elements.

    ``prompt_override`` bypasses ``_build_gemini_prompt`` entirely (the repair
    pass sends its own corrective prompt) while keeping the key rotation,
    cooldown, and model-fallback machinery below. ``elements`` is ignored when
    it is set.

    ``image_bytes`` (upload path only) is the processed sketch PNG. When present
    it is sent to Gemini alongside the text prompt so the model can READ the text
    baked into the pixels (the detector returns boxes but no text). The canvas
    path leaves it None, so the request stays text-only and byte-identical.

    Routing:
      - Keys tried in deterministic order (sorted by env var suffix).
      - Cooldowns are per-(key, model): Pro hitting per_day on key=1 cools only
        (key=1, pro); Flash on the same key keeps serving and is preferred on
        the next request without the wasted ~2s probe to confirm Pro is still 429.
      - per_minute → 60s cooldown on that (key, model), try next model.
      - per_day    → 24h cooldown on that (key, model), try next model.
      - ambiguous  → 60s cooldown on that (key, model), try next model
                     (raw_error logged for classifier tuning).
      - Non-quota errors → no cooldown, try fallback model on same key.
      - Pre-flight + per-key skip: bail / rotate when every model is cooling.
    """
    _key_re = re.compile(r"^GEMINI_API_KEY(_(\d+))?$")
    _env_keys = sorted(
        ((int(m.group(2)) if m.group(2) else 0), v.strip())
        for k, v in os.environ.items()
        if (m := _key_re.match(k)) and v.strip()
    )
    api_keys = [v for _, v in _env_keys]
    if api_key and api_key not in api_keys:
        api_keys.insert(0, api_key)

    if not api_keys:
        raise GeminiQuotaExhausted("No GEMINI_API_KEY configured.")

    try:
        import google.generativeai as genai
    except ImportError as exc:
        raise RuntimeError(f"google-generativeai not installed: {exc}") from exc

    n = len(api_keys)

    # ── Pre-flight: bail immediately if every (key, model) is cooling ────────
    if all(_is_key_fully_cooled(i) for i in range(n)):
        retry_after = max(1, int(_earliest_resume_ts(n) - time.time()))
        print(f"[gemini] all_keys_cooling retry_after={retry_after}s")
        raise GeminiRateLimited(
            f"All Gemini keys are temporarily rate limited. Retry in {retry_after}s."
        )

    # Decode the attached sketch once (upload path). If it fails to decode we fall
    # back to a text-only call rather than aborting code generation.
    sketch_image_part = None
    if image_bytes is not None:
        try:
            from PIL import Image

            sketch_image_part = Image.open(io.BytesIO(image_bytes))
            sketch_image_part.load()  # force decode now so a bad image fails early
        except Exception as img_error:
            print(f"[gemini] could not decode attached image, proceeding text-only: {img_error}")
            sketch_image_part = None

    prompt = prompt_override or _build_gemini_prompt(
        elements,
        framework,
        styling,
        description,
        extra_text=extra_text,
        has_image=sketch_image_part is not None,
        brand_kit=brand_kit,
        screens=screens,
        current_screen=current_screen,
    )

    any_daily_exhausted = False

    for key_index, current_key in enumerate(api_keys):

        if _is_key_fully_cooled(key_index):
            remaining = min(
                _model_cooldown_remaining(key_index, m) for m in _GEMINI_MODELS
            )
            print(
                f"[gemini] key={key_index + 1} status=skipped"
                f" reason=all_models_cooling remaining={remaining}s"
            )
            continue

        try:
            genai.configure(api_key=current_key)
        except Exception as exc:
            print(f"[gemini] key={key_index + 1} status=configure_error error={exc!r}")
            continue

        for model_name in _GEMINI_MODELS:
            if _is_model_cooled(key_index, model_name):
                print(
                    f"[gemini] key={key_index + 1} model={model_name} status=skipped"
                    f" reason=cooling remaining={_model_cooldown_remaining(key_index, model_name)}s"
                )
                continue

            try:
                # Low temperature: this is a rendering task, not a creative one.
                # Default (~1.0) made Gemini invent/move elements between runs on
                # the same sketch. 0.1 instead of 0.0 — pure greedy decoding can
                # degenerate into repetition loops on long outputs.
                model = genai.GenerativeModel(
                    model_name,
                    generation_config={"temperature": 0.1, "top_p": 0.8},
                )
                content = (
                    [prompt, sketch_image_part]
                    if sketch_image_part is not None
                    else prompt
                )
                response = model.generate_content(content)
                text = getattr(response, "text", None)
                if text:
                    _key_last_used[key_index] = time.time()
                    print(
                        f"[gemini] key={key_index + 1} model={model_name}"
                        f" status=success chars={len(text)}"
                    )
                    return _strip_code_fences(text)
                print(
                    f"[gemini] key={key_index + 1} model={model_name}"
                    " status=empty_response"
                )

            except Exception as exc:
                kind = _classify_gemini_429(exc)
                trying_next = "yes" if model_name == GEMINI_PRIMARY_MODEL else "no"

                if kind == "per_day":
                    _apply_model_cooldown(key_index, model_name, 86_400)
                    any_daily_exhausted = True
                    print(
                        f"[gemini] key={key_index + 1} model={model_name}"
                        f" status=per_day_429 trying_fallback={trying_next}"
                        f" cooldown=86400s"
                    )
                    continue

                if kind in ("per_minute", "ambiguous"):
                    _apply_model_cooldown(key_index, model_name, 60)
                    extra = f" raw_error={str(exc)!r}" if kind == "ambiguous" else ""
                    print(
                        f"[gemini] key={key_index + 1} model={model_name}"
                        f" status={kind}_429 trying_fallback={trying_next}"
                        f" cooldown=60s{extra}"
                    )
                    continue

                # Non-quota failure — try fallback model on the same key (no cooldown).
                print(
                    f"[gemini] key={key_index + 1} model={model_name}"
                    f" status=error error={exc!r}"
                )

        # Key became fully cooled during this iteration — log the routing decision.
        if _is_key_fully_cooled(key_index):
            next_key = next(
                (j + 1 for j in range(key_index + 1, n) if not _is_key_fully_cooled(j)),
                None,
            )
            available = sum(1 for j in range(n) if not _is_key_fully_cooled(j))
            if next_key:
                print(
                    f"[gemini] routing key={key_index + 1}->key={next_key}"
                    f" available={available}"
                )
            else:
                print(f"[gemini] routing key={key_index + 1}->none available={available}")

    # ── Post-loop: all keys tried ─────────────────────────────────────────────
    if all(_is_key_fully_cooled(i) for i in range(n)):
        retry_after = max(1, int(_earliest_resume_ts(n) - time.time()))
        print(f"[gemini] all_keys_cooling retry_after={retry_after}s")
        raise GeminiRateLimited(
            f"All Gemini keys are temporarily rate limited. Retry in {retry_after}s."
        )

    if any_daily_exhausted:
        print("[gemini] all_keys_exhausted reason=daily_quota")
        raise GeminiQuotaExhausted(
            f"All {n} Gemini API key(s) have hit their daily quota."
            " Try again tomorrow or add more keys."
        )

    print("[gemini] all_keys_exhausted reason=unknown")
    raise GeminiQuotaExhausted(
        f"All {n} Gemini API key(s) failed — check backend logs for details."
    )


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
