# CodeCanvas — PROJECT_CONTEXT (single source of truth for documentation)

> Purpose: one file documentation writers work from. Everything here is derived from the code in this repository as of the read date below. Every figure carries a `[source]` tag.
> Generated: 2026-07-17 (from code read, not from prior docs).
> Ground-truth rule: code wins over markdown. Where a doc claim conflicts with code, a line marked `DOC CONFLICT:` records it.
> Tag legend: `[file]` = read directly from that file; `[migration NNN]` = from that SQL migration; `[git]` = from git; `[CLAUDE.md claim, unverified]` = asserted in markdown, not verifiable from code/committed output; `[committed output]` = a value present in a committed artifact.

---

## 1. Product summary

CodeCanvas is a sketch-to-code web app: a user draws a UI wireframe on a canvas (or uploads an image of one), a trained object-detection model locates the UI regions, and Google Gemini turns those regions plus any text into production-ready frontend code that is shown live next to the canvas. Input modes: (a) canvas drawing (Konva.js), (b) uploaded photo of a hand sketch (`upload-photo`), (c) uploaded clean digital wireframe (`upload-clean`). An optional human-in-the-loop (HITL) review step lets the user correct detections before generation. Output frameworks: React + Tailwind (default), standalone HTML + Tailwind CDN, Vue 3 SFC. [backend/main.py, backend/app/models/inference.py, src/app/canvas/page.tsx]

---

## 2. Tech stack (versions from lockfiles/manifests)

### Frontend dependencies [package.json]
| Package | Version | Role |
|---|---|---|
| next | 16.1.1 | App Router framework (README says "Next.js 16"; CLAUDE.md says "Next.js 14") |
| react / react-dom | 19.2.3 | UI runtime |
| typescript | ^5 | Language |
| tailwindcss / @tailwindcss/postcss | ^4 | Styling |
| konva | ^10.0.12 | Canvas drawing engine |
| react-konva | ^19.2.1 | React bindings for Konva |
| @monaco-editor/react | ^4.7.0 | Code editor panel |
| monaco-editor | ^0.52.2 | Editor core |
| @supabase/supabase-js | ^2.91.0 | Supabase client |
| @supabase/ssr | ^0.8.0 | Cookie-based auth for Next.js SSR |
| jszip | ^3.10.1 | Export-as-ZIP |
| lucide-react | ^0.574.0 | Icons |
| motion | ^12.26.2 | Animations |
| gsap / @gsap/react | ^3.14.2 / ^2.1.2 | Animations |
| three / @react-three/fiber / ogl / postprocessing | ^0.182.0 / ^9.5.0 / ^1.0.11 / ^6.38.2 | Landing/visual effects |
| face-api.js | ^0.22.2 | Present in deps (usage not audited) |
| clsx / tailwind-merge / date-fns | ^2.1.1 / ^3.4.0 / ^4.1.0 | Utilities |

DOC CONFLICT: CLAUDE.md Tech Stack says "Next.js 14 (App Router)"; package.json pins `next@16.1.1` and README says Next.js 16.

### Backend dependencies [backend/requirements.txt]
| Package | Version | Role |
|---|---|---|
| fastapi | 0.115.6 | API server |
| uvicorn[standard] | 0.34.0 | ASGI server (port 8000) |
| pydantic | 2.10.6 | Request/response models |
| python-dotenv | 1.0.1 | .env loading |
| supabase | 2.12.0 | DB/auth/storage client (service role) |
| numpy | 2.2.6 | Arrays / image math |
| opencv-python-headless | 4.10.0.84 | Preprocessing, Canny line-art |
| pillow | 11.1.0 | Image decode/composite |
| inference-sdk | 0.64.8 | Roboflow hosted inference client |
| google-generativeai | 0.8.3 | Gemini client |
| playwright | 1.49.1 | Headless render for fidelity (optional at runtime) |

### Dev/test dependencies
| Package | Version | Side | Source |
|---|---|---|---|
| vitest | ^4.1.9 | frontend | [package.json] |
| eslint | ^9 (+ eslint-config-next 16.1.1, eslint-config-prettier, eslint-plugin-prettier) | frontend | [package.json] |
| prettier | ^3.7.4 | frontend | [package.json] |
| husky | ^9.1.7 + lint-staged ^16.2.7 | frontend | [package.json] |
| puppeteer | ^25.1.0 | frontend (dev, capture-ui) | [package.json] |
| pytest | 8.3.4 | backend | [backend/requirements-dev.txt] |
| pnpm | 10.28.0 (packageManager) | tooling | [package.json] |

