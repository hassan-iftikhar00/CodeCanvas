-- B1: Unify legacy schema (schema.sql) with canonical schema (initial_schema.sql).
-- Idempotent: safe to re-run, and works whether the DB is in the legacy state
-- (project_versions, name, thumbnail) or already partially canonical.
-- Target state: projects(title, thumbnail_url, generated_code, framework, is_public),
--               iterations(..., generated_code, prompt_used) with auto-version trigger.

BEGIN;

-- ---------- projects table ----------

DO $$
BEGIN
  -- Rename name -> title (only if legacy column still exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'name'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'title'
  ) THEN
    ALTER TABLE public.projects RENAME COLUMN name TO title;
  END IF;

  -- Rename thumbnail -> thumbnail_url
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'thumbnail'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'thumbnail_url'
  ) THEN
    ALTER TABLE public.projects RENAME COLUMN thumbnail TO thumbnail_url;
  END IF;
END $$;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS title          TEXT NOT NULL DEFAULT 'Untitled Project',
  ADD COLUMN IF NOT EXISTS thumbnail_url  TEXT,
  ADD COLUMN IF NOT EXISTS generated_code TEXT,
  ADD COLUMN IF NOT EXISTS framework      TEXT DEFAULT 'react',
  ADD COLUMN IF NOT EXISTS is_public      BOOLEAN DEFAULT FALSE;

-- ---------- project_versions -> iterations ----------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'project_versions'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'iterations'
  ) THEN
    ALTER TABLE public.project_versions RENAME TO iterations;
  END IF;
END $$;

-- If neither table existed, create iterations from scratch.
CREATE TABLE IF NOT EXISTS public.iterations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  canvas_data JSONB NOT NULL,
  generated_code TEXT,
  prompt_used TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.iterations
  ADD COLUMN IF NOT EXISTS generated_code TEXT,
  ADD COLUMN IF NOT EXISTS prompt_used    TEXT;

-- Backfill so we can enforce NOT NULL on generated_code
UPDATE public.iterations SET generated_code = '' WHERE generated_code IS NULL;
ALTER TABLE public.iterations ALTER COLUMN generated_code SET NOT NULL;

-- ---------- auto-version trigger ----------

CREATE OR REPLACE FUNCTION public.set_iteration_version()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.version_number IS NULL THEN
    SELECT COALESCE(MAX(version_number), 0) + 1
      INTO NEW.version_number
      FROM public.iterations
      WHERE project_id = NEW.project_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_set_iteration_version ON public.iterations;
CREATE TRIGGER auto_set_iteration_version
  BEFORE INSERT ON public.iterations
  FOR EACH ROW EXECUTE FUNCTION public.set_iteration_version();

-- ---------- RLS policies for renamed table ----------

ALTER TABLE public.iterations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own project versions"   ON public.iterations;
DROP POLICY IF EXISTS "Users can insert own project versions" ON public.iterations;
DROP POLICY IF EXISTS "Users can view own iterations"         ON public.iterations;
DROP POLICY IF EXISTS "Users can insert own iterations"       ON public.iterations;

CREATE POLICY "Users can view own iterations"
  ON public.iterations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = iterations.project_id
        AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own iterations"
  ON public.iterations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = iterations.project_id
        AND projects.user_id = auth.uid()
    )
  );

COMMIT;

-- Reload PostgREST schema cache so Supabase REST API picks up the changes immediately
NOTIFY pgrst, 'reload schema';
