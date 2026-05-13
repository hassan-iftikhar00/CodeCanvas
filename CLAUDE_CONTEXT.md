# CodeCanvas — Claude Context File

> Read this file before helping with any task.
> This is a FYP (Final Year Project) at a university.
> Last updated: May 2026

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
        _synthesize_missing_containers, _infer_canvas_extents)
        Handles oversized containers and top/bottom-band navbar/footer
        recovery when the model misses them.

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

| Person            | Role                               | Status                       |
| ----------------- | ---------------------------------- | ---------------------------- |
| **Hassan (Lead)** | Architecture, integration, reviews | Active                       |
| **Maarij**        | Frontend / UI / Dashboard          | Assigned tasks               |
| **Bilal**         | Backend / Database / API / Testing | Assigned tasks               |
| **Shahwaiz**      | AI Model training                  | Model ready via Roboflow API |

### Important Rule

- Do NOT assign implementation tasks to Hassan (Lead)
- Hassan only does: integration work, reviews, final QA
- Maarij owns all frontend files
- Bilal owns all backend/DB files

---

## Shahwaiz's AI Model — Current Status

### Hosting & access

- **Tool used:** Roboflow (cloud hosted)
- **Model ID:** `object-detection-4affw/2`
- **Architecture:** YOLOv11 Object Detection (Fast)
- **API URL:** `https://detect.roboflow.com` (hosted inference; do not use `serverless.roboflow.com` — that endpoint is treated as a v1 server by `inference-sdk` and tries to auth via `/model/add`)
- **Integration:** Via `inference-sdk` Python package
- **Key location:** `ROBOFLOW_API_KEY` in `.env` (never in frontend)
- **Status:** ✅ Trained and live

### Class semantics (confirmed with Shahwaiz)

| class    | meaning                                                                           |
| -------- | --------------------------------------------------------------------------------- |
| `navbar` | top horizontal bar region (CONTAINER, not content)                                |
| `footer` | bottom horizontal bar region (CONTAINER, not content)                             |
| `section`| middle page body **excluding** header/footer (CONTAINER, not content)             |
| `card`   | catch-all for EVERY content unit inside a section: button, text label, heading, paragraph, input, image, icon, link |

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

### Preprocessing & augmentations (v2)

- **Resize:** Stretch to 640×640 (so input aspect ratio is altered before inference — extreme aspect ratios like wide-thin strips lose vertical detail)
- **Auto-orient:** applied
- **Augmentations:** flip horizontal, ±5° rotation, ±10% brightness, 2 outputs per training example — **no noise / no blur / no contrast variation**, so the model is brittle to inputs that don't match training contrast / lighting

### Performance (mAP@50, validation set)

| class     | precision |
| --------- | --------- |
| all       | 72.0%     |
| `card`    | 58.0% ⚠️  |
| `footer`  | 68.0%     |
| `navbar`  | 82.0%     |
| `section` | 78.0%     |

Card is the weakest class — it's also the class with most variance (every content subtype lives under it).

### Confusion matrix (validation set)

|             | predicted card | predicted footer | predicted navbar | predicted section | false neg |
| ----------- | -------------- | ---------------- | ---------------- | ----------------- | --------- |
| true card   | 106            | 0                | 0                | 0                 | 17        |
| true footer | 1              | 11               | 0                | 0                 | 6         |
| true navbar | 1              | 0                | 12               | 0                 | 4         |
| true section| 0              | 0                | 0                | 18                | 0         |
| false pos   | 46             | 5                | 0                | 1                 | —         |

Key takeaways:
- `section` is essentially perfect (no false negatives, 1 false positive)
- `card` has 46 false positives and 17 false negatives → the model BOTH hallucinates cards AND misses real ones
- `footer` is sometimes mislabelled as `card`

### Operational notes (load-bearing — read before debugging detection)

1. **Input MUST be on a solid white (or non-black) background.** RGBA with transparent pixels gets composited to BLACK by both PIL's `.convert("RGB")` and Roboflow's preprocessor → dark sketch lines on black → effectively invisible → 0 predictions on what looks like a perfectly fine sketch in Windows Photos. The backend now composites alpha→white at decode time (`backend/app/models/inference.py`).
2. **Per-class confidence thresholds** (in `inference.py`): `card=0.03`, `navbar/footer/section=0.20`. Single global threshold can't fit both calibrations because card confidence is structurally lower than container confidence.
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