### External services
| Service | Role | Source |
|---|---|---|
| Supabase | Auth (incl. Google OAuth), PostgreSQL, Storage buckets. Frontend uses anon key + SSR cookies; backend uses service-role key. | [src/lib/supabase/*, backend/app/supabase_client.py, migrations] |
| Roboflow (detect.roboflow.com) | Hosted object detection, model `object-detection-4affw/4`, via inference-sdk. API URL default `https://detect.roboflow.com` (NOT serverless). | [backend/app/models/inference.py, .env.local] |
| Google Gemini (generativelanguage API) | Code generation + chat refine + repair + annotate, via multi-key rotation pool. Model ladder default `gemini-3.5-flash,gemini-3-flash-preview,gemini-2.5-flash`. | [inference.py, scripts/check_gemini_keys.py] |
| Vercel | Frontend host implied by proxy maxDuration/Hobby comments (`maxDuration=60`, 60s Hobby cap). No vercel.json in repo. | [src/app/api/generate-code/route.ts comments] |
| Render | Backend host referenced in CLAUDE.md ("deployed Render backend"). No render config file in repo. | [CLAUDE.md claim, unverified] |
| StackBlitz | "Open in StackBlitz" export via form-POST to their POST API (no SDK). | [src/lib/open-in-stackblitz.ts, CLAUDE.md] |

GAP: no committed Vercel/Render config files; deployment platform is inferred from code comments and prose only.

---

## 3. Feature inventory (as implemented)

| Feature | What it does | Entry point file(s) | Backend endpoint(s) | Status |
|---|---|---|---|---|
| Canvas drawing + tools | Konva surface; tools select/hand/pen/line/rectangle/button/text/erase/bin | src/components/canvas/SketchCanvas.tsx, SketchCanvasWithHistory.tsx, FloatingToolbar.tsx, src/types/canvas.ts | none | Done |
| Keyboard shortcuts | Tool hotkeys (v/h/p/n/r/b/t/e/x), undo/redo | src/hooks/useCanvasShortcuts.ts, useHistory.ts, TOOL_KEY_MAP in src/types/canvas.ts | none | Done |
| Undo/redo + per-screen history | Page owns Ctrl+Z/Y; useHistory reset/applyState; per-screen stacks | src/hooks/useHistory.ts, src/app/canvas/page.tsx | none | Done |
| Upload image (photo/clean) | Upload sketch photo or digital wireframe instead of drawing | src/components/canvas/UploadSketchModal.tsx, UploadedSketchPanel.tsx, page.tsx (`runGeneration`) | /api/predict (sketchSource) , /api/detect | Done |
| HITL detection review | Relabel/delete/draw detection boxes before generation | src/components/canvas/DetectionReviewOverlay.tsx | /api/detect then /api/predict (correctedElements) | Done |
| Code generation (React/HTML/Vue) | Detected elements + text to code via Gemini | page.tsx `runGeneration`, CanvasTopBar.tsx (framework pill) | /api/predict | Done |
| Chat refinement | Natural-language edit of current code | src/components/canvas/ChatInterface.tsx | /api/predict (mode="chat") | Done |
| Live preview + device frames | Render code in iframe; Fit/Desktop(1440x900)/Tablet(768x1024)/Mobile(390x844) | src/components/canvas/LivePreview.tsx, src/lib/preview-doc.ts | none | Done |
| Inspect mode (element to code) | Toggle; click preview element highlights code | LivePreview.tsx (inspectMode), MonacoCodeEditor.tsx (revealAndFlash) | none | Done |
| Element to code linker chips | `data-cc-id="cc-N"` chips highlight in preview + code | page.tsx detection strip, preview-doc.ts, MonacoCodeEditor.tsx | none (contract enforced in prompt) | Done |
| Incremental regeneration | Diff old/new detections; patch prompt instead of full regen | page.tsx (previousCode/previousElements) | /api/predict (diff logic in main.py + inference.py) | Done (backend logic verified; live smoke pending per CLAUDE.md) |
| Fidelity score | Re-render + re-detect + score generation | page.tsx (scoreFidelity), detection strip badge | /api/fidelity | Done (Playwright optional; 503 if absent) |
| Auto-repair | One corrective Gemini pass when score < 0.8 | page.tsx (needsRepair, allowRepair) | /api/repair | Done |
| Annotate-on-render | Draw markup on preview + instruction to edit marked area | LivePreview.tsx handleApplyAnnotation | /api/annotate | Done |
| Version history + rollback | Iterations list, restore code + canvas | src/hooks/useVersionHistory.ts, DraftingToolbox.tsx | (persisted by /api/predict etc.) | Done |
| Version diff viewer | Side-by-side A/B previews + LCS line diff | src/components/canvas/VersionCompareModal.tsx, src/lib/code-diff.ts | none | Done |
| Share link | Toggle `is_public`; public viewer /p/[id] | src/components/ShareDialog.tsx, src/app/p/[id]/page.tsx | /api/shared/[id] | Done |
| Brand kit | Per-project color+font tokens applied to generation | src/components/canvas/BrandKitModal.tsx | /api/predict (brandKit) | Done |
| Export ZIP | Vite+React scaffold or single HTML zip | src/lib/export-zip.ts, src/components/ExportDialog.tsx | none (client-side JSZip) | Done |
| Open in StackBlitz | Form-POST project to StackBlitz | src/lib/open-in-stackblitz.ts, CanvasTopBar.tsx (split button), ExportDialog.tsx | none | Done |
| Multi-screen | Per-screen snapshots; NAVIGATION prompt block wires nav elements | page.tsx, src/components/canvas/ScreenTabs.tsx | /api/predict (screens/currentScreen) | Done |
| Dashboard + thumbnails + delete | Project cards, SVG/upload thumbnails, delete | src/app/dashboard, src/components/dashboard, src/components/SketchThumbnail.tsx | none (Supabase direct + delete_project RPC) | Done |
| Auth | Supabase email + Google OAuth; SSR cookie sessions | src/app/auth, src/proxy.ts, src/app/auth/callback/route.ts | /api/auth/user, /api/auth/signout | Done |
| Profile | View/edit profile, avatar upload | src/app/profile, src/components/profile, src/app/api/profile, /api/upload-avatar | (Supabase) | Done |
| Onboarding tour | First-run tour; `profiles.onboarding_completed` | src/components/onboarding | none | Done [migration 20260516000001] |
| Dark mode | `data-theme` on html, FOUC prevention | src/components/theme, globals.css | none | Done |
| Account deletion | Delete storage + auth user (cascade) | src/components/profile/DeleteAccountModal.tsx | /api/account/delete | Done |
| Model control panel | Hidden Ctrl+Shift+G: AUTO/BEST/SAVER, key grid, auto-repair toggle | src/components/canvas/ModelControlPanel.tsx | /api/llm-status | Done |

Additional code present not on the request list: `src/app/demo`, `src/app/design-preview`, `src/app/design-preview-v2`, `src/app/design-system` (static mockup/design pages, eslint-exempted in eslint.config.mjs); `src/components/canvas/TemplatesPanel.tsx` + `ComponentPalette.tsx` (drag-in templates via `componentGroups`); `TipsTicker.tsx`, `StatusBar.tsx`, `GenerationProgress.tsx`.

---

## 4. Complete API surface

### FastAPI endpoints [backend/main.py]
| Method | Path | Purpose | Key request fields | Response fields | Auth | Rate limit | Timeout |
|---|---|---|---|---|---|---|---|
| GET | / | Health/root | - | status, service, models_loaded | none | no | - |
| GET | /health | Detailed health | - | status, sketch_detector, code_generator | none | no | - |
| GET | /api/llm-status | Gemini pool status | - | ladder[], keys[{slot,env,last_success_ts,models{cooldown_remaining_s,success_count_today}}] | via proxy | no | - |
| POST | /api/predict | Sketch-to-code + chat | canvasData, framework, styling, projectId, userId, mode(generate/chat), messages, currentCode, sketchImage, textAnnotations, sketchSource, correctedElements, detectionCorrections, brandKit, previousCode, previousElements, screens, currentScreen, forceModel | code, success, detectedElements[], message, iteration_id, usedFallback, timing_ms, usedIncremental | userId (proxy-stamped) | yes (per-user) | Gemini 110s (GEMINI_TIMEOUT_SECONDS); Roboflow 60s |
| POST | /api/detect | Detection only (HITL) | projectId, userId, sketchImage, sketchSource, width, height | success, elements[], imageWidth, imageHeight, previewImage, timing_ms | userId | yes (shared limiter) | Roboflow 60s |
| POST | /api/fidelity | Score a generation | projectId, userId, code, framework, elements[], width, height | success, score, report{score,counts{tp,fp,fn},per_class,matched,missing,extra}, timing_ms | userId | yes (shared) | render 30s + settle; 503 if Playwright missing; FIDELITY_ENABLED kill switch |
| POST | /api/repair | One corrective Gemini pass | projectId, userId, code, framework, missing[], extra[], width, height, forceModel | success, code, iteration_id, message | userId | yes (shared) | Gemini 110s |
| POST | /api/annotate | Apply markup instruction | projectId, userId, code, framework, note, targets[], region, width, height, forceModel | success, code, iteration_id, message | userId | yes (shared) | Gemini 110s |

Notes: request body cap 20 MB (BodySizeLimitMiddleware). CORS allows localhost:3000/3001 + FRONTEND_URL, methods GET/POST/OPTIONS. Ownership enforced by `load_project_or_403` (project must match userId). Repair has two extra sanity guards: reject if output < 50% of input length (422), reject if it introduces literal detector-class stub text (422).

### Next.js API routes (proxies + direct) [src/app/api/**/route.ts]
| Method | Path | Proxies to / does | maxDuration / proxy timeout | Auth |
|---|---|---|---|---|
| POST | /api/generate-code | -> FastAPI /api/predict; stamps user.id | maxDuration 60; FASTAPI_PROXY_TIMEOUT_MS default 58000 | Supabase getUser |
| POST | /api/detect | -> /api/detect | maxDuration 60; 55000 abort | Supabase getUser |
| POST | /api/fidelity | -> /api/fidelity | maxDuration 60; 55000 abort | Supabase getUser |
| POST | /api/repair | -> /api/repair | FASTAPI_PROXY_TIMEOUT_MS default 120000 | Supabase getUser |
| POST | /api/annotate | -> /api/annotate | FASTAPI_PROXY_TIMEOUT_MS default 120000 | Supabase getUser |
| GET | /api/llm-status | -> /api/llm-status (no-store) | maxDuration 15; 10000 abort | Supabase getUser |
| GET | /api/shared/[id] | Public project read via service-role, explicit is_public; UUID-validated; 404 leaks nothing | - | none (public), admin client |
| POST | /api/account/delete | Deletes storage objects (avatars/sketch-exports/project-assets) + admin.deleteUser (cascade) | - | Supabase getUser (userId from JWT only) |
| GET | /api/auth/user | Returns current user or 401 | - | Supabase getUser |
| (route) | /api/auth/signout | Sign out | - | Supabase |
| (route) | /api/profile | Profile read/update | - | Supabase |
| (route) | /api/upload-avatar | Avatar upload | - | Supabase |

