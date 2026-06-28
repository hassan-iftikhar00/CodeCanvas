# CodeCanvas — Completed Tasks & Changelog

> Chronological record of what changed and why. Read this when debugging regressions, understanding the context behind a prior decision, or tracing when a feature was added.
> Moved from CLAUDE.md on 2026-06-16.

---

## Recent Work (most recent first)

- **LivePreview React preview fixed under Babel 8** (2026-06-17, Hassan): unpinned `@babel/standalone` CDN silently moved to v8 (automatic JSX runtime → injects unresolvable `import "react/jsx-runtime"` → "Cannot use import statement outside a module"); switched `buildReactDocument` to an explicit `Babel.transform(..., { presets: [['react', { runtime: 'classic' }]] })` + `new Function` mount, hardened import/markdown-fence stripping, and pinned the CDN to `@babel/standalone@8.0.1`.

- **Container reclassification + orphan-card synthesis + horizontal layout rule** (2026-06-15):
  Fix for the case where the v4 detector returned a `footer` at y=0 (misclassified
  navbar) AND the actual footer's three side-by-side panels were detected as three
  separate `card`s with no wrapping container. Old behavior: `_synthesize_missing_containers`
  saw `has_footer=True` (the misplaced top one) and skipped bottom synthesis, leaving
  the bottom cards as orphans; Gemini then stacked them vertically.
  New behavior in `backend/main.py:379` (two stages):
  (1) Relabel a `footer` whose centroid is in the top 12% band as `navbar`, and a
  `navbar` whose centroid is in the bottom 12% band as `footer` — only if the
  correctly-placed slot is still empty. Marks the element with `attributes.reclassified_from`.
  (2) Extend synthesis trigger: fires on 2+ unattached anns **or** 2+ orphan cards
  (cards not contained ≥50% by any non-card element) in the band. The synthesized
  container's bounds grow to fully wrap the orphan cards so Gemini's
  "card inside container → child" inference nests them.
  Plus a new prompt rule in `backend/app/models/inference.py:_build_gemini_prompt`:
  general horizontal/vertical rule that says siblings with overlapping y but distinct
  x must render as a horizontal row (flex/grid columns), never as stacked rows.

- **Card thumbnails switched to SVG wireframes from saved canvas data** (2026-06-15):
  Both the dashboard ProjectCard and canvas TemplatesPanel used to show identical generic
  graph-paper + UI icon previews. Added `src/components/SketchThumbnail.tsx` that scales a
  `CanvasData` payload (shapes, freehand lines, componentGroups) into a 320×180 inline SVG
  using cobalt strokes for shapes and graphite for hand-drawn lines. Dashboard fetch already
  did `select("*")` so `canvas_data` was in the payload — just had to thread `raw.canvas_data`
  through `ProjectCard.canvasData`. TemplatesPanel's local `TemplateThumbnail` was deleted and
  replaced with the shared component. The raster `thumbnailUrl` fallback path is still wired
  if we ever want to add saved screenshots later.

- **UI audit implementation — all High/Medium items** (2026-06-15, Hassan + Claude):
  Full pass through `Audits/UI_UpgradeLeftOver.md` items 1-8.
  (1) **Welcome dialog** (`canvas/page.tsx:2079-2128`): replaced #1A1A1A/#FF6B00/rounded-2xl
  dialog with `DraftingModal` + `ModalButton` (cobalt primary "Analyze design ->", two ghost
  buttons). (2) **SketchCanvas** (`SketchCanvas.tsx`): added `DRAFTING_TOKENS as T` import;
  selection color on drawn lines + straight-line shapes changed `#FF6B00` -> `T.cobalt`;
  group selection ring `#3B82F6` -> `T.cobalt` (dashed), edit-mode ring `#10B981` ->
  `T.cobaltInk` (solid); edit-mode text label `#10B981` -> `T.cobalt`; all four
  `#F59E0B` amber shape-highlight rings -> `T.cobalt`; hover delete button `#1F1F22 cornerRadius=4`
  -> `T.graphite cornerRadius=0`; delete-X lines `white` -> `T.paper`; Transformer
  `anchorFill/anchorStroke/borderStroke` pinned to `T.paper`/`T.cobalt`. Container
  `rounded-[14px]` + `shadow-*` + `ring-*` stripped; Stage `className="rounded-xl"` removed.
  (3) **LivePreview**: device frame `shadow-[0_12px_28px...]` removed; desktop
  `borderRadius: 4` -> `0` (mobile bezel `24` kept). (4) **auth-code-error**: already
  Drafting Room. (5) **OnboardingTour**: imported `DRAFTING_TOKENS as T` +
  MONO/SANS/SERIF font-var consts; all hardcoded hexes replaced with token refs;
  "FINISH ✓" -> "FINISH ->". (6) **TemplatesPanel**: replaced `group-hover:text-[var(--d5-cobalt)]`
  (undefined global var) with `onMouseEnter/onMouseLeave` on the icon wrapper.
  (7) **Skeleton.tsx**: deleted (zero importers). (8) **globals.css + canvas orphans**:
  stripped entire legacy palette from `:root` (`--grey-*`, `--orange-*`, `--text-primary/secondary/muted`,
  `--charcoal-black`, `--card-grey`, `--border-grey`, `--shadow-orange-*`); removed dead
  utility classes; removed `.skeleton` + `@keyframes shimmer` + `.spinner`; scrollbar
  re-tokened; removed dead `@theme inline` block. `Layer` type moved from `LayerPanel.tsx`
  to `src/types/canvas.ts`; 6 canvas orphans deleted: `LayerPanel`, `VersionHistory`,
  `ZoomControls`, `ColorPicker`, `StrokeWidthSelector`, `ToolPalette`.

