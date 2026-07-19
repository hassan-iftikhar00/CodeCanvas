# CodeCanvas — Sprint Timeline

> Source-traced development timeline for the FYP sprints chapter.
> Every row traces to git history or a dated entry in `CLAUDE.md` / `Audits/COMPLETED_TASKS.md`.
> Generated: 2026-07-18. Structured as eight monthly sprints (Dec 2025 -> Jul 2026; idea proposal accepted 2026-11-20, work began December).
> Sprints 2-8 are traced line-by-line to git and dated notes. Sprint 1 (December planning) and March are described at phase/effort level only, with no feature invented — fill them from the proposal/SRS/design documents. See "Method and caveats".

---

## Method and caveats (read first)

This timeline was assembled from two evidence sources only:

1. **Git history** — `git log --all` across every ref, deduplicated by commit hash, merges separated from non-merges.
2. **Dated project notes** — the "Fully Done" entries and dated Decisions in `CLAUDE.md`, plus the dated entries in `Audits/COMPLETED_TASKS.md`.

**Git silence does not prove idleness.** A month with no commits does not mean no work happened — the team worked locally and pushed in batches, so unpushed local development (design, dataset experiments, refactors that were later squashed) leaves no trace on the graph. This is why the sprint plan below spans the full project (December kickoff through July) and does not treat any month as "dead"; git dates bound *when a push happened*, not *when work happened*. Beyond that, four things distort the raw git picture:

- **Two squash commits hide most of the real work.** The commit `2026-06-29` ("Drafting Room migration, upload input, rate limiting, test infra, canvas redesign") and `2026-07-05` ("feat: fidelity loop, auto-repair, HITL, incremental regen, ...") are each a single squashed commit that bundles dozens of individually dated pieces of work. The `COMPLETED_TASKS.md` entries dated 2026-06-12 through 2026-06-17 all land inside the 06-29 squash; the `CLAUDE.md` "Fully Done" entries dated 2026-07-02 through 2026-07-05 all land inside the 07-05 squash. **Git commit dates therefore under-report activity in mid-June and early-July.** Where a dated note exists, the note's date is treated as the true work date, not the squash date.
- **Test-suite file creation dates are unreliable.** Because the test files were introduced inside those same squash commits, `git log --diff-filter=A` on `backend/tests/*.py` reports only the squash dates. Test-suite attribution below is therefore taken from the dated `CLAUDE.md` notes, not from file history.
- **Author identities are aliased.** `Hassan`, `Hassan Iftikhar`, and `hassan-iftikhar00` are the same person (Hassan, lead). `copilot-swe-agent[bot]` is Hassan's cloud coding-agent session (the Feb canvas-tools batch merged as PR #3). `Maarij Sarfraz` is Maarij. Shahwaiz's model deliveries do not appear in this repo's git log (the model lives on Roboflow); his v4 delivery is dated from the `CLAUDE.md`/`COMPLETED_TASKS.md` note (2026-06-11).
- **Stash noise.** Three entries dated 2026-02-19 ("WIP on main", "index on main", "untracked files on main") are git-stash objects, not real commits. They are excluded from the counts below.

---

## 1. Month-by-month table

Commit counts are deduplicated by hash and exclude merges and stash objects. "Work landed" cross-references commit messages against `COMPLETED_TASKS.md` and the dated `CLAUDE.md` "Fully Done" entries; where a squash commit bundles dated work, the bundled dates are named.