Base endpoint resolution: proxies use `process.env.FASTAPI_URL` (default `http://localhost:8000/api/predict`) and rewrite the path; per-endpoint overrides exist (FASTAPI_DETECT_URL, FASTAPI_FIDELITY_URL, FASTAPI_REPAIR_URL, FASTAPI_ANNOTATE_URL, FASTAPI_LLM_STATUS_URL).

---

## 5. Database schema (from migrations)

Migrations in `supabase/migrations/`, run in filename order.

### Tables
**profiles** [migration 20260122000001, +20260516000001]
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | REFERENCES auth.users(id) ON DELETE CASCADE |
| email | TEXT | |
| full_name | TEXT | |
| avatar_url | TEXT | |
| onboarding_completed | BOOLEAN NOT NULL DEFAULT false | added by 20260516000001 |
| created_at / updated_at | TIMESTAMPTZ DEFAULT NOW() | updated_at auto-touched by trigger |

**projects** [migration 20260122000001, +20260430000001, +20260705000001]
| Column | Type | Notes |
|---|---|---|
| id | UUID PK DEFAULT gen_random_uuid() | |
| user_id | UUID NOT NULL | REFERENCES profiles(id) ON DELETE CASCADE |
| title | TEXT NOT NULL DEFAULT 'Untitled Project' | canonical (renamed from `name` by 20260430000001) |
| description | TEXT | |
| canvas_data | JSONB NOT NULL DEFAULT '{"strokes":[],"elements":[]}' | |
| generated_code | TEXT | |
| framework | TEXT DEFAULT 'react' | |
| is_public | BOOLEAN DEFAULT FALSE | share link |
| thumbnail_url | TEXT | canonical (renamed from `thumbnail`) |
| brand_kit | JSONB | added by 20260705000001; NULL = none |
| created_at / updated_at | TIMESTAMPTZ DEFAULT NOW() | |

**iterations** [migration 20260122000001, +20260430000001] (renamed from legacy `project_versions`)
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| project_id | UUID NOT NULL | REFERENCES projects(id) ON DELETE CASCADE |
| version_number | INTEGER NOT NULL | auto-set by trigger set_iteration_version (max+1) |
| canvas_data | JSONB NOT NULL | |
| generated_code | TEXT NOT NULL | |
| prompt_used | TEXT | |
| created_at | TIMESTAMPTZ DEFAULT NOW() | |

**canvas_snapshots** [migration 20260122000001]
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| project_id | UUID NOT NULL | CASCADE |
| snapshot_url | TEXT NOT NULL | |
| snapshot_type | TEXT CHECK in ('png','svg') DEFAULT 'png' | |
| created_at | TIMESTAMPTZ | |

**detection_corrections** [migration 20260704000001] (HITL audit log)
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| project_id | UUID NOT NULL | CASCADE |
| user_id | UUID NOT NULL | REFERENCES auth.users(id) CASCADE |
| action | TEXT NOT NULL CHECK in ('relabel','delete','add') | |
| element_type | TEXT | class after action |
| previous_type | TEXT | class before relabel |
| bounds | JSONB | {x,y,width,height} in sketch-image px |
| created_at | TIMESTAMPTZ NOT NULL DEFAULT now() | |

Indexes: idx_projects_user_id, idx_projects_created_at, idx_iterations_project_id, idx_iterations_version, idx_snapshots_project_id, detection_corrections_project_id_idx, detection_corrections_user_id_idx.

### Functions & triggers [migration 20260122000002, 20260430000001, 20260515000001]
- `update_updated_at_column()` + triggers on profiles, projects (touch updated_at).
- `set_iteration_version()` + trigger auto_set_iteration_version (auto version_number).
- `handle_new_user()` SECURITY DEFINER + trigger on_auth_user_created (creates profile row from auth.users metadata).
- `delete_project(project_id uuid)` SECURITY INVOKER: deletes iterations then project; granted to authenticated [20260515000001].

### RLS [migration 20260122000003, 20260430000001, 20260515000002, 20260704000001]
- RLS enabled on profiles, projects, iterations, canvas_snapshots, detection_corrections.
- profiles: owner select/update/insert (auth.uid()=id).
- projects: owner select/insert/update/delete; PLUS "Public projects viewable by everyone" (is_public=TRUE).
- iterations: owner select/insert/delete; PLUS public-project iterations select. delete policy added by 20260515000002.
- canvas_snapshots: owner select/insert; PLUS public-project snapshots select.
- detection_corrections: owner select only (writes come from service-role backend, bypassing RLS).

### Storage buckets (RLS policies; buckets created via Dashboard/CLI, not SQL) [migration 20260122000004, 20260122000005]
| Bucket | Access | Source |
|---|---|---|
| sketch-exports | owner insert/select/delete by folder=userId; public-project select via thumbnail_url match | 20260122000004 |
| project-assets | owner insert/select/delete by folder=userId | 20260122000004 |
| avatars | owner insert/update/delete by folder=userId; anyone select (public) | 20260122000005 |

DOC CONFLICT: README lists only migrations 1-5 to run; the repo also contains 20260430000001, 20260515000001/2, 20260516000001, 20260704000001, 20260705000001 which are required for the current schema (title/thumbnail_url/iterations, delete_project, onboarding, detection_corrections, brand_kit). Documentation must run all 11.

