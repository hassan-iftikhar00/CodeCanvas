# CodeCanvas — App Uplift Roadmap (Module Depth Round 2)

> Last updated: 2026-07-05
> Source: planning session 2026-07-04. Round 1 (FYP-defense features: fidelity loop, auto-repair, HITL editor) is tracked in `FYP_FEATURE_ROADMAP.md` — all three DONE.
> This round targets **product modules**: making CodeCanvas feel like a multi-module system instead of a single "draw/upload → code" flow.

## Status tracker

| #   | Feature                        | Effort     | Status         |
| --- | ------------------------------ | ---------- | -------------- |
| G   | Responsive Preview             | 2-3 days   | ✅ DONE (2026-07-04) — see notes below |
| J   | Open in StackBlitz             | 1-2 days   | ✅ DONE (2026-07-04) — see notes below |
| I   | Shareable Preview Link         | 2-3 days   | ✅ DONE (2026-07-05) — see notes below |
| E   | Version Diff Viewer            | 3-4 days   | ✅ DONE (2026-07-05) — see notes below |
| H   | Brand Kit                      | 3-4 days   | ✅ DONE (2026-07-05) — see notes below |
| C   | Element ↔ Code Linker          | ~1 week    | ✅ DONE (2026-07-05) — see notes below |
| B   | Annotate-on-Render Refinement  | ~1 week    | ❌ Not started |
| D   | Incremental Regeneration       | ~1 week    | ✅ DONE (2026-07-05) — see notes below |
| A   | Multi-Screen Flows             | 1.5-2 wks  | ❌ Not started |

Dropped in selection: F Repeating-Data Binding, Urdu/RTL (roadmap #7 carry-over), comparative benchmark (roadmap #3 carry-over), a11y auditor.

Total rough effort: ~7-8 weeks serial. Team split can parallelize (Maarij: E, G, I frontend; Bilal: H persistence, J; Hassan integrates B/C/D/A per ownership rules) — decide per feature at implementation time.

---

## Selected features (detail)

### A. Multi-Screen Flows
Sketch 2-3 screens as tabs; name link targets ("→ Dashboard"); generate a multi-page React app with working navigation. Export-zip becomes a real multi-page scaffold. Turns output from snippet into application.
**Files:** `canvas/page.tsx` (screen tabs), `inference.py` (per-screen prompt + router shell), `export-zip.ts`.

### B. Annotate-on-Render Refinement (tldraw make-real pattern)
After generation, user draws ON TOP of the live preview (circle a region, scribble a note "make this red / move this up"); annotated screenshot + note goes to Gemini multimodal as a targeted refinement. Visual chat — much stronger than text-only chat refinement.
**Files:** new overlay atop `LivePreview.tsx`, reuse Konva, reuse `prompt_override` path in `inference.py`, screenshot via existing render machinery.

### C. Element ↔ Code Linker (interactive grounding v2) — ✅ DONE 2026-07-05
The prompt's Output rules now REQUIRE `data-cc-id="cc-N"` on every rendered component's root tag, where N is the component's 1-based position in the detected list — so `detectedElements[i] ↔ cc-(i+1)` is the machine-readable contract (5 tests in `tests/test_element_linker.py`). Frontend: (a) `preview-doc.ts` injects a `linkerScript` bridge into all three iframe builders (and splices it into full HTML documents before `</body>`): clicking any rendered element posts `cc-element-click` to the parent; a `cc-highlight` message scrolls + outlines the element. (b) `MonacoCodeEditor` is now forwardRef with a `revealAndFlash(searchText)` handle (find match, reveal line, 1.6s decoration flash). (c) The detection-summary strip's count text was replaced with one clickable chip per element (`N·TYPE`); clicking highlights the element in BOTH the preview (via a `cc-highlight-request` broadcast that LivePreview forwards into its iframe) and the code. (d) Clicking an element inside the preview jumps to its code — auto-switching preview→split view so the highlight is visible. Live smoke pending (needs a Gemini generation that carries the ids). NOTE: incremental regen (D) re-stamps ids to the new list numbering on every patch, keeping the contract valid.
**Files:** `inference.py` (COMPONENT IDS prompt rule), `src/lib/preview-doc.ts` (linkerScript), `MonacoCodeEditor.tsx` (handle), `LivePreview.tsx` (message forward), `canvas/page.tsx` (chips, listener, revealCcInCode).

### D. Incremental Regeneration / Sketch Diffing — ✅ DONE 2026-07-05 (live smoke pending)
Frontend mirrors the latest generation (code incl. chat/manual edits + detection set + framework) in `previousGenRef` and sends `previousCode`/`previousElements` with the next generation request (only when the framework matches). Backend (`_generate_from_output`): `diff_detection_sets` (inference.py) aligns the OLD detection set into the NEW run's pixel space — scale = median same-class width/height ratio, translation = median center delta (robust because unchanged elements dominate the medians; envelope normalization was tried first and REJECTED: removing an envelope-edge element like the footer distorts every other coordinate) — then greedy per-class IoU (0.4). Outcomes: zero changes → previous code returned untouched, NO Gemini call (`incremental-noop`); small delta (≤ max(4, half the new set)) with at least one match → `build_incremental_prompt` patches via `prompt_override` (REMOVE by `data-cc-id` from feature C, ADD by position/label, byte-identical elsewhere, ids re-stamped to the new list numbering); big delta → silent fall-through to full regeneration. Cache get/put bypassed when `previousCode` present (the key doesn't hash it). Response gains `usedIncremental`; frontend shows an "Incremental update" toast. 13 tests in `tests/test_incremental.py` (incl. crop-shift invariance + footer-removal cases). Needs live smoke: verify Gemini actually byte-preserves untouched code on a real patch.
**Files:** `inference.py` (`diff_detection_sets`, `_align_old_boxes`, `build_incremental_prompt`), `main.py` (request fields, incremental branch, cache bypass, `usedIncremental`), `canvas/page.tsx` (`previousGenRef`, body fields, toast).

