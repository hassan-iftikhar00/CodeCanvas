# CodeCanvas — Claude Context File

> Read this file before helping with any task.
> This is a FYP (Final Year Project) at a university.
> Last updated: 2026-07-11 (stale-previousCode guard + wrapper container hint; 2026-07-09: positional bar snap + sidebar nav rule + create-verb button + Windows fidelity render fix + honest incremental debug log; 2026-07-08: container-shadow-card dedup + wrapper-card image veto — phantom image placeholder fix; earlier 2026-07-05: live-test fixes round 2: CanvasData persistence passthrough + share via server route + version restore code; earlier: App Uplift C Element-Code Linker + D Incremental Regeneration; I Share Link + E Version Diff Viewer + H Brand Kit; StackBlitz split button in top bar; 2026-07-04: App Uplift round 2 started — see Audits/APP_UPLIFT_ROADMAP.md; G responsive generation + tablet frame, J Open-in-StackBlitz; earlier same day: reading-order sort + zigzag text-block rule; HITL detection review editor; upload-session persistence UX pass; auto-repair pass + lint migration to ESLint CLI; fidelity self-check loop; role hints, alignment stamping, temperature, eval harness)

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
  is_public,      -- share link (feature I): public-read RLS when TRUE
  brand_kit,      -- jsonb design tokens (feature H), NULL = none
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
ROBOFLOW_MAX_RETRIES=3              # B8: max attempts for client.infer() (1 = no retry)
FIDELITY_IOU_THRESHOLD=0.25         # fidelity: min IoU for an original/re-detected box match
FIDELITY_EDGE_MODE=on               # fidelity: Canny line-art conversion before re-detection
FIDELITY_RENDER_SETTLE_MS=1200      # fidelity: wait after network idle (Babel + Tailwind JIT)
FIDELITY_VIEWPORT_WIDTH=1440        # fidelity: headless render width (raw sketch width shrinks elements below detector scale)
CACHE_ENABLED=true                  # B12: in-memory generation cache; set false to disable
CACHE_TTL_SECONDS=1800              # B12: cache entry lifetime in seconds (default 30 min)
CACHE_MAX_SIZE=50                   # B12: max cached entries before LRU eviction
INCREMENTAL_ENABLED=true            # feature D: set false during prompt tuning (stale previousCode masks fixes)
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
- Upload workspace swap (2026-07-03): when an upload runs, the center column swaps `CanvasSurface` for `UploadedSketchPanel` (new file) via `inputSource` state in `page.tsx` — the uploaded image is shown where the canvas was (zoom/pan, shared ZoomPill), drawing tools (FloatingToolbar) hidden, code panel + chat + topbar unchanged. A "Back to canvas" pill flips `inputSource` back and clears the preview. One page, no route split; canvas path byte-identical when `inputSource==="canvas"`. tsc + lint clean.
- Upload text-reading via multimodal Gemini (2026-06-17): uploads now pass the processed sketch image to Gemini so text baked into the pixels (button labels, nav links, headings) is read and rendered, instead of being lost to generic placeholders. Detector returns boxes only; the image is the text source of truth. Backend-only, upload path only; canvas path stays text-only/byte-identical. See Decision #22.
- B7: Rate limiting on the AI endpoint (2026-06-26): `/api/predict` is now capped per authenticated user via a custom in-memory sliding-window limiter (`backend/app/utils/rate_limit.py`). Defaults: 20 requests / 60s, env-tunable (`RATE_LIMIT_ENABLED`, `RATE_LIMIT_MAX_REQUESTS`, `RATE_LIMIT_WINDOW_SECONDS`). Keyed on the trusted user id the proxy stamps in (IP keying would pool all users behind the proxy). Over-limit returns HTTP 429 + `Retry-After`. Protects the shared Roboflow/Gemini quota (relevant while Roboflow is credit-capped). Backend-only; unit + end-to-end verified.
- B4: Proxy log scrub confirmed done (2026-06-26): `proxy.ts` has zero `console.log/debug/info`; doc status corrected to match code.
- B9: CI/CD pipeline (2026-06-29): `.github/workflows/ci.yml` runs on every push/PR to main. Two parallel jobs: frontend (pnpm tsc --noEmit + pnpm lint + pnpm test via Vitest) and backend (pytest, Python 3.11, installs requirements-dev.txt). OpenCV libGL system dep handled via `apt-get install libgl1`. pnpm and pip both cache across runs.
- B3: Auth callback race condition fixed (2026-06-30): `src/app/auth/callback/route.ts` replaced the Promise-based `setAllPromise` deadlock (hung forever when `setAll` was never called on error paths) with a synchronous `pendingCookies` array. All `console.log` calls removed. tsc clean.
- B8: Roboflow retry logic (2026-06-30): `detect_with_roboflow` in `backend/app/models/inference.py` retries `client.infer()` up to 3 attempts (env: `ROBOFLOW_MAX_RETRIES`) with exponential backoff (1s then 2s). Non-retryable errors (credit exhaustion, 401/403/auth) bypass the loop immediately. Covers cold-start blips and transient network errors.
- B5: Framework selector (2026-06-30): REACT / HTML / VUE pill added to `CanvasTopBar`. `selectedFramework` state in `canvas/page.tsx` flows through `runGeneration`, the upload path, and the chat handler. Backend `inference.py:1145-1149` was already branching on this field.
- B12: API response caching (2026-07-02): `backend/app/utils/response_cache.py` — `GenerationCache` (in-memory LRU+TTL, thread-safe). `main.py` — `_generation_cache_key` (sha256 sketch+framework+source+annotations), cache check before Roboflow+Gemini, cache put after successful Gemini call only (skips fallback/mock/template paths). Cache hit still persists a new iteration so version history stays correct. 3 new env vars: `CACHE_ENABLED`, `CACHE_TTL_SECONDS=1800`, `CACHE_MAX_SIZE=50`. 20 tests in `tests/test_response_cache.py` (LRU eviction, TTL, thread safety, key stability). Total backend: 62 tests, all pass.
- Generation fidelity fixes (2026-07-04, after supervisor demo exposed ~50-60% output fidelity): (a) Gemini `generation_config={"temperature": 0.1, "top_p": 0.8}` — default temp ~1.0 was the root cause of run-to-run invention/omission; (b) deterministic role hints (`backend/app/utils/role_inference.py` → `annotate_role_hints`): unambiguous cards get `RENDER AS: input/button/...` stamped into the prompt from label keywords + aspect ratio + container position (firm), shape-only guesses are soft (`likely:`) so in-image text can override; (c) container `child_alignment` stamping (`annotate_alignment`) + navbar logo-left/links-right convention REMOVED from prompt — drawn alignment is now mandatory; (d) upload-photo path sends the NON-binarized (crop-only) copy to Gemini for text reading (binarized copy still goes to Roboflow; same crop geometry = same pixel space); (e) eval harness `backend/scripts/eval_pipeline.py` measures detection P/R vs YOLO ground truth + saves per-image prompt/code artifacts. Baseline evidence: detection on 15 synthetic training images = 100% recall / 98.4% precision → the model was never the problem; the loss was prompt+Gemini. Post-fix, sketch_00001 renders element-for-element correct (centered navbar, 4 inputs, Confirm button). 85 backend tests pass. See Decision #24.
- Fidelity self-check loop (2026-07-04, Hassan): cyclic verification of every generation — `POST /api/fidelity` renders the generated code headless (Playwright Chromium), converts the screenshot to Canny line-art (the detector's training domain; renders are real UIs the model never saw), re-runs the SAME Roboflow model on it, and greedy-IoU-matches (threshold 0.25) the re-detected boxes against the original detections. Returns an F1 score + missing/extra element report. Backend: `app/utils/fidelity.py` (HTML wrappers are Python ports of LivePreview's iframe builders — keep in sync), endpoint in `main.py` (shares the B7 rate limiter; 503 gracefully if Playwright absent). Frontend: `src/app/api/fidelity/route.ts` proxy + non-blocking score badge in the canvas detection-summary strip (`FIDELITY · NN%`, green/amber/red bands; `success`/`error` tokens added to `DRAFTING_DARK`). Cross-class dupes (footer re-detected as footer+card on one box) suppressed in scoring. Validated live: faithful render scores 1.00, degraded render (footer + card deleted) scores 0.40 with the missing elements named. 24 new tests in `tests/test_fidelity.py` (109 backend total). Setup: `pip install playwright && python -m playwright install chromium`. See Decision #25.
- Auto-repair pass (2026-07-04, Hassan): when the fidelity score lands below 0.8, ONE corrective Gemini call runs automatically — `build_repair_prompt` (inference.py) turns the fidelity mismatch report into a surgical instruction (ADD the missing elements at described positions, REMOVE the extras, leave everything else byte-identical), sent via `generate_with_gemini(prompt_override=...)` (new param that bypasses `_build_gemini_prompt` but keeps key rotation/cooldowns/model fallback). New `POST /api/repair` in main.py (rate-limited, persists the repaired code as a new iteration) + `src/app/api/repair/route.ts` proxy. Frontend rescores the repaired code (repair disabled on the rescore — exactly one pass per generation) and the badge shows before → after (`FIDELITY · ~~40%~~ → 89%`). Scoring also gained positional bar reclassification: navbar/footer re-detections are snapped to their positional definition (top/bottom third) before matching, since those classes ARE positional. Validated live: degraded layout 0.40 → repaired 0.89 with zero extras. 10 new tests (119 backend total).
- Lint migrated to ESLint CLI (2026-07-04): Next 16 removed `next lint`, so `pnpm lint` had been broken (and CI's frontend job red) since the framework upgrade. `package.json` lint script is now `eslint .`; `eslint.config.mjs` gained ignores for `venv/`, `backend/`, `synthetic_dataset/`, `capture-ui.js`, rule downgrades to `warn` for pre-existing `@typescript-eslint/no-explicit-any` + `react-hooks/set-state-in-effect` (tighten back to error after cleanup), and rule-off overrides for the static `design-preview*` mockup pages. One repo-wide `eslint --fix` reformatted ~2.6k mechanical prettier violations. `pnpm lint` now exits 0 (57 pre-existing warnings, 0 errors).
- Upload-session persistence UX pass (2026-07-04, Hassan): four user-reported bugs fixed. (a) Upload projects now survive reload — `CanvasData` gained an optional `uploadedSketch` field (`{dataUrl, source, width, height}`, stored in the `canvas_data` jsonb only, NEVER sent to the generation API — `runGeneration` gained `persistCanvasData` to keep the POST lean since the image already travels as `sketchImage`); the `?id=` load effect restores the upload workspace (`inputSource="upload"` + `UploadedSketchPanel`) when the field is present. (b) Same field fixes two latent no-ops: Ctrl+S and post-chat persistence did nothing in upload mode because `canvasRef` is unmounted — new `getPersistableCanvasData()` helper builds the upload stub instead. (c) Dashboard `ProjectCard` renders the uploaded image as the thumbnail for upload-only projects (previously blank placeholder). (d) `GenerationProgress` bar no longer lies: replaced linear `elapsed/30` (hit 100% at 30s while Gemini still ran) with an asymptotic curve capped at 94% — full bar only ever means done. (e) Landing mini-canvas well is now pure white so it reads as a canvas instead of merging with the hero's grid; hero status copy bumped ROBOFLOW v2 → v4. tsc + lint clean.
- Incremental context gate, round 2 — per-screen recording (2026-07-11, Hassan — live multi-screen hole: kit updated → dashboard regenerated styled ✓ → switch to login → login zero-deltaed back its old un-styled code, because the screen-switch reset stamped the CURRENT kit as the context of the screen's OLD code): `ScreenSnapshot` gained `generationFramework` + `generationBrandKitKey` (recorded by all three snapshot writers — `getPersistableCanvasData`, `captureActiveScreen`, and the post-generation persist — from `previousGenRef`, which holds the true at-generation context); `loadScreenIntoWorkspace` restores the RECORDED context, with a `"__unrecorded__"` sentinel for legacy snapshots that can never match (one full regen, then recorded). Fields ride in canvas_data jsonb — backend `CanvasData.screens` is untyped `List[Dict]`, no stripping. tsc + 40 frontend tests clean.
- Incremental context gate (2026-07-11, Hassan — user question "what if I just added a brand kit but the sketch is same": zero-delta noop would return the old un-styled code verbatim, silently ignoring the kit): `previousGenRef` in `canvas/page.tsx` gained a `brandKitKey` (JSON of the kit) alongside `framework`; both are generation CONTEXT stamped only when a generation completes (or a screen switch restores one) — the live-sync effect now refreshes code/elements only and never touches context (this also fixed a latent bug: the effect stamped `framework: selectedFramework` live, so flipping the pill made the ref claim old code matched the new framework, defeating the existing gate). The payload gate sends previousCode/previousElements only when framework AND brand kit both match what the code was generated with; any change forces a full regeneration automatically — no manual "force regen" button needed. Verified live same day: class-stub guard fired on deployed Render backend ("[incremental] previous code contains literal detector-class stubs — full regeneration") and signup regenerated clean.
- Stale-previousCode guard round 2 (2026-07-11, Hassan — coverage check had a hole: the signup base carried FULL cc-id coverage (7/7, the good form) PLUS six id-less absolute '<p>Card</p>' stubs the old repair glued on top, so incremental patched the poison again): `_previous_code_is_degenerate` gained a second signal — regex `>\s*(Card|Navbar|Section|Footer)\s*<` (a rendered element whose entire visible text is a detector class name = repair-era damage; no faithful generation renders those words verbatim; "Credit Card Number" and attribute values don't match). Either signal forces full regen. 5 more tests (243 backend total).
- Stale-previousCode guard + wrapper container hint (2026-07-11, Hassan — live multi-screen test: login/signup screens kept recycling the pre-guard repair-destroyed "Card Card Card" stub via incremental regen; incremental noop returned it verbatim, delta path patched it): (a) `_previous_code_is_degenerate` in main.py — incremental regen (noop AND patch) now requires previousCode's distinct `data-cc-id` coverage ≥ 60% of previousElements (faithful generations stamp every element per Decision #28; the live stub had 3 ids for 9 elements; id-less code can't be patched correctly anyway since REMOVE keys off cc-ids) — degenerate base forces full regeneration. (b) role_inference: an UNLABELLED card wrapping ≥2 other cards gets firm `container (group box)` hint (login form container detected as `card` 54% → Gemini rendered a literal stub; labelled wrappers keep their text classification; single-child wrappers like pricing cards unaffected) + matching RENDER AS prompt clause (children render inside it). Known deploy quirk: on the Vercel Hobby proxy (maxDuration=60), /api/repair's 70-88s Gemini call usually 504s — repair is then skipped and the user keeps their code (the shrink/score-0 guards make that the safe outcome). 12 new tests (`test_incremental_guard.py` + role updates, 239 backend total).
- Fidelity scoring overhaul (2026-07-09, Hassan — root cause of the false 0.00: reproduced with the persisted iteration code, element-perfect render scored 0.00): two systematic domain gaps. (1) Renders at the sketch's raw pixel width (2000+px) make realistically-sized UI elements proportionally tiny vs the chunky hand-drawn training boxes — re-detection confidence collapses (navbar 0.07, inputs 0.17 at 2329px vs inputs 0.92 at 1440px, same code). `render_code_to_png` now clamps the viewport to `FIDELITY_VIEWPORT_WIDTH` (default 1440, aspect kept) and upscales the shot to sketch dims. (2) `score_fidelity` gained flow-tolerant stages after the greedy IoU pass: stage 2 center-distance fallback (same class, centers within 6% of canvas diagonal — rendered content FLOWS, faithful elements drift from drawn positions with zero IoU); stage 3 containment fallback (an unmatched original ≥4% of canvas with ≥2 re-detections centered inside it is present — rendered navbars/footers/wrappers have no drawn outline so the detector finds their children, never the container box); stage 4 extras suppression (re-detected `card` inside an original navbar/footer y-band = that bar's text child; re-detected `section` when the sketch drew none = the implicit middle band). Validated on the live run: same boxes 0.00 → 0.94 (fn=0), degraded render (form deleted) stays < 0.8. New endpoint arg `canvas_width`. 13 new/updated tests in `test_fidelity.py` (231 backend total).
- Auto-repair safety guards (2026-07-09, Hassan — after a false fidelity 0.00 triggered a repair that rewrote a correct 4679-char login screen into a 901-char stub of literal "Card"/"Navbar" placeholders): (a) frontend `needsRepair` now requires `score > 0` — a total mismatch (tp=0) means the SCORING loop failed (render/coordinate/detector issue), not the code; repairing it instructs Gemini to remove+re-add everything, i.e. a rewrite. (b) `/api/repair` rejects (422) any output smaller than 50% of the input code — repair is a surgical patch, drastic shrink = stub. Frontend treats non-OK as no-repair, user keeps their code. (c) fidelity endpoint in debug mode dumps every original/re-detected box with matched/MISSING/EXTRA status — a 0.00 was previously undiagnosable. Destroyed code is recoverable from CHECKPOINTS (both the good generation and the repair are persisted iterations).
- Dashboard-sketch fidelity round (2026-07-09, Hassan — after live dashboard+signup sketch rendered footer as navbar, sidebar menu as inputs, Create Account as input): (a) `snap_positional_bars` in `inference.py` — navbar/footer detections snapped to their positional definition (center in top third → navbar, bottom third → footer, middle keeps class) before sort/prompt on BOTH paths (Roboflow post-shadow-drop + HITL `_corrected_elements_to_output`; snapping fixes class only, reviewer authority on the element SET holds). Mirrors fidelity.py's `_reclassify_bars_by_position`. (b) role_inference: `create/delete/update/upload/view/go` added to `_BUTTON_VERBS` ("Create Account" was falling to the wide-thin rule → input); NEW sidebar rule — short-labelled card inside a TALL section (h ≥ 1.5·w) → firm `nav item (sidebar menu link)` (dashboard sidebars; field labels still win via `_classify_text` running first); labeled wide-thin rule DEMOTED to soft (non-field labels reaching it are often headings/menu rows — shape alone no longer forces `<input>`). (c) Windows fidelity render fixed: uvicorn installs WindowsSelectorEventLoopPolicy which cannot spawn subprocesses → async Playwright died with NotImplementedError (the 500 after Playwright install); `render_code_to_png` now runs Playwright in a worker thread with its own directly-constructed ProactorEventLoop (policy bypassed). Smoke-verified under the selector policy. (d) Debug log now prints the prompt Gemini ACTUALLY gets — previously it printed the full prompt even when the incremental patch prompt (`prompt_override`) was sent, which made that live run undebuggable. (e) New env `INCREMENTAL_ENABLED=true` — set `false` during prompt/role tuning so stale previousCode doesn't mask fixes (zero-delta returns old code untouched). 9 new tests (219 backend total).
- Container-shadow-card dedup + wrapper-card image veto (2026-07-08, Hassan — phantom image placeholder fix): the detector sometimes returns one container box twice — as its real class AND as a `card` on nearly the same pixels (live case: signup-form container as section 0.66 + card 0.65, IoU ~0.97). Class-aware NMS keeps both (different classes), then the unlabelled squarish shadow card got a soft `image placeholder` role hint → Gemini rendered an image the user never drew. Fix layer 1: `_drop_container_shadow_cards` in `inference.py` (post-NMS pass 3) drops any `card` with IoU ≥ 0.8 vs a navbar/footer/section detection — same threshold fidelity scoring already used for this exact double-detection; true containment (small card inside big section) has low IoU so hierarchy is untouched. Fix layer 2: `annotate_role_hints` vetoes the shape-only image-placeholder guess for a card wrapping other cards' centers (group box, not media slot); firm marker labels still win. 8 new tests (`tests/test_shadow_cards.py` + 2 in `test_role_inference.py`, 210 backend total). Verified on the live sketch: shadow card dropped, 15 clean elements.
- HITL detection review editor (2026-07-04, Hassan — roadmap idea #4): detection and generation are now two steps. "Run Detection" (and uploads) first hit new `POST /api/detect` (Roboflow only, rate-limited, no Gemini), then `DetectionReviewOverlay.tsx` shows the boxes + confidences over the sketch so the user can relabel (card→navbar etc.), delete false positives, or drag out missed boxes before clicking Generate. The corrected set goes to `/api/predict` as `correctedElements` — the backend then SKIPS Roboflow (detection budget spent exactly once) and skips container synthesis (the human's set is authoritative; text attachment + role hints + Gemini run unchanged via the extracted `_generate_from_output` tail). The relabel/delete/add diff is logged to new Supabase table `detection_corrections` (migration `20260704000001` — future fine-tuning dataset, logged only, apply before logging works; generation works without it). Uploads review on the preprocessed preview (`previewImage` from /api/detect) since boxes live in post-crop pixel space; that same preview goes back as `sketchImage` so Gemini still reads its text. Cache bypassed for corrected sets (key doesn't hash corrections). Detect failure/empty result falls back to the old one-shot path — review is never a gate. 12 new tests (`tests/test_hitl.py`, 131 backend total). Live-smoked: corrected path generates with annotation attach intact. See Decision #27.
- Reading-order sort + zigzag text-block rule (2026-07-04, Hassan — after sketch_00110 upload swapped two same-row grid cells): `sort_reading_order` in `inference.py` replaces the y-only element sort on BOTH paths (Roboflow post-NMS + HITL `_corrected_elements_to_output`). Consecutive `card` runs whose y-intervals chain-overlap ≥50% of the shorter box are re-sorted by x, so hand-drawn y jitter no longer decides same-row list order (Gemini follows list order when composing grids). Containers keep pure y order — they y-overlap their own children and must stay listed first. Prompt: components block now declared as READING ORDER with same-row order mandatory; upload image block gained "wavy/zigzag/scribbled lines = TEXT BLOCK → short lorem ipsum paragraph, never skeleton bars or an image". Image-marker labels ("[ image ]", "img", "photo", "[ X ]", "img placeholder" — mirrors the synthetic dataset's IMAGE_LABELS in `synthetic_data/layouts.py`) now classify as firm `image placeholder` in `role_inference.py` (beats the wide-thin input rule; whole-label match only, "Upload your image here" is unaffected) + matching upload prompt rule (render `<img>` placeholder, not the literal text). 12 new tests (`tests/test_reading_order.py` + 3 in `test_role_inference.py`, 146 backend total).
- App Uplift round 2, features G + J (2026-07-04, Hassan — see `Audits/APP_UPLIFT_ROADMAP.md` for the full 9-feature selection): (G) responsive generation — RESPONSIVE BEHAVIOUR block in `_build_gemini_prompt` (mobile-first Tailwind: rows stack by default, drawn side-by-side layout restores at `md:` up; NO hidden elements or hamburger substitutes — strict fidelity holds at every width) + `tablet` 768x1024 preset in `LivePreview.tsx` (768 = Tailwind `md:` breakpoint, so the tablet frame is the one that demos the collapse/restore); LivePreview already had fit/desktop/mobile frames + orientation + zoom. (J) Open in StackBlitz — 4th METHOD option in `ExportDialog.tsx`; new `src/lib/open-in-stackblitz.ts` form-POSTs the project to StackBlitz's POST API (no SDK): React/Vue/Next → same Vite+React scaffold as the ZIP export on the `node` template (shared `buildReactScaffoldFiles()` extracted in `export-zip.ts`), HTML → single-file `html` template. tsc + lint clean; 146 backend + 17 frontend tests pass. 2026-07-05: StackBlitz promoted to top bar — `CanvasTopBar.tsx` EXPORT button is now a split control (left EXPORT opens the dialog, right STACKBLITZ solid-graphite half launches directly through the same `handleExport` stackblitz branch with `selectedFramework`); dialog METHOD option retained.
- Live-test feedback fixes, round 2 (2026-07-05, Hassan): (a) ROOT CAUSE of "restore vanishes the sketch": the backend `CanvasData` pydantic model only defined strokes/lines/width/height, so `model_dump()` STRIPPED `shapes` (rectangles), `componentGroups` (templates), and `uploadedSketch` from every generation iteration's persisted canvas_data — restore then applied lines-only and wiped drawn shapes. Model gained passthrough fields (keep in sync with `src/types/canvas.ts`); 3 regression tests in `tests/test_canvas_data.py` (181 backend total). Iterations persisted BEFORE this fix are permanently stripped — restore works for new generations only. (b) `/api/predict` now stamps an `uploadedSketch` stub into persisted canvas_data on upload paths (image already travels as sketchImage) so version restore re-opens the upload workspace. (c) Toolbox checkpoint restore now also restores the iteration's generated code + opens the code panel (`restoreVersion` returns the full row, not just canvas_data). (d) Share link rebuilt server-side: new `/api/shared/[id]` route uses the service-role client with an EXPLICIT `is_public` check instead of depending on the anon-key RLS policy existing on the live DB; `/p/[id]` fetches it; failures now log server-side. ShareDialog toggle verifies the flag actually flipped via `.select()` after update (an RLS-filtered 0-row update reports no error).
- Live-test feedback fixes, round 1 (2026-07-05, Hassan): (1) share viewer /p/[id] no longer selects the `framework` column (an unknown column fails the whole PostgREST query and read as "not available"); language is sniffed from the code; added distinct "Nothing published yet" state + console.warn of the load error. (2) Code panel + loader now open at the START of every generation (canvas/HITL/upload — was upload-only). (3) Version list refetches after each generation and when COMPARE VERSIONS opens (was load-time only); diff colors darkened + 3px edge bars. (4) StackBlitz scaffold package.json gained `start` script + `stackblitz.startCommand` — the node template boots with `npm install && npm start`, so without it the preview said "Starting dev server" forever. (5) Checkpoint restore/rollback now uses the same restore path as the ?id= loader (history.setState) and restores the upload workspace via canvas_data.uploadedSketch. (6) Brand kit font dropdown previews each font (Google fonts loaded in modal + preview iframes now preload Poppins/Roboto/Montserrat/Playfair so font-['Name'] renders). (7) Brand-kit prompt forbids font <link> comments in React/Vue output. (8) Preview element→code click is now gated behind an explicit INSPECT toggle in the LivePreview toolbar (solid cobalt when active, crosshair cursor + hover outline inside iframe; clicks suppressed from activating elements while inspecting). (9) Incremental ADD prompt now includes position phrases + detector-class semantics (wide flat bar at bottom = footer; never render 'card' as literal text/placeholder).
- App Uplift round 2, features C + D (2026-07-05, Hassan — details in `Audits/APP_UPLIFT_ROADMAP.md`): (C) Element↔Code Linker — the Gemini prompt now REQUIRES `data-cc-id="cc-N"` on every rendered component's root tag (N = 1-based index in the detected list; contract: `detectedElements[i] ↔ cc-(i+1)`). `preview-doc.ts` injects a click/highlight message bridge into all iframe builders; `MonacoCodeEditor` is forwardRef with `revealAndFlash()`; the detection strip's count text became clickable per-element chips that highlight the element in preview + code; clicking an element in the preview jumps to its code (auto preview→split). (D) Incremental Regeneration — frontend sends `previousCode`/`previousElements` with each generation; backend `diff_detection_sets` aligns old→new pixel space via robust median scale/translation (NOT envelope normalization — edge-element removal distorts it), greedy per-class IoU; zero delta → previous code returned with NO Gemini call; small delta → `build_incremental_prompt` patch via `prompt_override` (REMOVE by cc-id, byte-identical elsewhere, ids re-stamped); big delta → full regen. Cache bypassed when previousCode present; response field `usedIncremental` + toast. 18 new backend tests (178 total). tsc + lint clean. LIVE SMOKE PENDING for both (needs real Gemini output). See Decision #28.
- App Uplift round 2, features I + E + H (2026-07-05, Hassan — details in `Audits/APP_UPLIFT_ROADMAP.md`): (I) Share Link — SHARE button in `CanvasTopBar` → `ShareDialog` toggles the pre-existing `projects.is_public` flag (column + public-read RLS were already in the initial schema, no migration) and copies `/p/[id]`; new public viewer route `src/app/p/[id]/page.tsx` renders the last SAVED code via the anon client; LivePreview's iframe builders extracted to shared `src/lib/preview-doc.ts` (fidelity.py mirrors them — Decision #25 sync rule now points there). (E) Version Diff Viewer — `VersionCompareModal` (entry: COMPARE VERSIONS in toolbox CHECKPOINTS): A/B iteration pickers, side-by-side rendered previews, zero-dep LCS line diff (`src/lib/code-diff.ts`, 14 Vitest tests) with unchanged-run collapsing, one-click rollback (code + canvas snapshot); `useVersionHistory` exports `ProjectVersion`. (H) Brand Kit — per-project colors + font in new `projects.brand_kit` jsonb (migration `20260705000001`), `BrandKitModal` (toolbox BRAND KIT section), backend `BrandKit` model + styling-only BRAND KIT prompt block in `_build_gemini_prompt` (strict fidelity preserved), generation cache key hashes the kit, kit flows through canvas/upload/HITL paths and reloads with `?id=`. 14 new backend tests (`test_brand_kit.py`, 160 total) + 14 new frontend tests (31 total). tsc + lint clean.
- B13: Speed metrics (2026-07-02): `main.py` — `time.perf_counter()` wraps Roboflow and Gemini calls in `resolve_external_model_output`; timings stored in `roboflow_output.metadata["timing_ms"]`. `predict()` times total pipeline and logs `[timing] total=Xms (roboflow=Yms gemini=Zms)` on every run. `GenerateCodeResponse` gains optional `timing_ms` field (dict with `total`, `roboflow`, `gemini` keys in ms) for FYP dissertation numbers. Cache hits return `{"total": 0, "cache_hit": 1}`. 62 tests still pass.

### ⚠️ Partially Done
- **B11: Frontend + backend tests (2026-06-26):** test infra + first suites now exist on BOTH sides; remaining work is broader coverage, not setup.
  - *Backend:* pytest infra in `backend/` (`pytest.ini`, `conftest.py` with path setup + a conditional `cv2` stub, `requirements-dev.txt`). Three suites, 62 tests, all pass via `python -m pytest`: `tests/test_rate_limit.py` (14), `tests/test_synthesis_helpers.py` (28), `tests/test_response_cache.py` (20 — B12 cache).
  - *Frontend:* Vitest 4.1.9 wired up — `vitest.config.ts` (node env, `@/` alias mirrors tsconfig), `pnpm test` / `pnpm test:watch` scripts. First suite `src/types/canvas.test.ts` (17 tests: `clampZoom`, `clampCodePanelHeight`, bounds-constant invariants, `TOOL_KEY_MAP` integrity). Small co-locating refactor: the `clampZoom`/`clampCodePanelHeight` helpers moved out of `canvas/page.tsx` into `src/types/canvas.ts` (next to the bounds they enforce) and are now exported, so the test guards the real production code path. `tsc --noEmit` clean on all touched files.
- **Canvas state-bridge:** 500ms poll still primary sync. Remaining: replace with explicit onChange callback in `SketchCanvas`. Candidate for Maarij.
- **M12: Mobile responsiveness:** auth + dashboard + canvas warning done; broader canvas chrome + code panel pass pending.
- **M13: Animations:** canvas chrome + theme transition + sidebar slide done; rest of app pending.

### ❌ Not Started / In Progress
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
| `src/components/canvas/UploadedSketchPanel.tsx` | Read-only workspace that replaces `CanvasSurface` when `inputSource==="upload"` (zoom/pan image + "Back to canvas" pill) |
| `backend/app/utils/preprocessing.py` | `preprocess_uploaded_photo` (cv2 binarize/crop; `return_clean=True` also yields the non-binarized copy Gemini reads text from) + canvas-data rasterizer |
| `backend/app/utils/role_inference.py` | Deterministic prompt hints: `annotate_role_hints` (card → input/button/image/nav item) + `annotate_alignment` (container child alignment) |
| `backend/scripts/eval_pipeline.py` | Eval harness: detection P/R vs YOLO ground truth + per-image prompt/code artifacts (`--stage detect|generate|both`) |
| `backend/app/utils/fidelity.py` | Fidelity self-check: headless render (Playwright) + line-art conversion + box matching vs original detections |
| `src/app/api/fidelity/route.ts` | Proxy to FastAPI `/api/fidelity` (stamps trusted userId, 90s ceiling) |
| `src/app/api/repair/route.ts` | Proxy to FastAPI `/api/repair` (auto-repair pass; full Gemini ceiling) |
| `src/app/api/detect/route.ts` | Proxy to FastAPI `/api/detect` (HITL detection-only step; 75s ceiling) |
| `src/components/canvas/DetectionReviewOverlay.tsx` | HITL review overlay: relabel/delete/draw detection boxes before generation |
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
- ✅ B1: Unify DB schema (migration 20260430000001 — title/thumbnail_url/iterations, cascade FK, RLS)
- ✅ B2: Fix FastAPI persistence layer (`main.py:268-300` writes iteration+project, ownership enforced)
- ✅ B3: Fix auth callback race condition (2026-06-30 — synchronous cookie collection, deadlock removed)
- ✅ B4: Remove sensitive proxy logs (verified: `proxy.ts` has no console logging)
- ✅ B5: Framework selector (2026-06-30 — REACT/HTML/VUE pill in `CanvasTopBar`; `selectedFramework` state flows through `runGeneration`, upload path, and chat handler; backend `inference.py:1145-1149` already branched)
- 🟦 B6: Export as ZIP — done client-side (`src/lib/export-zip.ts`, JSZip, no backend needed)
- ✅ B7: Rate limiting on AI endpoint (2026-06-26 — per-user sliding window, `rate_limit.py`)
- ✅ B8: Roboflow retry logic (2026-06-30 — 3-attempt exponential backoff in `detect_with_roboflow`, non-retryable bypass for credit/auth errors)
- ✅ B9: CI/CD pipeline (2026-06-29 — `.github/workflows/ci.yml`, frontend + backend jobs)
- B10: Clean inference.py interface
- ⚠️ B11: Frontend + backend tests — infra + first suites on both sides (backend: pytest, 62 tests; frontend: Vitest, 17 tests in `src/types/canvas.test.ts`); broader coverage ongoing
- ✅ B12: API response caching (2026-07-02 — `app/utils/response_cache.py` LRU+TTL+thread-safe; key=sha256(sketch)+framework+source+annotations; check before Roboflow+Gemini, put after Gemini; cache hit still persists iteration; 3 env vars; 20 tests)
- ✅ B13: Speed metrics (2026-07-02 — `time.perf_counter()` around Roboflow + Gemini calls; `[timing]` log on every run; `timing_ms` field on `GenerateCodeResponse`)

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
24. **Element roles and container alignment are computed in backend code, not left to Gemini prose heuristics (2026-07-04)** — `backend/app/utils/role_inference.py` stamps `role_hint` (+ `role_hint_firm`) and `child_alignment` into element attributes after text attachment (`annotate_role_hints` / `annotate_alignment`, called in `main.py` right after `_attach_text_annotations`); `_build_gemini_prompt` prints them per element. Firm hints (from label keywords / container position) are commands (`RENDER AS:`); shape-only guesses are soft (`likely:`) so text baked into an uploaded image can override them. The navbar "leftmost=logo, rightmost=links" prompt convention was REMOVED — drawn alignment is mandatory (fidelity over convention). Gemini runs at `temperature=0.1, top_p=0.8` — do NOT remove the generation_config; the default temperature (~1.0) was the root cause of nondeterministic element invention/omission. Detection is measured at 100% recall / 98.4% precision on synthetic training images (`backend/scripts/eval_pipeline.py`), so future fidelity regressions should be debugged prompt-side first, not model-side.
25. **Fidelity is measured by cyclic re-detection, and renders are normalized to the sketch domain first (2026-07-04)** — `/api/fidelity` closes the loop: generated code → headless render (Playwright) → Canny edge extraction (real UIs are outside the detector's line-art training domain per Decision #21, so the screenshot is converted to a wireframe-like image before re-detection) → same Roboflow model → greedy per-class IoU match against the original detections → F1 score. Key parameters: `FIDELITY_IOU_THRESHOLD=0.25` (relaxed vs the 0.5 used against ground truth — rendered layouts never reproduce sketch geometry exactly) and cross-class duplicate suppression in scoring (a rendered `card` with IoU ≥ 0.8 against a rendered container is the known footer-as-card double detection, not an invented element). Playwright is OPTIONAL: without it the endpoint returns 503 with install instructions and the UI badge simply doesn't appear — never take the server down for it. The HTML wrappers in `app/utils/fidelity.py` are Python ports of LivePreview's iframe builders; change one, mirror the other, or the score stops measuring what the user actually sees. This is the viva answer to "why not just send the image to ChatGPT": the system quantifies its own output fidelity with the same vision model that grounded the generation.
26. **Auto-repair is one surgical pass, never a loop (2026-07-04)** — a fidelity score below 0.8 triggers exactly ONE corrective Gemini call (`/api/repair`); the rescore after it can never trigger another (frontend passes `allowRepair: false`). Rationale: each pass costs a Gemini call + a render + a Roboflow call, repair against a noisy metric can oscillate, and one before→after jump is what the demo needs. The repair prompt (`build_repair_prompt` in inference.py, per Decision #10) is mismatch-report-driven and forbids touching anything not listed. `generate_with_gemini` gained `prompt_override` for this — reuse it for any future custom-prompt call instead of duplicating the key-rotation/cooldown machinery. Do NOT turn this into a retry-until-threshold loop without adding a hard pass cap and a quota budget.
27. **HITL review makes the corrected element set authoritative (2026-07-04)** — when `/api/predict` receives `correctedElements` (from the DetectionReviewOverlay), the backend skips BOTH the Roboflow call (the detection budget is spent exactly once, in `/api/detect`) AND `_synthesize_missing_containers` (fabricating containers behind the reviewer's back would defeat the review; the user can draw a missed navbar themselves). Text attachment, role hints, alignment stamping and Gemini still run, via the shared `_generate_from_output` tail — add future prompt-side steps THERE so both paths get them. The generation cache is bypassed for corrected sets (the key hashes the sketch, not the corrections). For uploads, the overlay draws on (and generation reuses) the preprocessed `previewImage` because boxes live in post-crop pixel space; the backend decodes that same image for Gemini text reading. Corrections are logged to `detection_corrections` fire-and-forget — logging failures must never block generation, and no training happens on them (Decision #21's no-new-training stance holds). Detect failure or an empty result silently falls back to the one-shot pipeline: review is an enhancement, never a gate.
28. **data-cc-id is the element↔code grounding contract; incremental regen is a single patch, not a loop (2026-07-05)** — generated code MUST carry `data-cc-id="cc-N"` where N is the element's 1-based position in the prompt's component list (same order as `detectedElements` in the response). The frontend linker (chips, preview click bridge, Monaco reveal) and D's REMOVE instructions both key off this. Anything that reorders elements between prompt and response breaks the contract — `sort_reading_order` runs BEFORE prompt building on both paths, so order is stable. Incremental regeneration re-stamps ALL ids to the new list numbering on every patch (the only permitted edit to unchanged elements). The delta path triggers only when previousCode+previousElements arrive AND the diff is small (≤ max(4, half the new set)) with ≥1 match; zero-delta returns the previous code without any Gemini call; oversized deltas silently fall back to full regeneration. Detection-set diffing aligns coordinate spaces with median same-class size ratios + median center deltas — do NOT switch to envelope normalization (removing an envelope-edge element like a footer distorts every coordinate; there's a regression test for exactly this).

---

## Current Bottleneck

**Detection is no longer the bottleneck** (v4 hits ~97% test-set P/R; eval harness measured 100% recall / 98.4% precision on synthetic training images, 2026-07-04). Generation fidelity was the weak link and got a major pass on 2026-07-04 (temperature 0.1, deterministic role hints, alignment stamping — see Decision #24). Remaining weak links: (a) Gemini fidelity on dense / unusual layouts, (b) isolated-footer sketches still classify as `card` — same on v2, not a regression, (c) product screenshots are OUT OF SCOPE (Decision #21) — the detector is trained on line-art sketches only; don't demo screenshots. Cold-start latency mitigated via `warmup_roboflow()` on FastAPI startup.

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
| `Audits/FYP_FEATURE_ROADMAP.md` | The ranked feature roadmap (fidelity loop, benchmark, HITL editor, Urdu support...) + per-idea status tracker — check before starting the next feature |