---

## 6. Auth flow (step by step)

1. User visits a protected route (`/canvas` or `/dashboard`). `src/proxy.ts` (Next.js middleware; matcher excludes static/_next) creates an SSR Supabase client from cookies, calls `supabase.auth.getUser()`. No user + protected route -> redirect `/auth/login`. Logged-in user on an auth page -> redirect `/dashboard`. [src/proxy.ts]
2. On the login page the user signs in with email/password or Google OAuth (Supabase Auth UI/client). OAuth provider configured: Google (avatar handling per Decision #18). [CLAUDE.md; provider list not in repo config -> GAP].
3. OAuth returns to `src/app/auth/callback/route.ts`: reads `code`, exchanges via `supabase.auth.exchangeCodeForSession(code)`. Cookies are collected synchronously into `pendingCookies` (no Promise deadlock); a `setTimeout(0)` yields the event loop so @supabase/ssr 0.8.0's async onAuthStateChange can populate cookies before the redirect is built. Sets cookies on the redirect response. [src/app/auth/callback/route.ts]
4. On signup, the Postgres trigger `on_auth_user_created` -> `handle_new_user()` inserts a `profiles` row from auth.users metadata (email, full_name, avatar_url). [migration 20260122000002]
5. Client and server both read session from cookies. `src/lib/supabase/{client,server,admin}.ts` provide anon client, SSR server client, and service-role admin client respectively. [src/lib/supabase/]
6. Authenticated backend call: browser calls a Next.js proxy route (e.g. `/api/generate-code`). The route calls `createClient()` + `getUser()`; on 401 returns Unauthorized; otherwise forwards to FastAPI with `userId: user.id` injected into the body. FastAPI never trusts a client-supplied userId for anything except this proxy-stamped value. `load_project_or_403` enforces the project belongs to that user. [src/app/api/generate-code/route.ts, backend/main.py]
7. Account deletion: `/api/account/delete` derives userId from the JWT only, deletes storage objects in avatars/sketch-exports/project-assets (non-fatal on failure), then `admin.auth.admin.deleteUser(userId)` which cascades auth.users -> profiles -> projects -> iterations -> canvas_snapshots. [src/app/api/account/delete/route.ts]

---

## 7. AI pipeline end to end

Numbered stages from user action to code on screen. Path differences noted per stage: [C]=canvas draw, [P]=upload-photo, [U]=upload-clean, [H]=HITL-reviewed.

1. Trigger. [C] user clicks Run Detection; sketch exported to PNG (transparent bg) + text annotations pre-transformed into image pixel space. [P/U] user uploads image via UploadSketchModal; `sketchSource` set. [H] user first hits /api/detect, reviews boxes, then /api/predict with `correctedElements`. Files: src/app/canvas/page.tsx (`runGeneration`), UploadSketchModal.tsx, DetectionReviewOverlay.tsx.
2. Proxy. /api/generate-code (or /api/detect) authenticates and stamps userId, forwards to FastAPI. [src/app/api/generate-code/route.ts]
3. Rate limit + auth + cache. main.py `predict`: per-user sliding-window limiter (`_rate_limit_key` -> user:<id>); `load_project_or_403`; cache lookup via `_generation_cache_key` (sha256 of sketch first-16-hex + framework + source + annotations-hash + brandkit-hash + screen-hash + forceModel). Cache bypassed when correctedElements or previousCode present. HITL corrections logged fire-and-forget to detection_corrections. [backend/main.py]
4. Image decode/composite. `detect_with_roboflow`: base64 decode; RGBA composited onto WHITE (transparent->black bug fix). [P] `preprocess_uploaded_photo(binarize=True)` (median blur + adaptive threshold + morphological open + content crop). [U] `preprocess_uploaded_photo(binarize=False)` (Otsu-mask crop only). For [P/U] a non-binarized clean copy is kept with identical crop geometry for Gemini text reading. [inference.py, app/utils/preprocessing.py]
5. Roboflow call. `client.infer(pil_image, model_id)` with server confidence floor set to 0.05 (default ~0.4 hides cards); up to ROBOFLOW_MAX_RETRIES=3 attempts with 1s then 2s backoff; non-retryable on credit/401/403/unauthorized/forbidden. [H] skips this entirely (corrected set is authoritative). [inference.py]
6. Post-detection filtering [inference.py]:
   - Pass 1: convert predictions, per-class confidence thresholds (card/navbar/footer/section all 0.20 for v4; env override `ROBOFLOW_CONFIDENCE_THRESHOLD_<CLASS>`), oversize-card guard (drop card > 85% of image area).
   - Pass 2: class-aware NMS (same-class IoU > 0.5 suppressed; cross-class kept = hierarchy).
   - Pass 3: `_drop_container_shadow_cards` (drop a card with IoU >= 0.8 vs a navbar/footer/section = cross-class shadow duplicate).
   - `snap_positional_bars` (navbar/footer snapped to top/bottom third by center-y).
   - `sort_reading_order` (top-to-bottom; consecutive same-row card runs re-sorted left-to-right).
7. Container synthesis [C/P/U only; skipped for H] `_synthesize_missing_containers` (main.py): reclassify misplaced top/bottom bars; synthesize a navbar/footer when a band has >= 2 unattached text annotations and/or orphan cards; marked `attributes.synthetic=True`.
8. Text annotation attach. `_attach_text_annotations` (main.py): single match -> `label_text`; 2+ matches on one element -> `positioned_texts` list (no concatenation). Match rule: >= 50% area overlap, or center-point containment; smallest enclosing element wins. Unmatched -> extra_text.
9. Role inference + alignment. `annotate_role_hints` + `annotate_alignment` (app/utils/role_inference.py): stamps `role_hint`/`role_hint_firm`/`role_hint_reason` (input/button/image placeholder/nav item/sidebar link/container group box) from label keywords, container position, aspect ratio, wrapping; and `child_alignment` (left/center/right/space-between/stacked) from drawn item positions. Firm hints become `RENDER AS:`, shape-only become `likely:`.
10. Incremental decision [when previousCode+previousElements present, INCREMENTAL_ENABLED=true]. `_previous_code_is_degenerate` guard: reject base if cc-id coverage < 60% of previous elements OR it contains literal class stubs (`>Card<` etc.). `diff_detection_sets` aligns old->new pixel space via median class size ratios + median center deltas (not envelope normalization), greedy per-class IoU (threshold 0.4). Zero delta -> return previous code, NO Gemini call. Delta <= max(4, len/2) with >=1 match -> `build_incremental_prompt` patch. Larger -> full regen. [main.py, inference.py]
11. Prompt building. `_build_gemini_prompt` (inference.py): components in reading order; STRICT FIDELITY directive (render only detected + annotated, invent nothing); brand kit block (colors/typography only); RESPONSIVE BEHAVIOUR block (mobile-first, no hiding/hamburgers); MULTI-SCREEN NAVIGATION block (window.ccNavigate) when 2+ screens; image block (READ text off attached image) when has_image; `data-cc-id="cc-N"` stamping contract (1-based order matches detected list).
12. Gemini call. `generate_with_gemini` (inference.py): key pool = `GEMINI_API_KEY` + `GEMINI_API_KEY_2..N`, sorted by suffix. Model ladder `GEMINI_MODELS` (default gemini-3.5-flash, gemini-3-flash-preview, gemini-2.5-flash). Per-(key,model) cooldowns: per_minute/ambiguous -> 60s, per_day -> 86400s. `force_model` restricts to one model (unknown falls back to full ladder). generation_config `temperature=0.1, top_p=0.8`. [P/U] processed image attached as multimodal part (`[prompt, image]`); [C] text-only. Empty/all-cooled -> GeminiRateLimited/GeminiQuotaExhausted. Code fences stripped. [inference.py]
13. Persistence. `persist_generation_result`: insert into iterations (auto version_number) + update projects.generated_code/canvas_data. Cache put on successful non-mock/non-fallback Gemini result. Timing logged (`[timing] total/roboflow/gemini`) and returned in `timing_ms`. [main.py]
14. Fidelity scoring [frontend-triggered after generation]. /api/fidelity: `render_code_to_png` (Playwright Chromium in own Proactor loop on Windows; viewport clamped to FIDELITY_VIEWPORT_WIDTH=1440 then upscaled to sketch dims) -> `normalize_render_to_sketch_domain` (Canny edges + dilate + invert = line-art) -> re-run Roboflow -> `score_fidelity`. Four match stages: (1) greedy per-class IoU (threshold 0.25), (2) center-distance flow-drift (<= 6% of diagonal), (3) containment fallback for outline-less containers (>=2 children inside a >=4%-area original), (4) extras suppression (bar text children, implicit section). Score = F1 = 2TP/(2TP+FP+FN). [app/utils/fidelity.py]
15. Auto-repair [frontend, only when score in (0, 0.8)]. /api/repair: `build_repair_prompt` (add missing at positions, remove extras, byte-identical elsewhere) via prompt_override. Guards: score must be > 0 (tp=0 means scoring failed, not code); output rejected if < 50% of input length or if it introduces class-name stub text. Rescore runs with allowRepair=false (exactly one pass). [main.py, page.tsx]
16. Chat refinement [independent path]. /api/predict mode="chat": `build_chat_refine_prompt` -> `generate_with_gemini(prompt_override=...)` same pool. On quota exhaustion, falls back to appending the request as an HTML comment (`usedFallback`). [main.py]

Fallbacks: if Roboflow unavailable/empty, `SketchDetector._fallback_detection` (OpenCV contour heuristics). If Gemini output absent, `CodeGenerator._template_based_generation` (React/HTML/Vue templates). Mock mode via `useMockModelOutput`/`MODEL_OUTPUT_SOURCE=mock`. [inference.py]

---

## 8. AI model training facts

### Versions
| Model | Roboflow ID | Architecture | Trained | Status |
|---|---|---|---|---|
| v2 | object-detection-4affw/2 | YOLOv11 Fast | - | legacy/rollback (card threshold 0.03 if restored) [inference.py comments] |
| v4 | object-detection-4affw/4 | YOLOv11 Small | 2026-06-11, promoted 2026-06-12 | production (`.env.local` ROBOFLOW_MODEL_ID) |

DOC CONFLICT: `.env.example` still sets `ROBOFLOW_MODEL_ID=object-detection-4affw/2`; `.env.local` and code default constant `ROBOFLOW_DEFAULT_MODEL_ID="object-detection-4affw/2"` [inference.py]. Production runs v4 via `.env.local`; the code DEFAULT and the example template still say v2. Docs must state: v4 is production, set via env; v2 is the hardcoded fallback default.

### Classes (YOLO ids, alphabetical) [synthetic_data/generate.py, data.yaml, CLAUDE.md]
| id | class | semantics |
|---|---|---|
| 0 | card | any single content unit (button/text/heading/input/image/icon/link) |
| 1 | footer | bottom horizontal bar (container) |
| 2 | navbar | top horizontal bar (container) |
| 3 | section | middle page body between navbar/footer (container) |

### Dataset composition
| | v2 | v4 |
|---|---|---|
| Total images | 311 (276 train / 17 val / 18 test) | 4,481 (3,690 train / 527 val / 264 test) |
| Real | 311 (23 unique source, rest augmented) | 311 original real |
| Synthetic | 0 | 2,700 [ARCHITECTURE_DETAILS.md] |
| Unaccounted (likely Roboflow auto-augmentation) | - | ~1,470 (repo notes "need to confirm") |
| Annotations (v2) | 221 (card 154 / section 23 / navbar 22 / footer 22) | - |

Source tags: all dataset figures are [ARCHITECTURE_DETAILS.md claim, unverified in code]. Synthetic generator lives in `backend/synthetic_data/` (generate.py v3, layouts/construction/decorations/rough/style/validate/verify). The committed `synthetic_dataset/train/` on disk holds 2,500 images + 2,500 labels [git ls-files shows these are gitignored; counted on disk], data.yaml declares nc=4 names [card,footer,navbar,section] with val/test as train placeholders.

### Training platform/process
Roboflow-hosted training + inference (free-tier workaround, Decision #1). Synthetic images generated locally (`python -m backend.synthetic_data.generate --count 2500 --out dataset`), uploaded to Roboflow train split; real 17 val + 18 test kept for evaluation (sim-to-real protocol; synthetic to train only, Decision #15). Preprocessing: stretch to 640x640, auto-orient; augmentations flip-H, +/-5deg, +/-10% brightness, 2 outputs/example; no noise/blur/contrast aug. [ARCHITECTURE_DETAILS.md, generate.py header]

### Performance metrics (every figure in repo, tagged by source and split)
Roboflow self-reported (provider metrics; Roboflow's own caveat quoted in doc):
| Metric | v2 test | v4 val | v4 test | Source |
|---|---|---|---|---|
| mAP@50 (all) | 80.2% | 98.7% | 98.0% | [ARCHITECTURE_DETAILS.md] |
| Precision | 83.1% | 98.3% | - | [ARCHITECTURE_DETAILS.md] |
| Recall | 79.5% | 97.9% | - | [ARCHITECTURE_DETAILS.md] |
| F1 | 80.3% | 98.1% | - | [ARCHITECTURE_DETAILS.md] |
| card mAP@50 | 58.0% (val) | 98.0% | 98.0% | [ARCHITECTURE_DETAILS.md] |
| footer mAP@50 | 68.0% (val) | 98.0% | 96.0% | [ARCHITECTURE_DETAILS.md] |
| navbar mAP@50 | 82.0% (val) | 99.0% | 99.0% | [ARCHITECTURE_DETAILS.md] |
| section mAP@50 | 78.0% (val) | 99.0% | 99.0% | [ARCHITECTURE_DETAILS.md] |

Locally-verified v4 test set (conf=0.20, IoU=0.5, n=264, run 2026-06-12 via `backend/eval_v4.py`) [ARCHITECTURE_DETAILS.md; eval_v4.py exists in repo, its committed output does not]:
| class | precision | recall |
|---|---|---|
| card | 97.4% | 98.8% |
| footer | 95.1% | 91.7% |
| navbar | 97.0% | 96.2% |
| section | 99.5% | 99.5% |
| macro | 97.2% | 96.5% |

Also thresholds embedded in inference.py comments (measured, uncommitted): v4 at conf=0.20 card P97.4/R98.8, footer P95.1/R91.7, navbar P97.0/R96.2, section P99.5/R99.5 (matches the table above); re-detection confidence collapse at 2329px vs 1440px (navbar 0.07, inputs 0.17 vs 0.92) [fidelity.py comment].

Eval-harness pipeline claim: detection 100% recall / 98.4% precision on 15 synthetic training images [CLAUDE.md claim; eval_pipeline.py exists but writes to gitignored backend/debug/eval/, no committed artifact]. sketch_00001 renders element-for-element correct [CLAUDE.md claim, no artifact].

v2 confusion matrix (validation) present in ARCHITECTURE_DETAILS.md (card 46 FP / 17 FN; footer sometimes -> card; section near-perfect).

FLAG: The v2->v4 gain confounds dataset expansion AND architecture upgrade (Fast->Small); repo explicitly says do not attribute the full 18pp to synthetic data alone (Decision #16). All headline mAP numbers are provider-reported; only the n=264 P/R table has a (referenced, uncommitted) local recomputation.

---

## 9. Deployment and environments

### Local dev [README.md]
Frontend: `pnpm install`; create `.env.local`; `pnpm dev` -> http://localhost:3000. Build: `pnpm build && pnpm start`.
Backend: `cd backend`; `python -m venv venv`; activate; `pip install -r requirements.txt`; `uvicorn main:app --reload --host 0.0.0.0 --port 8000` -> http://localhost:8000 (docs /docs). For fidelity: `pip install playwright && python -m playwright install chromium`. Tests dev deps: `pip install -r requirements-dev.txt`.
DB: run all 11 migrations in `supabase/migrations/` in order via Supabase SQL editor (README lists only the first 5; see Section 5 DOC CONFLICT).

### Production (inferred; no committed platform config)
Frontend on Vercel (proxy code assumes Vercel 60s Hobby function cap; `maxDuration=60`). Backend on Render (CLAUDE.md prose). Frontend->backend via `FASTAPI_URL`. GAP: no vercel.json / render.yaml / Dockerfile in repo; live URLs not in code.

### Environment variables
Frontend/proxy [route files, README]:
| Var | Purpose | Default |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | Supabase project URL | required |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase anon key | required |
| SUPABASE_SERVICE_ROLE_KEY | Admin client (shared/delete routes) | required for those routes |
| NEXT_PUBLIC_SITE_URL | Site URL | http://localhost:3000 |
| FASTAPI_URL | Backend predict endpoint base | http://localhost:8000/api/predict |
| FASTAPI_DETECT_URL / FASTAPI_FIDELITY_URL / FASTAPI_REPAIR_URL / FASTAPI_ANNOTATE_URL / FASTAPI_LLM_STATUS_URL | Per-endpoint overrides | derived from FASTAPI_URL |
| FASTAPI_PROXY_TIMEOUT_MS | Proxy abort ceiling | 58000 (predict) / 120000 (repair, annotate) |

Backend [main.py, inference.py, fidelity.py, .env.example]:
| Var | Purpose | Default |
|---|---|---|
| SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY | DB (service role) | required (startup validates) |
| FRONTEND_URL | CORS allow-origin | http://localhost:3000 |
| ROBOFLOW_API_KEY | Detection | required (startup validates) |
| ROBOFLOW_MODEL_ID | Model | object-detection-4affw/2 (code default); /4 in .env.local |
| ROBOFLOW_API_URL | Inference host | https://detect.roboflow.com |
| ROBOFLOW_CONFIDENCE_THRESHOLD / _CARD/_NAVBAR/_FOOTER/_SECTION | Thresholds | 0.4 global / 0.20 per-class |
| ROBOFLOW_SERVER_CONFIDENCE | Server floor override | 0.05 |
| ROBOFLOW_NMS_IOU | Same-class NMS | 0.5 |
| ROBOFLOW_MAX_RETRIES | Infer attempts | 3 |
| GEMINI_API_KEY / _2.._10 | Code-gen key pool (slot 1 tried first) | required (KEY) |
| GEMINI_MODELS | Model ladder, best first | gemini-3.5-flash,gemini-3-flash-preview,gemini-2.5-flash |
| GEMINI_TIMEOUT_SECONDS | Gemini ceiling | 110 |
| RATE_LIMIT_ENABLED / _MAX_REQUESTS / _WINDOW_SECONDS | Per-user limiter | true / 20 / 60 |
| CACHE_ENABLED / _TTL_SECONDS / _MAX_SIZE | Generation cache | true / 1800 / 50 |
| INCREMENTAL_ENABLED | Delta regen | true |
| FIDELITY_ENABLED | Fidelity kill switch | true |
| FIDELITY_IOU_THRESHOLD | Match threshold | 0.25 |
| FIDELITY_EDGE_MODE | Canny line-art on/off | on |
| FIDELITY_RENDER_SETTLE_MS | Post-load wait | 1200 |
| FIDELITY_VIEWPORT_WIDTH | Render width | 1440 |
| DEBUG_AI_PROMPT | Debug dumps (last_sketch.png, prompts) | off |
| MODEL_OUTPUT_SOURCE | "mock" to bypass Roboflow | unset |

DOC CONFLICT: `.env.example` still shows `ROBOFLOW_MODEL_ID=object-detection-4affw/2` and lacks `GEMINI_MODELS`, `FIDELITY_*`, `CACHE_*`, `RATE_LIMIT_*`, `INCREMENTAL_ENABLED`; it is stale relative to code.

### CI [.github/workflows/ci.yml]
Trigger: push/PR to main. Two parallel jobs.
- frontend (ubuntu-latest): pnpm 10.28.0 + Node 20 (pnpm cache) -> `pnpm install --frozen-lockfile` -> `pnpm exec tsc --noEmit` -> `pnpm lint` -> `pnpm test`.
- backend (ubuntu-latest): Python 3.11 (pip cache) -> `apt-get install -y libgl1` (OpenCV libGL) -> `pip install -r backend/requirements-dev.txt` -> `python -m pytest`.

### Playwright setup
`pip install playwright && python -m playwright install chromium`. Optional: absent -> /api/fidelity returns 503, badge just does not appear. On Windows the render runs in a worker thread with a directly-constructed ProactorEventLoop (uvicorn's selector loop cannot spawn subprocesses). [fidelity.py]

---

## 10. Testing

### Backend (pytest) [backend/tests/]
Total: 270 `def test_` functions across 17 suites [git grep -c].
| Suite | count | covers |
|---|---|---|
| test_fidelity.py | 39 | box matching, 4-stage scoring, HTML wrappers, reclassify/suppress |
| test_role_inference.py | 34 | role hints, alignment, image markers, sidebar/wrapper rules |
| test_synthesis_helpers.py | 28 | container synthesis, text attach, extents |
| test_response_cache.py | 18 | LRU, TTL, thread safety, key stability |
| test_model_ladder.py | 15 | ladder parse, force_model, cooldowns, llm-status |
| test_incremental_guard.py | 14 | degenerate-base guard, class-stub/coverage |
| test_brand_kit.py | 14 | brand kit prompt block, cache key |
| test_incremental.py | 13 | diff_detection_sets, alignment, delta prompt |
| test_hitl.py | 12 | corrected-set path, snap, correction rows |
| test_multiscreen.py | 12 | navigation block, screen cache key |
| test_reading_order.py | 12 | reading-order sort, same-row |
| test_rate_limit.py | 11 | sliding window, isolation, config |
| test_shadow_cards.py | 11 | container-shadow-card dedup |
| test_annotate.py | 10 | annotate prompt, innermost target |
| test_repair_prompt.py | 7 | repair prompt build, position phrase |
| test_element_linker.py | 5 | data-cc-id contract |
| test_canvas_data.py | 3 | passthrough fields survive model_dump |

DOC CONFLICT: CLAUDE.md says "263 total" backend tests; grep of `def test_` counts 270 (as of this read). Discrepancy likely new tests since the doc line was written.

Run: `cd backend && python -m pytest`. conftest.py adds path + conditional cv2 stub. Latest pass state: not runnable in this read session (no execution); CI green implies passing on main [inferred, not verified this session].

### Frontend (Vitest) [vitest.config.ts, src/**/*.test.ts]
Total: 41 tests across 3 suites (`it(`/`test(` count): src/lib/code-diff.test.ts (15), src/lib/export-zip.test.ts (9), src/types/canvas.test.ts (17). Node environment, `@/` alias. Run: `pnpm test`.
DOC CONFLICT: CLAUDE.md says "40 frontend tests"; count is 41.

### Scripts (not tests)
- `backend/scripts/eval_pipeline.py`: two-stage harness. Stage detect scores SketchDetector vs YOLO ground truth (IoU>=0.5, per-class P/R). Stage generate runs full post-detection + Gemini and saves prompt+code per image to backend/debug/eval/<tag>/ (gitignored). Flags: --num, --stage detect|generate|both, --images, --tag. Forces CACHE_ENABLED=false.
- `backend/scripts/check_gemini_keys.py`: pings every GEMINI_API_KEY* on each ladder model via raw REST generateContent; classifies OK/INVALID_KEY/DAILY_EXHAUSTED/RATE_LIMITED/MODEL_UNAVAILABLE/ERROR; masked-key table; `--json`, `--models`, `--timeout`. Last run recorded 2026-07-17: 8/10 keys OK on 3.5-flash, 9/10 on 3-flash-preview, 2/10 on 2.5-flash [Audits/GEMINI_FREE_PLAN.md committed output].

---

## 11. Folder structure (2-3 levels)

```
codecanvas/
  CLAUDE.md                     project brief (may be stale)
  README.md                     local setup (single-source per its own claim)
  package.json / pnpm-lock.yaml frontend manifest + lockfile
  .env.example / .env.local     env templates (example is stale; see Sec 9)
  .github/workflows/ci.yml      CI (frontend + backend jobs)
  eslint.config.mjs             flat config; ignores venv/backend/synthetic/design-preview
  vitest.config.ts              frontend test config
  Audits/                       docs: ARCHITECTURE_DETAILS, REFERENCE_FILE_MAP, COMPLETED_TASKS,
                                APP_UPLIFT_ROADMAP, FYP_FEATURE_ROADMAP, GEMINI_FREE_PLAN, this file
  supabase/migrations/          11 SQL migrations (schema, RLS, functions, storage, features)
  src/
    app/
      canvas/page.tsx           orchestrator (4088 lines) — detection/upload/generation triggers
      api/                      Next.js route handlers (proxies + auth/account/shared)
      auth/ dashboard/ profile/ p/[id]/ demo/ design-preview*/ design-system/
    components/
      canvas/                   ~26 canvas components (LivePreview, DetectionReviewOverlay,
                                ModelControlPanel, ScreenTabs, BrandKitModal, VersionCompareModal, ...)
      auth/ dashboard/ onboarding/ profile/ theme/ ui/ demo/
    hooks/                      useHistory, useProjectSave, useVersionHistory, useCanvasShortcuts
    lib/
      supabase/                 client.ts, server.ts, admin.ts, database.types.ts
      export-zip.ts, open-in-stackblitz.ts, preview-doc.ts, code-diff.ts, dashboard-projects.ts
      drafting-room/            tokens.ts (palette source of truth)
    types/canvas.ts             Tool/Mode/zoom constants, clamp helpers, TOOL_KEY_MAP
    data/ utils/ proxy.ts       middleware (auth gating)
  backend/
    main.py                     FastAPI (2312 lines): endpoints, synthesis, attach, cache, rate-limit
    app/
      models/inference.py       (2166 lines) SketchDetector + CodeGenerator + Roboflow + Gemini + prompts
      utils/                    fidelity.py, preprocessing.py, rate_limit.py, response_cache.py, role_inference.py
      supabase_client.py
    scripts/                    eval_pipeline.py, check_gemini_keys.py
    synthetic_data/             generate.py (v3) + layouts/construction/decorations/rough/style/validate/verify
    tests/                      17 pytest suites (270 tests)
    eval_v4.py                  local v4 test-set P/R recompute (referenced by ARCHITECTURE_DETAILS)
    requirements.txt / requirements-dev.txt
  synthetic_dataset/            data.yaml + train/{images,labels} (2500 each on disk; gitignored)
  ml-training/                  notebooks/01_sketch_detection_cnn.ipynb, utils/data_labeling.py, README
  synthetic_dataset.zip         ~147 MB archived dataset (on disk, not tracked)
```

---

## 12. Numbers bank

| Value | Meaning | Source | Confidence |
|---|---|---|---|
| 270 | backend pytest test functions | git grep `def test_` [backend/tests] | verified in code |
| 41 | frontend Vitest tests | git grep `it(`/`test(` [src/**/*.test.ts] | verified in code |
| 17 / 3 | backend / frontend test suites | file listing | verified in code |
| 61 | commits on main (HEAD) | git log --oneline | wc -l | verified (git) |
| 35+16+8 (Hassan identities), 6 (Maarij), 12 (copilot bot) | commits per author across all refs | git shortlog -sne --all | verified (git); counts span all branches, not just main |
| 2026-01-12 -> 2026-07-17 | first -> last commit date | git log | verified (git) |
| ~37,378 | lines in tracked .ts/.tsx (96 files) | git ls-files + wc -l | verified (git) |
| ~11,956 | lines in tracked .py (39 files) | git ls-files + wc -l | verified (git) |
| 12 | SQL files tracked (11 migrations + ...) | git ls-files *.sql | verified (git) |
| 2,500 / 2,500 | synthetic images / labels on disk (train) | ls synthetic_dataset/train | verified on disk (gitignored) |
| 4,481 (v4) / 311 (v2) | total training-corpus images | ARCHITECTURE_DETAILS.md | doc claim only |
| 311 real + 2,700 synthetic + ~1,470 unaccounted | v4 composition | ARCHITECTURE_DETAILS.md | doc claim only |
| 4 | detection classes (card/footer/navbar/section) | data.yaml, inference.py | verified in code |
| 0.20 | per-class confidence threshold (v4, all classes) | inference.py | verified in code |
| 0.03 | v2 card threshold (rollback only) | inference.py comment | verified in code |
| 0.05 | Roboflow server confidence floor | inference.py | verified in code |
| 0.5 | same-class NMS IoU | inference.py | verified in code |
| 0.8 | cross-class shadow-card / dup IoU | inference.py, fidelity.py | verified in code |
| 0.85 | oversize-card area ratio drop | inference.py | verified in code |
| 3 / 1s,2s | Roboflow retries / backoff | inference.py | verified in code |
| 0.25 | fidelity IoU threshold | fidelity.py | verified in code |
| 0.06 / 0.04 / 2 | fidelity center-dist frac / containment area frac / min children | fidelity.py | verified in code |
| temp 0.1, top_p 0.8 | Gemini generation config | inference.py | verified in code |
| 60s / 86400s | Gemini per-minute / per-day cooldown | inference.py | verified in code |
| 110s | GEMINI_TIMEOUT_SECONDS default | main.py | verified in code |
| 60s | Roboflow call timeout | main.py | verified in code |
| 58s / 120s | proxy abort (predict / repair,annotate) | route.ts | verified in code |
| 1440 / 1200ms | fidelity render width / settle | fidelity.py | verified in code |
| 20 req / 60s | rate limit default | main.py | verified in code |
| 50 / 1800s | cache max size / TTL | main.py | verified in code |
| 20 MB | max request body | main.py | verified in code |
| 80.2% -> 98.0% | v2 test -> v4 test mAP@50 | ARCHITECTURE_DETAILS.md | provider-reported doc claim |
| 97.2% / 96.5% | v4 macro P / R (n=264, conf 0.20, IoU 0.5) | ARCHITECTURE_DETAILS.md via eval_v4.py | doc claim; recompute referenced, output not committed |
| 100% R / 98.4% P | detection on 15 synthetic imgs (eval harness) | CLAUDE.md | doc claim, no committed artifact |
| 8/10, 9/10, 2/10 | keys OK on 3.5-flash / 3-flash-preview / 2.5-flash (2026-07-17) | GEMINI_FREE_PLAN.md | verified in committed output |
| $9.08 of $10 in 13 days | paid Gemini key burn (why free ladder) | GEMINI_FREE_PLAN.md | doc claim |

---

## 13. Known limitations and failure modes [ARCHITECTURE_DETAILS.md + verified against code]

| Failure | Root cause | Code handling |
|---|---|---|
| 0 predictions on valid sketch | transparent PNG composited to black | alpha->white composite in detect_with_roboflow (verified) |
| Isolated footer detected as card | loses "wide bar below content" context; same on v2 | snap_positional_bars only fixes navbar/footer already classed as such; isolated-footer-as-card not fully solved |
| Wide/thin layouts lose detail | 640x640 stretch distorts aspect ratio | inherent to model preprocessing |
| card confidence structurally lower | catch-all class variance | per-class thresholds (verified) |
| oversized section/card engulfs canvas | model confuses canvas boundary | oversize-card guard (cards only, verified); section case not guarded |
| Roboflow default hides cards | ~0.4 default floor | server floor forced to 0.05 (verified) |
| Uploaded photo detects poorly | capture conditions unseen in training | preprocess_uploaded_photo binarize+crop (verified) |
| Product screenshots out of scope | detector trained on line-art only (Decision #21) | not handled by design |
| Fidelity false 0.00 | render-domain / scale mismatch | viewport clamp + 4-stage scoring + score>0 repair guard (verified) |
| Repair rewrites into stubs | Gemini emits class-name placeholders | 50%-shrink guard + class-stub guard, 422 (verified) |
| Incremental recycles bad base | stale/degenerate previousCode | _previous_code_is_degenerate coverage + stub guards (verified) |
| Vercel Hobby 504 on long repair | 60s function cap vs ~70-88s Gemini | repair skipped, user keeps code (CLAUDE.md) |
| Cold-start latency | v4 Small load time | warmup_roboflow on startup (verified) |

Known bugs still open (CLAUDE.md): Email/Full Name order swap in one signup test predates annotate, not yet diagnosed; incremental + annotate live smoke pending for some features.

---

## 14. GAPS (what documentation still needs, not determinable from repo)

- Live deployment URLs: no Vercel/Render config or URLs in repo. Need production frontend URL, backend URL, whether backend is on Render free vs paid.
- Deployment configs: no vercel.json, render.yaml, Dockerfile, or Procfile committed. Need actual build/start commands and env set in the hosting dashboards.
- Supabase project details: project ref, region, which OAuth providers are actually enabled (only Google is implied), redirect URLs, whether storage buckets (avatars/sketch-exports/project-assets) were actually created (migrations only add policies, not buckets).
- Roboflow dashboard metrics: mAP/precision/recall are provider-reported markdown; the eval_v4.py recompute output and eval_pipeline.py artifacts are gitignored. Need the committed eval run outputs (or re-run) to cite locally-verified numbers with confidence.
- v4 dataset "~1,470 unaccounted" images: repo itself flags this as unconfirmed. Need Roboflow dataset export to state exact real/synthetic/augmented split.
- Training hyperparameters: epochs, batch size, learning rate, exact YOLOv11 Small config, training hardware/time, are not in the repo (Roboflow-hosted training). Need from Shahwaiz / Roboflow.
- API keys / secrets: all Gemini keys, Roboflow key, Supabase keys are credential-gated (.env not committed). Key-pool health (which of the 10 slots are live) is time-dependent; run check_gemini_keys.py before any demo.
- Real dates for milestones beyond commit timestamps: task assignment dates, demo/viva dates.
- Test pass state: not executed this session. Need a fresh `pytest` + `pnpm test` run to confirm 270/41 all green (CI status not fetched).
- Frontend component internals: canvas/page.tsx (4088 lines) and LivePreview.tsx were sampled, not fully audited; exact state-machine and every handler are not exhaustively documented here.
- LOC method caveat: counts are tracked files only (git ls-files + wc -l), excluding node_modules/venv and gitignored synthetic images; not cloc (no language-normalized blank/comment split).
- Legacy/unused deps: face-api.js and three.js stack are in package.json; their live usage (landing page effects vs dead code) not confirmed.
- HANDOFF_To_Shahwaiz_v3.md, ml-training/notebooks, QUICK_START.md not read here; may hold additional training/setup detail.
