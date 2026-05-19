-- supabase/migrations/20260515000002_add_delete_iterations_policy.sql

begin;

-- Drop the policy if it already exists to ensure a clean setup
drop policy if exists "Users can delete iterations of their projects" on public.iterations;

-- Create a new policy to allow users to delete iterations for projects they own
create policy "Users can delete iterations of their projects"
  on public.iterations for delete
  using (
    exists (
      select 1 from public.projects
      where projects.id = iterations.project_id
      and projects.user_id = auth.uid()
    )
  );

commit;
