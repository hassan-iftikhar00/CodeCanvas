# HASSAN_TODO.md — Lead Integration & Production Readiness

> Last updated: 2026-05-19
> Scope: Hassan only — integration work, system-level fixes, architectural gaps, release blockers
> Do NOT add Maarij / Bilal / Shahwaiz tasks here

---

## 1. Executive Summary

**System health: Functional but not production-ready.**

The core pipeline (draw → Roboflow detect → Gemini generate → display) works end-to-end in local development. However, several system-level gaps make the current build unsuitable for a real deployment or an evaluated demo:

- ~~The **middleware auth guard is not active**~~ — **NOT AN ISSUE** (Next.js 16 uses `proxy.ts` convention — already active)
- The **FastAPI backend URL is hardcoded to `localhost:8000`** — breaks in any non-local environment
- **All AI failures (Roboflow down, Gemini quota hit) are silent** — users see degraded output with zero feedback
- The **live preview iframe uses `postMessage('*')`** — a known XSS vector
- The **fetch to FastAPI has no timeout** — a hanging backend freezes the entire UI
- **No env vars are validated at startup** — a misconfigured deployment fails at request time, not boot time

The AI pipeline quality issues (card confidence, contour fallback quality) remain gated on Shahwaiz's v3 model and are out of Hassan's scope. Everything below is system/integration-layer work that only Hassan should touch.

---

## 2. Prioritized TODO List

---

### P0 — Blocks Demo / Production

---

#### ~~P0-1: Auth Middleware is NOT Running — Protected Routes Are Exposed~~

> ✔ FALSE POSITIVE — Closed 2026-05-19
>
> This project uses **Next.js 16.1.1**, which replaced the `middleware.ts` convention with `proxy.ts`. The file `src/proxy.ts` (exporting `proxy` + `config`) **is already the active route guard**. Auth protection on `/canvas` and `/dashboard` was working correctly the whole time. A `middleware.ts` was briefly created and immediately reverted after Next.js threw a conflict error. No action required.

---

#### P0-2: FastAPI URL Hardcoded to `localhost:8000` — Breaks Any Non-Local Deploy

**Issue:**
`src/app/api/generate-code/route.ts:4`:
```ts
const FASTAPI_DEFAULT_URL = "http://localhost:8000/api/predict";
```
If `FASTAPI_URL` is not set in the deployment env, all sketch-to-code requests silently hit `localhost:8000` and fail with a connection refused error. The error surfaces to the user as a generic 500, with no indication that an env var is missing.

**Why it matters:**
Every deployment (staging, prod, team demo) requires `FASTAPI_URL` to be set. Currently nothing enforces this — a missing var silently breaks the entire main feature.

**Exact fix:**
1. Remove the hardcoded default. Fail loudly at module load time if missing:
```ts
// src/app/api/generate-code/route.ts
const FASTAPI_URL = process.env.FASTAPI_URL;
if (!FASTAPI_URL) {
  throw new Error("FASTAPI_URL environment variable is not set");
}
```
2. Add `FASTAPI_URL` to `.env.example` with a comment explaining it.

**Files involved:**
- `src/app/api/generate-code/route.ts`
- `.env.example`

---

#### P0-3: No Timeout on FastAPI Fetch — UI Freezes on Backend Hang

**Issue:**
The proxy fetch to FastAPI in `route.ts:35-44` has no timeout, no AbortController, no signal. If the FastAPI backend is slow (Gemini quota backoff, Roboflow timeout) or completely hangs, the Next.js route handler waits indefinitely. The user sees a permanently spinning "Generating..." state with no way to recover.

**Why it matters:**
Gemini and Roboflow are external APIs with variable latency. During a demo, a 60-second hang with no feedback is unacceptable. Next.js also has a default 30-second function timeout on serverless platforms that will cause an opaque 504 with no user-facing message.

**Exact fix:**
```ts
// src/app/api/generate-code/route.ts
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 55_000); // 55s

const response = await fetch(fastApiUrl, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ...requestBody, userId: user.id }),
  signal: controller.signal,
});
clearTimeout(timeoutId);
```
Return a user-facing 504 with message "Detection timed out — try again" on AbortError.

**Files involved:**
- `src/app/api/generate-code/route.ts`

---

