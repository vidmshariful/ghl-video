-- 0013: the studio board becomes the premade pipeline.
--
-- The public board now shows only new premade-library videos moving
-- through four stages: visitor request, selected (up next), in
-- production, published. Client projects never appear on it.
--
--   1. studio_updates.status becomes selected / in_production / published
--      (legacy launched -> published, announcement -> in_production).
--   2. studio_requests: the visitor topic queue behind the "Request a
--      video" column. Inserts come only from the server API route
--      (service role); the public can never read it, so nothing shows
--      on the site until the team promotes a topic onto the board.

-- 1) map legacy statuses, then swap the check constraint
update public.studio_updates set status = 'published' where status = 'launched';
update public.studio_updates set status = 'in_production' where status = 'announcement';

alter table public.studio_updates
  drop constraint if exists studio_updates_status_check;
alter table public.studio_updates
  add constraint studio_updates_status_check
  check (status in ('selected', 'in_production', 'published'));

-- 2) the visitor request queue (moderated, never publicly readable)
create table if not exists public.studio_requests (
  id         uuid primary key default gen_random_uuid(),
  topic      text not null check (char_length(topic) between 4 and 160),
  status     text not null default 'new'
             check (status in ('new', 'selected', 'dismissed')),
  created_at timestamptz not null default now()
);

alter table public.studio_requests enable row level security;

-- admins manage the queue from /admin; no anon policies on purpose:
-- the insert path is the API route with the service-role key
drop policy if exists studio_requests_admin_all on public.studio_requests;
create policy studio_requests_admin_all
  on public.studio_requests
  for all
  using (public.is_admin())
  with check (public.is_admin());
