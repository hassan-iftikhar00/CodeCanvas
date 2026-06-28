from __future__ import annotations

import asyncio
import base64
import json
import math
import os
import re
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from pydantic import BaseModel, Field

from app.models.inference import (
    CodeGenerator,
    ExternalModelOutput,
    GeminiQuotaExhausted,
    GeminiRateLimited,
    ROBOFLOW_DEFAULT_API_URL,
    ROBOFLOW_DEFAULT_MODEL_ID,
    SketchDetector,
    _build_gemini_prompt,
    create_mock_external_model_output,
    detect_with_roboflow,
    generate_with_gemini,
)


def _debug_ai_enabled() -> bool:
    return os.getenv("DEBUG_AI_PROMPT", "").lower() in ("1", "true", "yes", "on")
from app.utils.preprocessing import preprocess_canvas_data
from app.utils.rate_limit import SlidingWindowRateLimiter

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR.parent / ".env.local", override=False)

OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
FREE_MODELS = [
    "openai/gpt-oss-120b:free",
    "deepseek/deepseek-r1-0528:free",
    "openai/gpt-oss-20b:free",
]

_MAX_BODY_BYTES = 20 * 1024 * 1024  # 20 MB

# Gemini code-gen ceiling. When the Pro key is on its daily-quota cooldown, every
# request falls back to Flash; a cold Flash call occasionally crosses 90s, which
# used to 504 even though the result was about to arrive. 110s gives that tail
# room while staying under the Next.js proxy ceiling (FASTAPI_PROXY_TIMEOUT_MS,
# default 120s). Override per-deploy via env. Keep proxy > this value.
GEMINI_TIMEOUT_SECONDS = float(os.getenv("GEMINI_TIMEOUT_SECONDS", "110"))


def _env_flag(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


# Rate limiting for /api/predict (B7). The endpoint is expensive (Roboflow +
# Gemini, or OpenRouter for chat) and would otherwise let a single user burn the
# shared API quota — especially relevant while Roboflow is credit-capped. Keyed
# on the authenticated user id the proxy stamps in (see _rate_limit_key). Defaults
# allow normal interactive use; override per-deploy via env. Set
# RATE_LIMIT_ENABLED=false to disable (e.g. for load tests / automated QA).
RATE_LIMIT_ENABLED = _env_flag("RATE_LIMIT_ENABLED", True)
RATE_LIMIT_MAX_REQUESTS = int(os.getenv("RATE_LIMIT_MAX_REQUESTS", "20"))
RATE_LIMIT_WINDOW_SECONDS = float(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))

ai_rate_limiter: Optional[SlidingWindowRateLimiter] = (
    SlidingWindowRateLimiter(RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_SECONDS)
    if RATE_LIMIT_ENABLED
    else None
)


def _client_ip(http_request: Request) -> str:
    """Best-effort client IP for the rate-limit fallback key. Only used when the
    authenticated user id is missing (shouldn't happen via the real proxy, which
    always stamps user.id). X-Forwarded-For is honoured for a real reverse proxy;
    it is spoofable by direct callers, which is acceptable for a fallback bucket."""
    forwarded = http_request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    client = http_request.client
    return client.host if client else "unknown"


def _rate_limit_key(request: "GenerateCodeRequest", http_request: Request) -> str:
    user_id = (request.userId or "").strip()
    if user_id:
        return f"user:{user_id}"
    return f"ip:{_client_ip(http_request)}"


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > _MAX_BODY_BYTES:
            return Response("Request body too large (max 20 MB)", status_code=413)
        return await call_next(request)


app = FastAPI(
    title="CodeCanvas AI Backend",
    description="Custom AI models for sketch-to-code generation",
    version="1.0.0",
)

