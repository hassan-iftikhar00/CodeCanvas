from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import math
import os
import re
import time
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
    build_annotation_prompt,
    build_incremental_prompt,
    build_repair_prompt,
    create_mock_external_model_output,
    detect_with_roboflow,
    diff_detection_sets,
    generate_with_gemini,
)


def _debug_ai_enabled() -> bool:
    return os.getenv("DEBUG_AI_PROMPT", "").lower() in ("1", "true", "yes", "on")
from app.utils.preprocessing import preprocess_canvas_data
from app.utils.rate_limit import SlidingWindowRateLimiter
from app.utils.role_inference import annotate_alignment, annotate_role_hints
from app.utils.response_cache import CachedResult, GenerationCache

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR.parent / ".env.local", override=False)

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
# Gemini for generation, Gemini for chat refinement) and would otherwise let a single user burn the
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

# B12: In-memory cache so identical sketch+framework+labels return without
# hitting Roboflow or Gemini again. Bounded (LRU) + time-limited (TTL) to
# keep memory predictable. Cache hits still persist a new iteration so version
# history remains correct. Set CACHE_ENABLED=false to disable (e.g. QA runs).
CACHE_ENABLED = _env_flag("CACHE_ENABLED", True)
CACHE_TTL_SECONDS = float(os.getenv("CACHE_TTL_SECONDS", "1800"))
CACHE_MAX_SIZE = int(os.getenv("CACHE_MAX_SIZE", "50"))

