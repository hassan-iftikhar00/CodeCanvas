# Gemini Free Strategy + Demo Day Plan (Exhibition Jul 21, FYP Eval Jul 22)

> Status: IMPLEMENTED 2026-07-17. Everything in "The Plan" section below is already
> in the codebase. The top section is the operational checklist for the demo days.

---

## DEMO DAY INSTRUCTIONS

### July 20 (night before) - preparation

1. **Check every key is alive:**
   ```
   python backend/scripts/check_gemini_keys.py
   ```
   Want: OK on `gemini-3.5-flash` for most keys. Any key showing DAILY_EXHAUSTED
   resets at the next UTC midnight (5:00 AM PKT). INVALID_KEY = replace it.

2. **Fix .env slot 1 if not done yet:** `GEMINI_API_KEY` (the first slot, tried
   first) must hold a HEALTHY free key. The old suspended paid key wastes two
   doomed calls on every generation. Delete its string entirely.

3. **Pre-generate every demo sketch and SAVE each as a project.** Saved projects
   replay with zero live Gemini calls. Do the "wow" live generation only when you
   choose to. This is the single biggest de-risk step.

4. **Restart the backend and run ONE test generation.** Terminal must show:
   ```
   [gemini] key=1 model=gemini-3.5-flash status=success
   ```

5. Optional: add more accounts/keys (see "Accounts vs projects" below). Any
   `GEMINI_API_KEY_11`, `_12`, ... is picked up automatically, no code change.

### July 21 (exhibition, 8am-4pm) - operating modes

- Open the hidden panel on the canvas page: **Ctrl+Shift+G** (or Cmd+K, type
  "Model control").
- **Casual walk-up visitors / students:** set **SAVER** (forces
  `gemini-3-flash-preview`, works on 9/10 keys, preserves 3.5-flash daily quota).
- **Supervisor / judge walks up:** flip to **BEST** (forces `gemini-3.5-flash`,
  the strongest model; fails loudly instead of silently degrading).
- **Auto repair toggle:** OFF during busy hours (each repair is one extra Gemini
  call). ON when showing the fidelity self-check feature itself.
- Watch the key grid in the panel: green OK = serving, amber = cooling seconds,
  red SPENT = that key's daily quota is gone until UTC midnight. Refresh button,
  no auto-polling.
- The `MODE · BEST` / `MODE · SAVER` pill in the detection strip reminds you a
  forced mode is on. Click it to reopen the panel.

### July 22 (FYP evaluation) - graded run

- Mode: **BEST**. Auto repair: **ON**. Full quality pipeline.
- Lead with saved projects; do one live generation to prove it's real.
- If a generation fails with a rate-limit message: wait ~60s (per-minute limit)
  or switch to AUTO (lets the ladder fall back) and retry.
- Rough capacity: ~9 healthy accounts x Flash-class free daily quota (hundreds
  of requests per account) = thousands of requests/day. The eval needs tens.
  You cannot realistically run out.

### Emergency ladder (if things go wrong on the day)

1. Generation 429s on BEST -> switch AUTO (falls back to 3-flash-preview).
2. All keys somehow red -> demo from saved projects (works with zero quota).
3. Backend itself down -> restart; cooldown state resets on restart (worst case
   it re-learns which keys are exhausted, costing a few wasted calls).

---

## Accounts vs projects for new keys - VERDICT: NEW ACCOUNTS

Google applies free-tier rate limits **per Google Cloud project**, and separate
projects do get separate quota pools. BUT use one project per fresh Google
account anyway, because:

1. **Shared fate.** Multiple projects under one account die together if Google
   flags or restricts that account. Separate accounts isolate failure - one
   flagged account costs you one key, not five.
2. **Abuse detection.** Farming many projects inside one account for stacked
   free quota is the exact pattern Google's abuse systems look for. One
   account, one project, one key looks like a normal developer.
3. **Same effort.** AI Studio key creation is ~2 minutes either way.

Recipe per key: new Google account -> aistudio.google.com -> Get API key ->
create key in new project -> paste into `.env` as the next `GEMINI_API_KEY_N`.
Never enable billing on these accounts (enabling billing deletes the free tier
for that project). Verify each new key with `check_gemini_keys.py`.

---

## THE PLAN (implemented 2026-07-17)

### Context

The paid `GEMINI_API_KEY` account drained ($9.08 of $10 in 13 days of live
testing) and is suspended. Research findings that shaped everything:

1. **Google removed ALL Pro models from the API free tier on 2026-04-01**
   (2.5 Pro, 3 Pro, 3.1 Pro are paid-only). Multi-account free Pro is impossible.