- **UI audit — Low-priority items** (2026-06-15, Hassan + Claude):
  Completed remaining Low-priority items from `Audits/UI_UpgradeLeftOver.md`.
  Deleted 6 orphan components: `Pricing.tsx`, `Testimonials.tsx` (superseded by inline
  landing blocks), `SplitText.tsx`, `TargetCursor.tsx`, `Antigravity.tsx`, `GridScan.tsx`
  (all GSAP/Three.js/R3F orphans with zero importers).
  **DemoTheatre.tsx** fully rewritten to Drafting Room: legacy `#0A0A0A`/`#1A1A1A`/`#FF6B00`
  palette replaced with `DRAFTING_TOKENS`; `rounded-*` -> sharp corners; gradient bg -> flat
  paper; orange spinner -> CSS `animate-spin` cobalt div; graph-paper canvas (tick lines).

- **Export-as-ZIP wired up properly** (2026-06-14, Hassan + Claude):
  The "ZIP" choice in the export dialog was a stub that dumped raw React code into a `.html`
  file. Added `jszip` and `src/lib/export-zip.ts` that produces a real `.zip`: for React
  it scaffolds a Vite + React 19 + Tailwind v4 project (`pnpm install && pnpm dev`). For HTML
  it emits a self-contained `index.html` with React + Babel + Tailwind from CDN. Vue / Next.js
  fall through to the React scaffold with a README note. ExportDialog's framework default
  flipped from `"html"` -> `"react"` to match what Gemini actually emits.

- **Global Toast migrated to Drafting Room** (2026-06-14, Hassan + Claude):
  `src/components/ui/Toast.tsx` was the last surface on the old palette. Rewrote visual layer
  to paper sheet with hairline rule, left variant accent rail (3px), vellum mono slug bar.
  Variant accents pull from `DRAFTING_TOKENS`: cobalt (info), success, warning (#A85A18
  desaturated burnt sienna), error. Same `useToast()` API unchanged.

