-- The spine: a video can belong to a project or a subscription month, not
-- only to an order.
--
-- WHY THIS IS THE FIRST THING, NOT THE LAST
-- -----------------------------------------
-- Everything good about the video experience, review, timestamped comments,
-- revision rounds, versions, promised dates, the approval flow, hangs off
-- order_deliverables, and order_deliverables hangs off an order. Premade
-- buyers get an order, so all of it works for them. Custom projects and
-- editing subscriptions never create an order, so those clients have no
-- videos, so every screen that reads the video list shows them nothing. That
-- is the whole reason the portal feels finished for one service and empty for
-- the other two.
--
-- So the row learns two more owners. Everything already built then works for
-- all three services instead of being written twice.
--
-- EXACTLY ONE OWNER
-- -----------------
-- A video belongs to an order, a project, or a subscription month. Never two,
-- never none. The check constraint is the thing that keeps that true, because
-- a video with two owners appears twice in a client's list and a video with
-- none is invisible to everybody.
--
-- Nothing changes for existing rows: every one of them has an order_id, and
-- the constraint they already satisfy is the one they keep satisfying.

/* ---------- custom video work ---------- */

create table if not exists public.projects (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid references public.customers (id) on delete set null,
  customer_email text not null,

  title          text not null check (char_length(title) between 2 and 160),
  brief          text,

  -- Enquiries and projects are deliberately separate things, see
  -- project_requests below. A project is work we intend to do, which is why
  -- its first status is scoped rather than "enquiry": most start life on a
  -- call or a referral with no quoting at all.
  status         text not null default 'scoped'
                   check (status in ('scoped','in_production','review','delivered','closed','cancelled')),

  quoted_cents   integer check (quoted_cents >= 0),
  agreed_cents   integer check (agreed_cents >= 0),

  owner_email    text,
  due_at         timestamptz,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.projects is
  'Custom video work. Invoices point at these instead of at a throwaway product.';

create index if not exists projects_customer_idx on public.projects (customer_email);
create index if not exists projects_status_idx on public.projects (status, created_at desc);

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

/* ---------- the enquiries that arrive before any project exists ---------- */

create table if not exists public.project_requests (
  id             uuid primary key default gen_random_uuid(),
  name           text,
  email          text not null,
  company        text,
  phone          text,
  brief          text,
  budget         text,

  source         text not null default 'website',
  status         text not null default 'new'
                   check (status in ('new','contacted','quoted','won','lost')),
  lost_reason    text,
  -- set when this enquiry became real work, so the two stay linked
  project_id     uuid references public.projects (id) on delete set null,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.project_requests is
  'Quote enquiries from the website. Kept apart from projects because most projects start on a call, with no enquiry at all.';

create index if not exists project_requests_status_idx
  on public.project_requests (status, created_at desc);

drop trigger if exists project_requests_set_updated_at on public.project_requests;
create trigger project_requests_set_updated_at
  before update on public.project_requests
  for each row execute function public.set_updated_at();

/* ---------- one billing month of an editing plan ---------- */

create table if not exists public.subscription_cycles (
  id              uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,

  period_start    timestamptz not null,
  period_end      timestamptz not null,

  -- Copied from the plan when the month opens rather than read live, so a
  -- client who changes plan mid-month keeps the allowance they were sold, and
  -- last March still reports what last March actually promised.
  long_form_allowed  integer not null default 0 check (long_form_allowed >= 0),
  short_form_allowed integer not null default 0 check (short_form_allowed >= 0),

  created_at      timestamptz not null default now(),

  unique (subscription_id, period_start),
  constraint subscription_cycles_period_makes_sense check (period_end > period_start)
);

comment on table public.subscription_cycles is
  'One row per billing month. Allowances are copied in, never read live, so history stays true. No roll over: each month starts fresh.';

create index if not exists subscription_cycles_sub_idx
  on public.subscription_cycles (subscription_id, period_start desc);

/* ---------- the change itself ---------- */

alter table public.order_deliverables
  alter column order_id drop not null,
  add column if not exists project_id uuid references public.projects (id) on delete cascade,
  add column if not exists cycle_id   uuid references public.subscription_cycles (id) on delete cascade,
  -- long or short only matters for editing plans, where they are counted
  -- separately against the month's allowance
  add column if not exists form text check (form in ('long','short'));

comment on column public.order_deliverables.project_id is
  'Set for custom video work. Exactly one of order_id, project_id, cycle_id is ever set.';
comment on column public.order_deliverables.cycle_id is
  'Set for an editing plan video, naming the month it counts against.';

/* One owner, always. Written as a constraint rather than trusted to the
   application, because a video with two owners shows up twice in a client's
   list and one with none is invisible to everybody. */
alter table public.order_deliverables
  drop constraint if exists order_deliverables_one_owner;
alter table public.order_deliverables
  add constraint order_deliverables_one_owner
  check (
    (case when order_id   is not null then 1 else 0 end) +
    (case when project_id is not null then 1 else 0 end) +
    (case when cycle_id   is not null then 1 else 0 end) = 1
  );

create index if not exists order_deliverables_project_idx
  on public.order_deliverables (project_id) where project_id is not null;
create index if not exists order_deliverables_cycle_idx
  on public.order_deliverables (cycle_id) where cycle_id is not null;

/* The no-duplicates backstop, extended to the two new owners. The original
   index covers (order_id, position); with order_id now nullable it keeps
   working for orders, because Postgres treats nulls as distinct, and these
   two give projects and cycles the same protection. */
create unique index if not exists order_deliverables_project_position_idx
  on public.order_deliverables (project_id, position) where project_id is not null;
create unique index if not exists order_deliverables_cycle_position_idx
  on public.order_deliverables (cycle_id, position) where cycle_id is not null;

/* Admin reads these like every other money-adjacent table. The portal reaches
   them through server routes that scope by the signed-in email, so no anon
   policy belongs here. */
alter table public.projects enable row level security;
alter table public.project_requests enable row level security;
alter table public.subscription_cycles enable row level security;

drop policy if exists projects_admin_read on public.projects;
create policy projects_admin_read on public.projects
  for select to authenticated using (public.is_admin());

drop policy if exists project_requests_admin_read on public.project_requests;
create policy project_requests_admin_read on public.project_requests
  for select to authenticated using (public.is_admin());

drop policy if exists subscription_cycles_admin_read on public.subscription_cycles;
create policy subscription_cycles_admin_read on public.subscription_cycles
  for select to authenticated using (public.is_admin());