#### P0-4: Silent AI Failures — Users Get Degraded Output With No Warning

**Issue (two linked problems):**

**A) Roboflow fails silently.** When Roboflow is down, quota exceeded, or returns 0 predictions, `run_roboflow_pipeline()` returns `None`. The predict endpoint then falls through to the OpenCV contour fallback (`SketchDetector._fallback_detection()`). The OpenCV fallback is a development placeholder that classifies rectangles by aspect ratio — it has no awareness of navbars, sections, or semantic structure. The user gets code, but it is of meaningfully lower quality, and they have no idea why.

**B) Gemini fails silently.** When both Gemini models fail (429 quota, timeout, bad key), `generate_with_gemini()` returns `None`. The `CodeGenerator.generate()` then falls back to `_template_based_generation()`, which produces a near-empty 4-element shell. Again, user sees code, not an error.

The current `GenerateCodeResponse` has a `usedFallback` field that is set, but only when the Roboflow mock mode is active — not when real Roboflow or Gemini failures trigger the fallback. The frontend does not use `usedFallback` for any user-visible feedback.

**Why it matters:**
- For a demo, a silent degraded result looks like a bug in the AI model
- For debugging, there is no signal distinguishing "Roboflow returned bad data" from "Gemini hit quota"
- The `usedFallback` field exists but is wired wrong — this is a one-sprint fix

**Exact fix:**

Backend (`backend/main.py`): populate `usedFallback` and `message` with specific reason:
```python
# After run_roboflow_pipeline returns None:
used_fallback = True
response_message = "Roboflow detection unavailable — using shape fallback. Results may be lower quality."

# After generate_with_gemini returns None:
used_fallback = True
response_message = "Gemini code generation unavailable — using template fallback."
```

Frontend (`src/app/canvas/page.tsx`): read `usedFallback` and `message` from the response and surface a toast warning (toast infrastructure already exists via `src/components/ui/Toast.tsx`).

**Files involved:**
- `backend/main.py` (populate `usedFallback` + `message` correctly)
- `src/app/canvas/page.tsx` (read + surface `usedFallback` to Toast)
- `src/app/api/generate-code/route.ts` (pass `usedFallback` + `message` through in response)

---

### P1 — Correctness / Stability

---

#### P1-1: `postMessage` Wildcard Origin in LivePreview — XSS Risk

**Issue:**
`src/components/canvas/LivePreview.tsx` lines 87, 90, 104, 130, 133 all call:
```ts
window.parent.postMessage({ type: 'console', data: ... }, '*');
```
The second argument `'*'` means any page in any origin can receive these messages. While the iframe is sandboxed, `postMessage('*')` is the canonical XSS escalation vector in iframe-based code sandboxes.

**Exact fix:**
Replace `'*'` with `window.location.origin` in all five calls:
```ts
window.parent.postMessage({ type: 'console', data: ... }, window.location.origin);
```

**Files involved:**
- `src/components/canvas/LivePreview.tsx` (lines 87, 90, 104, 130, 133)

---

#### P1-2: No Startup Env Validation on FastAPI — Misconfigurations Surface at Request Time

**Issue:**
The FastAPI backend starts successfully even if `ROBOFLOW_API_KEY`, `GEMINI_API_KEY`, `SUPABASE_URL`, or `SUPABASE_SERVICE_ROLE_KEY` are absent. The first real request then fails with a cryptic error deep in the stack.

**Exact fix:**
Add a startup validator to `backend/main.py`:
```python
@app.on_event("startup")
async def validate_env():
    required = ["ROBOFLOW_API_KEY", "GEMINI_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
    missing = [k for k in required if not os.getenv(k)]
    if missing:
        raise RuntimeError(f"Missing required env vars: {', '.join(missing)}")
```
This kills the server at startup with a clear message instead of silently misbehaving on first request.

**Files involved:**
- `backend/main.py`

---

#### P1-3: CORS Wildcard Methods — FastAPI Accepts DELETE/PATCH from Any Origin

**Issue:**
`backend/main.py:57`: `allow_methods=["*"]` and `allow_headers=["*"]`. The FastAPI server only has GET and POST endpoints. Allowing all methods and all headers is unnecessary surface area.

