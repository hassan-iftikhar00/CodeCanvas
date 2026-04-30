from __future__ import annotations

import asyncio
import json
import os
import re
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.models.inference import (
    CodeGenerator,
    ExternalModelOutput,
    SketchDetector,
    _build_gemini_prompt,
    create_mock_external_model_output,
    detect_with_roboflow,
    generate_with_gemini,
)


def _debug_ai_enabled() -> bool:
    return os.getenv("DEBUG_AI_PROMPT", "").lower() in ("1", "true", "yes", "on")
from app.utils.preprocessing import preprocess_canvas_data

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR.parent / ".env.local", override=False)

OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
FREE_MODELS = [
    "openai/gpt-oss-120b:free",
    "deepseek/deepseek-r1-0528:free",
    "openai/gpt-oss-20b:free",
]

app = FastAPI(
    title="CodeCanvas AI Backend",
    description="Custom AI models for sketch-to-code generation",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        os.getenv("FRONTEND_URL", "http://localhost:3000"),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CanvasData(BaseModel):
    strokes: Optional[List[List[Dict[str, float]]]] = None
    lines: Optional[List[Dict[str, Any]]] = None
    width: int = 1000
    height: int = 600


class ChatMessage(BaseModel):
    role: str
    content: str


class TextAnnotation(BaseModel):
    text: str
    x: float
    y: float
    width: float = 0.0
    height: float = 0.0


class GenerateCodeRequest(BaseModel):
    canvasData: Optional[CanvasData] = None
    framework: str = "html"
    styling: str = "tailwind"
    description: Optional[str] = None
    projectId: str
    userId: str
    mode: Literal["generate", "chat"] = "generate"
    messages: Optional[List[ChatMessage]] = None
    currentCode: Optional[str] = None
    externalModelOutput: Optional[ExternalModelOutput] = None
    useMockModelOutput: bool = False
    sketchImage: Optional[str] = None
    textAnnotations: Optional[List[TextAnnotation]] = None


class DetectedElement(BaseModel):
    type: str
    confidence: float
    bounds: Dict[str, float]
    label: Optional[str] = None


class GenerateCodeResponse(BaseModel):
    code: str
    success: bool
    detectedElements: List[DetectedElement]
    message: Optional[str] = None
    iteration_id: Optional[str] = None
    usedFallback: Optional[bool] = None


sketch_detector = None
code_generator = None


def create_supabase_client():
    from app.supabase_client import get_supabase_client as _get_supabase_client

    return _get_supabase_client()


def call_openrouter(
    api_key: str,
    model: str,
    system_prompt: str,
    user_content: str,
) -> tuple[int, str]:
    payload = json.dumps(
        {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            "temperature": 0.3,
            "max_tokens": 4096,
        }
    ).encode("utf-8")

    request = urllib.request.Request(
        OPENROUTER_API_URL,
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": os.getenv(
                "NEXT_PUBLIC_SITE_URL", "http://localhost:3000"
            ),
            "X-Title": "CodeCanvas",
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return response.getcode(), response.read().decode("utf-8")
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode("utf-8")


async def refine_chat_with_openrouter(
    user_message: str,
    current_code: str,
) -> Dict[str, Any]:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY is not set")

    system_prompt = (
        "You are CodeCanvas AI - a code-refinement assistant.\n"
        "You receive the user's CURRENT CODE and an INSTRUCTION describing what to change.\n"
        "Return ONLY the complete, updated code - no explanations, no markdown fences, no commentary.\n"
        "Rules:\n"
        "- Preserve the overall structure unless the instruction says otherwise.\n"
        "- Use Tailwind CSS classes for styling changes.\n"
        "- Keep the code valid HTML / JSX.\n"
        "- If the instruction is unclear, make a reasonable best-effort change."
    )
    user_content = (
        "CURRENT CODE:\n```\n"
        f"{current_code}\n"
        "```\n\n"
        f"INSTRUCTION: {user_message}"
    )

    last_error = ""

    for model in FREE_MODELS:
        for attempt in range(2):
            try:
                status, body = call_openrouter(
                    api_key,
                    model,
                    system_prompt,
                    user_content,
                )

                if 200 <= status < 300:
                    try:
                        data = json.loads(body or "{}")
                    except json.JSONDecodeError:
                        last_error = f"{model}: invalid JSON response"
                        break

                    refined = (
                        data.get("choices", [{}])[0]
                        .get("message", {})
                        .get("content", current_code)
                        .strip()
                    )
                    refined = re.sub(r"^```[\w]*\n?", "", refined)
                    refined = re.sub(r"\n?```$", "", refined).strip()

                    used_model = model.split("/")[-1].replace(":free", "")
                    return {
                        "code": refined,
                        "message": f"Code updated (via {used_model}).",
                    }

                last_error = f"{model}: {status} {body}"
                print(f"OpenRouter [{model}] attempt {attempt + 1}: {status}")

                if status == 429 and attempt == 0:
                    await asyncio.sleep(2)
                    continue

                break
            except Exception as fetch_error:
                last_error = f"{model}: {fetch_error}"
                break

    raise RuntimeError(f"All free models failed. Last: {last_error}")


def persist_generation_result(
    supabase,
    project_id: str,
    canvas_data: Any,
    generated_code: str,
    prompt_used: Optional[str],
) -> Optional[str]:
    iteration_id = None

    try:
        iteration_result = supabase.table("iterations").insert(
            {
                "project_id": project_id,
                "canvas_data": canvas_data,
                "generated_code": generated_code,
                "prompt_used": prompt_used,
            }
        ).execute()
        iteration_id = iteration_result.data[0]["id"] if iteration_result.data else None
    except Exception as error:
        print(f"Warning: could not save iteration for project {project_id}: {error}")

    try:
        supabase.table("projects").update(
            {
                "generated_code": generated_code,
                "canvas_data": canvas_data,
            }
        ).eq("id", project_id).execute()
    except Exception as error:
        print(f"Warning: could not update project {project_id}: {error}")

    return iteration_id


def load_project_or_403(supabase, project_id: str, user_id: str):
    project_result = (
        supabase.table("projects")
        .select("*")
        .eq("id", project_id)
        .eq("user_id", user_id)
        .execute()
    )

    if not project_result.data:
        raise HTTPException(status_code=403, detail="Project not found or unauthorized")

    return project_result.data[0]


_TEXT_MATCH_OVERLAP = 0.5  # at least 50% of the text shape must lie inside the element


def _bbox_overlap_ratio(
    ax: float, ay: float, aw: float, ah: float,
    bx: float, by: float, bw: float, bh: float,
) -> float:
    """Return (intersection area) / (a's area). 0 if a has no area."""
    if aw <= 0 or ah <= 0:
        return 0.0
    ix1 = max(ax, bx)
    iy1 = max(ay, by)
    ix2 = min(ax + aw, bx + bw)
    iy2 = min(ay + ah, by + bh)
    iw = ix2 - ix1
    ih = iy2 - iy1
    if iw <= 0 or ih <= 0:
        return 0.0
    return (iw * ih) / (aw * ah)


def _attach_text_annotations(
    elements: List[Any],
    annotations: List[TextAnnotation],
    *,
    debug: bool = False,
) -> List[str]:
    """
    Mutate `elements` to attach matching annotation text into element.attributes['label_text'].

    Match rule:
      - If the text shape has area: match the smallest element whose bbox contains
        at least _TEXT_MATCH_OVERLAP (50%) of the text's area. This rejects text
        that visually sits "on top of" / overlapping a shape's edge but is mostly
        outside it.
      - If the text shape has zero width or height (a bare point): fall back to
        center-point containment in the smallest enclosing element.

    Returns the list of annotation texts that didn't match any element.
    """
    unmatched: List[str] = []
    if not annotations:
        return unmatched

    for ann in annotations:
        text = (ann.text or "").strip()
        if not text:
            continue

        has_area = ann.width > 0 and ann.height > 0
        cx = ann.x + ann.width / 2.0
        cy = ann.y + ann.height / 2.0

        best = None
        best_area = float("inf")
        best_overlap = 0.0
        for elem in elements:
            bounds = getattr(elem, "bounds", None) or {}
            ex = float(bounds.get("x", 0))
            ey = float(bounds.get("y", 0))
            ew = float(bounds.get("width", 0))
            eh = float(bounds.get("height", 0))
            if ew <= 0 or eh <= 0:
                continue

            if has_area:
                overlap = _bbox_overlap_ratio(
                    ann.x, ann.y, ann.width, ann.height,
                    ex, ey, ew, eh,
                )
                if overlap < _TEXT_MATCH_OVERLAP:
                    continue
                area = ew * eh
                if area < best_area:
                    best = elem
                    best_area = area
                    best_overlap = overlap
            else:
                if ex <= cx <= ex + ew and ey <= cy <= ey + eh:
                    area = ew * eh
                    if area < best_area:
                        best = elem
                        best_area = area
                        best_overlap = 1.0

        if best is None:
            if debug:
                print(f"[debug] annotation '{text}' UNMATCHED → extra_text")
            unmatched.append(text)
            continue

        attrs = dict(getattr(best, "attributes", None) or {})
        existing = attrs.get("label_text")
        attrs["label_text"] = f"{existing} / {text}" if existing else text
        best.attributes = attrs
        if debug:
            print(
                f"[debug] annotation '{text}' → {best.type} "
                f"(overlap={best_overlap:.0%}, bbox area={best_area:.0f})"
            )

    return unmatched


async def resolve_external_model_output(
    request: GenerateCodeRequest,
    canvas_data: Dict[str, Any],
) -> Optional[ExternalModelOutput]:
    if request.externalModelOutput is not None:
        print("[trace] using request.externalModelOutput (skipping Roboflow)")
        return request.externalModelOutput

    if request.useMockModelOutput or os.getenv("MODEL_OUTPUT_SOURCE", "").lower() == "mock":
        print("[trace] mock mode active (skipping Roboflow)")
        return create_mock_external_model_output(
            canvas_data,
            framework=request.framework,
            styling=request.styling,
            description=request.description,
        )

    has_sketch = bool(request.sketchImage)
    sketch_len = len(request.sketchImage) if request.sketchImage else 0
    has_key = bool(os.getenv("ROBOFLOW_API_KEY"))
    debug_flag = _debug_ai_enabled()
    print(
        f"[trace] sketchImage={has_sketch} (len={sketch_len}), "
        f"ROBOFLOW_API_KEY={'set' if has_key else 'MISSING'}, "
        f"DEBUG_AI_PROMPT={'on' if debug_flag else 'off'}"
    )

    if not has_sketch or not has_key:
        print(
            "[trace] short-circuiting Roboflow: "
            f"{'no sketchImage in request' if not has_sketch else ''}"
            f"{' / ' if not has_sketch and not has_key else ''}"
            f"{'ROBOFLOW_API_KEY not loaded from env' if not has_key else ''}"
        )
        return None

    canvas_size = (
        int(canvas_data.get("width") or 1000),
        int(canvas_data.get("height") or 600),
    )

    try:
        roboflow_output = await asyncio.to_thread(
            detect_with_roboflow,
            request.sketchImage,
            canvas_size,
        )
    except Exception as error:
        print(f"Roboflow call raised: {error}")
        return None

    if roboflow_output is None:
        print("[trace] detect_with_roboflow returned None → falling back to contour")
        return None
    if not roboflow_output.elements:
        print("[trace] Roboflow output had no elements → falling back to contour")
        return None

    roboflow_output.framework = request.framework
    roboflow_output.styling = request.styling
    if request.description:
        roboflow_output.description = request.description

    debug = _debug_ai_enabled()

    if debug:
        print("=" * 70)
        print(f"[debug] Roboflow detected {len(roboflow_output.elements)} elements:")
        for i, el in enumerate(roboflow_output.elements, 1):
            b = el.bounds or {}
            print(
                f"  {i}. {el.type:8s} conf={el.confidence:.2f} "
                f"bbox=({b.get('x', 0):.0f},{b.get('y', 0):.0f},"
                f"{b.get('width', 0):.0f},{b.get('height', 0):.0f})"
            )
        ann_count = len(request.textAnnotations or [])
        print(f"[debug] {ann_count} text annotation(s) from canvas")

    extra_text = _attach_text_annotations(
        roboflow_output.elements,
        request.textAnnotations or [],
        debug=debug,
    )

    if debug:
        prompt_preview = _build_gemini_prompt(
            roboflow_output.elements,
            request.framework,
            request.styling,
            request.description,
            extra_text=extra_text or None,
        )
        print("[debug] Gemini prompt:")
        print("-" * 70)
        print(prompt_preview)
        print("-" * 70)

    if os.getenv("GEMINI_API_KEY"):
        try:
            generated_code = await asyncio.to_thread(
                generate_with_gemini,
                roboflow_output.elements,
                request.framework,
                request.styling,
                request.description,
                extra_text=extra_text or None,
            )
        except Exception as error:
            print(f"Gemini call raised: {error}")
            generated_code = None

        if debug:
            if generated_code:
                preview = generated_code[:500] + ("..." if len(generated_code) > 500 else "")
                print(f"[debug] Gemini returned {len(generated_code)} chars:")
                print(preview)
            else:
                print("[debug] Gemini returned no code (will fall back to template)")
            print("=" * 70)

        if generated_code:
            roboflow_output.generated_code = generated_code
            roboflow_output.metadata = {
                **(roboflow_output.metadata or {}),
                "code_generator": "gemini",
            }

    return roboflow_output


@app.on_event("startup")
async def load_models():
    """Load trained models on server startup"""
    global sketch_detector, code_generator
    print("Loading AI models...")

    try:
        sketch_detector = SketchDetector()
        code_generator = CodeGenerator()
        print("Models loaded successfully")
    except Exception as error:
        print(f"Warning: Could not load models: {error}")
        print("Running in development mode with mock predictions")


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "online",
        "service": "CodeCanvas AI Backend",
        "models_loaded": sketch_detector is not None and code_generator is not None,
    }


