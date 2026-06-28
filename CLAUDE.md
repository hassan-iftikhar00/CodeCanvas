# CodeCanvas — Claude Context File

> Read this file before helping with any task.
> This is a FYP (Final Year Project) at a university.
> Last updated: 2026-06-26

---

## What is CodeCanvas?

CodeCanvas is a **sketch-to-code web application**. Users draw UI wireframes on a canvas and the system generates production-ready frontend code from those drawings.

**One line summary:** Draw a UI sketch -> Get real React/HTML code instantly.

---

## Tech Stack

### Frontend
- Next.js 14 (App Router), TypeScript, Tailwind CSS
- Konva.js (canvas drawing), Supabase (auth + database)
- OpenRouter API (chat-based code refinement)

### Backend
- Python FastAPI (port 8000), Supabase PostgreSQL
- Roboflow API (UI component detection), Google Gemini API (code generation)

### Infrastructure
- Supabase (auth, database, storage)
- Roboflow cloud (hosts Shahwaiz's trained model)
- Next.js dev server (port 3000)

---

## The Complete Pipeline

```
Step 1: User draws sketch on canvas
        File: src/components/canvas/SketchCanvas.tsx

Step 2: User clicks "Run Detection"
        File: src/app/canvas/page.tsx

Step 3: Sketch image POSTed to FastAPI
        Frontend proxy: src/app/api/generate-code/route.ts
        Backend endpoint: POST /api/predict in backend/main.py

Step 4: FastAPI calls Roboflow API
        File: backend/app/models/inference.py (SketchDetector)
        Returns: [navbar, section, card, footer] with positions

Step 5: Backend attaches text annotations to detected elements
        File: backend/main.py (_attach_text_annotations,
        _synthesize_missing_containers, _infer_canvas_extents)

Step 6: Gemini generates React + Tailwind code
        File: backend/app/models/inference.py
        Entry points: _build_gemini_prompt + generate_with_gemini
        Class: CodeGenerator (no separate code_generator.py file)

Step 7: Code returned to frontend and displayed
        File: src/app/canvas/page.tsx (code panel)

Step 8: User can refine code via chat
        Frontend: src/components/canvas/ChatInterface.tsx
        Backend: refine_chat_with_openrouter in backend/main.py
        Uses: OpenRouter API (separate from Gemini)
```

**Alternate input (Upload Image):** instead of drawing, the user can upload a photo of a hand-drawn sketch or a clean digital wireframe (`src/components/canvas/UploadSketchModal.tsx`). It bypasses the canvas and feeds the image straight into Step 3 as `sketchImage` with `sketchSource: "upload-photo" | "upload-clean"`; the backend photo-normalizes it (`preprocess_uploaded_photo`) before Roboflow. Because the detector returns boxes with no text and uploads carry no `textAnnotations`, Step 6 additionally hands the processed image to Gemini (multimodal) so it READS the labels baked into the image. Steps 3-8 are otherwise identical. See Decisions #21 and #22.

---

## Team Structure

| Person            | Role                               |
| ----------------- | ---------------------------------- |
| **Hassan (Lead)** | Architecture, integration, reviews |
| **Maarij**        | Frontend / UI / Dashboard          |
| **Bilal**         | Backend / Database / API / Testing |
| **Shahwaiz**      | AI Model training                  |

### Important Rule
- Do NOT assign implementation tasks to Hassan (Lead)
- Hassan only does: integration work, reviews, final QA
- Maarij owns all frontend files
- Bilal owns all backend/DB files

---

## Shahwaiz's AI Model — Current Status

### Hosting & Access
- **Production Model ID (in `.env`):** `object-detection-4affw/4` (YOLOv11 Small, 2026-06-11; 4,481-image training corpus = 311 real + 2,700 synthetic + ~1,470 likely Roboflow auto-augmentation; promoted 2026-06-12)
- **Legacy model:** `object-detection-4affw/2` (YOLOv11 Fast, 311 images) — kept for rollback only; restore `card=0.03` threshold if you swap back
- **API URL:** `https://detect.roboflow.com` (do NOT use `serverless.roboflow.com`)
- **Integration:** `inference-sdk` Python package
- **Key:** `ROBOFLOW_API_KEY` in `.env` (never in frontend)

### Class Semantics (confirmed with Shahwaiz)

| class     | meaning                                                                                |
| --------- | -------------------------------------------------------------------------------------- |
| `navbar`  | top horizontal bar region (CONTAINER)                                                  |
| `footer`  | bottom horizontal bar region (CONTAINER)                                               |
| `section` | middle page body excluding header/footer (CONTAINER)                                   |
| `card`    | catch-all for every content unit: button, text, heading, input, image, icon            |

Cards live INSIDE sections. Disambiguation (button vs input etc.) happens via bbox aspect ratio + text annotation.

**YOLO class IDs (alphabetical):**

| ID | class     |
|----|-----------|
| 0  | `card`    |
| 1  | `footer`  |
| 2  | `navbar`  |
| 3  | `section` |

### Operational Notes (load-bearing — read before debugging detection)

1. **Input MUST be on a solid white background.** RGBA transparent -> composited to black -> invisible lines -> 0 predictions. Backend composites alpha->white at decode time. If detection misbehaves, check `backend/debug/last_sketch.png`.
2. **Per-class confidence thresholds** (`inference.py`): all four classes at `0.20` (re-tuned 2026-06-12 for v4). If you swap back to `/2`, restore `card=0.03`. Override via env: `ROBOFLOW_CONFIDENCE_THRESHOLD_CARD=0.10`.
3. **Class-aware NMS** (IoU > 0.5 within same class) deduplicates detections. Cross-class overlaps (card inside section) are KEPT — that's the intended hierarchy.
4. **Oversize-card guard:** any `card` covering > 85% of the image is dropped.
5. **Server-side confidence floor** set explicitly via `InferenceConfiguration(confidence_threshold=0.05)` — Roboflow's default ~0.4 silently hides most card predictions.
6. **Debug PNG dump:** `DEBUG_AI_PROMPT=on` writes the composited image to `backend/debug/last_sketch.png`.

-> Performance tables, dataset composition, confusion matrix, preprocessing details, v2/v4 FYP write-up: **Audits/ARCHITECTURE_DETAILS.md**

---

## LLM Usage — Who Does What

| LLM                | Purpose                                          |
| ------------------ | ------------------------------------------------ |
| **Gemini 2.5 Pro** | Initial code generation from detected components |
| **Gemini Flash**   | Fallback if 2.5 Pro is slow                      |
| **OpenRouter**     | Chat-based code refinement ONLY                  |

Gemini and OpenRouter serve different purposes and do NOT overlap.

---

## Database Schema — Canonical (Use This One)

```sql
-- Projects table
projects (
  id,
  title,          -- NOT "name"
  thumbnail_url,  -- NOT "thumbnail"
  user_id,
  framework,
  generated_code,
  canvas_data,
  created_at,
  updated_at
)

-- Iterations table (NOT "project_versions")
iterations (
  id,
  project_id,
  version_number,
  canvas_data,
  generated_code,
  created_at
)

-- Profiles table
profiles (
  id,             -- matches auth.users.id
  onboarding_completed  -- boolean, default false
)

-- DB function (migration 20260515000001)
delete_project(project_id uuid)  -- cascades: deletes iterations then project
```

### CRITICAL: Wrong names that must NOT be used
- ❌ `name` -> use `title`
- ❌ `thumbnail` -> use `thumbnail_url`
- ❌ `project_versions` -> use `iterations`

---

## Environment Variables Required

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENROUTER_API_KEY=        # For chat refinement
GEMINI_API_KEY=            # For code generation
ROBOFLOW_API_KEY=          # For sketch detection
ROBOFLOW_MODEL_ID=object-detection-4affw/4

# Optional tuning (have safe defaults — only set to override):
GEMINI_TIMEOUT_SECONDS=110          # backend Gemini code-gen ceiling
FASTAPI_PROXY_TIMEOUT_MS=120000     # Next.js proxy ceiling (keep ABOVE Gemini ceiling)
RATE_LIMIT_ENABLED=true             # B7: per-user rate limit on /api/predict
RATE_LIMIT_MAX_REQUESTS=20          # requests allowed per window, per user
RATE_LIMIT_WINDOW_SECONDS=60        # sliding window length in seconds
```

---

## Current Status

### ✅ Fully Done
- Canvas drawing interface (Konva.js) + redesign (`CanvasSurface`, `FloatingToolbar`, `StyleRibbon`, `ZoomPill`)
- Roboflow + Gemini pipeline end-to-end (H4)
- Backend text-to-element matching (canvas-extent inference, oversized containers, navbar/footer synthesis)
- User authentication (Supabase)
- Project save/load (`useProjectSave`, canonical `title`/`thumbnail_url`)
- OpenRouter chat refinement
- Version history (`useVersionHistory`, `iterations` table)
- Project rename (`updateProjectTitle`)
- Toast notifications (`src/components/ui/Toast.tsx`)
- Canvas keyboard shortcuts (`useCanvasShortcuts`)
- Profile page, Dashboard card actions + delete, Empty states, Onboarding tour
- M8: Error boundaries (`ErrorBoundary.tsx`, page/panel/inline variants)
- M9: Loading skeletons (auth/canvas/dashboard/profile)
- M11: Dark mode (`html[data-theme]` system, FOUC prevention, `ThemeProvider`)
- Account deletion flow (`DeleteAccountModal` + `/api/account/delete`)
- Export-as-ZIP (`src/lib/export-zip.ts`, real Vite+React scaffold)
- Full Drafting Room migration (canvas, auth, dashboard, profile, landing)
- SVG wireframe card thumbnails (`src/components/SketchThumbnail.tsx`)
- Container reclassification + orphan-card synthesis (`backend/main.py:379`)
- Decision #20 retired: orphan-label synthesis removed
- v4 model promoted to `.env` (frontend + backend), thresholds re-tuned, cold-start warm-up + 60s Roboflow timeout, Playwright smoke-tested on 4 templates + Login Form (2026-06-12)
- Gemini/proxy timeout hardening (2026-06-17, Hassan): backend Gemini ceiling 90s->110s (`GEMINI_TIMEOUT_SECONDS`), proxy 100s->120s (`FASTAPI_PROXY_TIMEOUT_MS`) so a slow cold Flash call stops 504ing right before it returns.
- Upload Image input (2026-06-17): alternative to drawing — upload a photo of a sketch / digital wireframe through the same detection->Gemini pipeline. New `UploadSketchModal.tsx`; shared `runGeneration` in `page.tsx`; additive `sketchSource` field + `preprocess_uploaded_photo` (cv2) in backend. Code-complete + statically verified (tsc/lint clean, cv2 + pydantic unit-checked); live end-to-end pending the Roboflow credit cap (see memory). See Decision #21.
- Upload text-reading via multimodal Gemini (2026-06-17): uploads now pass the processed sketch image to Gemini so text baked into the pixels (button labels, nav links, headings) is read and rendered, instead of being lost to generic placeholders. Detector returns boxes only; the image is the text source of truth. Backend-only, upload path only; canvas path stays text-only/byte-identical. See Decision #22.
- B7: Rate limiting on the AI endpoint (2026-06-26): `/api/predict` is now capped per authenticated user via a custom in-memory sliding-window limiter (`backend/app/utils/rate_limit.py`). Defaults: 20 requests / 60s, env-tunable (`RATE_LIMIT_ENABLED`, `RATE_LIMIT_MAX_REQUESTS`, `RATE_LIMIT_WINDOW_SECONDS`). Keyed on the trusted user id the proxy stamps in (IP keying would pool all users behind the proxy). Over-limit returns HTTP 429 + `Retry-After`. Protects the shared Roboflow/Gemini quota (relevant while Roboflow is credit-capped). Backend-only; unit + end-to-end verified.
- B4: Proxy log scrub confirmed done (2026-06-26): `proxy.ts` has zero `console.log/debug/info`; doc status corrected to match code.

### ⚠️ Partially Done
- **B11: Frontend + backend tests (2026-06-26):** test infra + first suites now exist on BOTH sides; remaining work is broader coverage, not setup.
  - *Backend:* pytest infra in `backend/` (`pytest.ini`, `conftest.py` with path setup + a conditional `cv2` stub, `requirements-dev.txt`). Two suites, 42 tests, all pass via `python -m pytest`: `tests/test_rate_limit.py` (14 — the B7 limiter, deterministic fake-clock timing + a real-thread lock test) and `tests/test_synthesis_helpers.py` (28 — the detection post-processing in `main.py`: bbox geometry, canvas-extent inference, container reclassify/synthesis per Decision #11, text-to-element matching per Decision #12).
  - *Frontend:* Vitest 4.1.9 wired up — `vitest.config.ts` (node env, `@/` alias mirrors tsconfig), `pnpm test` / `pnpm test:watch` scripts. First suite `src/types/canvas.test.ts` (17 tests: `clampZoom`, `clampCodePanelHeight`, bounds-constant invariants, `TOOL_KEY_MAP` integrity). Small co-locating refactor: the `clampZoom`/`clampCodePanelHeight` helpers moved out of `canvas/page.tsx` into `src/types/canvas.ts` (next to the bounds they enforce) and are now exported, so the test guards the real production code path. `tsc --noEmit` clean on all touched files.
- **Canvas state-bridge:** 500ms poll still primary sync. Remaining: replace with explicit onChange callback in `SketchCanvas`. Candidate for Maarij.
- **M12: Mobile responsiveness:** auth + dashboard + canvas warning done; broader canvas chrome + code panel pass pending.
- **M13: Animations:** canvas chrome + theme transition + sidebar slide done; rest of app pending.

### ❌ Not Started / In Progress
- B1: DB schema unification (Bilal — most critical)
- B5/B6: Framework selector + Export as ZIP endpoint (Bilal)
- B9: CI/CD pipeline (Bilal)
- M15: Docs cleanup (Maarij)

---

## Key Files — Quick Reference

-> Full file map with all components, hooks, backend modules, synthetic data pipeline: **Audits/REFERENCE_FILE_MAP.md**

Most-touched files:

| File | Purpose |
|------|---------|
| `src/app/canvas/page.tsx` | Orchestrator: composes chrome, owns detection + upload triggers (shared `runGeneration`) |
| `src/components/canvas/SketchCanvas.tsx` | Konva drawing surface |
| `src/components/canvas/SketchCanvasWithHistory.tsx` | Drawing + undo/redo wiring |
| `backend/main.py` | FastAPI server, `/api/predict`, synthesis helpers |
| `backend/app/models/inference.py` | SketchDetector + CodeGenerator + Gemini |
| `src/app/api/generate-code/route.ts` | Proxy to FastAPI; OpenRouter routing |
| `src/hooks/useProjectSave.ts` | Project CRUD (canonical schema) |
| `src/types/canvas.ts` | `Tool`, `Mode`, zoom constants, `TOOL_KEY_MAP` |
| `src/lib/drafting-room/tokens.ts` | Single source of truth for Drafting Room palette (`DRAFTING_TOKENS`, `DRAFTING_DARK`) |
| `src/components/canvas/DraftingModal.tsx` | Shared modal scaffold (`ModalButton`, `ModalSection`, `ModalOption`) |
| `src/components/canvas/UploadSketchModal.tsx` | Upload-image modal (drag-drop, Photo/Digital toggle); emits `sketchSource` into `runGeneration` |
| `backend/app/utils/preprocessing.py` | `preprocess_uploaded_photo` (cv2 binarize/crop) + canvas-data rasterizer |
| `src/components/canvas/canvasTokens.tsx` | Re-exports `T_CANVAS` / `CanvasMark` / `CanvasCross` |
| `src/components/auth/AuthShell.tsx` | Auth page scaffold; exports `T_AUTH = DRAFTING_TOKENS` |

---

## Current Task Assignments

### Hassan (Lead) — DO THESE ONLY
- ✅ H4: Roboflow + Gemini end-to-end
- ✅ Canvas redesign + matching reliability
- ✅ Gemini/proxy timeout hardening (2026-06-17) — env-configurable ceilings (`GEMINI_TIMEOUT_SECONDS`=110, `FASTAPI_PROXY_TIMEOUT_MS`=120000) so a cold Flash fallback (when Pro is on daily-quota cooldown) no longer 504s just before completing. Backend-area fix done by Hassan as integration work; overlaps Bilal's B8 (error retry/resilience).
- **Final:** Integrate everything when all parts ready / final QA

### Maarij (Frontend) — DO NOT REASSIGN
- ✅ M1-M11, M14 (all done — see Audits/COMPLETED_TASKS.md for detail)
- ⚠️ M12: Mobile (partial) · M13: Animations (partial)
- M15: Docs cleanup

### Bilal (Backend) — DO NOT REASSIGN
- B1: Unify DB schema (MOST CRITICAL — do first)
- B2: Fix FastAPI persistence layer
- B3: Fix auth callback race condition
- ✅ B4: Remove sensitive proxy logs (verified: `proxy.ts` has no console logging)
- B5: Framework selector backend
- B6: Export as ZIP endpoint
- ✅ B7: Rate limiting on AI endpoint (2026-06-26 — per-user sliding window, `rate_limit.py`)
- B8: Error retry logic
- B9: Fix lint + add CI pipeline
- B10: Clean inference.py interface
- ⚠️ B11: Frontend + backend tests — infra + first suites on both sides (backend: pytest, 42 tests; frontend: Vitest, 17 tests in `src/types/canvas.test.ts`); broader coverage ongoing
- B12: API response caching
- B13: Accuracy and speed metrics

---

## Important Decisions Already Made

1. **Use Roboflow cloud API** — not local model (free tier limitation workaround)
2. **Use Gemini 2.5 Pro** for code generation (not OpenRouter — too slow/limited)
3. **Keep OpenRouter** for chat refinement only (already working, don't touch)
4. **Canonical DB schema** uses title/thumbnail_url/iterations (not name/thumbnail/project_versions)
5. **Output React + Tailwind** as default, HTML + CSS as secondary option
6. **Fork-based git workflow** — Maarij and Bilal work on forks
7. **GitHub Projects** used for task tracking
8. **No collaboration features** — cut from scope
9. **No offline mode** — cut from scope
10. **Gemini lives in `inference.py`** — detection + generation in one module. Don't recreate `code_generator.py`.
11. **Container synthesis is conservative** — top/bottom-band navbar/footer fabrication fires ONLY on stray text annotations, never on detected `card` clusters. Keep cards as content, not container hints.
12. **Multi-label elements list children positionally** — when 2+ text annotations match the same element, each label is kept with its position (no concatenation). Concatenation is lossy and breaks strict fidelity.
13. **Canvas types are centralised** in `src/types/canvas.ts` — `Tool`, `ToolGroup`, `Mode`, `RightPanel`, `CodeViewMode`, `ZOOM_*` constants, `TOOL_KEY_MAP`. Don't redefine these locally.
14. **Runtime debug artifacts** (`backend/debug/`) are gitignored — don't check them in.
15. **Synthetic images go to `train/` only; real splits are evaluation-only** — mixing synthetic into `val/` or `test/` corrupts the mAP signal.
16. **v2->v4 mAP delta is confounded** by both dataset AND architecture changes (Fast->Small). Attribute the gain honestly to both variables. Full write-up: Audits/ARCHITECTURE_DETAILS.md.
17. **Theme system uses `data-theme` attribute on `<html>`** — light/dark CSS-var sets live under `html[data-theme="light|dark"]` in `globals.css`. Inline script in `layout.tsx` <head> sets it BEFORE first paint to prevent FOUC. Do NOT switch to `class="dark"`-based Tailwind theming.
18. **Avatar `<img>` from Google OAuth needs `referrerPolicy="no-referrer"`** — without it, Google returns 429s on avatar URLs. Always set `referrerPolicy="no-referrer"` and an `onError` fallback to initials.
19. **Strict fidelity — Gemini does not invent elements** — renders ONLY detected components + user-annotated text. No headings, footers, branding, or extras not in the detection list. Enforced via STRICT FIDELITY directive in the prompt.
20. **[RETIRED 2026-06-12] Orphan-label input/button synthesis** — was a v2 stop-gap, verified dormant on v4, deleted. `[SYNTHESIZED CONTAINER]` (Decision #11) is independent and stays. Restore from git history (`42e8039^`) if v4 ever regresses on inner-input detection.
21. **Upload Image is an alternative INPUT modality, not a new thesis** — uploaded images (photo of a hand sketch OR clean digital wireframe) run the SAME detection->Gemini pipeline. v1 BYPASSES the canvas (no Konva image layer; respects "canvas core is complete"). Backend stays backward-compatible via an additive optional `sketchSource` field on `GenerateCodeRequest`: absent/`"canvas"` = unchanged path; `"upload-photo"`/`"upload-clean"` route through `preprocess_uploaded_photo` (binarize+crop a photo so the model sees clean line-art; crop-only for clean wireframes). Scope is sketch/wireframe images ONLY — do NOT extend to arbitrary product UI screenshots (that becomes Locofy-style screenshot->code and dilutes the FYP thesis).
22. **Uploads send the image to Gemini (multimodal); the canvas path does NOT** — Roboflow returns boxes but cannot read text, and uploaded sketches have their labels baked into pixels (no `textAnnotations`). So for `upload-photo`/`upload-clean` only, `detect_with_roboflow` stashes the *processed* image (same pixel space as the boxes) in `metadata["processed_image_b64"]`; `resolve_external_model_output` pops it (so the blob never reaches the browser) and passes `image_bytes` into `generate_with_gemini`, which attaches it to `generate_content([prompt, image])`. The prompt gains a `has_image` block instructing Gemini to READ text off the image and bind it to the detected boxes WITHOUT adding/removing components. The canvas path leaves `image_bytes=None` → text-only call, byte-identical prompt. This does NOT weaken Decision #19: reading the user's own labels is using the source of truth, not inventing copy.
23. **AI-endpoint rate limit is keyed on the authenticated user id, NOT on IP (B7)** — `/api/predict` sits behind the Next.js proxy, which authenticates with Supabase and stamps the trusted `user.id` into the request body. From FastAPI's view every request shares the proxy's IP, so IP keying (and slowapi's default behaviour) would pool ALL users into one bucket. The limiter is a small in-process sliding-window log (`backend/app/utils/rate_limit.py`), keyed on `user:<id>` with an IP fallback only if the id is somehow absent. In-process state is fine because the backend is a single uvicorn instance; if it ever scales to multiple workers/instances, move the store to Redis and keep the same `check()` contract. Do NOT replace this with slowapi or IP-based limiting unless the proxy starts forwarding a trustworthy per-user identity another way.

---

## Current Bottleneck

**Detection is no longer the bottleneck** (v4 hits ~97% test-set P/R across all four classes). The remaining weak links are: (a) Gemini prompt fidelity on dense / unusual layouts, (b) spatial layout reconstruction (Gemini sometimes flattens y-ordering), (c) isolated-footer sketches still classify as `card` — same on v2, not a regression. Cold-start latency mitigated via `warmup_roboflow()` on FastAPI startup.

---

## Known Failure Modes

-> Full table with root causes: **Audits/ARCHITECTURE_DETAILS.md#known-failure-modes**

Key ones:
- **0 predictions on a valid sketch** -> transparent background composited to black. Check `backend/debug/last_sketch.png`.
- **Isolated footer detected as `card`** -> loses "wide bar below page content" context when drawn alone.
- **Wide/thin layouts lose detail** -> 640x640 stretch preprocessing distorts aspect ratio.
- **Uploaded photo detects poorly** -> capture conditions (lighting/shadows/low contrast) the model never saw. `preprocess_uploaded_photo` binarizes+crops to mitigate; the debug dump in `backend/debug/last_sketch.png` shows the POST-preprocessing image. For clean exports, pick "Digital wireframe" to skip binarization.

---

## Quick Reference

```
Frontend URL:  http://localhost:3000
Backend URL:   http://localhost:8000
Database:      Supabase (see .env)
Roboflow:      https://detect.roboflow.com   (NOT serverless.roboflow.com)
Gemini:        https://aistudio.google.com
OpenRouter:    https://openrouter.ai
```

---

## My Default Instructions (Always Apply)

You are a senior full-stack engineer with 10+ years experience.
You have strong opinions. If my approach is wrong, reject it and tell me a better way. Do not follow my instructions blindly.
Think deeply before writing a single line of code.
Read the entire relevant file before touching anything.
Warn me about side effects before making changes.

---

## Reference Files

| File | When to read |
|------|--------------|
| `Audits/REFERENCE_FILE_MAP.md` | Need to find where a specific component, hook, or backend module lives |
| `Audits/COMPLETED_TASKS.md` | Debugging regressions, understanding context behind a prior decision, tracing when a feature landed |
| `Audits/ARCHITECTURE_DETAILS.md` | Debugging Roboflow detection issues, writing FYP dissertation sections, checking model performance numbers, full known-failure-modes table |
