-- supabase/migrations/20260515000001_add_delete_project_function.sql

begin;

-- Drop the function if it already exists to ensure a clean setup
drop function if exists public.delete_project(project_id uuid);

-- Creates a function to delete a project and all its related data
create or replace function public.delete_project(project_id uuid)
returns void
language plpgsql
security invoker
as $$
begin
  -- Delete all iterations associated with the project first to avoid foreign key violations.
  delete from public.iterations
  where project_id = delete_project.project_id;

  -- In the future, you can add more deletion logic here, for example:
  -- delete from public.comments where project_id = delete_project.project_id;

  -- Finally, delete the project itself.
  delete from public.projects
  where id = project_id;
end;
$$;

-- Grant execute permission to the function
grant execute on function public.delete_project(uuid) to authenticated;

commit;