@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "sketch_detector": "loaded" if sketch_detector else "not loaded",
        "code_generator": "loaded" if code_generator else "not loaded",
    }


@app.post("/api/predict", response_model=GenerateCodeResponse)
async def predict(request: GenerateCodeRequest):
    """
    Main endpoint for sketch-to-code generation using custom trained models

    This is your FYP AI pipeline:
    1. Preprocess canvas data
    2. Run custom CNN for element detection
    3. Run custom code generation model
    4. Save results to Supabase
    5. Return generated code
    """
    try:
        print(f"Received prediction request for project: {request.projectId}")

        supabase = create_supabase_client()
        project = load_project_or_403(supabase, request.projectId, request.userId)
        project_canvas_data = project.get("canvas_data") or {}

        if request.mode == "chat":
            if not request.messages or not request.currentCode:
                raise HTTPException(
                    status_code=400,
                    detail="Missing messages or code context",
                )

            last_message = request.messages[-1].content
            try:
                result = await refine_chat_with_openrouter(
                    last_message,
                    request.currentCode,
                )
            except Exception as error:
                print(f"OpenRouter chat error: {error}")
                result = {
                    "code": request.currentCode + f"\n\n<!-- Refinement: {last_message} -->",
                    "message": "AI service temporarily unavailable - added your request as a comment.",
                    "usedFallback": True,
                }

            iteration_id = persist_generation_result(
                supabase,
                request.projectId,
                project_canvas_data,
                result["code"],
                last_message,
            )

            return GenerateCodeResponse(
                code=result["code"],
                success=True,
                detectedElements=[],
                message=result["message"],
                iteration_id=iteration_id,
                usedFallback=result.get("usedFallback"),
            )

        if not request.canvasData:
            raise HTTPException(status_code=400, detail="Invalid canvas data")

        canvas_data = request.canvasData.model_dump()
        external_model_output = await resolve_external_model_output(request, canvas_data)
        generation_framework = (
            external_model_output.framework
            if external_model_output and external_model_output.framework
            else request.framework
        )
        generation_description = (
            external_model_output.description
            if external_model_output and external_model_output.description
            else request.description
        )
        processed_data = preprocess_canvas_data(
            canvas_data,
            target_size=(256, 256),
        )

        detector = sketch_detector or SketchDetector()
        try:
            detected_elements = detector.detect(
                processed_data,
                external_output=external_model_output,
            )
        except Exception as error:
            print(f"Sketch detector error: {error}")
            detected_elements = detector.detect(processed_data)

        print(f"Detected {len(detected_elements)} UI elements")

        generator = code_generator or CodeGenerator()
        try:
            generated_code = generator.generate(
                elements=detected_elements,
                framework=generation_framework,
                description=generation_description,
                external_output=external_model_output,
            )
        except Exception as error:
            print(f"Code generator error: {error}")
            generated_code = generator.generate(
                elements=detected_elements,
                framework=generation_framework,
                description=generation_description,
            )

        print(f"Generated {len(generated_code)} characters of code")

        iteration_id = persist_generation_result(
            supabase,
            request.projectId,
            canvas_data,
            generated_code,
            generation_description,
        )

        response_message = None
        used_fallback = None
        if external_model_output is not None:
            response_message = f"Generated from {external_model_output.source} model output."
            used_fallback = external_model_output.source == "mock"

        return GenerateCodeResponse(
            code=generated_code,
            success=True,
            detectedElements=[DetectedElement(**elem) for elem in detected_elements],
            message=response_message,
            iteration_id=iteration_id,
            usedFallback=used_fallback,
        )

    except HTTPException:
        raise
    except Exception as error:
        print(f"Error in prediction pipeline: {str(error)}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(error)}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
