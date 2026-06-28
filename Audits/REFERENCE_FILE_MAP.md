# CodeCanvas — Reference File Map

> Full file locations and purposes. Read this when you need to find where a specific component, hook, or module lives.
> Moved from CLAUDE.md on 2026-06-16.

---

## Frontend — Canvas Chrome (post-redesign)

| File | Purpose |
|------|---------|
| `src/app/canvas/page.tsx` | Orchestrator: composes chrome, owns detection trigger |
| `src/components/canvas/SketchCanvas.tsx` | Konva drawing surface |
| `src/components/canvas/SketchCanvasWithHistory.tsx` | Drawing surface + undo/redo wiring |
| `src/components/canvas/CanvasSurface.tsx` | Dot-grid workspace + empty-state hint |
| `src/components/canvas/FloatingToolbar.tsx` | Tool picker (select/pen/shapes/erase) w/ shortcuts |
| `src/components/canvas/StyleRibbon.tsx` | Stroke / fill / width / opacity controls |
| `src/components/canvas/ZoomPill.tsx` | Zoom presets + fit-to-screen |
| `src/components/canvas/ChatInterface.tsx` | OpenRouter chat refinement panel |
| `src/components/canvas/LivePreview.tsx` | Code → live preview iframe |
| `src/types/canvas.ts` | Canonical `Tool`, `Mode`, zoom constants, `TOOL_KEY_MAP` |
| `src/hooks/useCanvasShortcuts.ts` | Keyboard shortcut handler for canvas page |
| `src/components/ui/Toast.tsx` | App-wide toast provider |
| `src/components/ErrorBoundary.tsx` | Class-based boundary, `page`/`panel`/`inline` variants |
| `src/components/theme/ThemeProvider.tsx` | localStorage + system-pref theme context |
| `src/components/canvas/StatusBar.tsx` | Drafting Room mono dims/tool/grid/zoom strip below canvas |
| `src/components/canvas/CanvasTopBar.tsx` | Drafting Room top bar for canvas (replaces Navbar) |
| `src/components/canvas/canvasTokens.tsx` | Re-exports `T_CANVAS` / `CanvasMark` / `CanvasCross` from drafting-room tokens |
| `src/lib/drafting-room/tokens.ts` | Single source of truth: `DRAFTING_TOKENS` + `DRAFTING_DARK` |
| `src/lib/drafting-room/marks.tsx` | `DraftingMark`, `DraftingCross` brand mark components |
| `src/components/canvas/DraftingToolbox.tsx` | Right rail — paper sheet with tab strip (CHAT / PROPS), collapsible |
| `src/components/canvas/DraftingModal.tsx` | Shared modal scaffold — paper sheet + title block + footer slot. Exports `ModalButton`, `ModalSection`, `ModalOption` |
| `src/components/canvas/UploadSketchModal.tsx` | Upload-image input modal: drag-drop/browse, preview, Photo/Digital toggle, validation. Emits `UploadDetectionPayload` (`sketchSource`) consumed by `runGeneration` in `page.tsx` |
| `src/components/canvas/GenerationProgress.tsx` | Code-generation progress indicator (used by code panel) |
| `src/components/auth/AuthLoadingSkeleton.tsx` | Drafting Room skeleton placeholder for auth pages |
| `src/components/auth/AuthShell.tsx` | Drafting Room scaffold: top bar, gridded bg, paper sheet card, exports `T_AUTH` tokens |
| `src/components/auth/AuthFields.tsx` | Shared form pieces: `AuthInput`, `AuthPasswordInput`, `OAuthButton`, `AuthSubmitButton`, `AuthError`, `AuthSuccess`, `AuthDivider`, `AuthCheckbox`, `PasswordStrengthMeter` |
| `src/components/dashboard/DashboardSkeleton.tsx` | Skeleton placeholder for dashboard |
| `src/components/profile/ProfileSkeleton.tsx` | Skeleton placeholder for profile page |
| `src/components/profile/DeleteAccountModal.tsx` | Account deletion confirmation modal |
| `src/components/onboarding/OnboardingTour.tsx` | Step-by-step onboarding overlay with spotlight highlight |
| `src/components/SketchThumbnail.tsx` | Renders saved canvas data (shapes + freehand lines + componentGroups) as a scaled SVG wireframe. Shared by dashboard ProjectCard and canvas TemplatesPanel. Exports `hasSketchContent` guard. |

