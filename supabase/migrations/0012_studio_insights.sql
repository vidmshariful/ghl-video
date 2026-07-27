-- Studio Insights: the public studio board. Two tables, both admin-managed
-- from the /admin Studio screen and publicly readable (they carry nothing
-- sensitive, like the chrome tables).
--
--   studio_slots    capacity per service line, fully MANUAL (client
--                   decision): the team sets total and remaining by hand.
--                   A total of 0 means "not shown on the site".
--   studio_updates  the production board: what the team is working on,
--                   target dates, and launches.
--
-- Apply: npm run migrate. Safe to re-run (idempotent guards throughout).

create table if not exists public.studio_slots (
  id            uuid primary key default gen_random_uuid(),
  service       text not null unique
                  check (service in ('premade', 'custom', 'editing')),
  period_label  text not null default 'This week',
  total         integer not null default 0 check (total >= 0),
  remaining     integer not null default 0 check (remaining >= 0),
  updated_at    timestamptz not null default now()
);

drop trigger if exists studio_slots_set_updated_at on public.studio_slots;
create trigger studio_slots_set_updated_at
  before update on public.studio_slots
  for each row execute function public.set_updated_at();

insert into public.studio_slots (service, period_label, total, remaining)
values
  ('premade', 'This week', 0, 0),
  ('custom', 'This month', 0, 0),
  ('editing', 'This month', 0, 0)
on conflict (service) do nothing;

create table if not exists public.studio_updates (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  status       text not null default 'in_production'
                 check (status in ('in_production', 'launched', 'announcement')),
  note         text,
  target_date  date,
  link_slug    text,            -- optional library slug for a preview link
  sort         integer not null default 0,
  published    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists studio_updates_status_idx
  on public.studio_updates (status, published, sort);

drop trigger if exists studio_updates_set_updated_at on public.studio_updates;
create trigger studio_updates_set_updated_at
  before update on public.studio_updates
  for each row execute function public.set_updated_at();

-- RLS: public read (the board is public content), admin-only writes.
alter table public.studio_slots enable row level security;
alter table public.studio_updates enable row level security;

drop policy if exists studio_slots_public_read on public.studio_slots;
create policy studio_slots_public_read
  on public.studio_slots for select using (true);

drop policy if exists studio_slots_admin_all on public.studio_slots;
create policy studio_slots_admin_all
  on public.studio_slots for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists studio_updates_public_read on public.studio_updates;
create policy studio_updates_public_read
  on public.studio_updates for select using (published = true);

drop policy if exists studio_updates_admin_all on public.studio_updates;
create policy studio_updates_admin_all
  on public.studio_updates for all
  using (public.is_admin()) with check (public.is_admin());
