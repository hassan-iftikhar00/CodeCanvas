# FYP Feature Roadmap — CodeCanvas Depth Upgrade

> Last updated: 2026-07-04
> Source: planning session 2026-07-04 (ideas researched + ranked, then implementation started same day).
> The plan below is preserved verbatim as written; this status block tracks execution.

## Status — what is done so far

| #   | Idea                                      | Status                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Fidelity Score — Cyclic Self-Verification | ✅ DONE (2026-07-04) — `backend/app/utils/fidelity.py`, `POST /api/fidelity`, `src/app/api/fidelity/route.ts`, badge in canvas detection strip. Validated live: faithful render 1.00, degraded 0.40. Extras beyond plan: Canny line-art normalization of the render (detector is line-art-trained), cross-class duplicate suppression, positional navbar/footer reclassification. 27 tests. See CLAUDE.md Decision #25. |
| 2   | Auto-Repair Pass                          | ✅ DONE (2026-07-04) — `build_repair_prompt` + `prompt_override` in `inference.py`, `POST /api/repair`, `src/app/api/repair/route.ts`, auto-triggers once when score < 0.8, badge shows before → after. Validated live: 0.40 → 0.89. One pass only, never a loop. See CLAUDE.md Decision #26.                                                                                                                           |
| 3   | Comparative Benchmark                     | ❌ Not started — Skipping for now                                                                                                                                                                                                                                                                                                                                                                                       |
| 4   | Human-in-the-Loop Detection Editor        | ✅ DONE (2026-07-04) — new `POST /api/detect` (Roboflow-only step), `DetectionReviewOverlay.tsx` (relabel/delete/draw boxes over the sketch), corrected set goes to `/api/predict` as `correctedElements` (skips Roboflow + container synthesis), corrections logged to `detection_corrections` (migration `20260704000001`, apply in Supabase). Fallback to one-shot path if detect fails. 12 tests. See CLAUDE.md Decision #27. |
| 5   | Multi-Screen Flows                        | ❌ Not started (only after #3)                                                                                                                                                                                                                                                                                                                                                                                          |
| 6   | Incremental Regeneration (Sketch Diffing) | ❌ Not started                                                                                                                                                                                                                                                                                                                                                                                                          |
| 7   | Urdu / Bilingual Sketch Support           | ❌ Not started (planned week-6 garnish)                                                                                                                                                                                                                                                                                                                                                                                 |
| 8   | Accessibility Auditor                     | ❌ Not started (filler only)                                                                                                                                                                                                                                                                                                                                                                                            |

Also done same day (unplanned but blocking): `pnpm lint` migrated from the removed `next lint` to the ESLint CLI (Next 16 broke it; CI frontend job was red). 0 errors now.

---

# CodeCanvas — Feature Ideas to Move From "Demo" to "System" (FYP Depth Analysis)

## Context

Current flow: sketch → detect (Roboflow) → generate (Gemini) → done. One-shot, no loop, no
measurement visible to user, no reason to return. Viva risk: "why not just send the image to
ChatGPT?" Needs: depth, closed feedback loop, measurable superiority, demo arc.

Assets already in repo that ideas below build on (reuse, don't rebuild):

- `backend/scripts/eval_pipeline.py` — detection P/R harness + per-image prompt/code artifacts
- `timing_ms` metrics (B13), response cache (B12), rate limiter (B7)
- `role_inference.py` deterministic hints + `temperature=0.1` fidelity stack (Decision #24)
- `LivePreview.tsx` (renders generated code), Playwright available for headless render
- Supabase (`iterations` table) for any persistence

---

## Ideas (ranked, honest gimmick-tagging)

### 1. Fidelity Score — Cyclic Self-Verification ⭐ core recommendation

**What:** After Gemini generates code, render it headless (Playwright screenshot of LivePreview
route), run the SAME Roboflow detector on the rendered screenshot, and match detected boxes
against the original sketch's boxes (class-aware IoU / Hungarian matching). Output one number:
"Fidelity: 92%" shown next to the generated code, plus a per-element mismatch report
(missing button, extra heading, misaligned navbar).
**Why for viva:** This is the killer answer to "why not ChatGPT?" — ChatGPT cannot measure its
own output. CodeCanvas closes the loop with the same vision model that opened it (cycle-consistency,
same intuition as CycleGAN's consistency loss, applied to sketch→code). Quantitative, novel among
FYPs, uses zero new training.
**Files:** new `backend/app/utils/fidelity.py` (box matching — reuse eval_pipeline matching code),
new backend endpoint or extension of `/api/predict`, small render-capture script (Playwright),
`canvas/page.tsx` + code panel UI for the score badge.
**Effort:** Medium (1 week, the matching math already exists in eval harness).
**Wow:** High — live score appearing after generation is a visible "the system checks itself" moment.
**Gimmick?** No. Genuine technical contribution + dissertation metric.

### 2. Auto-Repair Pass (rides on #1)

**What:** If fidelity < threshold, feed the mismatch report back to Gemini as a corrective
instruction ("button 'Confirm' at (x,y) missing — add it; do not change anything else") and
regenerate once. Show before/after score in UI.
**Why for viva:** Turns the score into a control loop — detect → generate → verify → repair.
"Self-healing generation" is a phrase examiners remember. Directly measurable improvement
(avg fidelity before vs after repair = dissertation table).
**Files:** `inference.py` (one extra Gemini call path), `main.py` orchestration, UI badge.
**Effort:** Small (2-3 days once #1 exists).
**Wow:** High — score visibly climbing 78% → 96% on stage is the demo money-shot.
**Gimmick?** No.

### 3. Comparative Benchmark — "Us vs Raw Multimodal LLM"

**What:** Extend `eval_pipeline.py`: same N sketches through (a) CodeCanvas full pipeline,
(b) image straight to Gemini with a plain "generate code" prompt (the ChatGPT baseline).
Render both, re-detect both, score element recall/precision + fidelity. Produce a table.
**Why for viva:** THE research-contribution artifact. Claim becomes: "detection-grounded
structured prompting beats end-to-end multimodal prompting by X% element recall" — a defensible,
falsifiable result. Also feeds dissertation chapter directly. No UI work at all.
**Files:** `backend/scripts/eval_pipeline.py` (add baseline mode + fidelity scoring), docs.
**Effort:** Small-Medium (3-5 days, mostly reuses #1's scorer).
**Wow:** Medium in live demo, HIGH in viva slides.
**Gimmick?** No — this is the difference between "tutorial project" and "research project".

### 4. Human-in-the-Loop Detection Editor

**What:** Before generation, overlay the Roboflow boxes + confidences on the sketch; user can
relabel a box (card→navbar), delete a false positive, or draw a missed box. Corrected set goes
to Gemini. Every correction is logged to Supabase (future fine-tuning dataset — logged only,
no training now).
**Why for viva:** "Interactive grounding" — user controls the intermediate representation,
impossible with ChatGPT (black box). Correction log = "the system collects data to improve
over time" answer, without adding training scope. Also rescues bad demos live (fix a miss on stage).
**Files:** new overlay component (Konva already in stack), `canvas/page.tsx` state,
`main.py` accepts pre-corrected detections (skip Roboflow when provided), one Supabase table.
**Effort:** Medium (1 week).
**Wow:** High — visibly shows the AI's "thoughts" and lets human steer them.
**Gimmick?** No. Standard research pattern (HITL) rarely seen in FYPs.

### 5. Multi-Screen Flows

**What:** User sketches 2-3 screens; draws arrow annotations or names link targets; system
generates a multi-page React app with working navigation between generated pages.
**Why for viva:** Output stops being a snippet and becomes an application. Strong demo arc ending.
**Files:** `canvas/page.tsx` (screen tabs), prompt builder in `inference.py` (per-screen +
router shell), `export-zip.ts` (multi-page scaffold).
**Effort:** Large-ish Medium (1.5-2 weeks). Biggest scope risk on this list — constrain to
"named pages + nav links", no conditional flows.
**Wow:** High.
**Gimmick?** No, but only take it if #1-#3 are done first.

### 6. Incremental Regeneration (Sketch Diffing)

**What:** User modifies the sketch after generation; system diffs old vs new detection sets and
sends only the delta to Gemini ("add input below email field; keep everything else identical"),
preserving prior code (and any chat refinements).
**Why for viva:** Replayability answer — the reason to come back. "Incremental synthesis"
sounds and is smart; cache (B12) + iterations table already give the substrate.
**Files:** `main.py` (detection-set diff), `inference.py` (delta prompt mode), `page.tsx`.
**Effort:** Medium (1 week).
**Wow:** Medium-High.
**Gimmick?** No, but subtle to get right (Gemini must not rewrite untouched code — mitigated
by low temperature + strict-fidelity discipline already in place).

### 7. Urdu / Bilingual Sketch Support (hidden gem)

**What:** Sketches labeled in Urdu (or mixed Urdu/English) generate correct RTL layouts with
proper `dir="rtl"`, Urdu web fonts (Noto Nastaliq), and the labels rendered verbatim. Detection
is language-agnostic (boxes only); Gemini multimodal already reads the text (Decision #22 path).
**Why for viva:** Local-impact box that Pakistani examiners specifically reward — "built for
Pakistani SMEs sketching in their own language." Nobody else's FYP demo has a hand-drawn Urdu
login form turning into working RTL code. Cheap because the pipeline barely changes.
**Files:** prompt block in `inference.py` (RTL/lang rules), test sketches, maybe font in preview.
**Effort:** Small (2-4 days, mostly testing Gemini's Urdu OCR quality).
**Wow:** High locally.
**Gimmick?** Borderline if done shallow; real if you show RTL layout logic actually flipping.

### 8. Accessibility Auditor (honest: useful but commodity)

**What:** Run axe-core against LivePreview output; list WCAG violations; one-click "fix"
routes them through the existing chat-refinement pipeline.
**Effort:** Small. **Wow:** Medium. **Gimmick?** Half — real value, but examiner has seen
a11y checkers before. Take only as filler.

### Rejected as gimmicks

- Theme/style presets ("corporate/playful") — prompt sugar, no depth.
- One-click deploy to Vercel — plumbing, zero research content.
- Analytics dashboard of timing metrics — data exists (B13), page adds nothing to defense.
- "Learns user preferences from chat history" — fuzzy, unfalsifiable, hard to demo honestly.

---

## Top 3 with 6 weeks left (as lead dev)

1. **#1 Fidelity Score** (week 1-2) — foundation everything else stands on.
2. **#2 Auto-Repair** (week 2) — cheap once #1 lands, biggest demo payoff.
3. **#3 Comparative Benchmark** (week 3) — converts the feature into a research claim with numbers.

Then #4 HITL editor (weeks 4-5) if pace holds; #7 Urdu support as the low-cost garnish in week 6.

**Demo arc this buys:** draw sketch → boxes appear (system "sees") → user fixes one box (human
in loop) → code generates → fidelity 81% → auto-repair → 95% → switch to Urdu sketch → RTL app.
Beginning, middle, wow.

## Hidden gem for Pakistani examiners

**#7 Urdu/RTL support.** Ties directly to national digital-inclusion narrative, costs days not
weeks, and is a demo moment no other FYP in the room will have.

## Team split (respects ownership rules)

- Bilal: fidelity scorer + benchmark (backend, extends his eval/test work)
- Maarij: score badge UI, HITL overlay, screen tabs (frontend)
- Shahwaiz: benchmark sketch set + ground truth, Urdu test corpus (model-side eval, no training)
- Hassan: integration of render-capture loop + final QA only

## Verification

- Fidelity scorer: unit tests on box matching (reuse eval_pipeline fixtures); golden test —
  known-good generation scores >90%, deliberately broken code scores <50%.
- Benchmark: run on 15 synthetic + real sketch set, table lands in `Audits/`.
- End-to-end: Playwright visual check of score badge + repair flow on Login Form template.