---

## Frontend — Data + Routes

| File | Purpose |
|------|---------|
| `src/app/api/generate-code/route.ts` | Proxy to FastAPI; OpenRouter routing |
| `src/app/api/account/delete/route.ts` | Delete current user (auth.users) via service-role admin client |
| `src/hooks/useProjectSave.ts` | Project CRUD (canonical schema) |
| `src/hooks/useVersionHistory.ts` | Iterations table queries |
| `src/lib/supabase/admin.ts` | Service-role Supabase client (server-only; DO NOT import in frontend) |
| `src/lib/export-zip.ts` | Builds the ZIP for code export: React + Vite scaffold OR standalone HTML w/ CDNs. Uses JSZip. |

---

## Backend

| File | Purpose |
|------|---------|
| `backend/main.py` | FastAPI server, `/api/predict`, text-attachment + synthesis helpers |
| `backend/app/models/inference.py` | `SketchDetector`, `CodeGenerator`, `_build_gemini_prompt`, `generate_with_gemini` — Roboflow + Gemini both live here. `detect_with_roboflow` takes `sketch_source` and photo-normalizes uploads before inference |
| `backend/app/utils/preprocessing.py` | `preprocess_uploaded_photo` (cv2 grayscale/denoise/adaptive-threshold/content-crop for uploaded images) + `preprocess_canvas_data` rasterizer |
| `backend/debug/last_sketch.png` | Runtime debug dump when `DEBUG_AI_PROMPT=on` (gitignored) |

---

## Synthetic Data Pipeline (`backend/synthetic_data/`)

Entry point: `python -m backend.synthetic_data.generate --count 2700 --out synthetic_dataset`

| File | Purpose |
|------|---------|
| `backend/synthetic_data/generate.py` | CLI orchestrator — renders images, writes YOLO labels |
| `backend/synthetic_data/layouts.py` | Layout templates (standard / sidebar / minimal) + `Element` dataclass |
| `backend/synthetic_data/style.py` | `SketchStyle`, `Hotspot`, style-type sampling (`random_style()`) |
| `backend/synthetic_data/rough.py` | PIL drawing primitives: wobble lines, zigzag text fill, image placeholder X |
| `backend/synthetic_data/validate.py` | YOLO label validation, bbox jitter, annotator miss-rate simulation |

Output is gitignored (`synthetic_dataset/`). All 2,700 images go to `train/` only — real 17 valid + 18 test stay as the evaluation split (sim-to-real protocol).

---

## Dashboard + Profile

| File | Purpose |
|------|---------|
| `src/components/dashboard/DashboardLayout.tsx` | Sidebar + top strip chrome; slide-in mobile sidebar |
| `src/components/dashboard/ProjectCard.tsx` | Project card with SVG thumbnail, hover overlay, delete action |
| `src/app/dashboard/page.tsx` | Projects grid, filter strip, activity card, delete/onboarding modals |
| `src/app/profile/page.tsx` | Profile form, danger zone, sign out |
| `src/components/canvas/ShortcutsPanel.tsx` | Keyboard shortcuts modal (Drafting Room) |
| `src/components/canvas/TemplatesPanel.tsx` | Starter templates modal with SVG wireframe thumbnails |
| `src/components/canvas/ComponentPalette.tsx` | Drop-in elements modal |
| `src/components/canvas/ExportDialog.tsx` | Export modal (framework picker + ZIP download) |
| `src/components/CommandPalette.tsx` | Ctrl+K command palette (Drafting Room) |
