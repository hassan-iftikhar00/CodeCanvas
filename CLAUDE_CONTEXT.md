# CodeCanvas — Claude Context File

> Read this file before helping with any task.
> This is a FYP (Final Year Project) at a university.
> Last updated: 2026-06-12

---

## What is CodeCanvas?

CodeCanvas is a **sketch-to-code web application**.

Users draw UI wireframes/sketches on a canvas (like drawing boxes for buttons, navbars, cards etc.) and the system automatically generates production-ready frontend code from those drawings.

**One line summary:** Draw a UI sketch → Get real React/HTML code instantly.

---

## Tech Stack

### Frontend

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Konva.js (canvas drawing)
- Supabase (auth + database)
- OpenRouter API (chat-based code refinement)

### Backend

- Python FastAPI (runs on port 8000)
- Supabase PostgreSQL (database)
- Roboflow API (UI component detection from sketches)
- Google Gemini API (code generation from detected components)

### Infrastructure

- Supabase (auth, database, storage)
- Roboflow cloud (hosts Shahwaiz's trained model)
- Next.js dev server (port 3000)

---

## The Complete Pipeline (How It Works)

```
Step 1: User draws sketch on canvas
        File: src/components/canvas/SketchCanvas.tsx
        Chrome: FloatingToolbar, StyleRibbon, ZoomPill, CanvasSurface

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
        _synthesize_missing_containers,
        _synthesize_inputs_for_orphan_labels, _infer_canvas_extents)
        Handles oversized containers, top/bottom-band navbar/footer
        recovery, and stop-gap input/button synthesis around orphan
        label text when v2 misses inner shapes.

Step 6: Gemini generates React + Tailwind code
        File: backend/app/models/inference.py
        Entry points: _build_gemini_prompt + generate_with_gemini
        Class: CodeGenerator (also in inference.py — no separate
        code_generator.py file)

Step 7: Code returned to frontend and displayed
        File: src/app/canvas/page.tsx (code panel)

Step 8: User can refine code via chat
        Frontend: src/components/canvas/ChatInterface.tsx
        Backend: refine_chat_with_openrouter in backend/main.py
        Uses: OpenRouter API (separate from Gemini)
```

---

## Team Structure

| Person            | Role                               | Status                                                     |
| ----------------- | ---------------------------------- | ---------------------------------------------------------- |
| **Hassan (Lead)** | Architecture, integration, reviews | Active                                                     |
| **Maarij**        | Frontend / UI / Dashboard          | Assigned tasks                                             |
| **Bilal**         | Backend / Database / API / Testing | Assigned tasks                                             |
| **Shahwaiz**      | AI Model training                  | v4 trained (mAP@50 98.7% valid set, 2026-06-11); v2 still live in `.env` pending Hassan integration |

### Important Rule

- Do NOT assign implementation tasks to Hassan (Lead)
- Hassan only does: integration work, reviews, final QA
- Maarij owns all frontend files
- Bilal owns all backend/DB files

---

## Shahwaiz's AI Model — Current Status

### Hosting & access

- **Tool used:** Roboflow (cloud hosted)
- **Production Model ID (in `.env` right now):** `object-detection-4affw/2` (YOLOv11 Fast)
- **Latest available model:** `object-detection-4affw/4` (YOLOv11 **Small**, trained 2026-06-11) — see "v4 performance" below. Not yet promoted to `.env`.
- **API URL:** `https://detect.roboflow.com` (hosted inference; do not use `serverless.roboflow.com` — that endpoint is treated as a v1 server by `inference-sdk` and tries to auth via `/model/add`)
- **Integration:** Via `inference-sdk` Python package
- **Key location:** `ROBOFLOW_API_KEY` in `.env` (never in frontend)
- **Status:** v2 live in prod; v4 trained and awaiting integration validation

### Class semantics (confirmed with Shahwaiz)

| class     | meaning                                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------------------------- |
| `navbar`  | top horizontal bar region (CONTAINER, not content)                                                                  |
| `footer`  | bottom horizontal bar region (CONTAINER, not content)                                                               |
| `section` | middle page body **excluding** header/footer (CONTAINER, not content)                                               |
| `card`    | catch-all for EVERY content unit inside a section: button, text label, heading, paragraph, input, image, icon, link |

The model intentionally collapses all content subtypes into `card`. Disambiguation (button vs input vs heading vs ...) happens downstream from each card's bbox aspect ratio + attached text annotation. Cards are expected to live INSIDE sections — that's the trained hierarchy.

### Dataset

- **Total images:** 311 (276 train / 17 valid / 18 test ≈ 89% / 5% / 6%)
- **Source images:** 23 unique (the rest come from augmentation)
- **Annotations:** 221 across 4 classes — heavy class imbalance:
  - `card`: 154 (~70%)
  - `section`: 23
  - `navbar`: 22
  - `footer`: 22
- **Median image ratio:** 600 × 720 (page-shaped, portrait-leaning)
- **Image size range:** 0.20 – 3.21 MP (avg 0.46 MP)
- **Training distribution:** mixed — hand-drawn pen sketches AND real digital UI screenshots

**YOLO class IDs (alphabetical order — confirmed):**

| ID  | class     |
| --- | --------- |
| 0   | `card`    |
| 1   | `footer`  |
| 2   | `navbar`  |
| 3   | `section` |

**Real dataset visual style distribution (discovered May 2026):**

- Clean digital wireframes (~40%) — thin crisp strokes, resembles Konva.js output; hardest inference target
- Dense hand-drawn sketches (~40%) — zigzag squiggles for text, X-cross marks for image placeholders
- Sparse wireframes (~20%) — few elements, minimal detail, lowest density

Synthetic generation weights mirror this 40/40/20 distribution.

### Preprocessing & augmentations (v2)

- **Resize:** Stretch to 640×640 (so input aspect ratio is altered before inference — extreme aspect ratios like wide-thin strips lose vertical detail)
- **Auto-orient:** applied
- **Augmentations:** flip horizontal, ±5° rotation, ±10% brightness, 2 outputs per training example — **no noise / no blur / no contrast variation**, so the model is brittle to inputs that don't match training contrast / lighting

### Performance (v2 model)

**Test set overall:** mAP@50 80.2% · Precision 83.1% · Recall 79.5% · F1 80.3%

**Per-class mAP@50 (validation set):**

| class     | mAP@50   |
| --------- | -------- |
| all       | ~72.0%   |
| `card`    | 58.0% ⚠️ |
| `footer`  | 68.0%    |
| `navbar`  | 82.0%    |
| `section` | 78.0%    |

Card is the weakest class — it's also the class with most variance (every content subtype lives under it).

### Performance (v4 model — trained 2026-06-11)

**Validation set:** mAP@50 **98.7%** · Precision **98.3%** · Recall **97.9%** · F1 **98.1%**

**Test set:** mAP@50 ~**98.0%** (per-class below)

**Per-class mAP@50 (Roboflow self-reported):**

| class     | v2 validation | v4 validation | v4 test  |
| --------- | ------------- | ------------- | -------- |
| all       | ~72.0%        | 99.0%         | 98.0%    |
| `card`    | 58.0% ⚠️      | 98.0%         | 98.0%    |
| `footer`  | 68.0%         | 98.0%         | 96.0%    |
| `navbar`  | 82.0%         | 99.0%         | 99.0%    |
| `section` | 78.0%         | 99.0%         | 99.0%    |

⚠️ **Roboflow's own caveat:** "These metrics are reported by the model provider and may not follow industry-standard evaluation techniques." Treat the headline numbers as directionally correct, not gospel — see `backend/eval_v4.py` for the locally-computed sanity check.

**Locally-verified v4 test-set numbers (2026-06-12, conf=0.20, IoU=0.5, n=264):**

| class     | precision | recall  |
| --------- | --------- | ------- |
| `card`    | 97.4%     | 98.8%   |
| `footer`  | 95.1%     | 91.7%   |
| `navbar`  | 97.0%     | 96.2%   |
| `section` | 99.5%     | 99.5%   |
| macro     | **97.2%** | **96.5%** |

The local computation matches Roboflow's reported 98.0% within ~1pp, confirming the headline metric is honest. `card` precision/recall both >97% on the held-out test set, vs 58% mAP on v2 — the FYP story is real.

### Dataset (v4)

- **Total images:** 4,481 (Train 3,690 / Valid 527 / Test 264 → 82% / 12% / 6%)
- **Composition:** 311 original real + 2,700 synthetic + ~1,470 unaccounted for (Roboflow auto-augmentation duplicates? Extra Shahwaiz uploads? Need to confirm by downloading the dataset and counting `sketch_*.jpg` files vs others.)

### Honest FYP write-up for v2 → v4 gain

The mAP@50 jump (test set: 80.2% → 98.0%) is real, but **attribute it to BOTH variables, not just the dataset**:

1. **Dataset expansion** (311 → 4,481 images, mostly synthetic): exposes the model to far more `card`-class variety than the original 154 card annotations could.
2. **Architecture upgrade** (YOLOv11 Fast → YOLOv11 Small): Small has more parameters and capacity than Fast — typically gives a few mAP points on its own.

For viva, the defensible claim is: "Synthetic data expansion combined with a moderate architecture upgrade moved test-set mAP@50 from 80.2% to 98.0%. Each contributes; we cannot fully decouple them without retraining v2-architecture on the v4 dataset (which we did not do due to compute/time constraints)."

Do NOT claim "the synthetic data alone delivered 18 mAP points" — that's not defensible without an ablation.

### Operational caveats

- ✅ **Per-class confidence thresholds re-tuned for v4 (2026-06-12)** — all four classes now at `0.20` in `_DEFAULT_PER_CLASS_THRESHOLDS`. v2's `card=0.03` floor would admit noise on v4's well-calibrated outputs.
- ✅ **Roboflow timeout bumped 30s → 60s (2026-06-12)** in `backend/main.py` line ~933. YOLOv11 Small (v4) is slower than YOLOv11 Fast (v2); 30s wasn't enough headroom for cold starts.
- ✅ **Backend startup warm-up (2026-06-12)** — `warmup_roboflow()` in `backend/main.py` fires one 64×64 dummy inference on FastAPI startup so the first real user request doesn't pay the cold-start tax. Background task; non-fatal if it fails. Watch for `[startup] Roboflow ... warm-up done in X.Xs` in backend output.
- ⚠️ **YOLOv11 Small is slower than Fast at inference** — measure user-facing detection latency after the swap.
- ✅ **Decision #15 effectively verified (2026-06-12)** — the contamination check's filename heuristic was defeated by Roboflow auto-renaming uploads (the `sketch_` prefix gets stripped), so we can't prove zero synthetic leakage by filenames alone. However, the local mAP eval shows uniformly high per-class numbers (95–99%) across the full 264-image test set. If synthetic had leaked in, we'd see a bimodal distribution (very high on synthetic, lower on real). We don't. The test set is honest in practice.

### Confusion matrix (v2 validation set)

|              | predicted card | predicted footer | predicted navbar | predicted section | false neg |
| ------------ | -------------- | ---------------- | ---------------- | ----------------- | --------- |
| true card    | 106            | 0                | 0                | 0                 | 17        |
| true footer  | 1              | 11               | 0                | 0                 | 6         |
| true navbar  | 1              | 0                | 12               | 0                 | 4         |
| true section | 0              | 0                | 0                | 18                | 0         |
| false pos    | 46             | 5                | 0                | 1                 | —         |

Key takeaways:

- `section` is essentially perfect (no false negatives, 1 false positive)
- `card` has 46 false positives and 17 false negatives → the model BOTH hallucinates cards AND misses real ones
- `footer` is sometimes mislabelled as `card`

### Operational notes (load-bearing — read before debugging detection)

1. **Input MUST be on a solid white (or non-black) background.** RGBA with transparent pixels gets composited to BLACK by both PIL's `.convert("RGB")` and Roboflow's preprocessor → dark sketch lines on black → effectively invisible → 0 predictions on what looks like a perfectly fine sketch in Windows Photos. The backend now composites alpha→white at decode time (`backend/app/models/inference.py`).
2. **Per-class confidence thresholds** (in `inference.py`): all four classes at `0.20` (re-tuned 2026-06-12 for v4). v2 used `card=0.03` because v2's card class was structurally under-confident; v4 is well-calibrated and 0.03 would admit noise. If you ever swap `ROBOFLOW_MODEL_ID` back to `/2`, restore `card=0.03`. Override any class via env: `ROBOFLOW_CONFIDENCE_THRESHOLD_CARD=0.10`.
3. **Class-aware NMS** (IoU > 0.5 within same class) deduplicates duplicate-region detections. Cross-class overlaps (card inside section) are KEPT — that's the intended hierarchy.
4. **Oversize-card guard:** any `card` covering > 85% of the image is dropped (those are the model confusing itself with the surrounding `section`).
5. **Server-side confidence floor** is set explicitly via `InferenceConfiguration(confidence_threshold=0.05)` so we can see everything above 5% — Roboflow's default floor is ~0.4, which would silently hide most card predictions.
6. **Debug PNG dump:** `DEBUG_AI_PROMPT=on` writes the white-composited image actually sent to Roboflow at `backend/debug/last_sketch.png`. Open this when detection is misbehaving — it shows exactly what the model sees.

### What Roboflow Returns

```json
{
  "predictions": [
    {
      "class": "navbar",
      "x": 200,
      "y": 10,
      "width": 400,
      "height": 60,
      "confidence": 0.94
    },
    {
      "class": "section",
      "x": 200,
      "y": 150,
      "width": 400,
      "height": 200,
      "confidence": 0.87
    },
    {
      "class": "card",
      "x": 150,
      "y": 300,
      "width": 200,
      "height": 150,
      "confidence": 0.91
    },
    {
      "class": "footer",
      "x": 200,
      "y": 500,
      "width": 400,
      "height": 80,
      "confidence": 0.89
    }
  ]
}
```

---

## LLM Usage — Who Does What

| LLM                | Purpose                                          | Status                         |
| ------------------ | ------------------------------------------------ | ------------------------------ |
| **Gemini 2.5 Pro** | Initial code generation from detected components | ✅ Integrated (commit 2bb44ed) |
| **Gemini Flash**   | Fallback if 2.5 Pro is slow                      | ✅ Available as fallback       |
| **OpenRouter**     | Chat-based code refinement ONLY                  | ✅ Already working             |

### Why Two LLMs?

- Gemini = generates the FIRST version of code from Roboflow detections
- OpenRouter = refines existing code when user chats ("make it dark mode")
- They serve different purposes and do NOT overlap

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

-- Profiles table (Supabase auth extension)
profiles (
  id,             -- matches auth.users.id
  onboarding_completed  -- boolean, default false; set true after tour
)

-- DB function (migration 20260515000001)
delete_project(project_id uuid)  -- cascades: deletes iterations then project
```

### CRITICAL: Wrong names that must NOT be used

- ❌ `name` → use `title`
- ❌ `thumbnail` → use `thumbnail_url`
- ❌ `project_versions` → use `iterations`

---

## Environment Variables Required

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI Services
OPENROUTER_API_KEY=        # For chat refinement
GEMINI_API_KEY=            # For code generation
ROBOFLOW_API_KEY=          # For sketch detection

# Roboflow Model
ROBOFLOW_MODEL_ID=object-detection-4affw/2
```

---

## Current Status — What is Done vs Remaining

### ✅ Fully Done

- Canvas drawing interface (Konva.js) — core drawing works; state-bridge
  bugs uncovered June 2026, see "Partially Done" below
- **Redesigned canvas workspace** (commit d42f2aa) — extracted
  `CanvasSurface`, `FloatingToolbar`, `StyleRibbon`, `ZoomPill`;
  shared types in `src/types/canvas.ts`
- **H4: Roboflow + Gemini pipeline** wired end-to-end (commit 2bb44ed)
- **Backend text-to-element matching hardened** (commit d42f2aa) —
  canvas-extent inference, oversized-container handling, top/bottom-band
  navbar/footer synthesis with mis-fire guards
- User authentication (Supabase)
- Project save/load — `useProjectSave` now uses canonical `title` /
  `thumbnail_url` columns (M1 done)
- OpenRouter chat refinement
- Fallback template-based code generation
- Database setup and migrations
- Version history — `useVersionHistory` queries `iterations` table
  with `version_number` ordering (M2 done)
- Project rename — `updateProjectTitle` in `useProjectSave` (M3 done)
- Toast notifications — `src/components/ui/Toast.tsx` (M10 done)
- Canvas keyboard shortcuts — `useCanvasShortcuts` hook (M14 done
  for canvas; rest of app may still need bindings)
- Profile page rework (M7 — landed alongside auth polish)
- Dashboard project card actions + delete (M4 done)
- Empty states — dashboard + canvas (M5 done)
- Onboarding tour (M6 done — `OnboardingTour.tsx`)
- **M8: Error boundaries** — `src/components/ErrorBoundary.tsx`
  (page/panel/inline variants, `resetKeys` support). Wrapped around
  root layout, command palette, canvas + each chrome component
  (SketchCanvas, FloatingToolbar, StyleRibbon, ZoomPill), both
  Monaco editor instances, both LivePreview instances, dashboard,
  profile. Landed via PR #8 (Maarij) + Hassan integration on
  canvas/Monaco wraps.
- **M9: Loading skeletons** — `src/components/ui/Skeleton.tsx` +
  `auth/AuthLoadingSkeleton`, `canvas/CodePanelSkeleton`,
  `dashboard/DashboardSkeleton`, `profile/ProfileSkeleton`. Used
  on auth pages, dashboard, profile. Canvas code panel uses
  Hassan's `GenerationProgress` (richer than skeleton).
- **M11: Dark mode** — full light/dark CSS-var system in `globals.css`
  under `html[data-theme="light|dark"]`. `ThemeProvider` (localStorage
  + system pref), `ThemeToggle` button in Navbar + Dashboard header.
  FOUC-prevention inline script in `layout.tsx` sets `data-theme`
  before paint. `.theme-transition` class on root for 180ms swap.
- Account deletion flow — `DeleteAccountModal` + `/api/account/delete`
  route (Hassan) using `lib/supabase/admin.ts`. Wired into profile page.

### ⚠️ Partially Done

- **Canvas state-bridge / persistence** — `canvas/page.tsx` uses
  `SketchCanvasWithHistory` (dynamic-imported, aliased as `SketchCanvas`)
  which polls Konva state into `useHistory` every 500ms. Series of
  regressions from the d42f2aa redesign, all fixed 2026-06-10:
  empty-state hint stuck after drawing or template insert; saved
  projects failed to restore on reload; undo wiped the original
  template along with the latest action because `componentGroups` was
  never tracked in history; template-only projects never auto-saved.
  Fix added `SketchCanvasRef.replaceCanvasState` for atomic three-bucket
  swap, propagated `componentGroups` through `CanvasTemplateData` /
  `CanvasData` / wrapper poll / restore path, and added
  `hasUserInteracted` in the page so the hint is responsive regardless
  of poll lag. **Remaining wart:** the 500ms poll is still the primary
  sync mechanism. Replacing it with an explicit onChange callback
  inside `SketchCanvas` (fired from setLines/setShapes/setComponentGroups
  callsites) would eliminate both the polling latency and the
  bidirectional-effect dance. Reasonable M-task candidate for Maarij.
- Dashboard project management — card actions present, polish ongoing
- Sketch detection accuracy — Roboflow integrated, but `card`
  precision is structurally low (58% — see Shahwaiz section);
  synthesis heuristics compensate but don't replace better training
- **v4 model integration** — Shahwaiz delivered `object-detection-4affw/4`
  on 2026-06-11 with valid-set mAP@50 98.7% and locally-verified test-set
  macro precision 97.2% / recall 96.5% (2026-06-12). Architecture switched
  from Fast → Small. **Remaining integration work:**
  (a) feature-test detection on representative sketches with
  `ROBOFLOW_MODEL_ID=object-detection-4affw/4` before flipping `.env`,
  (b) ✅ re-tuned per-class confidence thresholds to `0.20` across all four
  classes (commit 2026-06-12),
  (c) re-evaluate whether orphan-label input/button synthesis (Decision #20)
  can be retired now that card detection is reliable,
  (d) measure inference latency delta (Fast → Small is slower).
- **M12: Mobile responsiveness** — auth pages use `min-h-[100svh]`,
  Dashboard has slide-in sidebar with backdrop + hamburger,
  canvas shows dismissible mobile warning + auto-hides right panel
  on `< lg`, SketchCanvas wraps Konva Stage with touch handlers +
  `overscroll-none touch-none`. Broader pass on canvas chrome and
  code panel still pending.
- **M13: Animations** — canvas chrome animated (existing).
  Theme transition (180ms) + Dashboard sidebar slide added in PR #8.
  Rest of app still uses default transitions.

### ❌ Not Started / In Progress

- B1: DB schema unification (Bilal — most critical)
- B5/B6: Framework selector + Export as ZIP (Bilal)
- B9: CI/CD pipeline (Bilal)
- M15: Docs cleanup (Maarij)

---

## Key Files Map

### Frontend — canvas chrome (post-redesign)

| File                                                | Purpose                                                  |
| --------------------------------------------------- | -------------------------------------------------------- |
| `src/app/canvas/page.tsx`                           | Orchestrator: composes chrome, owns detection trigger    |
| `src/components/canvas/SketchCanvas.tsx`            | Konva drawing surface                                    |
| `src/components/canvas/SketchCanvasWithHistory.tsx` | Drawing surface + undo/redo wiring                       |
| `src/components/canvas/CanvasSurface.tsx`           | Dot-grid workspace + empty-state hint                    |
| `src/components/canvas/FloatingToolbar.tsx`         | Tool picker (select/pen/shapes/erase) w/ shortcuts       |
| `src/components/canvas/StyleRibbon.tsx`             | Stroke / fill / width / opacity controls                 |
| `src/components/canvas/ZoomPill.tsx`                | Zoom presets + fit-to-screen                             |
| `src/components/canvas/ChatInterface.tsx`           | OpenRouter chat refinement panel                         |
| `src/components/canvas/LivePreview.tsx`             | Code → live preview iframe                               |
| `src/types/canvas.ts`                               | Canonical `Tool`, `Mode`, zoom constants, `TOOL_KEY_MAP` |
| `src/hooks/useCanvasShortcuts.ts`                   | Keyboard shortcut handler for canvas page                |
| `src/components/ui/Toast.tsx`                       | App-wide toast provider                                  |
| `src/components/ui/Skeleton.tsx`                    | Base skeleton primitive                                  |
| `src/components/ErrorBoundary.tsx`                  | Class-based boundary, `page`/`panel`/`inline` variants   |
| `src/components/theme/ThemeProvider.tsx`            | localStorage + system-pref theme context                 |
| `src/components/theme/ThemeToggle.tsx`              | Sun/moon button used in Navbar + Dashboard header        |
| `src/components/canvas/StatusBar.tsx`               | Persistent dims/mode/grid/zoom bar below canvas          |
| `src/components/canvas/GenerationProgress.tsx`      | Code-generation progress indicator (used by code panel)  |
| `src/components/canvas/CodePanelSkeleton.tsx`       | Skeleton placeholder for code panel (unused on canvas)   |
| `src/components/auth/AuthLoadingSkeleton.tsx`       | Skeleton placeholder for auth pages                      |
| `src/components/dashboard/DashboardSkeleton.tsx`    | Skeleton placeholder for dashboard                       |
| `src/components/profile/ProfileSkeleton.tsx`        | Skeleton placeholder for profile page                    |
| `src/components/profile/DeleteAccountModal.tsx`     | Account deletion confirmation modal                      |
| `src/components/onboarding/OnboardingTour.tsx`      | Step-by-step onboarding overlay with spotlight highlight |

### Frontend — data + routes

| File                                 | Purpose                              |
| ------------------------------------ | ------------------------------------ |
| `src/app/api/generate-code/route.ts` | Proxy to FastAPI; OpenRouter routing |
| `src/app/api/account/delete/route.ts`| Delete current user (auth.users) via service-role admin client |
| `src/hooks/useProjectSave.ts`        | Project CRUD (canonical schema)      |
| `src/hooks/useVersionHistory.ts`     | Iterations table queries             |
| `src/lib/supabase/admin.ts`          | Service-role Supabase client (server-only; DO NOT import in frontend) |

### Backend

| File                              | Purpose                                                                                                              |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `backend/main.py`                 | FastAPI server, `/api/predict`, text-attachment + synthesis helpers                                                  |
| `backend/app/models/inference.py` | `SketchDetector`, `CodeGenerator`, `_build_gemini_prompt`, `generate_with_gemini` — Roboflow + Gemini both live here |
| `backend/debug/last_sketch.png`   | Runtime debug dump when `DEBUG_AI_PROMPT=on` (gitignored)                                                            |

### Synthetic data pipeline (`backend/synthetic_data/`)

Entry point: `python -m backend.synthetic_data.generate --count 2700 --out synthetic_dataset`

| File                                 | Purpose                                                                     |
| ------------------------------------ | --------------------------------------------------------------------------- |
| `backend/synthetic_data/generate.py` | CLI orchestrator — renders images, writes YOLO labels                       |
| `backend/synthetic_data/layouts.py`  | Layout templates (standard / sidebar / minimal) + `Element` dataclass       |
| `backend/synthetic_data/style.py`    | `SketchStyle`, `Hotspot`, style-type sampling (`random_style()`)            |
| `backend/synthetic_data/rough.py`    | PIL drawing primitives: wobble lines, zigzag text fill, image placeholder X |
| `backend/synthetic_data/validate.py` | YOLO label validation, bbox jitter, annotator miss-rate simulation          |

Output is **gitignored** (`synthetic_dataset/`). All 2,700 images go to `train/` only — real 17 valid + 18 test stay as the evaluation split (sim-to-real protocol).

---

## Current Task Assignments

### Hassan (Lead) — DO THESE ONLY

- ✅ **H4 (done):** Roboflow detection + Gemini code generation wired
  end-to-end (commits 2bb44ed, d42f2aa). Gemini lives in `inference.py`
  rather than a separate `code_generator.py`.
- ✅ **Canvas redesign + matching reliability (done):** chrome
  refactor, text-attachment + container-synthesis heuristics
  (commit d42f2aa).
- **Final:** Integrate everything when all parts ready / final QA

### Maarij (Frontend) — DO NOT REASSIGN

- ✅ M1: Fix useProjectSave.ts column names — done
- ✅ M2: Fix useVersionHistory.ts → iterations — done
- ✅ M3: Implement project rename handler — done (`updateProjectTitle`)
- ✅ M4: Polish project card actions — done (delete project + cascade iterations via `delete_project()` DB function)
- ✅ M5: Add empty states — done (dashboard + canvas)
- ✅ M6: Build onboarding flow — done (`OnboardingTour.tsx`, `onboarding_completed` on profiles)
- ✅ M7: Settings/profile page — landed
- ✅ M8: Error boundaries — done (PR #8, integration commit June 2026)
- ✅ M9: Loading skeletons — done (PR #8). Canvas code-panel uses
  Hassan's `GenerationProgress` instead of static skeleton.
- ✅ M10: Toast notifications — done (`src/components/ui/Toast.tsx`)
- ✅ M11: Dark mode — done (PR #8, full theme system + FOUC fix)
- ⚠️ M12: Mobile responsiveness — partial (auth + dashboard + canvas
  done; broader pass on chrome and code panel pending)
- ⚠️ M13: Animations — canvas chrome animated; theme transition +
  sidebar slide added; rest of app pending
- ✅ M14: Keyboard shortcuts (canvas) — done (`useCanvasShortcuts`).
  Global shortcuts (Cmd+K palette etc.) already exist in CommandPalette.
- M15: Docs cleanup

### Bilal (Backend) — DO NOT REASSIGN

- B1: Unify DB schema (MOST CRITICAL — do first)
- B2: Fix FastAPI persistence layer
- B3: Fix auth callback race condition
- B4: Remove sensitive proxy logs
- B5: Framework selector backend
- B6: Export as ZIP endpoint
- B7: Rate limiting on AI endpoint
- B8: Error retry logic
- B9: Fix lint + add CI pipeline
- B10: Clean inference.py interface (light task)
- B11: Frontend + backend tests
- B12: API response caching
- B13: Accuracy and speed metrics

---

## FYP Competitors (For Differentiation Context)

- **Uizard** — sketch to UI, no code export
- **Visily** — design tool, limited code
- **TeleportHQ** — visual builder, not sketch-based
- **Locofy** — Figma to code, not hand-drawn sketches

### What Makes CodeCanvas Different

1. Hand-drawn sketch → real code (not Figma/design tool)
2. Custom trained AI model (Shahwaiz's Roboflow model)
3. AI chat refinement built in (OpenRouter)
4. Multiple framework output (React + HTML)
5. Version history of generated code

---

## Important Decisions Already Made

1. **Use Roboflow cloud API** — not local model (free tier limitation workaround)
2. **Use Gemini 2.5 Pro** for code generation (not OpenRouter — too slow/limited)
3. **Keep OpenRouter** for chat refinement only (already working, don't touch)
4. **Canonical DB schema** uses title/thumbnail_url/iterations (not name/thumbnail/project_versions)
5. **Output React + Tailwind** as default, HTML + CSS as secondary option
6. **Fork-based git workflow** — Maarij and Bilal work on forks
7. **GitHub Projects** used for task tracking
8. **No collaboration features** — cut from scope (too complex for timeline)
9. **No offline mode** — cut from scope (overkill)
10. **Gemini lives in `inference.py`** — we collapsed the planned
    `backend/code_generator.py` into `inference.py` to keep the
    detection + generation pipeline in one module. Don't recreate
    `code_generator.py`.
11. **Container synthesis is conservative** — top/bottom-band navbar
    /footer fabrication fires ONLY on stray text annotations, never on
    detected `card` clusters. Reason: a row of dialog buttons
    (Yes / No) was being relabelled as a footer. If you extend this,
    keep cards as content, not container hints.
12. **Multi-label elements list children positionally** — when 2+
    text annotations match the same element, each label is kept
    with its position (no concatenation). Reason: the previous
    " / " join produced strings like "Password / Sign In" that
    Gemini rendered as a single heading. Concatenation is lossy
    and breaks strict fidelity. Always position when multiple
    labels match, regardless of container size.
13. **Canvas types are centralised** in `src/types/canvas.ts` —
    `Tool`, `ToolGroup`, `Mode`, `RightPanel`, `CodeViewMode`,
    `ZOOM_*` constants, `TOOL_KEY_MAP`. Don't redefine these locally.
14. **Runtime debug artifacts** (`backend/debug/`) are gitignored —
    don't check them in.
15. **Synthetic images go to `train/` only; real splits are evaluation-only** — mixing
    synthetic into `val/` or `test/` corrupts the mAP signal. Shahwaiz's 17 valid + 18
    test images are the only honest measure of real-world performance. Never move them to train.
16. **v3/v4 Roboflow augmentation config was meant to be identical to v2** — same stretch,
    flip, rotation, brightness, and 2-outputs setting. The goal was to isolate the dataset
    as the only variable so v2 vs v3 mAP would be a clean A/B comparison.
    **STATUS:** Partially violated. Shahwaiz's delivered v4 uses YOLOv11 **Small** instead
    of v2's Fast. So the v2 → v4 mAP delta is now confounded by both dataset AND architecture
    changes. For the FYP write-up, attribute the gain honestly to both, not just to data.
    For any FUTURE comparison (e.g. v4 → v5 if we add more synthetic data), lock both
    dataset and architecture so each variable can be isolated.
17. **Theme system uses `data-theme` attribute on `<html>`** — light
    and dark CSS-var sets live under `html[data-theme="light|dark"]`
    in `globals.css`. `ThemeProvider` writes the attribute; an
    inline script in `layout.tsx` <head> sets it BEFORE first
    paint to prevent FOUC. Reason: SSR can't know the user's
    preferred theme — without the inline script you get a dark→light
    (or vice versa) flash on first load. Don't rely on the React
    context for the initial paint; the inline script is load-bearing.
    Do NOT switch to `class="dark"`-based Tailwind theming — that
    would force re-writing every CSS-var set.
18. **Avatar `<img>` from Google OAuth needs `referrerPolicy="no-referrer"`**
    — without it, Google rate-limits the avatar URL based on
    referrer and returns 429s, causing broken avatar images.
    Always set `referrerPolicy="no-referrer"` and an `onError`
    fallback to initials on any avatar `<img>`. Currently applied
    in Navbar and DashboardLayout's `Avatar` component.
19. **Strict fidelity — Gemini does not invent elements** — the LLM
    renders ONLY the detected components plus user-annotated text.
    It must not add headings, subtitles, footers, branding,
    copyright, taglines, or "would look better with X" elements
    that are not in the detection list. Reason: the FYP thesis is
    sketch-to-code accuracy. Any LLM-side augmentation invalidates
    the detection-quality measurement, breaks reproducibility, and
    gives viva evaluators an obvious attack surface ("why are
    there 5 elements when I drew 3?"). If a sketch needs a "Sign
    In" heading, the user must draw it. The prompt enforces this
    via a top-of-rules STRICT FIDELITY directive; the matcher
    enforces it by listing multi-label hits positionally instead
    of concatenating them.
20. **Orphan-label input/button synthesis is a v2 stop-gap** — when
    a text annotation reads as a form-field label (Email, Password,
    Username, ...) or action verb (Sign In, Submit, ...) AND its
    only enclosing detected element is a large container (>10% of
    canvas area), `_synthesize_inputs_for_orphan_labels` in
    `backend/main.py` synthesizes a virtual `card` of input/button
    shape around the label so the matcher binds the label to a
    real-sized element. The prompt builder tags these
    `[SYNTHESIZED INPUT]` / `[SYNTHESIZED BUTTON]` so Gemini renders
    them as real `<input>` / `<button>` rather than placeholders.
    Reason: Roboflow v2 frequently misclassifies wide-thin inner
    input rectangles as `section` / `footer` (similar aspect ratio)
    and rejects them via per-class thresholds; strict fidelity then
    leaves the label floating in space with no input box. Mirrors a
    detected sibling input's x/width/height when available so the
    synthesized input lines up with the real ones visually.
    Auto-dormant when v3 ships (small-enclosing-element short-circuit
    fires). Delete the helper, the `_INPUT_LABEL_WORDS` /
    `_BUTTON_TEXT_WORDS` constants, and the role-aware `[SYNTHESIZED
    INPUT|BUTTON]` prompt branch once v3 mAP confirms inner inputs
    are reliably detected.

---

## Recent Work (most recent first)

- **v4 end-to-end smoke test (Claude via Playwright)** (2026-06-12):
  Drove the canvas UI through 4 representative sketches on `feat/v4-model`.
  Hero Section (1 section + 2 cards), 3-Column Cards (3 cards), Dashboard
  Sidebar (1 section + 4 cards, the v2-weak sparse case) — all perfect.
  Footer-in-isolation classified as 2 cards instead of 1 footer; same
  behaviour expected on v2 (see Known Failure Modes), and Gemini's
  positional rendering still produces footer-looking output. Detection
  latency ~3-5s Roboflow + 25-40s Gemini post warm-up.
  Also fixed two latency issues uncovered: bumped Roboflow timeout 30s → 60s
  for v4 Small's higher inference time, and added `warmup_roboflow()`
  startup handler to eat the cold-start tax during boot.
- **v4 local sanity check (Hassan)** (2026-06-12): Downloaded the v4 dataset
  zip from Roboflow and ran `backend/eval_v4.py` against the 264-image test
  split via `inference-sdk`. Macro precision 97.2% / recall 96.5%, matching
  Roboflow's reported 98% within ~1pp. Per-class: card P 97.4%/R 98.8%,
  footer 95.1%/91.7%, navbar 97.0%/96.2%, section 99.5%/99.5%. v4 cleared
  for `.env` promotion. Filename-based synthetic-leakage check was defeated
  by Roboflow's auto-rename, but uniform per-class numbers across the full
  test set rule out a synthetic-easy bimodal distribution.
- **v4 model delivered (Shahwaiz)** (2026-06-11): `object-detection-4affw/4`
  trained on 4,481 images. Valid-set mAP@50 **98.7%**, P 98.3%, R 97.9%, F1 98.1%.
  Architecture switched from YOLOv11 Fast (v2) to YOLOv11 Small (v4). Test-set
  (External) evaluation not yet captured — blank in delivered screenshot.
  Production `.env` still points to v2; integration validation pending (see
  "v4 model integration" in Partially Done). Synthetic dataset pipeline
  (`backend/synthetic_data/`) considered complete for now.
- **Canvas UX bug batch (Hassan)** (2026-06-10): Five fixes.
  (1) Spaces unusable in chat box — `SketchCanvas`'s global Space/pan
  handler only excluded `INPUT`, swallowing spaces in any TEXTAREA
  (chat, Monaco). New module-level `isTypingTarget()` covers
  input/textarea/contenteditable; also applied to the Delete/Backspace
  shape-delete handler (Backspace while chatting deleted selected
  shapes). (2) Text tool now multiline — modal input → textarea,
  Enter saves, Shift+Enter inserts newline (Konva Text renders \n
  natively). (3) Text hover delete button unreachable — it sits above
  the text with a hit-area gap, so mouseleave killed it mid-travel;
  hide is now delayed 300ms via timeout, cancelled on re-enter.
  (4) Text editing added — double-click (or double-tap) a text shape
  opens the same modal pre-filled; submit updates in place
  (`editingTextId` state). (5) Preview unscrollable — injected
  `html,body { height:auto !important; overflow-y:auto !important; }`
  into both LivePreview iframe document builders (generated hero
  layouts often set overflow:hidden), and the Fit-mode card now always
  uses `overflow-auto` instead of hiding overflow when zoomed out.

- **Orphan-label input/button synthesis (Hassan)** (2026-06-10):
  Stop-gap for the strict-fidelity + v2-detector-recall gap. Roboflow
  v2 often misclassifies inner input rectangles as `section` /
  `footer` and rejects them below threshold — the user's label
  (Email, Password) then has nowhere to bind, and the new STRICT
  FIDELITY rule prevents Gemini from inventing the missing input,
  so the preview renders a floating label with no input box. Added
  `_INPUT_LABEL_WORDS`, `_BUTTON_TEXT_WORDS`, helpers
  (`_looks_like_input_label`, `_looks_like_button_text`,
  `_find_enclosing_element`), and `_synthesize_inputs_for_orphan_labels`
  in `backend/main.py`. Wired into `resolve_external_model_output`
  between container synthesis and text-attach. `_build_gemini_prompt`
  now emits role-aware `[SYNTHESIZED INPUT]` / `[SYNTHESIZED BUTTON]`
  / `[SYNTHESIZED CONTAINER]` suffixes and the training-rules block
  tells Gemini each synthetic role is a real `<input>` / `<button>` /
  navbar/footer/section — not a placeholder. Auto-dormant once v3
  ships; remove the helper + constants then. See Decision #20.
- **Canvas state-bridge + undo fix + project-load loop (Hassan)** (2026-06-10):
  Root cause of "templates flash and vanish" and "saved canvas vanishes
  after some time" was `useProjectSave` calling `createClient()` on every
  render (not memoized), making `loadProject` an unstable reference.
  `canvas/page.tsx`'s project-load `useEffect([searchParams, loadProject])`
  therefore re-ran on every parent render, reloading the DB snapshot and
  overwriting local canvas edits via `history.setState` ~once per render.
  Fix: `const supabase = useMemo(() => createClient(), [])` in
  `useProjectSave.ts` (mirrors what `useVersionHistory` already did
  correctly). Alongside this, fixed four regressions in the
  `SketchCanvas` ⇄ `useHistory` bridge from the d42f2aa redesign:
  (1) empty-state hint stuck after drawing — fixed via `hasUserInteracted`
  flag wired to `CanvasSurface.onUserInteract`, plus the same flag is
  set in `handleInsertTemplate` / `handleInsertComponent` so the hint
  also vanishes when a template is dropped;
  (2) saved projects did not restore on reload — load handler now
  pushes `project.canvas_data` into `history.setState` (wrapper's effect
  renders it into Konva), dropping the `lines`-only guard and the 500ms
  setTimeout race;
  (3) undo removed both the latest action AND the original template —
  root cause: the wrapper's poll captured only `lines`/`shapes` and its
  restore path used `clearCanvas + insertTemplate` which wiped
  `componentGroups`. Added a `replaceCanvasState` method on
  `SketchCanvasRef` that swaps all three buckets atomically, and the
  wrapper now tracks `componentGroups` in both the poll and the restore;
  (4) template-only projects never auto-saved — `useAutoSave` hasContent
  check now considers `componentGroups`. `CanvasData` type gained a
  `componentGroups` field. Initial history state seeded with
  `componentGroups: []` to avoid a spurious first-poll diff;
  (5) **template flashed for ~100ms then vanished** — the wrapper's
  imperative `insertTemplate` had a `setTimeout(100)` that pushed
  `{lines, shapes}` into history WITHOUT `componentGroups`; the restore
  effect then saw a mismatch and wiped the just-inserted group. All
  three `onStateChange` callsites in `SketchCanvasWithHistory`
  (clearCanvas / insertTemplate / poll) now pass the full three-bucket
  payload, and the page's load handler normalizes `canvas_data` to
  exactly those three keys (raw DB data also carries width/height which
  broke the JSON comparison). Rule of thumb: any `onStateChange` /
  `history.setState` payload MUST contain exactly
  `{lines, shapes, componentGroups}` — nothing more, nothing less.
  Not assigned in the task board — fixed as integration work.
- **PR #8 + integration (Maarij + Hassan)** (June 2026): M8 (error
  boundaries), M9 (loading skeletons), M11 (dark mode) closed out;
  M12 mobile responsiveness landed for auth + dashboard + canvas
  (partial). Theme system uses `html[data-theme=...]` with FOUC
  inline script in `layout.tsx`. Integration was a 7-file
  surgical merge against Hassan's local WIP — preserved
  `referrerPolicy="no-referrer"` avatar fix, account-delete flow,
  `StatusBar`, `GenerationProgress`, line-tool, and gradient pill
  re-skin while layering in Maarij's `ErrorBoundary` wraps + mobile
  responsiveness. WIP safety branch: `wip/hassan-local-2026-06-10`.
- **13d94e8 — M4, M5, M6 (Maarij)** (May 2026): Dashboard project card actions
  polished (delete with cascade via `delete_project()` DB function), empty states
  added to dashboard, onboarding tour built (`OnboardingTour.tsx` with spotlight
  highlight). Also bumped `inference-sdk` 0.22.1 → 0.64.8 and `numpy` 1.26.4 → 2.2.6
  in backend requirements — test detection after `pip install -r requirements.txt`.
- **60ad65e — Dataset Generation** (May 2026): Added `backend/synthetic_data/`
  — PIL-based synthetic sketch generator producing 2,700 YOLO-format training images
  in three style types (clean 40% / dense_hand 40% / sparse_sketch 20%) matching
  the real dataset's visual distribution. All synthetic images go to `train/` only.
- **d42f2aa — Canvas redesign + matching reliability** (May 2026):
  Extracted canvas chrome into focused components, centralised types,
  added Toast + keyboard-shortcut hook. Backend: text-to-element
  matching now handles canvas-extent inference, oversized containers,
  and top/bottom-band navbar/footer recovery without the previous
  card-cluster mis-fires.
- **2bb44ed — H4** (April 2026): Roboflow + Gemini sketch-to-code
  pipeline wired end-to-end.
- **989dbb0 / 6dafba1 — Maarij tasks 2-5**: dashboard + auth polish.
- **56526bc**: sketch-first AI refinement, dashboard nav upgrades.

---

## Current Bottleneck

**Until v4 is promoted to `.env`:** the bottleneck is still Roboflow v2 detection quality —
weak `card` classification and poor handling of sparse layouts. Most downstream code
generation issues trace back to incorrect or incomplete component detection.

**Once v4 is integrated** (mAP@50 jumped from 80.2% test → 98.7% valid): the bottleneck
will likely shift to **Gemini prompt fidelity and layout reconstruction** — i.e. whether
the LLM faithfully renders the detected components without inventing extras (Decision #19)
and whether spatial relationships survive the bbox → JSX translation. Re-evaluate this
section after v4 ships and we have real failure-mode data.

---

## Known Failure Modes

These are real failure patterns seen in production or testing. Read before debugging detection issues.

| Failure                                                    | Root cause                                                                                                                                                                                    |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Detection returns 0 predictions on a clearly valid sketch  | Transparent canvas background composited to black — sketch lines invisible on dark background. Fixed in `inference.py` (alpha→white). If it regresses, check `backend/debug/last_sketch.png`. |
| Single isolated rectangle detected as `section` not `card` | Model learned sections as large-rectangle regions; a lone card drawn without context triggers the wrong class                                                                                 |
| Wide/thin or tall/narrow layouts lose detail               | Stretch to 640×640 preprocessing alters aspect ratio — extreme proportions lose spatial relationships                                                                                         |
| `card` confidence structurally lower than containers       | Cards are diverse (button/input/heading/image all map to one class) — a single global confidence threshold can't fit both. Use per-class thresholds (`card=0.03`, others `=0.20`).            |
| Oversized `section` prediction engulfs everything          | A section covering >85% of canvas is the model confusing the canvas boundary with a section. Oversize-card guard handles this for cards; similar behavior can affect sections.                |
| Sparse sketches underperform dense ones                    | Model trained on data skewed toward dense hand-drawn layouts (~40%) — sparse wireframe style (~20%) is underrepresented and harder to generalise                                              |
| Roboflow default threshold silently hides card predictions | Default Roboflow confidence floor is ~0.4 — most card predictions are below this. Always set `InferenceConfiguration(confidence_threshold=0.05)` explicitly.                                  |
| Footer mislabelled as `card`                               | Confusion matrix shows ~1 footer per validation run lands on card. Low-confidence footers look like wide cards to the model.                                                                  |
| Isolated-footer sketches (no page content above) classified as `card`  | v4 verified 2026-06-12 via the Footer template. A footer drawn alone in the bottom half of an otherwise empty canvas loses the "wide bar BELOW page content" context that defines the footer class. Same behaviour as v2 — not a v4 regression. Workaround: Gemini's positional rendering still produces a horizontal-link layout, so the user-facing output looks correct even when the detected class is wrong. |

---

## How to Help Me Most Effectively

When I ask for help:

1. Read this file first for context
2. Do NOT suggest reassigning work to Hassan unless it's integration/review
3. Do NOT change canvas editor core — it is complete
4. Do NOT change OpenRouter chat refinement — it is working
5. Always suggest keeping existing endpoint shapes (no frontend contract changes)
6. Prefer React + Tailwind in code suggestions
7. Keep DB column names canonical: title, thumbnail_url, iterations

---

## Quick Reference

```
Frontend URL:  http://localhost:3000
Backend URL:   http://localhost:8000
Database:      Supabase (see .env)
Roboflow:      https://detect.roboflow.com   (NOT serverless.roboflow.com — see Operational notes #1)
Gemini:        https://aistudio.google.com
OpenRouter:    https://openrouter.ai
```

## My Default Instructions (Always Apply)

You are a senior full-stack engineer with 10+ years experience.
You have strong opinions. If my approach is wrong, reject it and
tell me a better way. Do not follow my instructions blindly.
Think deeply before writing a single line of code.
Read the entire relevant file before touching anything.
Warn me about side effects before making changes.
