-- Storage buckets are created via Dashboard/CLI, but here are the RLS policies

-- RLS Policies for sketch-exports bucket
CREATE POLICY "Users can upload their own sketches"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'sketch-exports' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own sketches"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'sketch-exports'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Public project sketches are viewable"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'sketch-exports'
    AND EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.thumbnail_url LIKE '%' || storage.objects.name
      AND projects.is_public = TRUE
    )
  );

CREATE POLICY "Users can delete their own sketches"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'sketch-exports'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- RLS Policies for project-assets bucket
CREATE POLICY "Users can upload their own assets"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'project-assets' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own assets"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'project-assets'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own assets"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'project-assets'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
