-- Brand Kit (App Uplift feature H): per-project design tokens the user sets
-- once and every generation applies. Stored as jsonb so the token set can
-- grow (e.g. spacing scale) without further migrations.
--
-- Shape: { "primaryColor": "#0F62FE", "secondaryColor": "#...",
--          "accentColor": "#...", "fontFamily": "Poppins" }
-- NULL = no brand kit configured (generation prompt unchanged).

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS brand_kit JSONB;