generation_cache: Optional[GenerationCache] = (
    GenerationCache(CACHE_MAX_SIZE, CACHE_TTL_SECONDS)
    if CACHE_ENABLED
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


def _generation_cache_key(
    sketch_image: str,
    framework: str,
    sketch_source: Optional[str],
    text_annotations: Optional[List["TextAnnotation"]],
    brand_kit: Optional["BrandKit"] = None,
    screens: Optional[List[str]] = None,
    current_screen: Optional[str] = None,
) -> str:
    """Stable cache key for an AI generation request.

    Hashes the raw sketch bytes (first 16 hex chars of SHA-256 covers
    uniqueness in practice) plus the framework and source modality. For
    canvas sketches, text annotations are included in the key because the
    same sketch with different labels should produce different output. For
    uploads the image itself carries the text (Gemini reads it), so
    annotations are not separately keyed.
    """
    img_hash = hashlib.sha256(sketch_image.encode()).hexdigest()[:16]
    fw = (framework or "react").lower()
    src = (sketch_source or "canvas").lower()

    if src == "canvas" and text_annotations:
        ann_data = sorted(
            [{"t": a.text, "x": round(a.x), "y": round(a.y)} for a in text_annotations],
            key=lambda d: (d["x"], d["y"], d["t"]),
        )
        ann_hash = hashlib.sha256(
            json.dumps(ann_data, separators=(",", ":")).encode()
        ).hexdigest()[:12]
    else:
        ann_hash = "noann"

    # Brand kit changes the prompt (colors/font), so it must change the key —
    # otherwise editing the kit would serve the previous palette from cache.
    kit_data = brand_kit.as_prompt_dict() if brand_kit else {}
    if kit_data:
        kit_hash = hashlib.sha256(
            json.dumps(kit_data, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest()[:12]
    else:
        kit_hash = "nokit"

    # Multi-screen context changes the prompt (NAVIGATION block names the
    # other screens), so the same sketch generated as "Login of [Login,
    # Dashboard]" must not serve a cached single-screen result.
    if screens and len(screens) > 1:
        screen_hash = hashlib.sha256(
            json.dumps(
                {"s": screens, "c": current_screen or ""}, separators=(",", ":")
            ).encode()
        ).hexdigest()[:12]
    else:
        screen_hash = "noscr"

    return f"{img_hash}|{fw}|{src}|{ann_hash}|{kit_hash}|{screen_hash}"


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
    # Passthrough fields: the backend never reads these, but model_dump() of
    # this model is what gets persisted to iterations.canvas_data (and mirrored
    # onto projects.canvas_data). Omitting them silently STRIPPED rectangles
    # (shapes), template groups, and the uploaded-sketch stub from every
    # generation iteration, which broke checkpoint/version restore of the
    # drawing. Keep in sync with CanvasData in src/types/canvas.ts.
    shapes: Optional[List[Dict[str, Any]]] = None
    componentGroups: Optional[List[Dict[str, Any]]] = None
    uploadedSketch: Optional[Dict[str, Any]] = None
    # Multi-screen flows (App Uplift feature A): per-screen snapshots
    # ({id, name, canvasData, generatedCode, ...}) plus which one is active.
    # Backend never reads these; they must survive model_dump() persistence.
    screens: Optional[List[Dict[str, Any]]] = None
    activeScreenId: Optional[str] = None
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


class BrandKit(BaseModel):
    """Per-project design tokens (App Uplift feature H). Styling-only:
    the prompt block scopes these to colors/typography so strict fidelity
    (Decision #19) is untouched."""

    primaryColor: Optional[str] = None
    secondaryColor: Optional[str] = None
    accentColor: Optional[str] = None
    fontFamily: Optional[str] = None

    def as_prompt_dict(self) -> Dict[str, str]:
        return {
            k: v
            for k, v in {
                "primaryColor": self.primaryColor,
                "secondaryColor": self.secondaryColor,
                "accentColor": self.accentColor,
                "fontFamily": self.fontFamily,
            }.items()
            if v
        }


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
    # HITL detection editor: when present, these user-reviewed boxes replace the
    # Roboflow call entirely (the user already saw and corrected the detections
    # via /api/detect). Container synthesis is also skipped — the corrected set
    # is authoritative. Coordinates are in the same pixel space as sketchImage.
    correctedElements: Optional[List["DetectedElement"]] = None
    # Audit log of what the user changed in the review overlay (relabel/delete/
    # add). Persisted to detection_corrections for a future fine-tuning dataset.
    detectionCorrections: Optional[List[Dict[str, Any]]] = None
    # Brand Kit (feature H): user-defined project design tokens, stamped into
    # the Gemini prompt as a styling-only block. Absent = unchanged prompt.
    brandKit: Optional[BrandKit] = None
    # Incremental regeneration (feature D): the prior generation's code and
    # detection set. When present and the new detection differs only slightly,
    # the backend sends a delta prompt that patches the previous code instead
    # of regenerating from scratch (preserving chat refinements/manual edits).
    previousCode: Optional[str] = None
    previousElements: Optional[List["DetectedElement"]] = None
    # Multi-screen flows (feature A): names of all screens in the app plus
    # which one this generation is for. When present (2+ screens), the prompt
    # gains a NAVIGATION block wiring label-matched buttons/links to the host
    # shell's window.ccNavigate(screenName). Absent = single-screen, prompt
    # unchanged.
    screens: Optional[List[str]] = None
    currentScreen: Optional[str] = None


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
    timing_ms: Optional[Dict[str, float]] = None
    # True when the incremental (delta-patch) path produced this code.
    usedIncremental: Optional[bool] = None


class DetectRequest(BaseModel):
    """Detection-only request for the HITL review step (no Gemini call)."""

    projectId: str
    userId: str
    sketchImage: str
    # Same semantics as GenerateCodeRequest.sketchSource.
    sketchSource: Optional[str] = None
    width: int = Field(default=1000, gt=0, le=8000)
    height: int = Field(default=600, gt=0, le=8000)


class DetectResponse(BaseModel):
    success: bool
    elements: List[DetectedElement]
    # Pixel space the bounds live in (the image Roboflow actually saw).
    imageWidth: Optional[float] = None
    imageHeight: Optional[float] = None
    # Uploads only: the preprocessed image (crop/normalize applied) as a data
    # URL. The review overlay must draw boxes on THIS image, not the original
    # upload, because the bounds are in post-preprocessing pixel space.
    previewImage: Optional[str] = None
    timing_ms: Optional[Dict[str, float]] = None


class FidelityRequest(BaseModel):
    projectId: str
    userId: str
    code: str
    framework: str = "react"
    elements: List[DetectedElement]
    # Pixel space the original detection boxes live in (the sketch image dims).
    width: int = Field(default=1000, gt=0, le=8000)
    height: int = Field(default=600, gt=0, le=8000)


class FidelityResponse(BaseModel):
    success: bool
    score: float
    report: Dict[str, Any]
    timing_ms: Optional[Dict[str, float]] = None


class RepairRequest(BaseModel):
    projectId: str
    userId: str
    code: str
    framework: str = "react"
    # Mismatch report from /api/fidelity: element dicts with type/bounds/label.
    missing: List[Dict[str, Any]] = Field(default_factory=list)
    extra: List[Dict[str, Any]] = Field(default_factory=list)
    width: int = Field(default=1000, gt=0, le=8000)
    height: int = Field(default=600, gt=0, le=8000)


class RepairResponse(BaseModel):
    success: bool
    code: str
    iteration_id: Optional[str] = None
    message: Optional[str] = None


class AnnotateRequest(BaseModel):
    """Annotate-on-render refinement (App Uplift feature B).

    The user drew markup ON the rendered preview and wrote an instruction.
    ``targets`` are the rendered components the markup covered, resolved by
    the frontend from the iframe's data-cc-id boxes ({ccId, tag?, rect});
    ``region`` is the markup's own bounding box (fallback locator when the
    markup hit no tagged element). All coordinates are render-viewport CSS px.
    """

    projectId: str
    userId: str
    code: str
    framework: str = "react"
    note: str
    targets: List[Dict[str, Any]] = Field(default_factory=list)
    region: Optional[Dict[str, Any]] = None
    width: float = Field(default=1000, gt=0, le=16000)
    height: float = Field(default=600, gt=0, le=64000)


class AnnotateResponse(BaseModel):
    success: bool
    code: str
    iteration_id: Optional[str] = None
    message: Optional[str] = None


sketch_detector = None
code_generator = None


def create_supabase_client():
    from app.supabase_client import get_supabase_client as _get_supabase_client

    return _get_supabase_client()


def build_chat_refine_prompt(
    user_message: str,
    current_code: str,
    framework: str,
) -> str:
    """Full prompt for a chat-driven code refinement.

    Sent to Gemini via ``generate_with_gemini(prompt_override=...)``, which reuses
    the same key-rotation / cooldown / model-fallback pool as code generation
    (paid first key + GEMINI_API_KEY_2..10). No separate refinement key exists.
    """
    fw = (framework or "react").strip().lower()
    return (
        "You are CodeCanvas AI, a code-refinement assistant.\n"
        "You receive the user's CURRENT CODE and an INSTRUCTION describing what to change.\n"
        "Return ONLY the complete, updated code. No explanations, no markdown fences, no commentary.\n"
        "Rules:\n"
        "- Preserve the overall structure unless the instruction says otherwise.\n"
        "- Use Tailwind CSS classes for styling changes.\n"
        f"- Keep the code valid for the {fw} framework.\n"
        "- Preserve every existing data-cc-id attribute so element/code linking keeps working.\n"
        "- If the instruction is unclear, make a reasonable best-effort change.\n\n"
        "CURRENT CODE:\n```\n"
        f"{current_code}\n"
        "```\n\n"
        f"INSTRUCTION: {user_message}"
    )


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


_CC_ID_RE = re.compile(r'data-cc-id="cc-(\d+)"')

# Rendered element whose ENTIRE visible text is a detector class name — the
# signature of repair-era damage (old repair prompts made Gemini add literal
# "Card"/"Navbar" stubs). No faithful generation renders these words verbatim.
_CLASS_STUB_RE = re.compile(r">\s*(Card|Navbar|Section|Footer)\s*<")

# Minimum fraction of the previous element set that must carry a data-cc-id
# in the previous code for incremental patching to trust it as a base.
_INCREMENTAL_MIN_ID_COVERAGE = 0.6


def _repair_introduced_class_stubs(repaired_code: str, original_code: str) -> bool:
    """True when the repair output renders a literal detector-class name as
    visible text that the input code did not — the patch fabricated a stub
    element instead of a real component (live case: '<p>Card</p>' heading +
    stub injected into a correct signup form despite the prompt rule)."""
    return bool(_CLASS_STUB_RE.search(repaired_code)) and not bool(
        _CLASS_STUB_RE.search(original_code)
    )


def _previous_code_is_degenerate(previous_code: str, n_previous_elements: int) -> bool:
    """True when previousCode is not a trustworthy base for incremental regen.

    Two signals, either one disqualifies:

    1. cc-id coverage. Faithful generations stamp EVERY element with
       data-cc-id (Decision #28), so distinct-id coverage ~= 100%. A
       repair-destroyed stub or pre-linker output has far fewer; an id-less
       base also cannot be patched correctly (REMOVE keys off cc-ids).
    2. Literal class-name stubs. Old repair damage glued absolute-positioned
       '<p>Card</p>' divs ON TOP of otherwise well-id'd code (live case:
       signup base passed coverage at 7/7 while carrying six id-less "Card"
       stubs) — coverage alone cannot see additive damage.

    Either way, patching recycles the damage forever; force full regeneration.
    """
    if n_previous_elements <= 0:
        return True
    if _CLASS_STUB_RE.search(previous_code):
        print(
            "[incremental] previous code contains literal detector-class "
            "stubs ('Card'/'Navbar' as visible text) — full regeneration"
        )
        return True
    distinct_ids = set(_CC_ID_RE.findall(previous_code))
    coverage = len(distinct_ids) / n_previous_elements
    if coverage < _INCREMENTAL_MIN_ID_COVERAGE:
        print(
            f"[incremental] previous code fails id-coverage check "
            f"({len(distinct_ids)} distinct cc-ids for {n_previous_elements} "
            f"elements) — full regeneration"
        )
        return True
    return False


def _corrected_elements_to_output(
    corrected: List[DetectedElement],
) -> "ExternalModelOutput":
    """Build an ExternalModelOutput from the user-reviewed element set (HITL).

    Elements are sorted in reading order (top-to-bottom, left-to-right within
    a row) like the Roboflow path so the Gemini prompt reads in document order. Each element is tagged user_verified so
    the prompt (and any debugging) can tell it came through human review.
    """
    from app.models.inference import (
        ExternalModelElement,
        snap_positional_bars,
        sort_reading_order,
    )

    elements = [
        ExternalModelElement(
            id=f"corrected-{i}",
            type=(el.type or "card").lower(),
            confidence=el.confidence,
            bounds=el.bounds,
            label=el.label,
            attributes={"user_verified": True},
        )
        for i, el in enumerate(corrected, 1)
    ]
    # Positional snap runs even on the human-reviewed set: navbar/footer are
    # positional classes by definition, and the review UI makes it easy to
    # keep the detector's wrong class for a bottom bar. Snapping fixes the
    # class, never adds/removes elements — reviewer authority holds.
    snap_positional_bars(elements)
    sort_reading_order(elements)
    return ExternalModelOutput(
        source="user-corrected",
        elements=elements,
        metadata={"human_in_the_loop": True},
    )


async def resolve_external_model_output(
    request: GenerateCodeRequest,
    canvas_data: Dict[str, Any],
) -> Optional[ExternalModelOutput]:
    if request.externalModelOutput is not None:
        print("[trace] using request.externalModelOutput (skipping Roboflow)")
        return request.externalModelOutput

    # HITL path: the user reviewed and corrected the detections in the overlay,
    # so the corrected set replaces the Roboflow call. Synthesis is skipped too
    # (the human decided what containers exist); text attachment, role hints and
    # the Gemini call below run unchanged.
    if request.correctedElements:
        print(
            f"[trace] HITL: using {len(request.correctedElements)} user-corrected "
            "elements (skipping Roboflow + container synthesis)"
        )
        return await _generate_from_output(
            _corrected_elements_to_output(request.correctedElements),
            request,
            roboflow_ms=0.0,
            skip_synthesis=True,
        )

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
    _t_roboflow_start = time.perf_counter()
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
    _roboflow_ms = (time.perf_counter() - _t_roboflow_start) * 1000
    print(f"[timing] roboflow={_roboflow_ms:.0f}ms")

    if roboflow_output is None:
        print("[trace] detect_with_roboflow returned None → falling back to contour")
        return None
    if not roboflow_output.elements:
        print("[trace] Roboflow output had no elements → falling back to contour")
        return None

    return await _generate_from_output(
        roboflow_output,
        request,
        roboflow_ms=_roboflow_ms,
        skip_synthesis=False,
    )


async def _generate_from_output(
    roboflow_output: ExternalModelOutput,
    request: GenerateCodeRequest,
    *,
    roboflow_ms: float,
    skip_synthesis: bool,
) -> Optional[ExternalModelOutput]:
    """Shared generation tail: text attachment, role hints, Gemini call.

    Fed either by the live Roboflow detection or by the HITL corrected element
    set. ``skip_synthesis`` is True on the HITL path — the user's reviewed set
    is authoritative, so fabricating extra containers behind their back would
    defeat the point of the review step.
    """
    _roboflow_ms = roboflow_ms
    canvas_size = (
        int((request.canvasData.width if request.canvasData else 0) or 1000),
        int((request.canvasData.height if request.canvasData else 0) or 600),
    )

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
    elif (
        skip_synthesis  # HITL path: Roboflow was skipped, so no stashed image
        and request.sketchSource in ("upload-photo", "upload-clean")
        and request.sketchImage
    ):
        # The frontend sends back the preprocessed preview it got from
        # /api/detect as sketchImage, so it is already in the same pixel space
        # as the corrected boxes — decode it directly for Gemini text reading.
        try:
            from app.models.inference import _decode_sketch_image

            gemini_image_bytes = _decode_sketch_image(request.sketchImage)
        except Exception as decode_error:
            print(f"[trace] could not decode HITL upload image for Gemini: {decode_error}")

    annotations = request.textAnnotations or []
    if debug and annotations:
        print(
            f"[debug] {len(annotations)} text annotation(s) (already in image space "
            f"{int(image_w)}x{int(image_h)})"
        )

    if not skip_synthesis:
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

    # Deterministic prompt hints (after text attachment so label_text exists):
    # unambiguous cards get an explicit role (input/button/image/nav item) and
    # containers get their drawn child alignment. Gemini follows explicit
    # per-element hints far more reliably than the prose heuristics alone.
    annotate_role_hints(roboflow_output.elements)
    annotate_alignment(roboflow_output.elements)

    # Incremental regeneration (feature D): when the frontend sends the prior
    # generation, diff old vs new detection sets and patch instead of
    # regenerating — unchanged code (incl. chat refinements) stays intact.
    incremental_prompt: Optional[str] = None
    incremental_enabled = os.getenv("INCREMENTAL_ENABLED", "true").lower() not in (
        "false", "0", "off", "no",
    )
    if (
        request.previousCode
        and request.previousElements
        and incremental_enabled
        and not _previous_code_is_degenerate(
            request.previousCode, len(request.previousElements)
        )
    ):
        diff = diff_detection_sets(
            [e.model_dump() for e in request.previousElements],
            roboflow_output.elements,
        )
        n_changes = len(diff["added"]) + len(diff["removed"])
        if n_changes == 0:
            print("[incremental] no detection changes — keeping previous code (no Gemini call)")
            roboflow_output.generated_code = request.previousCode
            roboflow_output.metadata = {
                **(roboflow_output.metadata or {}),
                "code_generator": "incremental-noop",
                "incremental": True,
                "timing_ms": {"roboflow": round(_roboflow_ms), "gemini": 0},
            }
            return roboflow_output
        # A huge delta means a substantially different sketch — a full
        # regeneration is safer than a long patch instruction.
        max_delta = max(4, len(roboflow_output.elements) // 2)
        if diff["matched"] and n_changes <= max_delta:
            print(
                f"[incremental] delta prompt: +{len(diff['added'])} "
                f"-{len(diff['removed'])} (matched {len(diff['matched'])})"
            )
            incremental_prompt = build_incremental_prompt(
                request.previousCode,
                request.framework,
                roboflow_output.elements,
                diff,
            )
        else:
            print(
                f"[incremental] delta too large (+{len(diff['added'])} "
                f"-{len(diff['removed'])}, matched {len(diff['matched'])}) — full regeneration"
            )

    if debug:
        # Print what Gemini will ACTUALLY receive: the incremental patch
        # prompt when the delta path fired, the full prompt otherwise.
        if incremental_prompt is not None:
            prompt_preview = incremental_prompt
            print("[debug] Gemini prompt (INCREMENTAL PATCH — previous code + delta):")
        else:
            prompt_preview = _build_gemini_prompt(
                roboflow_output.elements,
                request.framework,
                request.styling,
                request.description,
                extra_text=extra_text or None,
                has_image=gemini_image_bytes is not None,
                brand_kit=request.brandKit.as_prompt_dict() if request.brandKit else None,
                screens=request.screens,
                current_screen=request.currentScreen,
            )
            print("[debug] Gemini prompt:")
        print("-" * 70)
        print(prompt_preview)
        print("-" * 70)

    _t_gemini_start = time.perf_counter()
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
                brand_kit=request.brandKit.as_prompt_dict()
                if request.brandKit
                else None,
                prompt_override=incremental_prompt,
                screens=request.screens,
                current_screen=request.currentScreen,
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

    _gemini_ms = (time.perf_counter() - _t_gemini_start) * 1000
    print(f"[timing] gemini={_gemini_ms:.0f}ms")

    roboflow_output.generated_code = generated_code
    roboflow_output.metadata = {
        **(roboflow_output.metadata or {}),
        "code_generator": "gemini-incremental" if incremental_prompt else "gemini",
        "incremental": bool(incremental_prompt),
        "timing_ms": {"roboflow": round(_roboflow_ms), "gemini": round(_gemini_ms)},
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

        # HITL audit trail: what the user changed in the review overlay. Logged
        # fire-and-forget — a logging failure must never block generation.
        if request.detectionCorrections:
            rows = _build_correction_rows(
                request.projectId, request.userId, request.detectionCorrections
            )
            if rows:
                try:
                    supabase.table("detection_corrections").insert(rows).execute()
                    print(f"[hitl] logged {len(rows)} detection correction(s)")
                except Exception as log_error:
                    print(f"Warning: could not log detection corrections: {log_error}")

        if request.mode == "chat":
            if not request.messages or not request.currentCode:
                raise HTTPException(
                    status_code=400,
                    detail="Missing messages or code context",
                )

            last_message = request.messages[-1].content
            chat_prompt = build_chat_refine_prompt(
                last_message,
                request.currentCode,
                request.framework,
            )
            used_fallback = False
            try:
                refined = await asyncio.wait_for(
                    asyncio.to_thread(
                        generate_with_gemini,
                        [],
                        request.framework,
                        request.styling,
                        None,
                        prompt_override=chat_prompt,
                    ),
                    timeout=GEMINI_TIMEOUT_SECONDS,
                )
                refined = re.sub(r"^```[\w]*\n?", "", refined.strip())
                refined = re.sub(r"\n?```$", "", refined).strip()
                if not refined:
                    raise RuntimeError("Gemini returned empty code")
                result = {
                    "code": refined,
                    "message": "Code updated.",
                }
            except (GeminiRateLimited, GeminiQuotaExhausted) as error:
                print(f"Gemini chat unavailable: {error}")
                used_fallback = True
                result = {
                    "code": request.currentCode
                    + f"\n\n<!-- Refinement: {last_message} -->",
                    "message": "AI service is busy right now - added your request as a comment. Try again shortly.",
                }
            except Exception as error:
                print(f"Gemini chat error: {error}")
                used_fallback = True
                result = {
                    "code": request.currentCode
                    + f"\n\n<!-- Refinement: {last_message} -->",
                    "message": "AI service temporarily unavailable - added your request as a comment.",
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
                usedFallback=used_fallback or None,
            )

        if not request.canvasData:
            raise HTTPException(status_code=400, detail="Invalid canvas data")

        canvas_data = request.canvasData.model_dump()

        # Upload path: the frontend keeps the API payload lean (the image
        # already travels as sketchImage), so canvasData carries no
        # uploadedSketch stub. Stamp one in before persisting so version
        # restore can bring the upload workspace back for THIS iteration.
        if (
            request.sketchSource in ("upload-photo", "upload-clean")
            and request.sketchImage
            and not canvas_data.get("uploadedSketch")
        ):
            _data_url = request.sketchImage
            if not _data_url.startswith("data:"):
                _data_url = "data:image/png;base64," + _data_url
            canvas_data["uploadedSketch"] = {
                "dataUrl": _data_url,
                "source": request.sketchSource,
                "width": canvas_data.get("width") or 1000,
                "height": canvas_data.get("height") or 600,
            }

        # B12: Cache check. Same sketch + framework + labels → skip Roboflow+Gemini.
        # Auth and rate-limit already passed above; still persist an iteration on
        # hit so version history stays accurate for the user.
        # HITL corrected sets bypass the cache entirely (read AND write): the
        # cache key hashes the sketch image, not the corrections, so a cached
        # result would silently ignore the user's edits.
        cache_key: Optional[str] = None
        if (
            generation_cache is not None
            and request.sketchImage
            and not request.correctedElements
            # Incremental requests depend on previousCode, which the key does
            # not hash — a cache hit would ignore the user's sketch edit.
            and not request.previousCode
        ):
            cache_key = _generation_cache_key(
                request.sketchImage,
                request.framework,
                request.sketchSource,
                request.textAnnotations,
                request.brandKit,
                request.screens,
                request.currentScreen,
            )
            cached = generation_cache.get(cache_key)
            if cached is not None:
                print(f"[cache] HIT (key={cache_key[:20]}…) — skipping Roboflow+Gemini")
                iteration_id = persist_generation_result(
                    supabase,
                    request.projectId,
                    canvas_data,
                    cached.generated_code,
                    request.description,
                )
                return GenerateCodeResponse(
                    code=cached.generated_code,
                    success=True,
                    detectedElements=[DetectedElement(**e) for e in cached.elements_json],
                    message=None,
                    iteration_id=iteration_id,
                    usedFallback=False,
                    timing_ms={"total": 0, "cache_hit": 1},
                )
            print(f"[cache] MISS (key={cache_key[:20]}…)")

        _t_pipeline_start = time.perf_counter()
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

        # Cache successful Gemini results. Skip for fallback/mock/template paths —
        # those are degraded outputs and shouldn't crowd out real results.
        if (
            generation_cache is not None
            and cache_key is not None
            and external_model_output is not None
            and getattr(external_model_output, "source", None) != "mock"
            and getattr(external_model_output, "generated_code", None)
        ):
            generation_cache.put(
                cache_key,
                CachedResult(
                    generated_code=generated_code,
                    elements_json=detected_elements,
                    source="gemini",
                ),
            )
            print(f"[cache] stored (key={cache_key[:20]}…, size={generation_cache.size})")

        iteration_id = persist_generation_result(
            supabase,
            request.projectId,
            canvas_data,
            generated_code,
            generation_description,
        )

        _total_ms = (time.perf_counter() - _t_pipeline_start) * 1000
        _stage_timing: Optional[Dict[str, float]] = (
            (external_model_output.metadata or {}).get("timing_ms")
            if external_model_output and external_model_output.metadata
            else None
        )
        _timing_ms: Dict[str, float] = {"total": round(_total_ms)}
        if _stage_timing:
            _timing_ms.update(_stage_timing)
        print(
            f"[timing] total={_total_ms:.0f}ms"
            + (
                f" (roboflow={_stage_timing['roboflow']}ms"
                f" gemini={_stage_timing['gemini']}ms)"
                if _stage_timing
                else ""
            )
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

        used_incremental = bool(
            external_model_output is not None
            and (external_model_output.metadata or {}).get("incremental")
        )

        return GenerateCodeResponse(
            code=generated_code,
            success=True,
            detectedElements=[DetectedElement(**elem) for elem in detected_elements],
            message=response_message,
            iteration_id=iteration_id,
            usedFallback=used_fallback,
            timing_ms=_timing_ms,
            usedIncremental=used_incremental or None,
        )

    except HTTPException:
        raise
    except Exception as error:
        print(f"Error in prediction pipeline: {str(error)}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(error)}")


def _build_correction_rows(
    project_id: str,
    user_id: str,
    corrections: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Normalize the review-overlay correction log into detection_corrections
    rows. Unknown actions are dropped rather than rejected — the log is an
    audit trail, not a contract, and must never break generation."""
    rows: List[Dict[str, Any]] = []
    for entry in corrections:
        if not isinstance(entry, dict):
            continue
        action = str(entry.get("action") or "").lower()
        if action not in ("relabel", "delete", "add"):
            continue
        rows.append(
            {
                "project_id": project_id,
                "user_id": user_id,
                "action": action,
                "element_type": str(entry.get("elementType") or "") or None,
                "previous_type": str(entry.get("previousType") or "") or None,
                "bounds": entry.get("bounds") if isinstance(entry.get("bounds"), dict) else None,
            }
        )
    return rows


@app.post("/api/detect", response_model=DetectResponse)
async def detect(request: DetectRequest, http_request: Request):
    """Detection-only endpoint for the HITL review step (Idea #4).

    Runs the same Roboflow call /api/predict would, but stops before Gemini so
    the user can review, relabel, delete or add boxes in the overlay. The
    corrected set then goes back through /api/predict as correctedElements
    (which skips Roboflow — the detection budget is spent exactly once).
    """
    if not request.sketchImage.strip():
        raise HTTPException(status_code=400, detail="No sketch image to detect on")

    # Same per-user AI budget as /api/predict — this spends a Roboflow call.
    if ai_rate_limiter is not None:
        allowed, retry_after, _ = ai_rate_limiter.check(
            _rate_limit_key(request, http_request)
        )
        if not allowed:
            retry_secs = max(1, math.ceil(retry_after))
            raise HTTPException(
                status_code=429,
                detail=(
                    "You're sending requests too quickly. "
                    f"Please wait {retry_secs}s and try again."
                ),
                headers={"Retry-After": str(retry_secs)},
            )

    supabase = create_supabase_client()
    load_project_or_403(supabase, request.projectId, request.userId)

    _t_start = time.perf_counter()
    try:
        output = await asyncio.wait_for(
            asyncio.to_thread(
                detect_with_roboflow,
                request.sketchImage,
                (request.width, request.height),
                sketch_source=request.sketchSource,
            ),
            timeout=60.0,
        )
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=504,
            detail="Sketch detection timed out — the Roboflow API did not respond in time. Please try again.",
        )
    except Exception as error:
        print(f"[detect] Roboflow call raised: {error}")
        raise HTTPException(status_code=502, detail="Sketch detection failed")

    _detect_ms = (time.perf_counter() - _t_start) * 1000

    if output is None or not output.elements:
        # Not an error: a blank/unrecognizable sketch legitimately detects
        # nothing. The frontend falls back to the direct generation path.
        return DetectResponse(
            success=True,
            elements=[],
            timing_ms={"total": round(_detect_ms)},
        )

    meta = output.metadata or {}

    # Uploads: the boxes live in post-preprocessing pixel space, so the overlay
    # must draw on the preprocessed image. Reuse the stashed Gemini copy (clean,
    # non-binarized — most readable for the user) as the review preview.
    preview_image: Optional[str] = None
    processed_b64 = meta.pop("processed_image_b64", None)
    if processed_b64 and request.sketchSource in ("upload-photo", "upload-clean"):
        preview_image = f"data:image/png;base64,{processed_b64}"

    elements = [
        DetectedElement(
            type=el.type,
            confidence=el.confidence,
            bounds=el.bounds,
            label=el.label,
        )
        for el in output.elements
    ]
    print(f"[detect] {len(elements)} element(s) in {_detect_ms:.0f}ms (HITL review)")

    return DetectResponse(
        success=True,
        elements=elements,
        imageWidth=float(meta.get("image_width") or 0) or None,
        imageHeight=float(meta.get("image_height") or 0) or None,
        previewImage=preview_image,
        timing_ms={"total": round(_detect_ms)},
    )


@app.post("/api/fidelity", response_model=FidelityResponse)
async def fidelity(request: FidelityRequest, http_request: Request):
    """Cyclic self-verification of a generation (Decision #25).

    Renders the generated code headless, converts the screenshot back into
    line-art (the detector's training domain), re-runs the SAME Roboflow
    detector on it, and scores the re-detected boxes against the original
    sketch's boxes. Returns a 0-1 fidelity score plus a per-element mismatch
    report (missing / extra) the UI shows next to the code.
    """
    from app.utils.fidelity import (
        FidelityUnavailableError,
        elements_to_fidelity_boxes,
        normalize_render_to_sketch_domain,
        render_code_to_png,
        score_fidelity,
    )

    # Kill switch (deploy safety): on 512MB hosts a per-request Chromium launch
    # can OOM-kill the whole process. Set FIDELITY_ENABLED=false to hard-disable
    # this endpoint without a code redeploy — the UI badge just stops appearing.
    if os.getenv("FIDELITY_ENABLED", "true").lower() in ("0", "false", "no", "off"):
        raise HTTPException(
            status_code=503,
            detail="Fidelity scoring is disabled on this deployment (FIDELITY_ENABLED=false).",
        )

    if not request.elements:
        raise HTTPException(status_code=400, detail="No detected elements to score against")
    if not request.code.strip():
        raise HTTPException(status_code=400, detail="No generated code to score")

    # Shares the AI limiter with /api/predict — this endpoint also spends a
    # Roboflow call, so it draws from the same per-user budget.
    if ai_rate_limiter is not None:
        allowed, retry_after, _ = ai_rate_limiter.check(
            _rate_limit_key(request, http_request)
        )
        if not allowed:
            retry_secs = max(1, math.ceil(retry_after))
            raise HTTPException(
                status_code=429,
                detail=(
                    "You're sending requests too quickly. "
                    f"Please wait {retry_secs}s and try again."
                ),
                headers={"Retry-After": str(retry_secs)},
            )

    supabase = create_supabase_client()
    load_project_or_403(supabase, request.projectId, request.userId)

    _t_start = time.perf_counter()
    try:
        render_png = await render_code_to_png(
            request.code, request.framework, request.width, request.height
        )
    except FidelityUnavailableError as error:
        raise HTTPException(status_code=503, detail=str(error))
    except Exception as error:
        print(f"[fidelity] render failed: {error}")
        raise HTTPException(status_code=500, detail=f"Render failed: {error}")
    _render_ms = (time.perf_counter() - _t_start) * 1000

    line_art_png = await asyncio.to_thread(normalize_render_to_sketch_domain, render_png)

    if _debug_ai_enabled():
        try:
            debug_dir = BASE_DIR / "debug"
            debug_dir.mkdir(exist_ok=True)
            (debug_dir / "last_render.png").write_bytes(render_png)
            (debug_dir / "last_render_lineart.png").write_bytes(line_art_png)
            print(f"[fidelity] debug renders saved to {debug_dir}")
        except Exception as dump_error:
            print(f"[fidelity] could not save debug renders: {dump_error}")

    _t_detect = time.perf_counter()
    rendered_output = await asyncio.to_thread(
        detect_with_roboflow,
        base64.b64encode(line_art_png).decode("ascii"),
        (request.width, request.height),
    )
    _detect_ms = (time.perf_counter() - _t_detect) * 1000
    if rendered_output is None:
        raise HTTPException(
            status_code=502, detail="Re-detection on the rendered code failed"
        )

    original_boxes = elements_to_fidelity_boxes(
        [e.model_dump() for e in request.elements]
    )
    rendered_boxes = elements_to_fidelity_boxes(
        [
            {"type": el.type, "confidence": el.confidence, "bounds": el.bounds}
            for el in (rendered_output.elements or [])
        ]
    )
    report = score_fidelity(
        original_boxes,
        rendered_boxes,
        canvas_height=float(request.height),
        canvas_width=float(request.width),
    )

    _total_ms = (time.perf_counter() - _t_start) * 1000
    print(
        f"[fidelity] score={report['score']:.2f} "
        f"(tp={report['counts']['tp']} fp={report['counts']['fp']} "
        f"fn={report['counts']['fn']}) total={_total_ms:.0f}ms"
    )
    if _debug_ai_enabled():
        # Box-level dump — without this a 0.00 score is undiagnosable (no way
        # to tell coordinate mismatch from render failure from detector miss).
        for b in original_boxes:
            print(
                f"[fidelity]   orig {b.cls:8s} ({b.x:.0f},{b.y:.0f},{b.w:.0f},{b.h:.0f}) "
                f"{'matched' if b.matched else 'MISSING'}"
            )
        for b in rendered_boxes:
            print(
                f"[fidelity]   rend {b.cls:8s} conf={b.confidence:.2f} "
                f"({b.x:.0f},{b.y:.0f},{b.w:.0f},{b.h:.0f}) "
                f"{'matched' if b.matched else 'EXTRA'}"
            )

    return FidelityResponse(
        success=True,
        score=report["score"],
        report=report,
        timing_ms={
            "total": round(_total_ms),
            "render": round(_render_ms),
            "redetect": round(_detect_ms),
        },
    )


@app.post("/api/repair", response_model=RepairResponse)
async def repair(request: RepairRequest, http_request: Request):
    """Auto-repair pass: one corrective Gemini call driven by the fidelity
    mismatch report. Adds the missing elements, removes the extras, and is
    instructed to leave everything else byte-identical. The client re-scores
    the result via /api/fidelity to show the before/after.
    """
    if not request.code.strip():
        raise HTTPException(status_code=400, detail="No code to repair")
    if not request.missing and not request.extra:
        raise HTTPException(status_code=400, detail="Nothing to repair")

    # Same per-user AI budget as /api/predict — this is a full Gemini call.
    if ai_rate_limiter is not None:
        allowed, retry_after, _ = ai_rate_limiter.check(
            _rate_limit_key(request, http_request)
        )
        if not allowed:
            retry_secs = max(1, math.ceil(retry_after))
            raise HTTPException(
                status_code=429,
                detail=(
                    "You're sending requests too quickly. "
                    f"Please wait {retry_secs}s and try again."
                ),
                headers={"Retry-After": str(retry_secs)},
            )

    supabase = create_supabase_client()
    project = load_project_or_403(supabase, request.projectId, request.userId)

    prompt = build_repair_prompt(
        request.code,
        request.framework,
        request.missing,
        request.extra,
        float(request.width),
        float(request.height),
    )

    _t_start = time.perf_counter()
    try:
        repaired_code = await asyncio.wait_for(
            asyncio.to_thread(
                generate_with_gemini,
                [],
                request.framework,
                "tailwind",
                None,
                prompt_override=prompt,
            ),
            timeout=GEMINI_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Repair timed out")
    except GeminiRateLimited as error:
        raise HTTPException(
            status_code=429, detail=str(error), headers={"Retry-After": "60"}
        )
    except GeminiQuotaExhausted as error:
        raise HTTPException(status_code=503, detail=str(error))
    except Exception as error:
        print(f"[repair] Gemini error: {error}")
        raise HTTPException(status_code=500, detail=f"Repair failed: {error}")

    if not repaired_code or not repaired_code.strip():
        raise HTTPException(status_code=502, detail="Repair returned empty code")

    # Sanity guard: repair is a SURGICAL patch (add missing, remove extras,
    # byte-identical elsewhere). Output dramatically smaller than the input
    # means Gemini rewrote the page as a stub (live case: a correct 4679-char
    # login screen came back as 901 chars of literal "Card"/"Navbar"
    # placeholders). Reject — the user keeps their code, the badge just shows
    # the unrepaired score. Legitimate extra-removal never halves the file.
    if len(repaired_code) < 0.5 * len(request.code):
        print(
            f"[repair] REJECTED: output {len(repaired_code)} chars vs input "
            f"{len(request.code)} — shrank below 50%, looks like a rewrite, "
            "not a patch"
        )
        raise HTTPException(
            status_code=422,
            detail="Repair output failed sanity check (code shrank drastically)",
        )

    # Second sanity guard: the repair prompt names missing elements by their
    # detector class ("card", "navbar"...) and despite an explicit rule Gemini
    # sometimes renders that word as the element's visible text (live case:
    # a '<p>Card</p>' heading + stub injected into a correct signup form). A
    # class stub the INPUT didn't have means the patch fabricated garbage.
    if _repair_introduced_class_stubs(repaired_code, request.code):
        print(
            "[repair] REJECTED: output renders a literal detector-class name "
            "('Card'/'Navbar'/...) as visible text that the input did not — "
            "fabricated stub, not a patch"
        )
        raise HTTPException(
            status_code=422,
            detail="Repair output failed sanity check (introduced detector-class stubs)",
        )

    # Version history stays truthful: the repaired code is a new iteration.
    iteration_id = persist_generation_result(
        supabase,
        request.projectId,
        project.get("canvas_data") or {},
        repaired_code,
        "Auto-repair pass (fidelity self-check)",
    )

    print(
        f"[repair] ok chars={len(repaired_code)} "
        f"missing={len(request.missing)} extra={len(request.extra)} "
        f"took={(time.perf_counter() - _t_start) * 1000:.0f}ms"
    )
    return RepairResponse(success=True, code=repaired_code, iteration_id=iteration_id)


@app.post("/api/annotate", response_model=AnnotateResponse)
async def annotate(request: AnnotateRequest, http_request: Request):
    """Annotate-on-render refinement: one targeted Gemini call driven by the
    user's markup on the live preview. The markup resolves to data-cc-id
    elements (or a raw region), and the prompt instructs Gemini to apply the
    user's note to those parts only, byte-preserving everything else.
    """
    if not request.code.strip():
        raise HTTPException(status_code=400, detail="No code to refine")
    if not request.note.strip():
        raise HTTPException(status_code=400, detail="Annotation note is empty")
    if not request.targets and not request.region:
        raise HTTPException(
            status_code=400, detail="Annotation has no target elements or region"
        )

    # Same per-user AI budget as /api/predict — this is a full Gemini call.
    if ai_rate_limiter is not None:
        allowed, retry_after, _ = ai_rate_limiter.check(
            _rate_limit_key(request, http_request)
        )
        if not allowed:
            retry_secs = max(1, math.ceil(retry_after))
            raise HTTPException(
                status_code=429,
                detail=(
                    "You're sending requests too quickly. "
                    f"Please wait {retry_secs}s and try again."
                ),
                headers={"Retry-After": str(retry_secs)},
            )

    supabase = create_supabase_client()
    project = load_project_or_403(supabase, request.projectId, request.userId)

    prompt = build_annotation_prompt(
        request.code,
        request.framework,
        request.note,
        request.targets,
        request.region,
        float(request.width),
        float(request.height),
    )

    _t_start = time.perf_counter()
    try:
        refined_code = await asyncio.wait_for(
            asyncio.to_thread(
                generate_with_gemini,
                [],
                request.framework,
                "tailwind",
                None,
                prompt_override=prompt,
            ),
            timeout=GEMINI_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Annotation refinement timed out")
    except GeminiRateLimited as error:
        raise HTTPException(
            status_code=429, detail=str(error), headers={"Retry-After": "60"}
        )
    except GeminiQuotaExhausted as error:
        raise HTTPException(status_code=503, detail=str(error))
    except Exception as error:
        print(f"[annotate] Gemini error: {error}")
        raise HTTPException(
            status_code=500, detail=f"Annotation refinement failed: {error}"
        )

    if not refined_code or not refined_code.strip():
        raise HTTPException(
            status_code=502, detail="Annotation refinement returned empty code"
        )

    # Version history stays truthful: the refined code is a new iteration.
    note_summary = request.note.strip().replace("\n", " ")
    if len(note_summary) > 120:
        note_summary = note_summary[:117] + "..."
    iteration_id = persist_generation_result(
        supabase,
        request.projectId,
        project.get("canvas_data") or {},
        refined_code,
        f"Annotation refinement: {note_summary}",
    )

    print(
        f"[annotate] ok chars={len(refined_code)} targets={len(request.targets)} "
        f"took={(time.perf_counter() - _t_start) * 1000:.0f}ms"
    )
    return AnnotateResponse(
        success=True, code=refined_code, iteration_id=iteration_id
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
