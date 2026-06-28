# Code-Verified Status & Work Split

> Created: 2026-06-25
> Last updated: 2026-06-26
> Author: Hassan (Lead)
> Method: **Code-verified**. Every line below was checked against the actual source, not against CLAUDE.md or the other audit files. Each claim cites `file:line`.
> Why this exists: CLAUDE.md and the audit files had drifted from the code. Some items marked "done" are not done; one backend item marked "open" is actually done. This file is the ground truth as of the date above.

---

## Legend

| Mark | Meaning |
|------|---------|
| ✅ DONE | Verified working in code |
| ❌ NOT DONE | Verified absent / broken in code |
| ⚠️ PARTIAL | Some of it is in, some is missing |
| 🟦 NON-ISSUE | Looks open in a doc, but code makes it harmless. Do not spend time |
| ❓ UNVERIFIED | Not traced in this pass; needs a quick look |

Owners follow the project rule: **Maarij = all frontend**, **Bilal = all backend/DB**, **Hassan = integration, security leftovers, reviews, QA, docs**.

---

## 1. Executive summary (read this first)

Three items are **marked done but are not done in code**. These are the only true regressions:

1. **Project rename is fully broken** (frontend) — owner **Maarij**
2. **`useCanvasShortcuts` is dead code** (frontend) — owner **Maarij**
3. **`window.open` has no `noopener`** (security, deliberately reverted) — owner **Hassan**

One item is **done but still shows as open**: **B4 proxy log scrub** (owner Bilal, just needs the doc ticked).

The large `MAARIJ_TASK_FIXES.md` plan was **almost entirely not applied** (only 3 of ~25 fixes landed). Most of those, however, are quality/hygiene, not regressions. The genuinely broken one is rename.

Hassan's `HASSAN_TODO.md` is **effectively complete** (all P0/P1 + key rotation verified in code). Only a minor race guard and the noopener call remain.

---

## 2. Marked DONE but actually NOT done (action required)