app.add_middleware(BodySizeLimitMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        os.getenv("FRONTEND_URL", "http://localhost:3000"),
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


class CanvasData(BaseModel):
    strokes: Optional[List[List[Dict[str, float]]]] = None
    lines: Optional[List[Dict[str, Any]]] = None
    width: int = Field(default=1000, gt=0, le=8000)
    height: int = Field(default=600, gt=0, le=8000)


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
    # Where sketchImage came from. Absent/"canvas" = Konva export (unchanged path);
    # "upload-photo"/"upload-clean" = uploaded image routed through photo normalization.
    sketchSource: Optional[str] = None


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

# Synthesis bands: top/bottom 12% of the canvas height by default.
_TOP_BAND_RATIO = 0.12
_BOTTOM_BAND_RATIO = 0.12

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


def _infer_canvas_extents(
    elements: List[Any],
    annotations: List[TextAnnotation],
    canvas_size: Optional[tuple],
) -> tuple:
    """
    Best-effort canvas (x_min, y_min, x_max, y_max) in the same coordinate space
    that Roboflow's bounds and the canvas annotations live in.

    We can't rely on canvasData.width/height alone because Roboflow returns image-
    pixel coordinates and the sketch image may be rendered at a different scale
    than the canvas. So we take the union of all detected bounds + annotation
    positions, which is guaranteed to be in the right space.
    """
    xs_min: List[float] = []
    ys_min: List[float] = []
    xs_max: List[float] = []
    ys_max: List[float] = []

    for elem in elements:
        b = getattr(elem, "bounds", None) or {}
        try:
            x = float(b.get("x", 0))
            y = float(b.get("y", 0))
            w = float(b.get("width", 0))
            h = float(b.get("height", 0))
        except (TypeError, ValueError):
            continue
        if w <= 0 or h <= 0:
            continue
        xs_min.append(x); ys_min.append(y)
        xs_max.append(x + w); ys_max.append(y + h)

    for ann in annotations:
        xs_min.append(float(ann.x))
        ys_min.append(float(ann.y))
        xs_max.append(float(ann.x) + max(float(ann.width), 1.0))
        ys_max.append(float(ann.y) + max(float(ann.height), 1.0))

    if not xs_min:
        # Last resort: use canvas_size if provided.
        if canvas_size:
            return (0.0, 0.0, float(canvas_size[0]), float(canvas_size[1]))
        return (0.0, 0.0, 1000.0, 600.0)

    return (min(xs_min), min(ys_min), max(xs_max), max(ys_max))


def _synthesize_missing_containers(
    elements: List[Any],
    annotations: List[TextAnnotation],
    canvas_size: Optional[tuple],
    *,
    debug: bool = False,
) -> List[Any]:
    """
    Recovery synthesizer for missed navbar / footer containers.

    Two stages:

    1. Reclassify misplaced containers. The detector sometimes flips wide-thin
       horizontal bars: returns a `footer` at y=0 (clearly a navbar) or a
       `navbar` at the bottom (clearly a footer). We relabel these to match
       their band so downstream logic and Gemini see them in the right slot.
       Only relabels when the correctly-placed slot isn't already filled, to
       avoid creating duplicates.

    2. Synthesize a thin container in the top/bottom band when the band has
       2+ unattached text annotations OR 2+ orphan cards (cards not contained
       by any non-card element). Orphan cards in the band are a strong signal
       the user drew a footer/navbar row of items but the detector missed the
       enclosing rectangle. The synthesized container's bounds grow to wrap
       the orphan cards too, so Gemini's "card inside container → child"
       inference puts them inside.

    New entries are marked with `attributes["synthetic"] = True` so the prompt
    can flag them to Gemini.
    """
    from app.models.inference import ExternalModelElement  # local import to avoid cycles

    x_min, y_min, x_max, y_max = _infer_canvas_extents(elements, annotations, canvas_size)
    canvas_h = max(y_max - y_min, 1.0)
    canvas_w = max(x_max - x_min, 1.0)
    top_band_y = y_min + canvas_h * _TOP_BAND_RATIO
    bottom_band_y = y_max - canvas_h * _BOTTOM_BAND_RATIO

    def _centroid_y(elem: Any) -> float:
        b = getattr(elem, "bounds", None) or {}
        try:
            return float(b.get("y", 0)) + float(b.get("height", 0)) / 2.0
        except (TypeError, ValueError):
            return 0.0

    # ── Stage 1: reclassify misplaced top/bottom-band containers ─────────────
    real_navbar_exists = any(
        (getattr(e, "type", "") or "").lower() == "navbar" and _centroid_y(e) <= top_band_y
        for e in elements
    )
    real_footer_exists = any(
        (getattr(e, "type", "") or "").lower() == "footer" and _centroid_y(e) >= bottom_band_y
        for e in elements
    )
    for elem in elements:
        etype = (getattr(elem, "type", "") or "").lower()
        cy = _centroid_y(elem)
        if etype == "footer" and cy <= top_band_y and not real_navbar_exists:
            elem.type = "navbar"
            attrs = getattr(elem, "attributes", None) or {}
            attrs["reclassified_from"] = "footer"
            elem.attributes = attrs
            real_navbar_exists = True
            if debug:
                print(f"[debug] reclassified misplaced footer at y_center={cy:.0f} -> navbar")
        elif etype == "navbar" and cy >= bottom_band_y and not real_footer_exists:
            elem.type = "footer"
            attrs = getattr(elem, "attributes", None) or {}
            attrs["reclassified_from"] = "navbar"
            elem.attributes = attrs
            real_footer_exists = True
            if debug:
                print(f"[debug] reclassified misplaced navbar at y_center={cy:.0f} -> footer")

    has_navbar = any((getattr(e, "type", "") or "").lower() == "navbar" for e in elements)
    has_footer = any((getattr(e, "type", "") or "").lower() == "footer" for e in elements)
    if has_navbar and has_footer:
        return elements

    # ── Stage 2: synthesize from unattached anns and/or orphan cards ─────────
    # Same overlap rule as `_attach_text_annotations` so the two stay in sync.
    def _is_attached(ann: TextAnnotation) -> bool:
        for elem in elements:
            b = getattr(elem, "bounds", None) or {}
            try:
                ex = float(b.get("x", 0)); ey = float(b.get("y", 0))
                ew = float(b.get("width", 0)); eh = float(b.get("height", 0))
            except (TypeError, ValueError):
                continue
            if ew <= 0 or eh <= 0:
                continue
            if ann.width > 0 and ann.height > 0:
                if _bbox_overlap_ratio(
                    ann.x, ann.y, ann.width, ann.height, ex, ey, ew, eh
                ) >= _TEXT_MATCH_OVERLAP:
                    return True
            else:
                cx = float(ann.x); cy = float(ann.y)
                if ex <= cx <= ex + ew and ey <= cy <= ey + eh:
                    return True
        return False

    unattached_anns = [a for a in (annotations or []) if not _is_attached(a)]

    def _is_orphan_card(card: Any) -> bool:
        if (getattr(card, "type", "") or "").lower() != "card":
            return False
        cb = getattr(card, "bounds", None) or {}
        try:
            cx = float(cb.get("x", 0)); cy = float(cb.get("y", 0))
            cw = float(cb.get("width", 0)); ch = float(cb.get("height", 0))
        except (TypeError, ValueError):
            return False
        if cw <= 0 or ch <= 0:
            return False
        for other in elements:
            if other is card:
                continue
            otype = (getattr(other, "type", "") or "").lower()
            if otype == "card":
                continue
            ob = getattr(other, "bounds", None) or {}
            try:
                ox = float(ob.get("x", 0)); oy = float(ob.get("y", 0))
                ow = float(ob.get("width", 0)); oh = float(ob.get("height", 0))
            except (TypeError, ValueError):
                continue
            if ow <= 0 or oh <= 0:
                continue
            if _bbox_overlap_ratio(cx, cy, cw, ch, ox, oy, ow, oh) >= 0.5:
                return False
        return True

    orphan_cards = [e for e in elements if _is_orphan_card(e)]

    def _ann_center(ann: TextAnnotation) -> tuple:
        cx = float(ann.x) + max(float(ann.width), 1.0) / 2.0
        cy = float(ann.y) + max(float(ann.height), 1.0) / 2.0
        return cx, cy

    ann_centers: List[tuple] = [_ann_center(a) for a in unattached_anns]
    new_elements: List[Any] = list(elements)

    def _card_bbox(card: Any) -> tuple:
        b = getattr(card, "bounds", None) or {}
        bx = float(b.get("x", 0)); by = float(b.get("y", 0))
        bw = float(b.get("width", 0)); bh = float(b.get("height", 0))
        return bx, by, bx + bw, by + bh

    if not has_navbar:
        top_centers = [c for c in ann_centers if c[1] <= top_band_y]
        top_orphan_cards = [c for c in orphan_cards if _centroid_y(c) <= top_band_y]
        trigger_count = len(top_centers) + len(top_orphan_cards)
        if trigger_count >= 2:
            band_top = y_min
            # Anns expand the strip slightly past the deepest center; orphan
            # cards expand it to fully cover the card's bottom edge.
            candidates: List[float] = [c[1] + canvas_h * 0.03 for c in top_centers]
            for oc in top_orphan_cards:
                _, _, _, oy2 = _card_bbox(oc)
                candidates.append(oy2 + canvas_h * 0.005)
            band_bottom = max(candidates) if candidates else top_band_y + canvas_h * 0.04
            # Clamp to a thin strip ONLY when no orphan cards are forcing the
            # navbar to grow; cards must end up inside the synthesized bounds
            # so Gemini's nesting heuristic picks them up.
            if not top_orphan_cards:
                band_bottom = min(band_bottom, top_band_y + canvas_h * 0.06)
            navbar_elem = ExternalModelElement(
                id="synthetic-navbar",
                type="navbar",
                confidence=0.0,
                label="Navbar",
                bounds={
                    "x": x_min,
                    "y": band_top,
                    "width": canvas_w,
                    "height": max(band_bottom - band_top, canvas_h * 0.06),
                },
                attributes={
                    "synthetic": True,
                    "reason": (
                        f"no navbar detected; inferred from {len(top_centers)} unattached "
                        f"top-band text label(s) and {len(top_orphan_cards)} orphan card(s)"
                    ),
                },
            )
            new_elements.append(navbar_elem)
            if debug:
                print(
                    f"[debug] synthesized navbar from {len(top_centers)} unattached "
                    f"annotation(s) + {len(top_orphan_cards)} orphan card(s) "
                    f"y in [{band_top:.0f},{band_bottom:.0f}]"
                )

    if not has_footer:
        bottom_centers = [c for c in ann_centers if c[1] >= bottom_band_y]
        bottom_orphan_cards = [c for c in orphan_cards if _centroid_y(c) >= bottom_band_y]
        trigger_count = len(bottom_centers) + len(bottom_orphan_cards)
        if trigger_count >= 2:
            band_bottom = y_max
            candidates: List[float] = [c[1] - canvas_h * 0.03 for c in bottom_centers]
            for oc in bottom_orphan_cards:
                _, oy1, _, _ = _card_bbox(oc)
                candidates.append(oy1 - canvas_h * 0.005)
            band_top = min(candidates) if candidates else bottom_band_y - canvas_h * 0.04
            # Same clamp logic as navbar: only restrict to a thin strip when no
            # orphan cards need to fit inside.
            if not bottom_orphan_cards:
                band_top = max(band_top, bottom_band_y - canvas_h * 0.06)
            footer_elem = ExternalModelElement(
                id="synthetic-footer",
                type="footer",
                confidence=0.0,
                label="Footer",
                bounds={
                    "x": x_min,
                    "y": band_top,
                    "width": canvas_w,
                    "height": max(band_bottom - band_top, canvas_h * 0.06),
                },
                attributes={
                    "synthetic": True,
                    "reason": (
                        f"no footer detected; inferred from {len(bottom_centers)} unattached "
                        f"bottom-band text label(s) and {len(bottom_orphan_cards)} orphan card(s)"
                    ),
                },
            )
            new_elements.append(footer_elem)
            if debug:
                print(
                    f"[debug] synthesized footer from {len(bottom_centers)} unattached "
                    f"annotation(s) + {len(bottom_orphan_cards)} orphan card(s) "
                    f"y in [{band_top:.0f},{band_bottom:.0f}]"
                )

    # Sort by y, tie-broken by height so a synthesized navbar at y=0 lands BEFORE
    # an oversized section that also starts at y=0 — otherwise Gemini sees the
    # navbar after the section in "ordered top to bottom".
    new_elements.sort(
        key=lambda el: (
            float((el.bounds or {}).get("y", 0.0)),
            float((el.bounds or {}).get("height", 0.0)),
        )
    )
    return new_elements


def _attach_text_annotations(
    elements: List[Any],
    annotations: List[TextAnnotation],
    *,
    debug: bool = False,
) -> List[str]:
    """
    Mutate `elements` to attach matching annotation text into element.attributes.

    Attach modes per element (decided purely by match count):
      1. `label_text` (single string) — exactly one annotation matched.
      2. `positioned_texts` (list of {text, x, y, width, height}) — two or more
         annotations matched. Each label is kept as a discrete addressable item
         with its x/y/w/h so the LLM can render them as separate elements.

    Concatenating multiple labels with " / " was previously the non-oversized
    multi-match path. It corrupted the data — e.g. "Password" plus "Sign In"
    became the literal string "Password / Sign In", which Gemini then rendered
    as a single heading. Strict fidelity requires multi-match to always go
    positional, regardless of container size.

    Match rule (unchanged):
      - text with area: smallest element whose bbox contains ≥ _TEXT_MATCH_OVERLAP
        of the text's area
      - bare-point text: center-point containment in smallest enclosing element

    Returns the list of annotation texts that didn't match any element.
    """
    unmatched: List[str] = []
    if not annotations:
        return unmatched

    # First pass: figure out which element each annotation matches to (so we can
    # switch to positioned mode for any element that catches 2+ labels).
    matches: List[tuple] = []  # (annotation, best_elem_or_None, best_overlap, best_area)
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

        matches.append((ann, text, best, best_overlap, best_area))

    # Second pass: count per-element matches so we know which elements catch
    # 2+ labels → switch to positioned mode for those.
    counts: Dict[int, int] = {}
    for _, _, best, _, _ in matches:
        if best is not None:
            counts[id(best)] = counts.get(id(best), 0) + 1

    # Third pass: actually attach.
    for ann, text, best, best_overlap, best_area in matches:
        if best is None:
            if debug:
                print(f"[debug] annotation '{text}' UNMATCHED → extra_text")
            unmatched.append(text)
            continue

        attrs = dict(getattr(best, "attributes", None) or {})
        use_positioned = counts.get(id(best), 0) >= 2

        if use_positioned:
            positioned = list(attrs.get("positioned_texts") or [])
            positioned.append({
                "text": text,
                "x": float(ann.x),
                "y": float(ann.y),
                "width": float(ann.width),
                "height": float(ann.height),
            })
            attrs["positioned_texts"] = positioned
            if debug:
                print(
                    f"[debug] annotation '{text}' → {best.type} "
                    f"(overlap={best_overlap:.0%}, multi-label → positioned mode)"
                )
        else:
            attrs["label_text"] = text
            if debug:
                print(
                    f"[debug] annotation '{text}' → {best.type} "
                    f"(overlap={best_overlap:.0%}, bbox area={best_area:.0f})"
                )

        best.attributes = attrs

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

    # v2 (YOLOv11 Fast) returned in 2–5s warm and ~15s cold, so 30s was safe.
    # v4 (YOLOv11 Small) is slower — observed >30s on cold start. 60s gives
    # headroom without hitting the 100s Next.js proxy ceiling.
    try:
        roboflow_output = await asyncio.wait_for(
            asyncio.to_thread(
                detect_with_roboflow,
                request.sketchImage,
                canvas_size,
                sketch_source=request.sketchSource,
            ),
            timeout=60.0,
        )
    except asyncio.TimeoutError:
        print("[error] Roboflow call timed out after 60s")
        raise HTTPException(
            status_code=504,
            detail="Sketch detection timed out — the Roboflow API did not respond in time. Please try again.",
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

    # Coordinate space.
    # The frontend's exportAsPNG returns the crop transform alongside the PNG,
    # and canvas/page.tsx pre-applies that transform to every text annotation
    # before sending. So request.textAnnotations are ALREADY in the same
    # image-pixel space Roboflow returns its bboxes in — no scaling here.
    # (Naive "image_size / canvas_size" scaling is wrong because the PNG is a
    # tight CROP of the canvas, not a uniform scale of it.)
    meta = roboflow_output.metadata or {}
    image_w = float(meta.get("image_width") or canvas_size[0])
    image_h = float(meta.get("image_height") or canvas_size[1])
    inferred_canvas_size = (image_w, image_h)

    # For uploads, hand the processed sketch to Gemini so it can READ the text
    # baked into the pixels (the detector only returns boxes). Pop it out of the
    # metadata so the base64 blob never travels back to the browser in the response.
    gemini_image_bytes: Optional[bytes] = None
    processed_b64 = (roboflow_output.metadata or {}).pop("processed_image_b64", None)
    if processed_b64 and request.sketchSource in ("upload-photo", "upload-clean"):
        try:
            gemini_image_bytes = base64.b64decode(processed_b64)
        except Exception as decode_error:
            print(f"[trace] could not decode processed upload image for Gemini: {decode_error}")

    annotations = request.textAnnotations or []
    if debug and annotations:
        print(
            f"[debug] {len(annotations)} text annotation(s) (already in image space "
            f"{int(image_w)}x{int(image_h)})"
        )

    roboflow_output.elements = _synthesize_missing_containers(
        roboflow_output.elements,
        annotations,
        inferred_canvas_size,
        debug=debug,
    )

    extra_text = _attach_text_annotations(
        roboflow_output.elements,
        annotations,
        debug=debug,
    )

    if debug:
        prompt_preview = _build_gemini_prompt(
            roboflow_output.elements,
            request.framework,
            request.styling,
            request.description,
            extra_text=extra_text or None,
            has_image=gemini_image_bytes is not None,
        )
        print("[debug] Gemini prompt:")
        print("-" * 70)
        print(prompt_preview)
        print("-" * 70)

    try:
        generated_code = await asyncio.wait_for(
            asyncio.to_thread(
                generate_with_gemini,
                roboflow_output.elements,
                request.framework,
                request.styling,
                request.description,
                extra_text=extra_text or None,
                image_bytes=gemini_image_bytes,
            ),
            timeout=GEMINI_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        print(f"[error] Gemini call timed out after {GEMINI_TIMEOUT_SECONDS:.0f}s")
        raise HTTPException(
            status_code=504,
            detail="Code generation timed out — Gemini did not respond in time. Please try again.",
        )
    except GeminiRateLimited as error:
        print(f"[error] {error}")
        raise HTTPException(
            status_code=429,
            detail="Gemini rate limit hit (too many requests per minute). Wait about 60 seconds and try again.",
        )
    except GeminiQuotaExhausted as error:
        print(f"[error] {error}")
        raise HTTPException(
            status_code=503,
            detail="All Gemini API keys have hit their daily quota. Try again tomorrow or add more API keys.",
        )
    except Exception as error:
        print(f"[error] Gemini call raised unexpected error: {error}")
        raise HTTPException(
            status_code=504,
            detail="Code generation failed unexpectedly. Please try again.",
        )

    if debug:
        preview = generated_code[:500] + ("..." if len(generated_code) > 500 else "")
        print(f"[debug] Gemini returned {len(generated_code)} chars:")
        print(preview)
        print("=" * 70)

    roboflow_output.generated_code = generated_code
    roboflow_output.metadata = {
        **(roboflow_output.metadata or {}),
        "code_generator": "gemini",
    }

    return roboflow_output


@app.on_event("startup")
async def validate_env():
    required = {
        "ROBOFLOW_API_KEY": "Roboflow sketch detection",
        "GEMINI_API_KEY": "Gemini code generation",
        "SUPABASE_URL": "Supabase database",
        "SUPABASE_SERVICE_ROLE_KEY": "Supabase database",
    }
    missing = [k for k, _ in required.items() if not os.getenv(k)]
    if missing:
        raise RuntimeError(
            f"[CodeCanvas] Missing required environment variables: {', '.join(missing)}. "
            f"Check backend/.env before starting the server."
        )


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


@app.on_event("startup")
async def warmup_roboflow():
    """Pre-warm Roboflow's hosted inference so the first user detection
    doesn't pay the cold-start tax (30-60s for v4 Small to load weights).

    Fires in the background so backend startup is non-blocking. A failure
    here is non-fatal — the user's first real request will still work,
    just slower."""
    api_key = os.getenv("ROBOFLOW_API_KEY")
    if not api_key:
        return  # validate_env already complained

    async def _warm():
        import time
        start = time.time()
        try:
            from inference_sdk import InferenceHTTPClient
            from PIL import Image

            model_id = os.getenv("ROBOFLOW_MODEL_ID", ROBOFLOW_DEFAULT_MODEL_ID)
            api_url = os.getenv("ROBOFLOW_API_URL", ROBOFLOW_DEFAULT_API_URL)

            # 64x64 white image — minimum payload that triggers Roboflow's
            # model-load path without spending a real inference credit's worth.
            dummy = Image.new("RGB", (64, 64), (255, 255, 255))
            client = InferenceHTTPClient(api_url=api_url, api_key=api_key)

            await asyncio.to_thread(client.infer, dummy, model_id=model_id)
            print(f"[startup] Roboflow {model_id} warm-up done in {time.time() - start:.1f}s")
        except Exception as error:
            print(f"[startup] Roboflow warm-up skipped after {time.time() - start:.1f}s (non-fatal): {error}")

    asyncio.create_task(_warm())


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
async def predict(request: GenerateCodeRequest, http_request: Request):
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
        # Rate limit the expensive AI pipeline per authenticated user, BEFORE any
        # DB load / Roboflow / Gemini work, so abuse is cheap to reject. The proxy
        # stamps the trusted user id into request.userId; we key on that (every
        # request shares the proxy IP, so IP keying would pool all users together).
        if ai_rate_limiter is not None:
            allowed, retry_after, _ = ai_rate_limiter.check(
                _rate_limit_key(request, http_request)
            )
            if not allowed:
                retry_secs = max(1, math.ceil(retry_after))
                print(
                    f"[rate-limit] 429: over {RATE_LIMIT_MAX_REQUESTS} req / "
                    f"{RATE_LIMIT_WINDOW_SECONDS:.0f}s; retry in {retry_secs}s"
                )
                raise HTTPException(
                    status_code=429,
                    detail=(
                        "You're sending requests too quickly. "
                        f"Please wait {retry_secs}s and try again."
                    ),
                    headers={"Retry-After": str(retry_secs)},
                )

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

        if external_model_output is None:
            used_fallback = True
            response_message = (
                "Sketch detection was unavailable — code was generated from basic shape analysis. "
                "Results may be generic."
            )
        elif getattr(external_model_output, "source", None) == "mock":
            used_fallback = True
            response_message = "Running in demo mode — using mock detection."
        elif not getattr(external_model_output, "generated_code", None):
            used_fallback = True
            response_message = (
                "AI code generation hit a quota limit — showing a template-based result instead. "
                "Try again in a few minutes."
            )
        else:
            used_fallback = False
            response_message = None

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
