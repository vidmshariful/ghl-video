-- Editing plans move from two fixed buckets to one credit balance.
--
-- The old model sold "N long form and M short form videos" a month. Clients
-- do not think in those words: a real client's first three requests were five
-- minute YouTube videos filed as "short form" because short was the default
-- and nothing in between existed. He spent three short slots while four long
-- slots sat idle, and every card told the editor "short, 16:9, 5 min".
--
-- Credits price the work by what it actually is (see lib/editing-credits.ts).
-- The numbers are the old plans run through the same table, so nobody loses
-- anything in the move: 2 long + 4 short = 10, 4 + 8 = 20, 8 + 16 = 40.

-- ---- what a month grants ----
-- The old per-form allowances stay on the row for now. They are what the
-- history was measured in, and dropping them would rewrite months that have
-- already been billed and delivered.
alter table public.subscription_cycles
  add column if not exists credits_allowed integer not null default 0;

comment on column public.subscription_cycles.credits_allowed is
  'Editing credits granted for this month by the plan. Does not roll over. Top-up credits live on the subscription and do carry.';

-- ---- what a piece of work costs ----
alter table public.order_deliverables
  add column if not exists edit_type text,
  add column if not exists runtime_minutes numeric(6,1),
  add column if not exists credit_cost integer;

comment on column public.order_deliverables.edit_type is
  'short | mid | long | podcast_standard | podcast_advanced. The shape of the work, which decides its credit cost. Replaces the old two-value `form`.';
comment on column public.order_deliverables.runtime_minutes is
  'Finished runtime in minutes. Required for podcasts, which are priced on it; informational on the video tiers, which are flat.';
comment on column public.order_deliverables.credit_cost is
  'Credits this piece of work spent, stamped at creation so a later price change never rewrites a month that was already billed.';

-- ---- top-up credits, bought when a month runs out ----
-- A ledger rather than a running total: a balance you cannot explain is a
-- balance a client will argue with, and "where did my credits go" has to be
-- answerable from rows. Plan credits are NOT in here; they are granted and
-- reset by the cycle. These are bought, and they do not expire.
create table if not exists public.editing_credit_grants (
  id               uuid primary key default gen_random_uuid(),
  subscription_id  uuid not null references public.subscriptions (id) on delete cascade,
  credits          integer not null check (credits > 0),
  price_cents      integer not null default 0 check (price_cents >= 0),
  -- the order that paid for them, so a refund can be traced to a grant
  order_id         uuid references public.orders (id) on delete set null,
  note             text,
  created_at       timestamptz not null default now()
);

create index if not exists editing_credit_grants_sub_idx
  on public.editing_credit_grants (subscription_id, created_at desc);

comment on table public.editing_credit_grants is
  'Top-up credits bought on top of a plan. They never expire, unlike the monthly plan grant.';

alter table public.editing_credit_grants enable row level security;

drop policy if exists editing_credit_grants_admin_all on public.editing_credit_grants;
create policy editing_credit_grants_admin_all on public.editing_credit_grants
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---- backfill ----
-- Grant every existing cycle the credits its plan is worth.
update public.subscription_cycles
   set credits_allowed = case plan_sku
     when 'editing-starter' then 10
     when 'editing-growth'  then 20
     when 'editing-scale'   then 40
     else coalesce(long_form_allowed, 0) * 3 + coalesce(short_form_allowed, 0)
   end
 where credits_allowed = 0;

-- Give every existing request a type and a cost.
--
-- Length wins over the old form value where we have it, because the form
-- value is exactly what clients got wrong. A 300 second video recorded as
-- "short" was always a mid form video, and this is the moment to say so:
-- it costs 2 credits, not 1, and the editor stops being told it is a 90
-- second cut.
update public.order_deliverables
   set edit_type = case
         when target_seconds is not null and target_seconds > 0 then
           case
             when target_seconds <= 90  then 'short'
             when target_seconds <= 300 then 'mid'
             else 'long'
           end
         when form = 'long' then 'long'
         else 'short'
       end
 where cycle_id is not null
   and edit_type is null;

update public.order_deliverables
   set runtime_minutes = round((target_seconds / 60.0)::numeric, 1)
 where cycle_id is not null
   and runtime_minutes is null
   and target_seconds is not null
   and target_seconds > 0;

update public.order_deliverables
   set credit_cost = case edit_type
         when 'short' then 1
         when 'mid'   then 2
         when 'long'  then 3
         else 1
       end
 where cycle_id is not null
   and credit_cost is null;
