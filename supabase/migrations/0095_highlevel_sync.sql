-- HighLevel owns the customer; Supabase owns the work; this is the wire
-- between them (phase 2 of the rebuild plan, September 2026).
--
-- hl_sync_outbox   Every change to a customer, project or video writes one
--                  row here, by trigger, so no screen has to remember to
--                  tell HighLevel. A worker drains it: builds the payload
--                  from the live row, calls HighLevel, marks the row done or
--                  schedules a retry. Failures keep the row and the error,
--                  so nothing is lost when HighLevel is down.
-- hl_links         What each of our rows is in HighLevel: the contact, the
--                  opportunity, the custom object record. One row per pair,
--                  with the last payload's fingerprint so the reconciliation
--                  can say "unchanged" without calling out.
-- hl_inbound       Every event HighLevel sends us, raw, with when it was
--                  handled and how. The audit trail for "why did this
--                  contact change".
--
-- Service role only: the portal and admin never touch these directly.

create table if not exists public.hl_sync_outbox (
  id              bigint generated always as identity primary key,
  kind            text not null check (kind in ('customer', 'project', 'video')),
  entity_id       uuid not null,
  op              text not null default 'upsert' check (op in ('upsert', 'delete')),
  reason          text,
  attempts        integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error      text,
  created_at      timestamptz not null default now(),
  done_at         timestamptz
);
create index if not exists hl_sync_outbox_pending_idx
  on public.hl_sync_outbox (next_attempt_at) where done_at is null;
create index if not exists hl_sync_outbox_entity_idx
  on public.hl_sync_outbox (kind, entity_id) where done_at is null;
alter table public.hl_sync_outbox enable row level security;

create table if not exists public.hl_links (
  kind         text not null check (kind in ('customer', 'project', 'video')),
  entity_id    uuid not null,
  hl_id        text not null,
  hl_kind      text not null check (hl_kind in ('contact', 'opportunity', 'record')),
  location_id  text not null,
  fingerprint  text,
  synced_at    timestamptz not null default now(),
  primary key (kind, entity_id, hl_kind)
);
create index if not exists hl_links_hl_idx on public.hl_links (hl_kind, hl_id);
alter table public.hl_links enable row level security;

create table if not exists public.hl_inbound (
  id           bigint generated always as identity primary key,
  event        text not null,
  payload      jsonb not null,
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  outcome      text
);
alter table public.hl_inbound enable row level security;

-- One row in the outbox per change, collapsed: a customer edited three
-- times in a minute is one job, not three. The partial unique index is what
-- collapses it, and the insert simply does nothing when a pending row for
-- the same entity is already waiting.
create unique index if not exists hl_sync_outbox_one_pending_idx
  on public.hl_sync_outbox (kind, entity_id) where done_at is null;

create or replace function public.hl_enqueue(p_kind text, p_entity uuid, p_reason text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.hl_sync_outbox (kind, entity_id, reason)
  values (p_kind, p_entity, p_reason)
  on conflict do nothing;
$$;

create or replace function public.hl_customer_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.hl_enqueue('customer', new.id, tg_op);
  return new;
end $$;

-- a project also reshapes its customer (their lines, their tags), so the
-- customer is queued with it and, going first in the drain, sees the new job
create or replace function public.hl_project_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cust uuid;
begin
  perform public.hl_enqueue('project', new.id, tg_op);
  cust := new.customer_id;
  if cust is null and new.customer_email is not null then
    select id into cust from public.customers where lower(email) = lower(new.customer_email) limit 1;
  end if;
  if cust is not null then
    perform public.hl_enqueue('customer', cust, 'project ' || tg_op);
  end if;
  return new;
end $$;

-- an order or a plan changes what lines an account has; neither table is
-- mirrored itself, but the customer is queued so the contact's tags follow
create or replace function public.hl_customer_of_row_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cust uuid;
begin
  cust := new.customer_id;
  if cust is null and new.customer_email is not null then
    select id into cust from public.customers where lower(email) = lower(new.customer_email) limit 1;
  end if;
  if cust is not null then
    perform public.hl_enqueue('customer', cust, tg_table_name || ' ' || tg_op);
  end if;
  return new;
end $$;

create or replace function public.hl_video_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.hl_enqueue('video', new.id, tg_op);
  return new;
end $$;

drop trigger if exists hl_customer_changed on public.customers;
create trigger hl_customer_changed
  after insert or update on public.customers
  for each row execute function public.hl_customer_changed();

drop trigger if exists hl_project_changed on public.projects;
create trigger hl_project_changed
  after insert or update on public.projects
  for each row execute function public.hl_project_changed();

drop trigger if exists hl_video_changed on public.order_deliverables;
create trigger hl_video_changed
  after insert or update on public.order_deliverables
  for each row execute function public.hl_video_changed();

drop trigger if exists hl_order_changed on public.orders;
create trigger hl_order_changed
  after insert or update of status, customer_email, customer_id on public.orders
  for each row execute function public.hl_customer_of_row_changed();

drop trigger if exists hl_subscription_changed on public.subscriptions;
create trigger hl_subscription_changed
  after insert or update of status, customer_email, customer_id on public.subscriptions
  for each row execute function public.hl_customer_of_row_changed();

-- the configuration HighLevel gives us on provisioning: field ids, pipeline
-- and stage ids, the object keys. One row per location, written by
-- scripts/hl-provision, read by the sync.
create table if not exists public.hl_config (
  location_id  text primary key,
  config       jsonb not null default '{}'::jsonb,
  updated_at   timestamptz not null default now()
);
alter table public.hl_config enable row level security;
