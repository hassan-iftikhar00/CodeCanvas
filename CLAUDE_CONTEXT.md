# CodeCanvas — Claude Context File

> Read this file before helping with any task.
> This is a FYP (Final Year Project) at a university.
> Last updated: April 2026

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

Step 2: User clicks "Run Detection"
        File: src/app/canvas/page.tsx (handleRunDetection)

Step 3: Sketch image sent to FastAPI backend
        File: src/app/api/generate-code/route.ts

Step 4: FastAPI calls Roboflow API
        File: backend/app/models/inference.py (SketchDetector)
        Returns: [navbar, section, card, footer] with positions

Step 5: Detected components sorted top-to-bottom
        Then sent to Gemini API with a prompt

Step 6: Gemini generates React + Tailwind code
        File: backend/code_generator.py (CodeGenerator)

Step 7: Code returned to frontend and displayed
        File: src/app/canvas/page.tsx (code panel)

Step 8: User can refine code via chat
        File: src/app/api/generate-code/route.ts
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
| **Gemini 2.5 Pro** | Initial code generation from detected components | 🔴 To be integrated (Task H4) |
| **Gemini Flash**   | Fallback if 2.5 Pro is slow                      | 🔴 To be integrated           |
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
- User authentication (Supabase)
- Project save/load (partially broken schema — Bilal fixing)
- OpenRouter chat refinement
- Fallback template-based code generation
- Database setup and migrations
- Version history UI

### ⚠️ Partially Done

- Sketch detection (fallback works, Roboflow not yet integrated)
- Code generation (templates work, Gemini not yet integrated)
- Dashboard project management (rename handler is empty)
- Frontend hooks (wrong DB column names)

### ❌ Not Started / In Progress

- H4: Roboflow + Gemini integration (Hassan's task)
- B1: DB schema unification (Bilal)
- M3: Project rename implementation (Maarij)
- CI/CD pipeline (Bilal)
- Onboarding flow (Maarij)
- Settings/profile page (Maarij)
- Dark mode (Maarij)
- Export as ZIP (Bilal)
- Framework selector (Bilal)

---

## Key Files Map

| File                                     | Purpose                                            |
| ---------------------------------------- | -------------------------------------------------- |
| `src/app/canvas/page.tsx`                | Main canvas page, detection trigger                |
| `src/app/api/generate-code/route.ts`     | API route, OpenRouter integration                  |
| `src/components/canvas/SketchCanvas.tsx` | Drawing canvas component                           |
| `src/hooks/useProjectSave.ts`            | Save project to DB (schema broken — Maarij fixing) |
| `src/hooks/useVersionHistory.ts`         | Version management (schema broken — Maarij fixing) |
| `backend/main.py`                        | FastAPI server, main endpoints                     |
| `backend/app/models/inference.py`        | Detection + generation logic                       |
| `backend/code_generator.py`              | Gemini code generation (to be created)             |

---

## Current Task Assignments

### Hassan (Lead) — DO THESE ONLY

- **H4:** Integrate Roboflow detection + Gemini code generation
  - Update inference.py with Roboflow SDK
  - Create code_generator.py with Gemini
  - Update main.py endpoint
  - Test end-to-end pipeline
- **Final:** Integrate everything when all parts ready

### Maarij (Frontend) — DO NOT REASSIGN

- M1: Fix useProjectSave.ts column names
- M2: Fix useVersionHistory.ts → iterations
- M3: Implement project rename handler
- M4: Polish project card actions
- M5: Add empty states
- M6: Build onboarding flow
- M7: Settings/profile page
- M8: Error boundaries
- M9: Loading skeletons
- M10: Toast notifications
- M11: Dark mode
- M12: Mobile responsiveness
- M13: Animations
- M14: Keyboard shortcuts
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
Roboflow:      https://serverless.roboflow.com
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