| Month | Commits | Per author | What landed (evidence) |
|-------|---------|------------|------------------------|
| **2026-01** | 5 | Hassan 4, Maarij 1 | Project bootstrap (Create Next App), Supabase client wiring, first auth. PR #1 (Maarij) merged 01-28. *(git)* |
| **2026-02** | ~11 real + bot | Hassan ~5, Maarij 2, copilot-bot 12 | Signup/login work (Maarij, PR #2 merged 02-04), login fix + logo (02-09). Canvas core tools batch via cloud agent: ellipse/triangle/arrow shapes, eraser/selection, snap-to-grid, export, info overlay (copilot-bot 02-18, merged as PR #3 on 02-19). Canvas page improvement + VS Code cloud-agent checkpoint (02-19). *(git)* |
| **2026-03** | **0** | — | 0 commits on any ref, but not idle: local unpushed development (surfaces in the 04-16 refinement commit). See Sprint S4. *(git)* |
| **2026-04** | 2 | Hassan 2, Maarij 1 | Sketch-first AI refinement + dashboard navigation upgrades (04-16). Maarij "tasks 2-5" (04-19, merged PR #6 on 04-22). **H4: Roboflow + Gemini pipeline wired end-to-end (04-30)** — first working sketch-to-code. *(git; CLAUDE.md Fully Done "H4")* |
| **2026-05** | 5 | Hassan 5, Maarij 1 | Canvas workspace redesign + matching hardening (05-08). Synthetic dataset generation + removal churn (05-13/05-14). Maarij M4/M5/M6 completed (05-19, merged PR #7). Context-file update: synthetic pipeline + Maarij audit (05-19). *(git; COMPLETED_TASKS "Canvas UX", CLAUDE.md)* |
| **2026-06** | ~12 | Hassan ~11, Maarij 1 | Deploy plumbing (monaco peer dep, vercel.json add/remove, 06-07). PR #8 (Maarij) integrated 06-10: auth flow, dashboard, profile, theme system, ErrorBoundaries. **v4 model delivered by Shahwaiz (06-11)**, local sanity + Playwright smoke test, threshold re-tune, latency fixes, promoted to `.env` (06-12). Decision #20 retired (06-12). Full Drafting Room migration + LivePreview Babel-8 fix (06-12 to 06-17, per COMPLETED_TASKS). **Squash commit 06-29** bundles: Drafting Room migration, Upload Image input, B7 rate limiting, B8 retries, B9 CI/CD, B3 auth-callback fix, B4/B5, test infra. *(git; COMPLETED_TASKS 06-12..06-17; CLAUDE.md Fully Done)* |
| **2026-07** | 16 | Hassan 16 | **Squash commit 07-05** bundles the App Uplift round: fidelity loop, auto-repair, HITL review, incremental regen, brand kit, share link, version diff, element-code linker, responsive gen, StackBlitz, caching (B12), speed metrics (B13). Then annotate-on-render + multi-screen flows (07-06), Render Docker deploy + cross-screen bleed fixes (07-10), incremental context/id guards + wrapper hint (07-11), multi-screen data-loss audit (07-12), annotate-vs-repair race + annotate targeting (07-13), free Gemini model ladder + key health script + hidden control panel (07-17). *(git; CLAUDE.md Fully Done entries)* |

---

## 2. Chronological event list

Every dated event extracted from `CLAUDE.md` (Fully Done entries + dated Decisions) and `COMPLETED_TASKS.md`, merged with the load-bearing git milestones, in date order. Evidence column: `git` = commit, `CM` = CLAUDE.md, `CT` = COMPLETED_TASKS.md.

| Date | Event | Evidence |
|------|-------|----------|
| 2026-01-12 | Initial commit (Create Next App) | git |
| 2026-01-26 | Supabase client files added | git |
| 2026-01-28 | PR #1 (Maarij) merged; early auth | git |
| 2026-02-02 | Signup/login modifications (Maarij) | git |
| 2026-02-04 | PR #2 (Maarij) merged; auth-change conflict resolution | git |
| 2026-02-09 | Login issue resolved + logo | git |
| 2026-02-18 | Canvas tools batch: shapes, eraser, selection, snap-to-grid, export, info overlay (cloud agent) | git |
| 2026-02-19 | PR #3 merged; canvas page improvement | git |
| 2026-04-16 | Sketch-first AI refinement + dashboard navigation upgrades | git |
| 2026-04-19 | Maarij tasks 2-5 (PR #6, merged 04-22) | git |
| 2026-04-30 | **H4: Roboflow + Gemini pipeline end-to-end** | git, CM |
| 2026-05-08 | Canvas workspace redesign + matching hardening | git |
| 2026-05-13/14 | Synthetic dataset generation + removal | git |
| 2026-05-19 | Maarij M4/M5/M6 completed (PR #7); context-file update | git, CM |
| 2026-06-07 | Deploy plumbing (monaco peer dep, vercel.json) | git |
| 2026-06-10 | Canvas UX bug batch; state-bridge + undo fix + project-load loop | git, CT |
| 2026-06-10 | PR #8 (Maarij): auth flow, dashboard, profile, theme system, ErrorBoundaries | git, CM |
| 2026-06-11 | **v4 model delivered (Shahwaiz)** — YOLOv11 Small, 4,481-image corpus | CM, CT |
| 2026-06-12 | v4 local sanity + Playwright smoke on 4 templates + Login Form | CT |
| 2026-06-12 | v4 thresholds re-tuned; 60s Roboflow timeout + startup warm-up; promoted to `.env` | git, CM |
| 2026-06-12 | **Decision #20 retired** (orphan-label synthesis deleted) | git, CM |
| 2026-06-12 to 06-14 | Auth pages, canvas chrome, dashboard, profile migrated to Drafting Room (Phases 1-4) | CT |
| 2026-06-14 | Export-as-ZIP wired; Toast migrated; Monaco dark slab; `--cc-*` retired; dead code removed | CT |
| 2026-06-15 | UI audit (all High/Medium + Low items); SVG wireframe thumbnails; container reclassification + horizontal layout rule | CT |
| 2026-06-16 | COMPLETED_TASKS split out of CLAUDE.md | CT |
| 2026-06-17 | LivePreview React preview fixed under Babel 8 (pinned `@babel/standalone@8.0.1`) | CT |
| 2026-06-17 | **Gemini/proxy timeout hardening** (110s / 120000ms env ceilings) | CM |
| 2026-06-17 | **Upload Image input** + workspace swap + multimodal text-reading (Decisions #21, #22) | CM |
| 2026-06-26 | **B7 rate limiting**; B4 proxy-log scrub confirmed; B11 test infra + first suites | CM |
| 2026-06-29 | **B9 CI/CD pipeline** (`.github/workflows/ci.yml`) | CM |
| 2026-06-29 | Squash commit lands June work on main | git |
| 2026-06-30 | **B3 auth-callback race fixed**; **B8 Roboflow retries**; **B5 framework selector** | CM |
| 2026-07-02 | **B12 API response caching**; **B13 speed metrics** | CM |
| 2026-07-04 | **Generation fidelity fixes** (temp 0.1, role hints, alignment) — Decision #24 | CM |
| 2026-07-04 | **Fidelity self-check loop** (`/api/fidelity`, Playwright re-detection) — Decision #25 | CM |
| 2026-07-04 | **Auto-repair pass** (`/api/repair`) — Decision #26 | CM |
| 2026-07-04 | **HITL detection review editor** (`/api/detect`) — Decision #27 | CM |
| 2026-07-04 | Lint migrated to ESLint CLI; reading-order sort; App Uplift G+J (responsive, StackBlitz) | CM |
| 2026-07-05 | **App Uplift C+D** (element-code linker, incremental regen) — Decision #28 | CM |
| 2026-07-05 | **App Uplift I+E+H** (share link, version diff, brand kit) | CM |
| 2026-07-05 | Live-test feedback fixes rounds 1 + 2; CanvasData persistence passthrough | CM |
| 2026-07-05 | Squash commit lands App Uplift on main | git |
| 2026-07-06 | Annotate-on-render refinement (B) + multi-screen flows (A) | git |
| 2026-07-08 | Container-shadow-card dedup + wrapper-card image veto | CM |
| 2026-07-09 | Fidelity scoring overhaul (false-0.00 fix); auto-repair safety guards; dashboard-sketch fidelity round; Windows render fix | CM |
| 2026-07-10 | Render Docker backend deploy; cross-screen sketch bleed fix; Vercel maxDuration caps | git, CM |
| 2026-07-11 | Incremental context gate + class-stub guard + id-coverage guard + wrapper hint + per-screen context recording | git, CM |
| 2026-07-12 | Multi-screen isolation audit (11 fixes, autosave screen-wipe) | git, CM |
| 2026-07-13 | Annotate-vs-repair race + annotate innermost-target resolution; mini-canvas draft persistence | git, CM |
| 2026-07-17 | **Free Gemini strategy** — model ladder, key health script, hidden control panel — Decision #29 | git, CM |

---

## 3. Sprint plan (eight monthly sprints, Dec 2025 -> Jul 2026)

The FYP idea proposal was accepted on **2026-11-20** (November 20, 2025), and active project work began in **December 2025**. Git only starts capturing on 2026-01-12 (first code push), so the December planning/design work and the March development month left no commits — but they were worked (git dates bound *when a push happened*, not *when work happened*). The plan below divides the Dec-to-Jul span into eight monthly sprints so the chapter reflects the real project duration, not just the git-visible slice.

Sprint 1 (December) has **no git artifacts**; its content is a placeholder to be filled from the proposal / SRS / design documents, not invented here. Sprints 2-8 are anchored to real git and dated-note evidence.

| # | Month | Phase | Evidence basis |
|---|-------|-------|----------------|
| S1 | Dec 2025 | Proposal follow-through: requirements, architecture, design, feasibility | none in git — planning phase (fill from proposal/SRS/design) |
| S2 | Jan 2026 | Project bootstrap + auth | git |
| S3 | Feb 2026 | Auth complete + canvas core | git |
| S4 | Mar 2026 | Local development (unpushed) | inferred local work — no commits |
| S5 | Apr 2026 | AI pipeline bring-up (H4) | git, CM |
| S6 | May 2026 | Canvas redesign + dataset + team integration | git, CT |
| S7 | Jun 2026 | Model v4 + Drafting Room + hardening | git, CM, CT |
| S8 | Jul 2026 | App uplift + multi-screen + model ladder | git, CM |

---

### S1 — December 2025 · Requirements, architecture and design

**Candidate goal:** Turn the accepted proposal (idea approved 2026-11-20) into a specified, designed, feasibility-checked plan ready to build.

**Work (from planning docs, not git):**
- Problem definition and scope boundaries (draw-a-sketch focus; no collaboration, no offline — later formalised as Decisions #8/#9; Locofy-style screenshot tools ruled out of scope, later Decision #21).
- Functional / non-functional requirements and the four-layer architecture (Next.js frontend, FastAPI backend, Roboflow detection, Gemini generation).
- Stack selection: Next.js 14 + TypeScript + Tailwind, Konva canvas, Supabase auth/DB, Python FastAPI. Design-time decisions "Roboflow cloud not local" (#1) and "Gemini in one inference module" (#10) belong here.
- UI wireframes/mockups, database schema design (`projects` / `iterations` / `profiles`, later unified as Decision #4), synthetic-dataset strategy, Roboflow + Gemini feasibility spikes, dev-environment + Supabase project setup.

**Evidence:** none in git. Fill from the FYP proposal / SRS / design chapter. Nothing feature-specific is invented here.

**Test suites added:** none.

---

### S2 — January 2026 · Project bootstrap and auth

**Candidate goal:** Stand up the Next.js + Supabase skeleton and the first authentication flow.

**Features completed**
- Next.js app bootstrap (Create Next App) — git 2026-01-12.
- Supabase client files wired — git 2026-01-26.
- First auth work; Maarij PR #1 merged — git 2026-01-28.

**Decisions:** Supabase for auth/DB confirmed in practice (Decision #4 lineage).

**Bugs fixed:** none dated.

**Test suites added:** none.

---

### S3 — February 2026 · Auth complete and canvas core

**Candidate goal:** Finish signup/login and build a usable drawing canvas.

**Features completed**
- Signup/login modifications (Maarij, PR #2 merged 02-04); login-issue fix + logo (Hassan 02-09) — git.
- Canvas drawing core via cloud-agent batch (02-18, merged PR #3 on 02-19): freehand plus ellipse / triangle / arrow shapes, eraser, selection, snap-to-grid, PNG export, info overlay — git.
- Canvas page improvement + VS Code cloud-agent checkpoint — git 02-19.

**Decisions:** none dated.

**Bugs fixed:** login issue (02-09); auth-change merge conflict (02-04).

**Test suites added:** none.

---

### S4 — March 2026 · Local development (unpushed)

**Candidate goal:** Continue matching / refinement groundwork locally between the canvas-core push and the AI-pipeline push.

**Work:** no commits landed this month. Per the team, development continued locally without pushes; the groundwork surfaces in the 2026-04-16 "sketch-first AI refinement" commit, which is too substantial to have been written in a single day. Treat March as active local work, not a gap.

**Evidence:** inferred from the shape of the 04-16 commit and the team's batch-push habit. **No git artifacts — do not attribute specific dated features here.** If local branches or editor history exist, cite them; otherwise describe this sprint at the effort level, not the feature level.

**Test suites added:** none.

---

### S5 — April 2026 · AI pipeline bring-up (H4)

**Candidate goal:** Make a drawn sketch produce real code by wiring Roboflow detection into Gemini generation.

**Features completed**
- Sketch-first AI refinement + dashboard navigation upgrades — git 04-16.
- Maarij tasks 2-5 (PR #6, merged 04-22) — git.
- **H4: Roboflow + Gemini sketch-to-code pipeline end-to-end** — git + CM, 04-30. The core thesis pipeline first working.

**Decisions:** #1 (Roboflow cloud) and #10 (Gemini in `inference.py`) are realised in code here.

**Bugs fixed:** none individually dated.

**Test suites added:** none.

---

### S6 — May 2026 · Canvas redesign, dataset and team integration

**Candidate goal:** Harden sketch matching, build the synthetic training dataset, and integrate the team's frontend milestones.

**Features completed**
- Canvas workspace redesign + matching hardening — git 05-08.
- Synthetic dataset generation pipeline — git 05-13/14.
- Maarij M4 / M5 / M6 completed (PR #7) — git 05-19.

**Decisions:** #15 (synthetic images to `train/` only; real splits evaluation-only), consistent with the dataset work.

**Bugs fixed:** matching-hardening pass (05-08).

**Test suites added:** none.

---

### S7 — June 2026 · Model v4, Drafting Room and hardening

**Candidate goal:** Ship the production v4 detector, add the Upload-Image input, migrate the UI to the Drafting Room design system, and harden the backend.

**Features completed**
- Deploy plumbing (monaco peer dep, vercel.json) — git 06-07.
- PR #8 (Maarij) integrated: auth flow, dashboard, profile, theme system, ErrorBoundaries — git + CM 06-10.
- **v4 model** delivered (Shahwaiz 06-11); local sanity + Playwright smoke; threshold re-tune; cold-start warm-up + 60s timeout; promoted to `.env` — git + CM + CT 06-12.
- Full **Drafting Room migration** (canvas, auth, dashboard, profile, landing) — CT 06-12..06-14.
- Export-as-ZIP (CT 06-14); SVG wireframe thumbnails (CT 06-15); UI audit High/Medium/Low (CT 06-15); LivePreview Babel-8 fix (CT 06-17).
- **Gemini/proxy timeout hardening** (110s / 120000ms) — CM 06-17.
- **Upload Image input** + workspace swap + multimodal text reading — CM 06-17.
- **B7 rate limiting** (06-26); **B9 CI/CD** (06-29); **B3 auth-callback fix**, **B8 Roboflow retries**, **B5 framework selector** (06-30) — CM.

**Decisions dated:** #20 retired (06-12); #21, #22 (upload modality + multimodal, 06-17); #23 (user-id rate-limit keying, 06-26).

**Bugs fixed:** Babel-8 preview breakage (06-17); auth-callback deadlock (06-30); Roboflow cold-start blips (06-30); v4 latency 504s (06-12).

**Test suites added (from dated notes):** B11 pytest infra + `test_rate_limit.py`, `test_synthesis_helpers.py`; frontend Vitest + `src/types/canvas.test.ts` (CM 06-26). Backend reaches ~62 tests by end of June.

**Flag:** the 06-29 squash commit compresses ~two weeks of dated work; use the CT/CM dates above.

---

### S8 — July 2026 · App uplift, multi-screen and model ladder

**Candidate goal:** Turn the working pipeline into a defensible product with self-verifying fidelity, human-in-the-loop review, incremental editing, sharing/branding, robust multi-screen projects, and a sustainable free-tier LLM strategy.

**Features completed**
- **B12 caching** + **B13 speed metrics** (07-02).
- **Generation fidelity fixes** (temp 0.1, role hints, alignment) — Decision #24 (07-04).
- **Fidelity self-check loop** `/api/fidelity` — Decision #25 (07-04).
- **Auto-repair pass** `/api/repair` — Decision #26 (07-04).
- **HITL detection review editor** `/api/detect` — Decision #27 (07-04).
- Reading-order sort; ESLint CLI migration; responsive gen (G); StackBlitz (J) (07-04).
- **Element-code linker (C)** + **incremental regen (D)** — Decision #28 (07-05).
- **Share link (I)** + **version diff (E)** + **brand kit (H)** (07-05).
- Annotate-on-render + multi-screen flows (07-06); shadow-card dedup (07-08); fidelity scoring overhaul + auto-repair guards + Windows render fix (07-09); Render Docker deploy + cross-screen bleed fix (07-10); incremental context/id guards + per-screen context (07-11); multi-screen isolation audit (07-12); annotate-vs-repair race fix (07-13).
- **Free Gemini strategy** — model ladder + key health script + hidden control panel — Decision #29 (07-17).

**Decisions dated:** #24-#27 (07-04); #28 (07-05); #29 (07-17).

**Bugs fixed:** false-0.00 fidelity -> destructive repair (07-09); Windows Playwright subprocess crash (07-09); cross-screen sketch bleed (07-10); autosave wiping `screens` array (07-12); annotate-vs-repair overwrite race (07-13); incremental noop recycling repair-damaged stubs (07-11).

**Test suites added (from dated notes):** `test_response_cache.py` (07-02); `test_fidelity.py` (07-04, overhauled 07-09); `test_hitl.py`, `test_reading_order.py` (07-04); brand-kit + incremental + `test_canvas_data.py` (07-05); `test_shadow_cards.py` (07-08); `test_incremental_guard.py` (07-11); `test_model_ladder.py` (07-17). Backend climbs from ~62 to 263; frontend Vitest to 40.

**Flag:** the 07-05 squash commit compresses the entire App Uplift round; use the per-feature CM dates above.

---

## 4. Open ambiguities (not guessed)

- **Sprint 1 (December) content** — no git artifacts exist before 2026-01-12. Its deliverables are described at phase level only and must be filled from the proposal / SRS / design documents. Nothing feature-specific is invented for it.
- **March 2026** — zero commits, but treated as active local work per the team (git silence != idleness). No specific dated features are attributed; describe at effort level unless local branch or editor history can be cited.
- **Model v2** — referenced in `CLAUDE.md` as the legacy detector but has **no commit** in this repo; its build date is outside tracked history and belongs to the pre-push design/dataset phase.
- **Bilal / Shahwaiz git presence** — neither appears as a git author (Bilal's backend work is squashed under Hassan's integration commits per the B-series notes; Shahwaiz's models live on Roboflow). Author-based effort attribution from git alone under-counts both; the dated notes are the better source for their contributions.
- **Per-feature commit granularity in June-July** — lost to the two squash commits. Dates above come from the dated notes, which are reliable for *when* work happened even though the git graph cannot corroborate each item independently.
