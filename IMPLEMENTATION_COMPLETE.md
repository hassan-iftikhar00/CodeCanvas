# CodeCanvas Implementation Summary

This file is a changelog-style summary of major implementation work.

For setup and installation, use `README.md`.

## Snapshot

- Project type: sketch-to-code demo/learning project
- Core stack: Next.js + Supabase + optional FastAPI service
- Chat refinement path: OpenRouter integration with fallback handling

## Implemented Areas

### 1. Sketch-First Chat Workflow

Summary:

- Chat interaction is gated until code exists.
- UI communicates sketch-first behavior to users.

Primary files:

- `src/components/canvas/ChatInterface.tsx`
- `src/app/canvas/page.tsx`

### 2. Chat Refinement API Path

Summary:

- Chat requests are routed through `src/app/api/generate-code/route.ts`.
- OpenRouter free-model fallback chain is implemented.
- Failure path returns a safe fallback response instead of crashing.

Primary file:

- `src/app/api/generate-code/route.ts`

### 3. Sketch Detection Integration Path

Summary:

- Generate-mode requests can call FastAPI (`FASTAPI_URL`).
- Local fallback generation path exists when backend is unavailable.

Related files:

- `src/app/api/generate-code/route.ts`
- `backend/main.py`

### 4. Dashboard and Project Management Updates

Summary:

- Project CRUD UX improvements have been applied incrementally.
- Delete interactions now include confirmation and UI-state handling.

Related files (recently updated):

- `src/app/dashboard/page.tsx`
- `src/components/dashboard/ProjectCard.tsx`
- `src/lib/dashboard-projects.ts`

## Change Log Notes

- Migrated project naming fields toward `title` conventions in frontend flows.
- Improved TypeScript alignment across canvas state and history wrappers.
- Preserved graceful-degradation behavior for optional services.

## Known Constraints and Follow-Up Ideas

- OpenRouter free-tier usage can be rate-limited.
- FastAPI local service is optional; behavior differs when unavailable.
- Additional automated tests around integration/fallback paths would reduce regression risk.

## Related Docs

- `README.md`: full setup and run guide
- `INTEGRATION_GUIDE.md`: advanced integration details
- `OPENROUTER_SETUP.md`: focused OpenRouter notes
