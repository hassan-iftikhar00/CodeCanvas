-- HITL detection editor (roadmap idea #4): audit log of user corrections made
-- in the detection review overlay. Each row is one action (relabel / delete /
-- add) against a Roboflow detection. Collected as a future fine-tuning dataset
-- (logged only — no training happens now).
--
-- Writes come from the FastAPI backend via the service-role key (bypasses
-- RLS); the policies below only govern direct client access.

begin;

create table if not exists public.detection_corrections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('relabel', 'delete', 'add')),
  -- Element class after the action (for relabel/add); the deleted class for delete.
  element_type text,
  -- Element class before a relabel; null for delete/add.
  previous_type text,
  -- Box geometry in sketch-image pixel space: {x, y, width, height}.
  bounds jsonb,
  created_at timestamptz not null default now()
);

create index if not exists detection_corrections_project_id_idx
  on public.detection_corrections (project_id);
create index if not exists detection_corrections_user_id_idx
  on public.detection_corrections (user_id);

alter table public.detection_corrections enable row level security;

drop policy if exists "Users can view own detection corrections" on public.detection_corrections;
create policy "Users can view own detection corrections"
  on public.detection_corrections for select
  using (auth.uid() = user_id);

commit;