| LLM                | Purpose                                          | Status                        |
| ------------------ | ------------------------------------------------ | ----------------------------- |
| **Gemini 2.5 Pro** | Initial code generation from detected components | ✅ Integrated (commit 2bb44ed) |
| **Gemini Flash**   | Fallback if 2.5 Pro is slow                      | ✅ Available as fallback      |
| **OpenRouter**     | Chat-based code refinement ONLY                  | ✅ Already working            |

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

- Canvas drawing interface (Konva.js)
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

### ⚠️ Partially Done

- Dashboard project management — card actions present, polish ongoing
- Sketch detection accuracy — Roboflow integrated, but `card`
  precision is structurally low (58% — see Shahwaiz section);
  synthesis heuristics compensate but don't replace better training

### ❌ Not Started / In Progress

- B1: DB schema unification (Bilal — most critical)
- B5/B6: Framework selector + Export as ZIP (Bilal)
- B9: CI/CD pipeline (Bilal)
- M6: Onboarding flow (Maarij)
- M11: Dark mode (Maarij)
- M12: Mobile responsiveness (Maarij)
- M13: Animations beyond canvas chrome (Maarij)

---

## Key Files Map

### Frontend — canvas chrome (post-redesign)

| File                                          | Purpose                                                 |
| --------------------------------------------- | ------------------------------------------------------- |
| `src/app/canvas/page.tsx`                     | Orchestrator: composes chrome, owns detection trigger   |
| `src/components/canvas/SketchCanvas.tsx`      | Konva drawing surface                                   |
| `src/components/canvas/SketchCanvasWithHistory.tsx` | Drawing surface + undo/redo wiring                |
| `src/components/canvas/CanvasSurface.tsx`     | Dot-grid workspace + empty-state hint                   |
| `src/components/canvas/FloatingToolbar.tsx`   | Tool picker (select/pen/shapes/erase) w/ shortcuts      |
| `src/components/canvas/StyleRibbon.tsx`       | Stroke / fill / width / opacity controls                |
| `src/components/canvas/ZoomPill.tsx`          | Zoom presets + fit-to-screen                            |
| `src/components/canvas/ChatInterface.tsx`     | OpenRouter chat refinement panel                        |
| `src/components/canvas/LivePreview.tsx`       | Code → live preview iframe                              |
| `src/types/canvas.ts`                         | Canonical `Tool`, `Mode`, zoom constants, `TOOL_KEY_MAP` |
| `src/hooks/useCanvasShortcuts.ts`             | Keyboard shortcut handler for canvas page               |
| `src/components/ui/Toast.tsx`                 | App-wide toast provider                                 |

### Frontend — data + routes

| File                                     | Purpose                                            |
| ---------------------------------------- | -------------------------------------------------- |
| `src/app/api/generate-code/route.ts`     | Proxy to FastAPI; OpenRouter routing               |
| `src/hooks/useProjectSave.ts`            | Project CRUD (canonical schema)                    |
| `src/hooks/useVersionHistory.ts`         | Iterations table queries                           |

### Backend

| File                                     | Purpose                                            |
| ---------------------------------------- | -------------------------------------------------- |
| `backend/main.py`                        | FastAPI server, `/api/predict`, text-attachment + synthesis helpers |
| `backend/app/models/inference.py`        | `SketchDetector`, `CodeGenerator`, `_build_gemini_prompt`, `generate_with_gemini` — Roboflow + Gemini both live here |
| `backend/debug/last_sketch.png`          | Runtime debug dump when `DEBUG_AI_PROMPT=on` (gitignored) |

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
- M4: Polish project card actions
- M5: Add empty states (canvas has one — extend to dashboard)
- M6: Build onboarding flow
- ✅ M7: Settings/profile page — landed
- M8: Error boundaries
- M9: Loading skeletons
- ✅ M10: Toast notifications — done (`src/components/ui/Toast.tsx`)
- M11: Dark mode
- M12: Mobile responsiveness
- M13: Animations (canvas chrome already animated — rest of app pending)
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
12. **Oversized containers list children positionally** — any
    container >= 55% of canvas area gets its text annotations listed
    by position rather than joined, so giant page-level rectangles
    don't swallow labels.
13. **Canvas types are centralised** in `src/types/canvas.ts` —
    `Tool`, `ToolGroup`, `Mode`, `RightPanel`, `CodeViewMode`,
    `ZOOM_*` constants, `TOOL_KEY_MAP`. Don't redefine these locally.
14. **Runtime debug artifacts** (`backend/debug/`) are gitignored —
    don't check them in.

---

## Recent Work (most recent first)

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