**Exact fix:**
```python
allow_methods=["GET", "POST", "OPTIONS"],
allow_headers=["Content-Type", "Authorization"],
```

**Files involved:**
- `backend/main.py` (line 49–59)

---

#### P1-4: Canvas Dimension Input Not Validated — Server Crash on Invalid Values

**Issue:**
`CanvasData.width` and `.height` in `backend/main.py:62-66` accept any integer with no bounds check. If the frontend sends negative or zero values, `preprocess_canvas_data()` calls `np.ones((height, width, 3))`, which will crash with a memory error. Sending `width=0` or `height=-1` produces an unhandled 500.

**Exact fix:**
Add Pydantic validator to `CanvasData`:
```python
from pydantic import validator

class CanvasData(BaseModel):
    width: int = 1000
    height: int = 600

    @validator("width", "height")
    def must_be_positive(cls, v):
        if v <= 0 or v > 10_000:
            raise ValueError("dimension must be between 1 and 10000")
        return v
```

**Files involved:**
- `backend/main.py`

---

#### P1-5: Gemini API Call Has No Timeout — Blocks Thread Pool on Hang

**Issue:**
`generate_with_gemini()` in `backend/app/models/inference.py:691` calls `model.generate_content(prompt)` via `asyncio.to_thread()` with no timeout. The Gemini SDK does not have a built-in timeout parameter. If the Google API hangs (network partition, backend overload), the thread blocks indefinitely, occupying a thread pool slot permanently.

**Exact fix:**
Wrap the `asyncio.to_thread()` call at the call site in `main.py` with `asyncio.wait_for()`:
```python
generated_code = await asyncio.wait_for(
    asyncio.to_thread(generate_with_gemini, ...),
    timeout=45.0,
)
```
Catch `asyncio.TimeoutError` and treat it as a Gemini failure (fall through to template fallback, set `usedFallback=True`).

Same pattern for the Roboflow call at `backend/main.py:682-690`.

**Files involved:**
- `backend/main.py` (Roboflow call: ~line 682, Gemini call: ~line 766)

---

#### P1-6: No Request Body Size Limit — DoS via Large Sketch Image

**Issue:**
FastAPI accepts arbitrarily large request bodies by default. A large base64-encoded PNG (e.g., 50MB) will be fully decoded into memory before any processing begins. No max body size is configured.

**Exact fix:**
Add a body size limit to the FastAPI app:
```python
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest

class LimitBodySizeMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: StarletteRequest, call_next):
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > 20 * 1024 * 1024:  # 20MB
            from starlette.responses import Response
            return Response("Payload too large", status_code=413)
        return await call_next(request)

app.add_middleware(LimitBodySizeMiddleware)
```

**Files involved:**
- `backend/main.py`

---

### P2 — Polish / Demo Quality

---

#### P2-1: Auto-Save Race Condition in `useProjectSave`

**Issue:**
`src/hooks/useProjectSave.ts` uses a debounced `updateProject()` but does not track in-flight saves. Rapid edits (fast typing in description, loading a project then immediately editing) can fire multiple concurrent Supabase updates. The last one wins, but intermediate states may surface as stale data.

**Exact fix:**
Add a `pendingSave` ref and skip queuing a new save while one is in flight:
```ts
const isSaving = useRef(false);
// In the debounced handler:
if (isSaving.current) return;
isSaving.current = true;
try { await updateProject(...); } finally { isSaving.current = false; }
```

**Files involved:**
- `src/hooks/useProjectSave.ts`

---

#### P2-2: No User Feedback When FastAPI is Down

**Issue:**
If FastAPI is not running (common during development or after deploy), the fetch in `route.ts` throws a connection refused error, which surfaces as a generic 500. The user sees "Internal server error" with no actionable information.

**Exact fix:**
In `route.ts`, catch the fetch error specifically:
```ts
try {
  const response = await fetch(fastApiUrl, { ... });
} catch (err: unknown) {
  if (err instanceof TypeError && err.message.includes("fetch")) {
    return NextResponse.json(
      { error: "Backend is offline. Please start the FastAPI server." },
      { status: 503 }
    );
  }
  throw err;
}
```
Surface this as a toast in the canvas page.

**Files involved:**
- `src/app/api/generate-code/route.ts`
- `src/app/canvas/page.tsx`