### E. Version Diff Viewer — ✅ DONE 2026-07-05
Side-by-side compare of two iterations: rendered previews (shared `preview-doc.ts` builders in sandboxed iframes) plus a line diff with unchanged-run collapsing (context 3) and +/- stats. Diff engine is a dependency-free LCS in `src/lib/code-diff.ts` (14 Vitest tests in `code-diff.test.ts`). Rollback restores that version's `generated_code` into the editor (clears manual edits) and its `canvas_data` snapshot when present. Entry: COMPARE VERSIONS button in the toolbox CHECKPOINTS section. Defaults to previous-vs-latest.
**Files:** `src/lib/code-diff.ts` (+tests), `src/components/canvas/VersionCompareModal.tsx`, `useVersionHistory` (exports `ProjectVersion`), `canvas/page.tsx` (`handleRollbackVersion`).

### G. Responsive Preview + Device Frames — ✅ DONE 2026-07-04
Discovery: `LivePreview.tsx` ALREADY had fit/desktop/mobile device frames + orientation + zoom, so the UI half existed. What was added: (a) RESPONSIVE BEHAVIOUR block in `_build_gemini_prompt` (`inference.py`) — mobile-first Tailwind, rows stack by default and restore at `md:` up, NO hidden elements / hamburger substitutes (strict fidelity preserved at every width); (b) `tablet` preset (768x1024 — 768 sits exactly on Tailwind's `md:` breakpoint so this frame demos the collapse/restore) with orientation toggle and framed bezel.
**Files touched:** `LivePreview.tsx` (DeviceType + preset + frame styling), `inference.py` (prompt).

### H. Brand Kit / Theme Module — ✅ DONE 2026-07-05
Per-project brand tokens: primary/secondary/accent colors (hex, validated) + font family (curated list incl. Google fonts), set in `BrandKitModal` (toolbox BRAND KIT section, swatch preview on the button). Persisted in new `projects.brand_kit` jsonb column (migration `20260705000001` — apply before persistence works; session-only kit works without it). Backend: `BrandKit` pydantic model on `GenerateCodeRequest`; `_build_gemini_prompt` gains a BRAND KIT block (Tailwind arbitrary-value guidance, Google Fonts link for HTML output) that explicitly scopes itself to COLORS and TYPOGRAPHY ONLY so strict fidelity (Decision #19) holds. Cache key now hashes the kit (`|kithash` segment) so editing tokens never serves the old palette from cache. Kit loads with the project (`?id=` effect) and rides a ref into `runGeneration` (canvas, upload, and HITL paths all get it). 14 backend tests in `tests/test_brand_kit.py`. Chat refinement (OpenRouter) and the repair pass are untouched — repair preserves existing styling by design.
**Files:** `supabase/migrations/20260705000001_add_brand_kit.sql`, `backend/main.py` (BrandKit model, cache key), `backend/app/models/inference.py` (prompt block, `generate_with_gemini` param), `src/components/canvas/BrandKitModal.tsx`, `canvas/page.tsx`.

### I. Shareable Preview Link — ✅ DONE 2026-07-05
SHARE button in `CanvasTopBar` opens `ShareDialog`: toggles the project's existing `is_public` flag (column + "Public projects are viewable by everyone" RLS policy were ALREADY in the initial schema — no migration needed) and hands out `/p/[id]` with a COPY button. New public route `src/app/p/[id]/page.tsx` reads via the anon client (private/missing rows render the same "not available" screen, no id-existence leak) and renders the last SAVED `generated_code` in a sandboxed iframe with a minimal drafting header. Iframe doc builders were extracted from `LivePreview.tsx` into shared `src/lib/preview-doc.ts` (`buildPreviewDocument` + `detectPreviewLanguage` heuristic for rows without a framework value) — NOTE: `backend/app/utils/fidelity.py` mirrors these builders (Decision #25), keep in sync. Also gives B a stable render URL.
**Files:** `src/lib/preview-doc.ts`, `src/app/p/[id]/page.tsx`, `src/components/ShareDialog.tsx`, `CanvasTopBar.tsx` (SHARE button), `LivePreview.tsx` (imports shared builders).

### J. Open in StackBlitz / CodeSandbox — ✅ DONE 2026-07-04
STACKBLITZ method added to ExportDialog (4th option in METHOD grid, bolt icon, "OPEN IN STACKBLITZ" footer button). New `src/lib/open-in-stackblitz.ts` posts the project to StackBlitz's POST API via a hidden form (no SDK dependency): React/Vue/Next → the SAME Vite+React scaffold as the ZIP export on the `node` template (WebContainers auto-installs + runs Vite); HTML framework → single `index.html` on the `html` template. Scaffold extracted into shared `buildReactScaffoldFiles()` in `export-zip.ts` so ZIP and StackBlitz always ship identical projects.
**Files touched:** `export-zip.ts` (refactor, exports `BuildOptions` + `buildReactScaffoldFiles`), new `open-in-stackblitz.ts`, `ExportDialog.tsx`, `canvas/page.tsx` (handler).
**2026-07-05 adjustment:** StackBlitz promoted to the top bar. The EXPORT toolbar button in `CanvasTopBar.tsx` is now a split control: left half EXPORT (opens the export dialog as before, keeps `data-onboarding="export-action"`), right half STACKBLITZ (solid graphite fill, bolt icon) which launches directly via the existing `handleExport({format: "stackblitz", framework: selectedFramework, styling: "tailwind"})` path — no dialog step, same no-code guard toast. Dialog METHOD option retained.

---

## Build order + dependencies

1. **G Responsive Preview** — smallest visible module; its responsive-prompt work feeds A later.
2. **J StackBlitz** — rides on existing `export-zip.ts`; do alongside G.
3. **I Share Link** — one viewer route; also gives B a stable render URL.
4. **E Version Diff Viewer** — pure frontend over existing `iterations` table.
5. **H Brand Kit** — establishes the "project-scoped generation settings" pattern.
6. **C Element ↔ Code Linker** — `data-cc-id` stamping is the FOUNDATION for B and D; must land before them.
7. **B Annotate-on-Render** — reuses `prompt_override` + Konva + C's element ids.
8. **D Incremental Regen** — detection-set diff + delta prompt; C's ids pin untouched code.
9. **A Multi-Screen Flows** — largest scope risk, most runway last; G's prompt + J/export scaffold + I's viewer all feed it.

Dependency chain that matters: **C before B and D**. Everything else independent.

## Competitor grounding

Uizard/Visily ship multi-screen prototypes + theme generation; tldraw make-real ships annotate-on-render. None combine annotate-on-render + element↔code linking + incremental regen on a detection-grounded pipeline — B, C, D stay differentiated.

## Next step

Per-feature implementation planning, starting with G + J (quick wins). Each feature gets its own detailed plan (files, prompt changes, tests) before code is written.
