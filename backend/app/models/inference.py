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

    try:
        pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as error:
        print(f"Roboflow: could not open sketch image: {error}")
        return None

    debug = os.getenv("DEBUG_AI_PROMPT", "").lower() in ("1", "true", "yes", "on")

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

    elements: List[ExternalModelElement] = []
    rejected = 0
    for prediction in predictions:
        element = _roboflow_to_element(prediction)
        if element is None:
            rejected += 1
            continue
        if element.confidence >= threshold:
            elements.append(element)
        else:
            rejected += 1

    if debug:
        print(
            f"[debug] After threshold {threshold}: kept={len(elements)} rejected={rejected}"
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
    image_meta = result.get("image") if isinstance(result, dict) else None
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
        label_text = (element.attributes or {}).get("label_text")
        label_suffix = f' — contains text: "{label_text}"' if label_text else ""
        element_lines.append(
            f"{index}. {element.type} "
            f"(confidence={element.confidence:.2f}, "
            f"x={bounds.get('x', 0):.0f}, y={bounds.get('y', 0):.0f}, "
            f"w={bounds.get('width', 0):.0f}, h={bounds.get('height', 0):.0f})"
            f"{label_suffix}"
        )
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
        "About the detection model:\n"
        "- The sketch detector only outputs 4 class labels: `navbar`, `footer`, `section`, `card`.\n"
        "- `navbar` = top navigation bar. `footer` = bottom footer strip. `section` = a large horizontal page band (hero, feature row, etc.).\n"
        "- `card` is a CATCH-ALL inner block — the user uses it for anything that isn't a navbar/footer/section. Depending on its size, position, aspect ratio, and any attached `contains text` annotation, a `card` may actually be:\n"
        "    * a heading or paragraph of text (small height, wide, has text)\n"
        "    * an image / media placeholder (squarish or landscape, no text)\n"
        "    * a button (small, has short action-style text like \"Sign up\", \"Buy now\")\n"
        "    * an input field (wide and short, may have placeholder-style text)\n"
        "    * an actual content card (medium-sized, may have text)\n"
        "  Infer the most likely role for each `card` from its dimensions, position relative to siblings, and text content. Render it as the appropriate semantic element (h1/h2/p, img, button, input, or div), NOT literally as a generic card every time.\n"
        "- When a `section` contains multiple `card` children (by overlapping bounds), treat them as the section's inner content and arrange them in a sensible grid/flex layout.\n"
        "- For empty `card`s with image-like aspect ratios, render an `<img>` with a placeholder source (e.g. `https://placehold.co/{w}x{h}`) sized to the bounds.\n\n"
        "Layout rules:\n"
        "- Compose the listed components in the order given.\n"
        "- When a component is annotated with `contains text: \"...\"`, that text is the COMPLETE intended copy for that component. Use it verbatim. Do NOT augment, prefix, or suffix it with extra boilerplate (no \"©\", \"All rights reserved\", \"Welcome\", filler taglines, slogans, or default headings). If the user wrote `\"This is the footer\"` for the footer, the footer's only visible text is `\"This is the footer\"`.\n"
        "- For components WITHOUT a `contains text:` annotation, use minimal, sensible default content appropriate to the inferred role (e.g. an unlabelled button can say \"Submit\"; an unlabelled heading can say \"Welcome\"). Keep these defaults short and avoid inventing branding/copyright/tagline text.\n"
        "- The \"Additional text the user wrote on the canvas\" section (if present) is unbound text the user added; place each item somewhere reasonable but again, use it verbatim and don't augment it with extra surrounding copy.\n"
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
        """Generate React component code"""
        # Sort elements by Y position (top to bottom)
        sorted_elements = sorted(elements, key=_sort_key)

        code = "export default function GeneratedComponent() {\n"
        code += "  return (\n"
        code += "    <div className=\"flex flex-col gap-4 p-8 max-w-md mx-auto\">\n"

        if description:
            code += "      {/* " + description + " */}\n"

        for elem in sorted_elements:
            elem_type = elem.get('type', 'div')
            label = elem.get('label', elem_type.capitalize())

            if elem_type == 'button':
                code += f"      <button className=\"rounded-lg bg-blue-600 px-6 py-3 text-white font-semibold hover:bg-blue-700 transition-colors\">\n"
                code += f"        {label}\n"
                code += f"      </button>\n"

            elif elem_type == 'input':
                code += f"      <input\n"
                code += f"        type=\"text\"\n"
                code += f"        placeholder=\"{label}\"\n"
                code += f"        className=\"rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none\"\n"
                code += f"      />\n"

            elif elem_type == 'text':
                code += f"      <p className=\"text-gray-700\">{label}</p>\n"

            elif elem_type == 'container':
                code += f"      <div className=\"rounded-lg border border-gray-200 p-4\">\n"
                code += "        {/* Container content */}\n"
                code += f"      </div>\n"

        code += "    </div>\n"
        code += "  );\n"
        code += "}"

        return code

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