---

#### P2-3: `window.open` in LivePreview Opens Without `noopener`

**Issue:**
`src/components/canvas/LivePreview.tsx:240` calls `window.open("", "_blank")` to open the preview in a new tab. Without `noopener`, the spawned window has access to the `window.opener` context — a tab-napping risk.

**Exact fix:**
```ts
const newWindow = window.open("", "_blank", "noopener,noreferrer");
```

**Files involved:**
- `src/components/canvas/LivePreview.tsx` (line ~240)

---

#### P2-4: Sensitive Data Logged in Proxy — Remove Before Demo

**Issue:**
`src/proxy.ts` lines 36–44 logs every request path, user email, and cookie names to the console:
```ts
console.log("Proxy - Path:", request.nextUrl.pathname);
console.log("Proxy - User:", user ? user.email : "Not authenticated");
console.log("Proxy - Cookies:", request.cookies.getAll().map(c => c.name).join(", "));
```
These logs include PII (user email addresses). They should be removed or replaced with non-PII debug output before any public demo or shared deployment.

This is Bilal's task B4, but since P0-1 requires touching `proxy.ts` indirectly via the middleware export, confirm B4 is done before demoing.

**Files involved:**
- `src/proxy.ts` (lines 36–44)

---

## 3. Demo Readiness Checklist

```
MUST FIX (gate on these before any demo)
[x] P0-1: ~~Create src/middleware.ts~~ — FALSE POSITIVE, proxy.ts already active in Next.js 16
[x] P0-2: FASTAPI_URL guard — throws in prod, warns in dev on first request, || fallback for empty string — verified 2026-05-19
[x] P0-3: AbortController 55s timeout on FastAPI fetch — 504 on timeout, 503 when backend offline — fixed 2026-05-19
[x] P0-4: usedFallback now set for all 3 failure modes (Roboflow down / Gemini quota / mock); specific message shown in warning bar — fixed 2026-05-19

SHOULD FIX (high confidence issues that will show during demo)
[x] P1-1: postMessage origin locked — parent origin passed as string literal into iframe HTML; listener validates event.origin; window.open noopener added (P2-3 done here too) — fixed 2026-05-19
[x] P1-2: FastAPI startup validates all 4 required env vars — server refuses to start with clear message if any missing — fixed 2026-05-19
[x] P1-5: asyncio.wait_for() — Roboflow 30s raises 504, Gemini 45s raises 504 — no silent fallback to template — fixed 2026-05-19

HOTFIXES (bugs fixed outside original P0/P1 list)
[x] Auth redirect: logged-in users hitting /auth/login now redirect to /dashboard instead of blank /canvas — fixed 2026-05-19 (src/proxy.ts:58)
[x] Pen draw ghost bug: cursor leaving canvas mid-stroke no longer resumes drawing on re-entry — fixed 2026-05-19 (SketchCanvas.tsx — added onMouseLeave={handleMouseUp} to Stage)

VERIFY BEFORE DEMO (confirm working, not broken by other changes)
[ ] Detection pipeline works end-to-end with real sketch image
[ ] Chat refinement returns meaningful output (backend path migrating to Gemini key pool — currently a no-op stub)
[ ] Project save/load roundtrip works (canvas_data persists correctly)
[ ] Version history creates a new iteration on each generation run
[ ] Onboarding tour completes without JS errors
[ ] Dashboard: delete project cascades (iterations deleted, card removed)
[ ] Auth: login → redirect to canvas, logout → redirect to login

NICE TO HAVE (if time permits)
[x] P1-3: Restrict CORS methods to GET/POST/OPTIONS — fixed 2026-05-19 (backend/main.py:57)
[x] P1-4: Add Pydantic dimension validator to CanvasData — width/height Field(gt=0, le=8000) — fixed 2026-05-19 (backend/main.py:65-66)
[x] P1-6: Add 20MB body size limit middleware to FastAPI — BodySizeLimitMiddleware checks Content-Length, returns 413 — fixed 2026-05-19 (backend/main.py)
[x] P2-2: Already resolved by P0-3 — TypeError catch returns 503 with "Backend is offline" message — closed 2026-05-19
[x] P2-3: noopener done alongside P1-1 — 2026-05-19
[x] P2-4: Removed 3 debug console.logs from proxy.ts (path, user email, cookie names) — fixed 2026-05-19 (src/proxy.ts:36-44)

PRE-DEMO INSURANCE
[x] H-DEMO: Gemini key rotation implemented — up to 4 keys, 429 rotates key, all exhausted raises 504 — fixed 2026-05-19 (inference.py: GeminiQuotaExhausted + _is_quota_error; main.py: removed if-guard, catches quota separately)
```

