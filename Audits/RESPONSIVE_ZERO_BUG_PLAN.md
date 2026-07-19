# CodeCanvas — Responsiveness & Zero-Bug Implementation Plan

> **Purpose:** make the app 100% responsive across all devices and eliminate all bugs,
> errors, and console warnings — implemented **one phase at a time**.
> **Planned with Opus, implement with Sonnet.** Say: *"Implement Phase N from
> Audits/RESPONSIVE_ZERO_BUG_PLAN.md."* Do exactly that phase, then stop and report.
> Last updated: 2026-07-10.

---

## 0. Ground rules (read before every phase)

These are non-negotiable and apply to **all** phases:

1. **Frontend only.** Do NOT touch `backend/`, Python, the Roboflow/Gemini pipeline, or
   the DB. This is a UI-layer task. If a "bug" traces into the backend, log it in the
   final report — do not fix it here.
2. **Incremental & testable.** Change one file (or one tight cluster of related files) at
   a time. After each batch, run the verification gate (below). Never batch-rewrite.
3. **Verification gate — run after every batch, must all pass:**
   ```
   pnpm tsc --noEmit      # zero type errors
   pnpm lint              # eslint . — zero NEW warnings (57 pre-existing are baseline)
   pnpm test              # vitest — all green
   ```
   A phase is NOT done until all three pass on every file it touched.