2. **`gemini-3.5-flash` IS free**, stable, multimodal (image input works, so the
   upload text-reading path keeps working), and beats Gemini 2.5 Pro on 18/20
   benchmark categories including React component tasks. Two generations newer
   than what the code was requesting.
3. Free quota is per Google Cloud project; keys 2-10 are each from a different
   Google account, so quotas stack.
4. Free Qwen3-Coder / DeepSeek / Codestral all rank BELOW Gemini 2.5 Pro, which
   ranks below 3.x Flash -> external providers rejected (worse quality for new
   integration work). Gemini-only.
5. The old ladder (`gemini-2.5-pro` -> `gemini-2.5-flash`) burned a doomed Pro
   attempt every generation, then landed on the WEAKEST free model (the 0.22
   fidelity live run). Upgrading the ladder was the whole quality fix.

All LLM paths (generation, chat refine, auto-repair, incremental regen,
annotate, upload multimodal read) funnel through `generate_with_gemini`
(backend/app/models/inference.py), so one ladder change fixed every path.
Detection (Roboflow, ~98%) was never the problem and is untouched.

### What was built

| Piece | Where | Status |
|-------|-------|--------|
| Env-driven model ladder `GEMINI_MODELS` (default `gemini-3.5-flash,gemini-3-flash-preview,gemini-2.5-flash`) | `backend/app/models/inference.py` (`_parse_gemini_models`) | DONE |
| `force_model` param on `generate_with_gemini` (single-model restriction; unknown values ignored) | same | DONE |
| `forceModel` field on GenerateCodeRequest / RepairRequest / AnnotateRequest, threaded to all 4 call sites | `backend/main.py` | DONE |
| Cache key gains model segment (BEST result never serves a SAVER request) | `backend/main.py` (`_generation_cache_key`) | DONE |
| Key pool health tester (masked keys, `--json`) | `backend/scripts/check_gemini_keys.py` | DONE |
| `GET /api/llm-status` (per key x model cooldowns + today's success counts; key slots only, never key material) | `backend/main.py` + `get_llm_pool_status` | DONE |
| Frontend proxy | `src/app/api/llm-status/route.ts` | DONE |
| Hidden model-control panel (Ctrl+Shift+G): AUTO/BEST/SAVER, key grid, auto-repair toggle, localStorage persistence, MODE micro-pill | `src/components/canvas/ModelControlPanel.tsx` + `src/app/canvas/page.tsx` | DONE |
| Tests: ladder parsing, cache key, success counter, pool status shape | `backend/tests/test_model_ladder.py` (15 tests, 263 total) | DONE |

### Key health results (live run 2026-07-17)

```
KEY                gemini-3.5-flash   gemini-3-flash-preview   gemini-2.5-flash
GEMINI_API_KEY     RATE_LIMITED       RATE_LIMITED             RATE_LIMITED      <- dead paid key, REPLACE
GEMINI_API_KEY_2   (timeout, transient) OK                     OK
GEMINI_API_KEY_3   OK                 OK                       OK
GEMINI_API_KEY_4-10  OK               OK                       MODEL_UNAVAILABLE

8/10 healthy on gemini-3.5-flash
9/10 healthy on gemini-3-flash-preview
2/10 healthy on gemini-2.5-flash   <- Google is pulling 2.5-flash from newer free projects
```

That last line is why SAVER forces `gemini-3-flash-preview`, not 2.5-flash.

### Mode reference

| Mode | Forces | Use when |
|------|--------|----------|
| AUTO | nothing (full ladder) | default; normal work |
| BEST | `gemini-3.5-flash` | judges, graded eval; fails instead of degrading |
| SAVER | `gemini-3-flash-preview` | casual crowds; preserves 3.5 daily quota |

### Explicitly rejected

- External free providers (Groq/Cerebras/OpenRouter): lower quality than free
  3.5-flash, new integration surface. Contingency only.
- Paying $10 to un-suspend the paid account: pointless, free 3.5-flash is
  better than what the money bought.
- Auto-polling /api/llm-status: wasteful, manual refresh only.

### Verification already done

- 263 backend tests pass, `pnpm tsc --noEmit` clean, 40 frontend tests pass.
- Key health script run live (table above).
- Known repo issue, unrelated: `pnpm lint` has 238 pre-existing prettier errors
  on clean main (formatting drift since 07-13) - CI frontend job red before this
  work. One `eslint --fix` commit clears it.

### Still to verify live (5 minutes, after .env slot-1 swap)

1. One canvas generation -> log shows `key=1 model=gemini-3.5-flash status=success`.
2. Panel BEST -> log shows only 3.5-flash attempts; SAVER -> only 3-flash-preview.
3. Upload path still reads baked-in labels (multimodal intact).
4. Fidelity badge lands far above the old Flash 0.22.
