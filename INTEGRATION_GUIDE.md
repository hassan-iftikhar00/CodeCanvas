# CodeCanvas Integration Guide (Advanced)

Base setup is documented in `README.md`.

Use this file for optional and advanced integration details only.

## Scope

This guide covers:

- Optional service integrations
- Fallback behavior across services
- Advanced troubleshooting
- Deployment integration notes

## Integration Architecture

```text
Frontend (Next.js)
  -> /api/generate-code (Next.js route)
    -> FastAPI /api/predict (optional for sketch detection)
    -> OpenRouter chat completions (optional for chat refinement)
  -> Supabase (required: auth + data + storage)
```

## Optional Integrations

### 1. FastAPI Sketch Detection Service

Purpose:

- Handles sketch-detection and model-driven generation requests.

Default expected endpoint:

- `http://localhost:8000/api/predict`

If your backend runs on a different host/port, set this in `.env.local`:

```dotenv
FASTAPI_URL=http://localhost:8001/api/predict
```

Behavior when unavailable:

- The Next.js API route falls back to a simplified local generation path.

### 2. OpenRouter Chat Refinement

Purpose:

- Refines generated code from chat prompts.

Required env variable:

```dotenv
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxx
```

Behavior when unavailable:

- Chat route returns a graceful fallback response instead of crashing the app.

## Runtime Flow Details

### Generate Mode

1. Frontend sends sketch payload to `/api/generate-code`.
2. Route attempts request to `FASTAPI_URL`.
3. On success, returns backend result.
4. On failure, route uses fallback generation logic.

### Chat Mode

1. Frontend sends chat prompt + current code to `/api/generate-code`.
2. Route tries OpenRouter free-model chain.
3. On repeated failure, route returns fallback output with explanatory message.

## Advanced Troubleshooting

### FastAPI Service Issues

### Symptom

- Sketch generation behaves more generic than expected.

### Checks

1. Verify backend process is running.
2. Open `http://localhost:8000/health`.
3. Confirm `FASTAPI_URL` includes `/api/predict` path.

### OpenRouter Issues

### Symptom

- Chat refinement does not return model-updated code.

### Checks

1. Confirm `OPENROUTER_API_KEY` is present in `.env.local`.
2. Restart Next.js dev server after env changes.
3. Check server logs for rate-limit or auth errors.

### Supabase Integration Checks

If auth/data operations fail:

1. Recheck `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. Confirm migrations were applied in order (see `README.md`).
3. Confirm RLS policies are present in Supabase Dashboard.

## Deployment Notes

At deploy time, set environment variables in your host dashboard:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `FASTAPI_URL` (if using deployed backend)
- `OPENROUTER_API_KEY` (if using chat refinement)
- `NEXT_PUBLIC_SITE_URL` (recommended for OpenRouter headers)

This project can run as a learning/demo setup with only frontend + Supabase, while FastAPI and OpenRouter are optional enhancements.