---

## 4. Top 5 Production Risks (Summary)

| # | Risk | Severity | Current State |
|---|------|----------|---------------|
| 1 | ~~**Auth middleware not active**~~ | ~~Critical~~ | **FALSE POSITIVE** — Next.js 16 uses `proxy.ts`; already active |
| 2 | **Silent AI degradation** — Roboflow/Gemini failures produce bad output with no user feedback | Critical | `usedFallback` field exists but is not wired to user-visible signal |
| 3 | **No fetch timeout** — hanging FastAPI freezes entire UI indefinitely | High | No AbortController in `route.ts` fetch; no `asyncio.wait_for` in backend |
| 4 | **Hardcoded localhost URL** — deploy without `FASTAPI_URL` env var = complete feature failure | High | `FASTAPI_DEFAULT_URL = "http://localhost:8000/api/predict"` in `route.ts` |
| 5 | **`postMessage('*')` in LivePreview** — iframe code execution XSS escalation surface | Medium | All 5 postMessage calls in `LivePreview.tsx` use wildcard origin |

---

## 5. H-DEMO: LLM Pipeline Hardening (Pre-Presentation)

**Issue:**
During the FYP presentation, a Gemini quota exhaustion (429) will silently fall back to template-based code — exactly what happened in testing on 2026-05-19. The free tier daily limit is very easy to hit during a live demo. This is the highest-probability failure mode at presentation time.

**Why it matters:**
A demo that shows generic placeholder code instead of real AI-generated output undermines the entire project thesis. This needs to be solved before presentation day, not patched the morning of.

**Options to research and pick ONE before demo:**

### Option A — Easiest: Upgrade to Gemini Paid Tier (Recommended)
- Go to https://aistudio.google.com → Billing → enable pay-as-you-go
- Gemini 2.5 Pro costs ~$1.25 per 1M input tokens. A full demo run is ~2,000 tokens → costs fractions of a cent per generation
- No code changes needed. Eliminates the quota problem permanently.
- **File:** `backend/.env` — update `GEMINI_API_KEY` with a paid-tier key

### Option B — Free: Rotate Multiple Gemini API Keys
- Create 2–3 additional Google accounts, each gets a fresh free-tier key
- Add to `backend/.env`: `GEMINI_API_KEY_2=`, `GEMINI_API_KEY_3=`
- In `generate_with_gemini()` (`backend/app/models/inference.py`), cycle through keys on 429:
```python
API_KEYS = list(filter(None, [
    os.getenv("GEMINI_API_KEY"),
    os.getenv("GEMINI_API_KEY_2"),
    os.getenv("GEMINI_API_KEY_3"),
]))
for key in API_KEYS:
    for model_name in (GEMINI_PRIMARY_MODEL, GEMINI_FALLBACK_MODEL):
        try:
            genai.configure(api_key=key)
            # ... generate ...
        except Exception as e:
            if "429" in str(e):
                continue  # try next key
            raise
```
- Gives 3× the free quota. Enough for a full demo day.

### Option C — Safest: Pre-warm a Demo Sketch Response
- Before the presentation, generate code for the exact sketch you plan to show
- Cache the result (save the generated code string somewhere)
- If live generation fails, show the cached result — audience sees identical output
- No infrastructure needed. Can be done the night before.
- Only works if your demo sketch is fixed.

**Recommendation:** Do Option A (paid tier) + Option C (pre-warm cache) as belt-and-suspenders. Total cost for a presentation is under $0.10. Option B is a good fallback if billing isn't available.

**Decision deadline:** At least 3 days before presentation — enough time to test the full pipeline under demo conditions.

**Files involved (if implementing B or D):**
- `backend/app/models/inference.py` — `generate_with_gemini()`
- `backend/.env` — additional API keys
- `backend/main.py` — `resolve_external_model_output()`
