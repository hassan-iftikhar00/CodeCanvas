-- Create profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Project',
  description TEXT,
  canvas_data JSONB NOT NULL DEFAULT '{"strokes": [], "elements": []}',
  generated_code TEXT,
  framework TEXT DEFAULT 'react',
  is_public BOOLEAN DEFAULT FALSE,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create iterations table for version tracking
CREATE TABLE public.iterations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  canvas_data JSONB NOT NULL,
  generated_code TEXT NOT NULL,
  prompt_used TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create canvas_snapshots for quick preview thumbnails
CREATE TABLE public.canvas_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  snapshot_url TEXT NOT NULL,
  snapshot_type TEXT CHECK (snapshot_type IN ('png', 'svg')) DEFAULT 'png',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_projects_user_id ON public.projects(user_id);
CREATE INDEX idx_projects_created_at ON public.projects(created_at DESC);
CREATE INDEX idx_iterations_project_id ON public.iterations(project_id);
CREATE INDEX idx_iterations_version ON public.iterations(project_id, version_number DESC);
CREATE INDEX idx_snapshots_project_id ON public.canvas_snapshots(project_id);

-- Comment tables
COMMENT ON TABLE public.profiles IS 'User profiles linked to auth.users';
COMMENT ON TABLE public.projects IS 'User projects with canvas data and generated code';
COMMENT ON TABLE public.iterations IS 'Version history of code generation for projects';
COMMENT ON TABLE public.canvas_snapshots IS 'PNG/SVG snapshots of canvas for thumbnails';
