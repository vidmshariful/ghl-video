-- GHL Video native checkout schema (POC: one SKU, architecture for all).
-- Database-first: this already supports one-time AND subscription products,
-- order bumps and upsells (via products.metadata), and a full audit trail,
-- even though the POC exercises a single one-time SKU.
--
-- Money path, so the defaults are strict: RLS on every table, orders and
-- customers are NOT publicly readable, and price authority lives here in
-- products.price_cents (the server reads it by SKU, never trusts the client).
--
-- Apply: paste into the Supabase SQL editor, or run with the service-role
-- key from a trusted shell. Safe to re-run (idempotent guards throughout).

-- Extensions -----------------------------------------------------------------
create extension if not exists "pgcrypto";      -- gen_random_uuid()

-- updated_at helper ----------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- products -------------------------------------------------------------------
-- The catalog and the single source of price truth. One row per sellable
-- SKU. metadata carries per-product config (delivery_days, video_count,
-- tier, the HighLevel tag to apply, bump_eligible, upsell_sku, ...) so
-- adding a product later is a row insert, never new plumbing.
create table if not exists public.products (
  id           uuid primary key default gen_random_uuid(),
  sku          text not null unique,
  name         text not null,
  description  text,
  type         text not null default 'one_time'
                 check (type in ('one_time', 'subscription')),
  price_cents  integer not null check (price_cents >= 0),
  currency     text not null default 'usd',
  active       boolean not null default true,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists products_sku_idx on public.products (sku);

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- customers ------------------------------------------------------------------
-- Deduplicated by email. Holds the cross-system identity: the Stripe
-- customer id and the HighLevel contact id, so repeat buyers reconcile.
create table if not exists public.customers (
  id                    uuid primary key default gen_random_uuid(),
  email                 text not null unique,
  name                  text,
  company               text,
  phone                 text,
  stripe_customer_id    text,
  highlevel_contact_id  text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists customers_email_idx on public.customers (email);

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- orders ---------------------------------------------------------------------
-- One row per purchase attempt. amount_cents is a SNAPSHOT of the price at
-- purchase time (never re-read from products, so historical orders stay
-- honest if a price later changes). status walks pending -> paid | failed,
-- with refunded reserved for later. The unique constraint on the Stripe
-- PaymentIntent id is the backbone of idempotent webhook handling.
create table if not exists public.orders (
  id                        uuid primary key default gen_random_uuid(),
  product_id                uuid not null references public.products(id),
  customer_id               uuid not null references public.customers(id),
  customer_email            text not null,           -- denormalized for lookup
  amount_cents              integer not null check (amount_cents >= 0),
  currency                  text not null default 'usd',
  status                    text not null default 'pending'
                              check (status in ('pending','paid','failed','refunded')),
  stripe_payment_intent_id  text unique,
  highlevel_contact_id      text,
  highlevel_opportunity_id  text,
  metadata                  jsonb not null default '{}'::jsonb,
  created_at                timestamptz not null default now(),
  paid_at                   timestamptz
);

create index if not exists orders_stripe_pi_idx    on public.orders (stripe_payment_intent_id);
create index if not exists orders_customer_email_idx on public.orders (customer_email);
create index if not exists orders_status_idx        on public.orders (status);
create index if not exists orders_product_idx       on public.orders (product_id);

-- order_events ---------------------------------------------------------------
-- The audit log. Every state change appends a row here (intent_created,
-- webhook_received, payment_succeeded, payment_failed, hl_synced,
-- hl_sync_failed, ...), so any order can be reconstructed end to end.
create table if not exists public.order_events (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  event_type  text not null,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists order_events_order_idx on public.order_events (order_id);
create index if not exists order_events_type_idx  on public.order_events (event_type);

-- stripe_events --------------------------------------------------------------
-- Event-level idempotency guard. Stripe can deliver the same webhook event
-- more than once; we record each processed event id and no-op on repeats,
-- BEFORE any fulfillment runs. Belt to the orders unique-constraint braces.
create table if not exists public.stripe_events (
  id            text primary key,            -- Stripe event id (evt_...)
  type          text not null,
  processed_at  timestamptz not null default now()
);

-- Row-level security ---------------------------------------------------------
alter table public.products      enable row level security;
alter table public.customers     enable row level security;
alter table public.orders        enable row level security;
alter table public.order_events  enable row level security;
alter table public.stripe_events enable row level security;

-- Products are the only publicly readable table, and only the active rows:
-- prices are already public on the marketing site. Everything server-side
-- runs with the service-role key, which bypasses RLS. customers, orders,
-- order_events and stripe_events get NO anon/authenticated policy, so they
-- are default-deny to the publishable/anon key.
drop policy if exists products_public_read on public.products;
create policy products_public_read
  on public.products for select
  to anon, authenticated
  using (active = true);

-- Seed: the POC product ------------------------------------------------------
-- The AI-first Master Explainer single video, $495 one-time. Re-runnable.
insert into public.products (sku, name, description, type, price_cents, currency, active, metadata)
values (
  'all-in-one-ai-first-positioning',
  'All-in-one + AI-First Positioning',
  'All-in-one plus AI-first positioning in 90 to 120 seconds. The video that sells your platform before the first call.',
  'one_time',
  49500,
  'usd',
  true,
  jsonb_build_object(
    'tier', 'premade',
    'video_count', 1,
    'format', 'Master Explainer',
    'capability', 'All-in-one',
    'delivery_days', 3,
    'bump_eligible', false,
    'upsell_sku', 'ai-first-saas-pack',
    'hl_tags', jsonb_build_array('ghlv-purchase', 'ghlv-all-in-one-ai-first-positioning')
  )
)
on conflict (sku) do update set
  name        = excluded.name,
  description = excluded.description,
  price_cents = excluded.price_cents,
  metadata    = excluded.metadata,
  updated_at  = now();