4. **Colour comes from `src/lib/drafting-room/tokens.ts`** (`DRAFTING_TOKENS` /
   `DRAFTING_DARK`) — never hardcode hex, never add palette vars to globals.css
   (Decision #17). Spacing/typography/radius/z-index tokens live in globals.css `:root`.
5. **Theme system is `data-theme` on `<html>`** (Decision #17). Do not introduce
   `class="dark"` Tailwind theming. Every responsive change must look correct in BOTH
   light and dark.
6. **Use ONE breakpoint set** — Tailwind defaults, no custom `--breakpoint` (see §1).
   Never hardcode arbitrary `px` media queries per component.
7. **Preserve behaviour.** Responsive work is layout/CSS + light JSX restructuring only.
   Do not change data flow, state, generation logic, or the canvas/Konva event model.
   Warn in the report if a layout change forces a logic change.
8. **Explain each change** — what changed and why — in the per-phase report.
9. **Respect ownership context:** these are Maarij's frontend files, but this audit is a
   cross-cutting pass; keep diffs surgical and style-consistent with each file.

### Breakpoint reference (Tailwind v4 defaults — the ONLY set we use)

| Token  | Min width | Device band (from the audit brief)     |
|--------|-----------|-----------------------------------------|
| (base) | 0         | Mobile 320 / 375 / 414                   |
| `sm:`  | 640px     | Large phone / small tablet portrait      |
| `md:`  | 768px     | Tablet 768 / 834                         |
| `lg:`  | 1024px    | Laptop 1024                              |
| `xl:`  | 1280px    | Laptop 1280                              |
| `2xl:` | 1536px    | Desktop 1440 / 1920                      |

Mobile-first: unprefixed = smallest screen; add `md:`/`lg:` to *restore* the wide layout.

### The canvas decision (READ THIS — shapes Phases 4 & 5)

The `/canvas` editor (Konva drawing surface + `FloatingToolbar` + `StyleRibbon` +
resizable code panel + `ChatInterface`) is a **desktop-first professional tool**. We do
**NOT** try to make the drawing surface usable at 320–767px. Instead:

- **< `md` (768px):** show a clean, branded **"Open on a larger screen" gate** for the
  editing surface (with a link back to Dashboard). The *route* still loads, auth still
  works, no crash, no horizontal scroll.
- **≥ `md`:** the editor is fully usable; chrome (top bar, toolbox, code panel, modals)
  must reflow sensibly between `md`, `lg`, `xl`, `2xl` and never overflow the viewport.

Everything OUTSIDE the editor (landing, demo, auth, dashboard, profile, share viewer,
and every modal/dropdown/toast) must be **genuinely responsive down to 320px**.

---

## Phase 0 — Baseline capture (already scoped; re-confirm before Phase 1)

**Goal:** freeze the "before" state so we can prove improvement and avoid regressions.

**Tasks:**
1. Confirm the viewport meta tag exists and is correct in `src/app/layout.tsx`
   (`width=device-width, initial-scale=1`). If missing, that is the single highest-impact
   fix — add it. (Next.js: `export const viewport = {...}` or `<meta>` in the head.)
2. Record the current verification-gate output (tsc / lint / test) as the baseline. Note
   the exact pre-existing lint warning count (CLAUDE.md says ~57) — Phase 6 must not
   exceed it.
3. Boot the app (`pnpm dev`), open each route, and capture the browser console
   errors/warnings per route into the report. Do NOT fix yet — just log:
   - `/`, `/demo`
   - `/auth/login`, `/auth/signup`, `/auth/forgot-password`, `/auth/reset-password`,
     `/auth/auth-code-error`
   - `/dashboard`, `/profile`, `/canvas`, `/p/[id]` (use any public project id)
4. Exclude the internal design pages (`/design-preview`, `/design-preview-v2`,
   `/design-system`) from the responsive scope — they're dev mockups. Confirm they're
   not linked from user-facing nav; note if they are.

**Acceptance:** a written baseline (console log per route + gate output + viewport-meta
status) appended to the final report's "Before" section. No code changes except the
viewport meta if it was missing.

---

## Phase 1 — Responsive foundations (shared infrastructure)

**Goal:** the primitives every later phase reuses — so no phase invents its own breakpoints.

**Files:** new `src/hooks/useMediaQuery.ts`; `src/app/globals.css`; `src/app/layout.tsx`.

**Tasks:**
1. **`useMediaQuery` hook** — SSR-safe (`useState` + `useEffect` + `matchMedia`, guard
   `typeof window`), returns `boolean`. Add thin helpers used across the app:
   `useIsMobile()` (`< 768px` = below `md`), `useIsTablet()`, `useIsDesktop()`.
   This is the ONE place `matchMedia` lives — components must not call `matchMedia`
   directly. Must not cause a hydration mismatch (start from a deterministic SSR value,
   reconcile in effect).
2. **Global overflow guards** in globals.css:
   ```css
   html, body { max-width: 100%; overflow-x: hidden; }
   img, svg, video, canvas { max-width: 100%; }   /* NOT the Konva stage — scope carefully */
   ```
   ⚠️ Konva renders a `<canvas>`; a blanket `canvas { max-width:100% }` could distort the
   drawing stage. Scope the media rule so it does NOT hit the Konva stage (target
   `img, svg, video` for scaling; handle the Konva container separately, or exclude via a
   class). Verify the drawing surface still tracks pointer coords 1:1 after this.
3. **Fluid type (optional, low-risk):** consider `clamp()` for the largest landing
   headings only. Do not globally change the type scale — that risks every page.
4. Confirm `prefers-reduced-motion` block (already present) still covers any new
   animations.

**Acceptance:** hook compiles and is SSR-safe (no hydration warning); `overflow-x: hidden`
holds globally; Konva drawing still maps pointer→canvas correctly at all zoom levels;
gate green.

---

## Phase 2 — Marketing & auth pages (public surface)

**Goal:** first-impression pages perfect from 320px up.

**Files:** `src/app/page.tsx` (landing), `src/app/demo/page.tsx`,
`src/components/demo/DemoTheatre.tsx`, `src/components/auth/AuthShell.tsx`,
`src/components/auth/AuthFields.tsx`, the 5 `src/app/auth/**/page.tsx`.

**Per-breakpoint checks (320/375/414/768/1024/1280/1440/1920):**
- No horizontal scroll / overflow at any width.
- Hero + mini-canvas well stack cleanly on mobile; multi-column feature grids reflow to
  1 col (mobile) → 2 (`md`) → N (`lg`+). No orphaned/squished cells.
- Landing nav collapses to a reachable mobile menu (hamburger or stacked) — must be
  operable and within viewport.
- Headings don't clip or overlap; body text stays legible (≥16px base on mobile).
- Auth cards center, never exceed viewport width, inputs are full-width with ≥44px tap
  height, labels associated, focus ring visible (cobalt, already global).
- CTA buttons ≥44×44px tap target on mobile.

**Acceptance:** every listed route passes all per-breakpoint checks in light AND dark;
gate green. Report the grid/nav reflow decisions.

---

## Phase 3 — Dashboard, profile & share viewer

**Goal:** the authenticated content pages reflow correctly; card grids behave.

**Files:** `src/app/dashboard/page.tsx`, `src/components/dashboard/DashboardLayout.tsx`,
`src/components/dashboard/ProjectCard.tsx`, `src/components/dashboard/DashboardSkeleton.tsx`,
`src/app/profile/page.tsx`, `src/components/profile/*`, `src/app/p/[id]/page.tsx`.

**Checks:**
- Project card grid: 1 col (mobile) → 2 (`sm`/`md`) → 3–4 (`lg`/`xl`). Thumbnails keep
  aspect ratio; titles truncate (not overflow); card actions reachable (menu within
  viewport, not clipped).
- Dashboard sidebar/nav (if any) collapses to a drawer or top bar on mobile; the
  `DashboardLayout` sidebar-slide animation still works.
- Empty states and skeletons are centered and responsive at all widths.
- Profile forms: single column on mobile, inputs full-width, avatar block stacks above
  fields; `DeleteAccountModal` obeys the Phase 5 modal rules.
- Share viewer `/p/[id]`: the rendered preview + "Nothing published yet" state fit mobile;
  the LivePreview iframe scales without horizontal scroll of the outer page.

**Acceptance:** grids reflow at the stated breakpoints, no clipped card actions, modals
behave, light+dark verified, gate green.

---

## Phase 4 — Canvas editor (desktop tool + small-screen gate)

**Goal:** apply the canvas decision (§Ground rules). Editor usable ≥`md`, graceful gate
below, no crashes or overflow at any width.

**Files:** `src/app/canvas/page.tsx` (careful — 3642 lines), `src/components/canvas/*`
(`CanvasTopBar`, `FloatingToolbar`, `StyleRibbon`, `DraftingToolbox`, `ScreenTabs`,
`StatusBar`, `LivePreview`, `ChatInterface`, `ZoomPill`, `TipsTicker`, `UploadedSketchPanel`).

**Tasks:**
1. **Small-screen gate (< `md`):** render a branded "CodeCanvas works best on a larger
   screen — open on a laptop/desktop to draw" panel *instead of* the editing surface,
   using `useIsMobile()` from Phase 1. Keep auth, the top bar brand, and a "Back to
   Dashboard" link. The `?id=` load effect and all state must still mount without error
   (gate is a render branch, not an early return that skips hooks — **preserve hook
   order**, no conditional hooks).
2. **≥ `md` chrome reflow:** between `md`→`2xl`, verify:
   - `CanvasTopBar` (brand, framework pill, EXPORT split button, SHARE, etc.) wraps or
     condenses instead of overflowing on narrow laptops; consider icon-only + tooltips at
     `md`, labels at `lg`+.
   - `DraftingToolbox` and floating panels don't cover the whole canvas on `md`; the code
     panel min/collapsed heights still respect `clampCodePanelHeight`.
   - `LivePreview` device frames (fit/desktop/tablet/mobile) and `ScreenTabs` stay within
     the panel; the preview toolbar wraps on narrow widths.
   - `ChatInterface` input row and messages don't overflow; send button reachable.
   - `TipsTicker` already hidden `< md` — keep.
3. **No horizontal page scroll** at any width — the gate handles `< md`; `≥ md` chrome
   must fit.
4. Do **not** alter Konva event handling, zoom math (`clampZoom`), pointer mapping, or
   generation triggers. Layout only.

**Acceptance:** `< md` shows the gate (no console errors, hooks stable, no overflow);
`md/lg/xl/2xl` fully operable with reflowed chrome; a full draw→detect→generate cycle
still works at `lg` (spot-check); gate green.

---

## Phase 5 — Global overlay safety sweep (modals, dropdowns, toasts, tooltips)

**Goal:** nothing floating ever escapes the viewport, on any screen.

**Files:** `src/components/canvas/DraftingModal.tsx` (shared scaffold — fix here first),
`ExportDialog.tsx`, `ShareDialog.tsx`, `ShortcutsPanel.tsx`, `CommandPalette.tsx`,
`BrandKitModal.tsx`, `VersionCompareModal.tsx`, `TextInputModal.tsx`,
`UploadSketchModal.tsx`, `DetectionReviewOverlay.tsx`, `DeleteAccountModal.tsx`,
`OnboardingTour.tsx`, `src/components/ui/Toast.tsx`, `TipsTicker.tsx`.

**Checks (apply to each overlay):**
- Width `min(<design>, 100vw − gutter)`; never wider than the viewport on mobile.
- Max-height capped (`max-h-[90dvh]` / `85vh`) with internal `overflow-y:auto` — long
  content scrolls inside the modal, page behind does not.
- Uses `dvh` not `vh` where mobile browser chrome matters (address bar).
- Centered and reachable on 320px; close button ≥44×44px and always visible.
- Dropdowns/tooltips flip/clamp to stay on-screen near edges.
- `VersionCompareModal` side-by-side previews stack vertically on mobile.
- `DetectionReviewOverlay` (draws over the sketch) — it's editor-scoped (≥`md` per Phase
  4); still verify it fits the `md` viewport.
- Toasts: pinned corner, don't push layout, wrap long text, stack sanely.

**Acceptance:** every overlay fits within 320px width and caps height with internal
scroll, in light+dark; gate green. Fix the shared `DraftingModal` scaffold once so
children inherit the behaviour.

---

## Phase 6 — Bug, error & warning elimination

**Goal:** zero console errors/warnings, clean build, no dead code.

**Tasks:**
1. **Fix every console error/warning** logged in Phase 0: React key warnings, hydration
   mismatches, controlled/uncontrolled input flips, `useEffect` deps, invalid DOM nesting,
   duplicate ids, missing `alt`, act() warnings.
2. **Hydration:** anything reading `window`/`matchMedia`/`localStorage`/`Date.now()` at
   render must be effect-guarded (the Phase 1 hook is the template). Theme (`data-theme`)
   is already FOUC-guarded in `layout.tsx` — don't regress it.
3. **Encoding bug:** fix the mojibake comment at `src/app/canvas/page.tsx:2549`
   (garbled `Ã¢â‚¬…` box-drawing chars). Grep the repo for other mojibake
   (`Ã`, `â€`, `Â`) in source/comments and clean them.
4. **Dead code / imports:** remove unused imports, unreachable branches, and unused vars
   surfaced by lint. Do NOT silence with `eslint-disable` — fix the cause.
5. **Broken links / missing imports:** verify every `href`/`import` resolves; check the
   internal design pages aren't reachable from user nav (or noindex them).
6. **Interactive smoke test:** every button/form/modal/nav does something — no silent
   failures. Forms show validation + error states; async actions show loading + error.
7. **Edge cases:** empty states, very long titles/labels (overflow → truncate/wrap),
   slow-network loading states, and that `ErrorBoundary` variants render on thrown errors.

**Acceptance:** console clean on every route (fresh reload, no interactions needed to
clear); `pnpm lint` warning count ≤ the Phase 0 baseline (ideally lower); `pnpm tsc`
clean; `pnpm test` green.

---

## Phase 7 — Accessibility overlaps (bug-adjacent a11y)

**Goal:** close the a11y gaps that are also correctness bugs. (Not a full WCAG audit —
scoped to what overlaps Phase 2/6.)

**Tasks:**
- Every `<img>` has `alt` (decorative → `alt=""`); Google avatars keep
  `referrerPolicy="no-referrer"` + initials fallback (Decision #18).
- Every input has an associated `<label>`/`aria-label`; icon-only buttons have
  `aria-label`.
- Focus states visible on all interactive elements (global cobalt ring exists — verify no
  component removes it).
- Tap targets ≥44×44px on mobile for primary actions.
- Modals: focus trap + `Esc` to close + `aria-modal`/`role="dialog"` + restore focus on
  close.
- Color contrast of body text ≥ 4.5:1 in both themes (spot-check the greys against
  paper/graphite tokens).

**Acceptance:** no missing alt/label, keyboard can operate every flow, modals trap focus,
gate green.

---

## Phase 8 — Final verification & report

**Goal:** prove the two objectives are met.

**Tasks:**
1. Re-run the full breakpoint sweep (320/375/414/768/834/1024/1280/1440/1920) on every
   in-scope route. Record pass/fail per route × per breakpoint in a matrix.
2. Confirm console is clean on every route (both themes).
3. Confirm `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all green; state final lint
   warning count vs. baseline.
4. Produce the **final deliverable report**:
   - Bugs found & fixed (file-by-file).
   - Responsiveness issues found & fixed (file-by-file).
   - Breakpoint test matrix (route × width).
   - Remaining known issues / recommendations (e.g. canvas intentionally gated `< md`;
     any backend-rooted issue punted per Ground Rule #1).

**Acceptance:** the matrix is all-pass (or every fail has a documented, intentional
reason), console clean, gate green.

---

## Phase-at-a-glance

| Phase | Scope | Risk | Depends on |
|-------|-------|------|-----------|
| 0 | Baseline capture + viewport meta | none | — |
| 1 | `useMediaQuery` + global overflow guards | low (Konva caveat) | 0 |
| 2 | Landing / demo / auth | low | 1 |
| 3 | Dashboard / profile / share viewer | low–med | 1 |
| 4 | Canvas editor + `< md` gate | **high** (huge file) | 1 |
| 5 | Modal/overlay/toast viewport safety | med | 1, 4 |
| 6 | Console/build/lint/dead-code + encoding fix | med | all above |
| 7 | A11y overlaps | low | 2–6 |
| 8 | Final verification + report | none | all |

**Recommended order:** 0 → 1 → 2 → 3 → 5 → 4 → 6 → 7 → 8. (Do the overlay sweep before the
giant canvas file so modal fixes are proven on smaller pages first; but 4-before-5 is also
fine if you prefer to finish the editor's own modals in context.)
