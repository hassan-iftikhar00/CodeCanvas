# CodeCanvas

CodeCanvas is a sketch-to-code demo project for learning and experimentation. It includes a Next.js frontend, Supabase for auth/data/storage, and an optional FastAPI backend for sketch detection.

This README is the single source of truth for local setup.

## Project Overview

- Frontend: Next.js 16 + React 19 + TypeScript
- Auth/data/storage: Supabase
- Optional AI services:
  - FastAPI service for sketch detection + code generation (`backend/main.py`)
  - Gemini API keys for code generation (paid first key + free-key rotation pool)

## Prerequisites

Install these before starting:

- Node.js 20 LTS (recommended)
- npm 10+ (works) or pnpm 9+ (recommended in this repo)
- Python 3.10+ (only needed if running FastAPI locally)
- Supabase account and project

Optional but useful:

- Git
- Supabase CLI (only if you want CLI-based DB workflows)

## 1. Clone and Install

```bash
git clone <your-repo-url>
cd CodeCanvas

# choose one package manager
pnpm install
# or
npm install
```

## 2. Environment Variables

Create a file named `.env.local` in the project root.

```dotenv
# Required for frontend auth/data
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY

# Optional but recommended
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Optional: sketch detection backend endpoint
# If omitted, app defaults to http://localhost:8000/api/predict
FASTAPI_URL=http://localhost:8000/api/predict
```

If you plan to run the Python backend, create `backend/.env`:

```dotenv
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY

# Optional: used by backend CORS config
FRONTEND_URL=http://localhost:3000
```

## 3. Database Setup and Migrations (Supabase)

Use the Supabase Dashboard SQL Editor and run migration files in this exact order:

1. `supabase/migrations/20260122000001_initial_schema.sql`
2. `supabase/migrations/20260122000002_functions_and_triggers.sql`
3. `supabase/migrations/20260122000003_row_level_security.sql`
4. `supabase/migrations/20260122000004_storage_policies.sql`
5. `supabase/migrations/20260122000005_avatar_storage.sql`

Notes:

- These are the migration filenames currently present in the repository.
- Run each file once, in order.
- If a statement fails because an object already exists, verify whether that migration was already applied before re-running.

## 4. Run the Project

### Frontend (required)

```bash
# from project root
pnpm dev
# or
npm run dev
```

Open: `http://localhost:3000`

### Backend (optional, for sketch detection service)

```bash
cd backend
../venv/Scripts/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Windows
python -m venv venv
venv\Scripts\activate

# macOS/Linux
# python -m venv venv
# source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Backend endpoints:

- API root: `http://localhost:8000`
- API docs: `http://localhost:8000/docs`

If backend is not running, parts of generate flow may fall back to simplified behavior.

## 5. Production Build and Run

```bash
# from project root
pnpm build
pnpm start

# npm equivalent
# npm run build
# npm run start
```

## 6. Required and Optional Services

- Required:
  - Supabase project (auth + PostgreSQL + storage)
- Optional:
  - FastAPI backend at `FASTAPI_URL`
  - Gemini API keys in `backend/.env` for code generation (`GEMINI_API_KEY` + `_2..10`)

## 7. Common Commands

```bash
pnpm dev          # start Next.js dev server
pnpm build        # create production build
pnpm start        # run production server
pnpm lint         # lint codebase
pnpm lint:fix     # auto-fix lint issues
pnpm format       # format files
pnpm format:check # check formatting
```

## 8. Quick Validation Checklist

After setup, verify:

1. Frontend starts and loads at `http://localhost:3000`
2. You can sign up/login with Supabase auth
3. Dashboard and canvas pages load
4. Project create/save works
5. If backend is running, sketch detection requests reach FastAPI
6. If Gemini keys are set, code generation returns real code

## Additional Docs

- `INTEGRATION_GUIDE.md`: advanced and optional integration details
- `IMPLEMENTATION_COMPLETE.md`: implementation summary/changelog notes
