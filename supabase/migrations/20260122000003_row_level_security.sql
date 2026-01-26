-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iterations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canvas_snapshots ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Projects policies
CREATE POLICY "Users can view their own projects"
  ON public.projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Public projects are viewable by everyone"
  ON public.projects FOR SELECT
  USING (is_public = TRUE);

CREATE POLICY "Users can create their own projects"
  ON public.projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
  ON public.projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
  ON public.projects FOR DELETE
  USING (auth.uid() = user_id);

-- Iterations policies
CREATE POLICY "Users can view iterations of their projects"
  ON public.iterations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = iterations.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Public project iterations are viewable"
  ON public.iterations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = iterations.project_id
      AND projects.is_public = TRUE
    )
  );

CREATE POLICY "Users can create iterations for their projects"
  ON public.iterations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = iterations.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Canvas snapshots policies
CREATE POLICY "Users can view snapshots of their projects"
  ON public.canvas_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = canvas_snapshots.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Public project snapshots are viewable"
  ON public.canvas_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = canvas_snapshots.project_id
      AND projects.is_public = TRUE
    )
  );

CREATE POLICY "Users can create snapshots for their projects"
  ON public.canvas_snapshots FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = canvas_snapshots.project_id
      AND projects.user_id = auth.uid()
    )
  );