| # | Item | Evidence | Owner | Priority |
|---|------|----------|-------|----------|
| R1 | **Project rename non-functional.** `updateProjectTitle` exists but is never called. Dashboard handler only mutates local state. `ProjectCard` ignores the `onRename` prop and renders no rename UI. | `useProjectSave.ts:232` (defined, uncalled), `dashboard/page.tsx:501-507` (local-only), `ProjectCard.tsx:34-40` (prop not destructured), `ProjectCard.tsx:150` (static title) | **Maarij** | High |
| R2 | **`useCanvasShortcuts` is dead code.** Repo-wide grep finds it only at its own definition. Nothing imports or calls it. | `useCanvasShortcuts.ts:27` (sole reference) | **Maarij** | Medium (decide: wire up or delete) |
| R3 | **`window.open` missing `noopener`.** Deliberately reverted because `noopener` returned null and broke the blob-URL preview. Low real risk (same-origin blob of the user's own code), but the security item is technically open. | `LivePreview.tsx:311` + comment at `:302` | **Hassan** | Low |

CLAUDE.md currently lists R1 and R2 under "Fully Done." That is wrong and must be corrected (see Section 6).

---

## 3. Done but NOT marked done (just update the docs)

| Item | Evidence | Owner | Action |
|------|----------|-------|--------|
| **B4 — remove sensitive proxy logs** | `proxy.ts` has zero `console.log/debug/info` | Bilal | Tick B4 in CLAUDE.md |

---

## 4. Remaining work by person

### 4a. Hassan (you) — Lead

Your security/integration list is verified done in code: P0-2 `route.ts:4-20`, P0-3 `route.ts:53-88`, P0-4 full chain (`main.py:1164-1189` + `canvas/page.tsx:1010-1011,1724-1734`), P1-1 origin-locked postMessage, P1-2 `main.py:963-976`, P1-3 `main.py:85`, P1-4 `main.py:93-94`, P1-5 `wait_for` on Roboflow+Gemini, P1-6 20MB body cap, H-DEMO key rotation `inference.py:864-916`.

Remaining:

| ID | Task | Status | Notes |
|----|------|--------|-------|
| R3 | Add `noopener` to `LivePreview.tsx:311` without breaking the blob preview (e.g. set `newWindow.opener = null` after open) | ❌ | Low priority, deliberately reverted before |
| P2-1 | Auto-save in-flight guard (`isSaving` ref to skip concurrent saves) | ❌ | Minor; auto-save otherwise works |
| QA | Run the `HASSAN_TODO.md` "Verify before demo" checklist (detection round-trip, chat refine, save/load, version history, onboarding, delete cascade, auth redirect) | ❓ | Never ticked |
| INT | Final integration + QA once Maarij/Bilal close their items | open | Your closing task |
| DOCS | Apply Section 6 doc corrections | open | Do this first; docs are currently misleading |

> Per project rules, do not take Maarij's or Bilal's implementation items. R3/P2-1 stay with you because they are security/integration leftovers you already owned.

### 4b. Maarij — Frontend

Real regressions first, then the unapplied fix-plan items.

| ID | Task | Status | Evidence |
|----|------|--------|----------|
| R1 | **Fix rename end-to-end**: call `updateProjectTitle` from the dashboard handler, wire `onRename` + inline edit UI in `ProjectCard`, add empty-title guard | ❌ | `dashboard/page.tsx:501`, `ProjectCard.tsx:34,150`, `useProjectSave.ts:232` |
| R2 | **Resolve `useCanvasShortcuts`**: either wire it into `canvas/page.tsx` (with memoized handlers / ref pattern) or delete it | ❌ | `useCanvasShortcuts.ts:27` |
| M6-1 | Onboarding focus trap (Tab containment + initial focus) | ❌ | `OnboardingTour.tsx:117-147` |
| M6-2 | Onboarding backdrop click interceptor | ❌ | `OnboardingTour.tsx:228` |
| M6-3 | Onboarding tooltip position flash (gate opacity on `tooltipPos`) | ❌ | `OnboardingTour.tsx:258-264` |
| M6-4 | Consolidate onboarding localStorage keys (3 prefixes + debug key → 2) | ❌ | `dashboard/page.tsx:56-59` |
| M7-1 | Remove `window.location.reload()` after profile save | ❌ | `profile/page.tsx:184` |
| M7-4 | Revoke avatar blob URL (leak) | ❌ | `profile/page.tsx:101` |
| M7-5 | Memoize `createClient()` in profile | ❌ | `profile/page.tsx:29` |
| M4-2 | Remove legacy `name` fallback insert | ❌ | `dashboard/page.tsx:246-254` |
| M4-3 | Memoize `createClient()` in dashboard | ❌ | `dashboard/page.tsx:84` |
| M4-4 | Use Toast for delete errors (not inline banner) | ❌ | `dashboard/page.tsx:834` |
| M4-5 | Remove `console.debug` + onboarding debug key | ❌ | `dashboard/page.tsx:184,354,397` |
| M2 | `useVersionHistory`: type `canvas_data` as `CanvasData`, check `compareVersions` errors, optimistic `createVersion` | ❌ | `useVersionHistory.ts:8,197,117` |
| M1-4 | Stop setting `updated_at` client-side | ❌ | `useProjectSave.ts:155,240` |
| M5 | Split empty states into 2 components; add `type="button"` to Clear filters | ❌ | `dashboard/page.tsx:852-948` |
| M12 | Mobile responsiveness (canvas chrome + code panel pass) | ⚠️ | partial per CLAUDE.md |
| M13 | Animations (rest of app) | ⚠️ | partial per CLAUDE.md |
| M15 | Docs cleanup | ❌ | not started |
| Bridge | Replace 500ms canvas poll with explicit `onChange` in `SketchCanvas` | ⚠️ | candidate |

Already applied (do not redo): `useProjectSave` memoization (`useProjectSave.ts:88`), profile uses `DashboardLayout` (`profile/page.tsx:229`), expanded `Profile` interface (`profile/page.tsx:18`).

### 4c. Bilal — Backend / DB

| ID | Task | Status | Evidence |
|----|------|--------|----------|
| B4 | Proxy log scrub | ✅ | `proxy.ts` clean — just needs the doc tick |
| B1 | DB schema unification | ✅ | `migration 20260430000001` (rename to title/thumbnail_url/iterations, cascade FK, auto-version trigger, RLS) |
| B2 | FastAPI persistence layer | ✅/❓ | `main.py:268-300` writes iteration+project, `load_project_or_403` enforces ownership. Confirm any remaining "fix" intent |
| B5 | Framework selector backend | ⚠️ | `inference.py:1145-1149` branches react/html/vue; confirm frontend exposes the selector |
| B8 | Error retry logic | ⚠️ | Gemini key rotation + OpenRouter 2x retry done; Roboflow has timeout but no retry |
| B3 | Auth callback race fix | ❓ | route exists `auth/callback/route.ts`; internals not traced |
| B6 | Export-as-ZIP **endpoint** | ❌ | no backend endpoint in `main.py` (client-side `export-zip.ts` exists) |
| B7 | Rate limiting on AI endpoint | ✅ | per-user sliding-window limiter `app/utils/rate_limit.py`; wired into `/api/predict` (`main.py`), 429 + `Retry-After`, env-tunable. Done 2026-06-26 |
| B9 | CI/CD pipeline + lint | ❌ | no `.github/workflows` |
| B10 | Clean `inference.py` interface | ❓ | subjective; not assessed |
| B11 | Frontend + backend tests | ⚠️ | infra + first suites on BOTH sides. Backend: pytest, 42 tests, all pass: `tests/test_rate_limit.py` (14 — limiter, fake-clock + real-thread lock test) + `tests/test_synthesis_helpers.py` (28 — bbox geometry, canvas-extent inference, container reclassify/synthesis, text-to-element matching); infra `pytest.ini` + `conftest.py` (path + conditional cv2 stub) + `requirements-dev.txt`. Frontend: Vitest 4.1.9, 17 tests in `src/types/canvas.test.ts` (clampZoom, clampCodePanelHeight, bounds invariants, TOOL_KEY_MAP); infra `vitest.config.ts` + `pnpm test`/`test:watch` scripts; clamp helpers moved into `src/types/canvas.ts` (exported) so tests guard the real path. Broader coverage ongoing. Started 2026-06-26 |
| B12 | API response caching | ❌ | none |
| B13 | Accuracy + speed metrics | ⚠️ | write-up in Audits doc; no code metrics |

---

## 5. Non-issues — verified safe, do NOT spend time

| Claimed problem (from MAARIJ_TASK_FIXES) | Why it is safe |
|------------------------------------------|----------------|
| M1-3 / M4-1: raw `.delete()` leaves orphaned iterations | `iterations` FK is `ON DELETE CASCADE` (`migration 20260430000001:61`). No orphans occur. The `delete_project` RPC also exists but is redundant. Optional cleanup, not a bug |
| M1-2: auto-save never fires due to unstable `updateProject` | The applied memoization (`useProjectSave.ts:88`) stabilizes the reference, so auto-save works despite the structural refactor not being done |
| M14: shortcut listener re-attaches every render | Moot — the hook is not used at all (see R2) |

---

## 6. Where to update the "DONE" status (closeout instructions)

When you finish an item, update **all** of the following so the docs stop drifting:

1. **This file** (`Audits/CODE_VERIFIED_STATUS.md`)
   - Flip the item's status mark (❌ → ✅) in its table row.
   - Bump `Last updated:` at the top to the date you edited it.

2. **`CLAUDE.md` → "Current Status"**
   - Move finished items between `✅ Fully Done` / `⚠️ Partially Done` / `❌ Not Started`.
   - **Immediately**: move **rename** and **canvas keyboard shortcuts** OUT of "Fully Done" (they are R1/R2, broken). Re-add them only when R1/R2 are actually fixed.
   - **Immediately**: mark **B4** done in Bilal's list.
   - Bump the `Last updated:` line at the top of CLAUDE.md.

3. **`CLAUDE.md` → "Current Task Assignments"**
   - Tick the matching B# / M# line when its work lands.

4. **`Audits/MAARIJ_TASK_FIXES.md`**
   - For each M-issue closed, add `[DONE <date>]` next to the issue heading so the plan reflects reality.

5. **`Audits/HASSAN_TODO.md`**
   - Tick P2-1 and P2-3 in the checklist when done.

6. **`Audits/COMPLETED_TASKS.md`** (if used as the changelog)
   - Add a one-line entry, most recent first, for any feature that fully landed.

### Update rules (from the global instructions)
- Status moves + adding new files = just do it (low-risk, factual).
- Removing or rewriting existing sections = ask Hassan first.
- Always use **absolute dates** (e.g. 2026-06-25), never "today"/"yesterday".
- Keep user-facing copy free of em-dashes and emojis (code comments/commits/docs are exempt).

---

## 7. Recommended order of work

1. **Hassan**: apply Section 6 doc corrections now (docs are actively misleading). ~15 min.
2. **Maarij**: R1 (rename) first — it is the only shipped-broken feature. Then R2, then M6 (onboarding a11y), then hygiene (M4-5, M7-1).
3. **Bilal**: tick B4; then B7 (rate limit) and B11 (tests) as the highest-value gaps before demo; B1 already done.
4. **Hassan**: run the verify-before-demo checklist, then final integration/QA.

---

## 8. Evidence index (quick jump)

- Rename: `useProjectSave.ts:232`, `dashboard/page.tsx:501`, `ProjectCard.tsx:34,150`
- Shortcuts: `useCanvasShortcuts.ts:27`
- noopener: `LivePreview.tsx:311`
- Proxy logs (clean): `proxy.ts`
- Schema unify + cascade: `supabase/migrations/20260430000001_unify_canonical_schema.sql:61`
- delete_project RPC: `supabase/migrations/20260515000001_add_delete_project_function.sql`
- Backend hardening: `main.py:61-95,807-946,963-976,1164-1189`
- Gemini key rotation / framework / image: `inference.py:864-916,1145-1149,895-899`
- Onboarding: `OnboardingTour.tsx:117-147,228,258-264`
- Profile: `profile/page.tsx:18,29,101,184,229`
- Dashboard: `dashboard/page.tsx:56-59,84,184,246-254,354,397,501,834`