- **Canvas code panel + Monaco editor flipped to dark slab** (2026-06-14, Hassan + Claude):
  New `DRAFTING_DARK` token set added to `src/lib/drafting-room/tokens.ts` (re-exported as
  `T_DARK` via `canvasTokens.tsx`): `bg` (#0E0E0F) + `bgRaised` (#131316) surfaces, paper-
  tinted ink at graded opacity, brighter cobalt (#8C8DD4) + cobalt-ink (#B7B8E5) for dark
  surfaces. `MonacoCodeEditor.tsx` flipped to `vs-dark`, graphite bg, paper-tinted foreground.
  Code panel container, drag handle, tabs, COPY/maximize/close, detection summary bar,
  empty state, regen overlay all flipped to `T_DARK`. `GenerationProgress.tsx` full-bleed
  surface flipped so it doesn't flash white inside the dark panel.

- **Drafting Room CSS-var cleanup complete (--cc-* fully retired)** (2026-06-14, Hassan + Claude):
  Removed `CodePanelSkeleton.tsx` (0 imports). Removed 168-line `{false && rightPanel && (...)}` 
  legacy dark aside in `canvas/page.tsx`. Removed all `--cc-*` token definitions from
  `globals.css`. Removed dead helper classes + keyframes. `body{}` updated to use hex values
  directly. Total `--cc-*` references: 12 -> 0.

- **auth-code-error migrated + ErrorBoundary migrated + SaveIndicator/ThemeToggle deleted** (2026-06-14, Hassan + Claude):
  `auth-code-error/page.tsx` rewritten to paper sheet with error-bordered title strip.
  `ErrorBoundary.tsx` rewritten with three variants: `inline` (thin banner), `page` and
  `panel` (paper sheet with error title strip). All class methods preserved verbatim.
  `SaveIndicator.tsx` (0 imports) and `theme/ThemeToggle.tsx` (0 imports) deleted.

- **Navbar.tsx + Footer.tsx removed (dead code)** (2026-06-14, Hassan + Claude):
  Both files had zero active imports. `Navbar` replaced by `CanvasTopBar` (canvas) and
  `DashboardLayout`'s top strip (dashboard/profile). `Footer` never re-enabled after
  landing-page redesign. Dropped 42 `var(--cc-*)` references in one shot.

- **Profile page migrated to Drafting Room** (2026-06-14, Hassan + Claude):
  `profile/page.tsx`, `DeleteAccountModal.tsx`, `ProfileSkeleton.tsx` migrated.
  Each section is a paper sheet with a vellum title strip. Danger zone uses error red.
  `DeleteAccountModal`: focus trap + Escape handling + isDeleting backdrop guard all
  preserved verbatim (kept inline JSX, not `DraftingModal`).

- **Dashboard migrated to Drafting Room (Phases A/B/C)** (2026-06-14, Hassan + Claude):
  A: `DashboardLayout.tsx` sidebar + top strip on paper, mono nav labels, cobalt left rail.
  B: `ProjectCard.tsx` + `dashboard/page.tsx` — project cards as paper sheets, vellum title
  strips, cobalt "OPEN ->" hover. Focus trap on delete modal preserved.
  C: Filter strip + `DashboardSkeleton.tsx` rewritten to match new card shapes.

- **Canvas Phase 4: Drafting Room token consolidation + Command Palette migration** (2026-06-14, Hassan + Claude):
  Single source of truth now at `src/lib/drafting-room/tokens.ts` + `marks.tsx`.
  `canvasTokens.tsx` re-exports as `T_CANVAS`; `AuthShell.tsx` re-exports as `T_AUTH`.
  `CommandPalette.tsx` migrated to Drafting Room. Shortcuts panel deduped: one panel,
  three entry points (`?`, SHORTCUTS button, Ctrl+K -> "Keyboard shortcuts").

- **Canvas Phase 3: code panel + modals to Drafting Room** (2026-06-13, Hassan + Claude):
  Code panel chrome restyled. MonacoCodeEditor gets custom `drafting-room` theme.
  All 4 modals migrated via `DraftingModal`: ExportDialog, ShortcutsPanel, TemplatesPanel,
  ComponentPalette. OnboardingTour spotlight overlay: cobalt highlight ring, paper tooltip.

- **Canvas Phase 2: drafting toolbox + style controls relocated** (2026-06-13, Hassan + Claude):
  Built `DraftingToolbox` (right rail). LAYERS tab removed (pipeline rasterizes canvas, so
  layers add complexity without core value). StyleRibbon refactored from canvas-overlay to
  vertical block component inside the PROPS tab.

- **Canvas Phase 1: chrome to Drafting Room** (2026-06-12, Hassan + Claude):
  New `CanvasTopBar.tsx`. Restyled `FloatingToolbar`, `ZoomPill`, `StatusBar`, `CanvasSurface`.
  Replaced `cc-dot-grid` with two-layer hairline graph (8px fine + 32px coarse 1.5px lines).

- **Auth pages migrated to Drafting Room** (2026-06-12, Hassan + Claude):
  Added shared `AuthShell` + `AuthFields`. Each page dropped from ~900-1140 lines to ~250-310.
  Login, signup, forgot-password, reset-password all use editorial serif H1 with cobalt italic
  accent. All supabase logic preserved verbatim. Mobile verified at 390px and 1440px.

- **Hero paper-sheet separation + footer hover fix** (2026-06-12, Hassan + Claude):
  Wrapped landing hero left column in paper sheet with "BRIEF · v0.1" title block.
  Fixed footer social icons going all-black on hover (moved to `.d5-social` CSS class).

- **Decision #20 retired** (2026-06-12, Claude via Playwright):
  Verified `_synthesize_inputs_for_orphan_labels` is dormant on v4 via Login Form template
  (zero `synthetic: True` flags; every inner rectangle detected as card conf 0.47-0.89).
  Deleted `_INPUT_LABEL_WORDS`, `_BUTTON_TEXT_WORDS`, and all related helpers from
  `backend/main.py`. `[SYNTHESIZED CONTAINER]` (Decision #11) is independent and preserved.

- **v4 end-to-end smoke test** (2026-06-12, Claude via Playwright):
  4 representative sketches tested. Hero Section (1 section + 2 cards), 3-Column Cards
  (3 cards), Dashboard Sidebar (1 section + 4 cards) — all perfect. Footer-in-isolation
  classified as 2 cards (expected behaviour, same as v2). Detection latency ~3-5s Roboflow
  + 25-40s Gemini post warm-up. Fixed: Roboflow timeout bumped 30s -> 60s; added
  `warmup_roboflow()` startup handler.

- **v4 local sanity check** (2026-06-12, Hassan):
  Ran `backend/eval_v4.py` against 264-image test split. Macro precision 97.2% / recall
  96.5%, matching Roboflow's reported 98% within ~1pp. v4 cleared for `.env` promotion.

- **v4 model delivered (Shahwaiz)** (2026-06-11):
  `object-detection-4affw/4` trained on 4,481 images. Valid-set mAP@50 98.7%.
  Architecture switched from YOLOv11 Fast (v2) to YOLOv11 Small (v4).

- **Canvas UX bug batch** (2026-06-10, Hassan):
  (1) Spaces unusable in chat box — new `isTypingTarget()` covers input/textarea/contenteditable.
  (2) Text tool now multiline (textarea, Enter saves, Shift+Enter inserts newline).
  (3) Text hover delete button unreachable — hide now delayed 300ms via timeout.
  (4) Text editing added — double-click opens modal pre-filled; submit updates in place.
  (5) Preview unscrollable — injected `html,body { height:auto !important }` into both
  LivePreview iframe document builders.

- **Canvas state-bridge + undo fix + project-load loop** (2026-06-10, Hassan):
  Root cause: `useProjectSave` calling `createClient()` on every render (not memoized),
  making `loadProject` unstable, causing the project-load `useEffect` to re-run on every
  render and overwrite local edits. Fix: `const supabase = useMemo(() => createClient(), [])`.
  Also fixed 5 regressions in SketchCanvas ⇄ useHistory bridge: empty-state hint stuck,
  saved projects failed to restore, undo wiped original template, template-only projects
  never auto-saved, template flashed then vanished.
  Rule of thumb: any `onStateChange` / `history.setState` payload MUST contain exactly
  `{lines, shapes, componentGroups}` — nothing more, nothing less.

- **PR #8 + integration (Maarij + Hassan)** (June 2026):
  M8 (error boundaries), M9 (loading skeletons), M11 (dark mode) closed out.
  M12 mobile responsiveness landed for auth + dashboard + canvas (partial).

- **13d94e8 — M4, M5, M6 (Maarij)** (May 2026):
  Dashboard card actions (delete + cascade), empty states, onboarding tour.
  Also bumped `inference-sdk` 0.22.1 -> 0.64.8 and `numpy` 1.26.4 -> 2.2.6.

- **60ad65e — Dataset Generation** (May 2026):
  Added `backend/synthetic_data/` — PIL-based synthetic sketch generator,
  2,700 YOLO-format images in three style types (clean 40% / dense_hand 40% / sparse_sketch 20%).

- **d42f2aa — Canvas redesign + matching reliability** (May 2026):
  Extracted canvas chrome, centralised types, added Toast + keyboard-shortcut hook.
  Backend: text-to-element matching with canvas-extent inference, oversized containers,
  navbar/footer recovery.

- **2bb44ed — H4** (April 2026): Roboflow + Gemini sketch-to-code pipeline wired end-to-end.

- **989dbb0 / 6dafba1 — Maarij tasks 2-5**: dashboard + auth polish.

- **56526bc**: sketch-first AI refinement, dashboard nav upgrades.
