-- Internal notes on a work item: a project, or one editing request.
--
-- The team's coordination about a piece of work ("waiting on their logo in
-- svg", "client said skip the intro on this one") had nowhere to live
-- except memory and outside chat. One small thread per item, admin-only:
-- clients never see these, their conversation stays in the inbox and their
-- video feedback stays on the review screen. Three channels, one job each.

begin;

create table if not exists public.work_notes (
  id             uuid primary key default gen_random_uuid(),
  -- exactly one owner: an editing request (deliverable) or a project
  deliverable_id uuid references public.order_deliverables (id) on delete cascade,
  project_id     uuid references public.projects (id) on delete cascade,
  author         text not null,
  body           text not null check (char_length(body) between 1 and 4000),
  created_at     timestamptz not null default now(),
  constraint work_notes_one_owner check (
    (case when deliverable_id is not null then 1 else 0 end) +
    (case when project_id is not null then 1 else 0 end) = 1
  )
);

comment on table public.work_notes is
  'Team-only notes on a work item. Never shown to clients: the drawer renders them, the portal never queries them.';

create index if not exists work_notes_deliverable_idx
  on public.work_notes (deliverable_id) where deliverable_id is not null;
create index if not exists work_notes_project_idx
  on public.work_notes (project_id) where project_id is not null;

alter table public.work_notes enable row level security;

drop policy if exists work_notes_admin on public.work_notes;
create policy work_notes_admin on public.work_notes
  for all using (public.is_admin()) with check (public.is_admin());

commit;
