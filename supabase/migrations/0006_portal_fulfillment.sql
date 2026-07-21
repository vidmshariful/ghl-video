-- Portal fulfillment data. The team drives these from /admin; the customer
-- sees them in /account. Customers read via server routes (service role,
-- filtered by their verified email), so no customer RLS policies are added
-- here; these tables stay admin-only to the authenticated client.

alter table public.orders
  add column if not exists fulfillment_stage text not null default 'paid'
    check (fulfillment_stage in ('paid','intake','production','review','delivered')),
  add column if not exists assigned_manager text not null default 'Tanvir Prince',
  add column if not exists delivery_url text,
  add column if not exists invoice_number text,
  add column if not exists intake_completed boolean not null default false;

-- Backfill an invoice number for existing paid orders (GV-<short id>).
update public.orders
  set invoice_number = 'GV-' || upper(substr(replace(id::text, '-', ''), 1, 8))
  where invoice_number is null;

-- Customer-facing timeline entries the team posts ("Script approved", etc.).
create table if not exists public.order_updates (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists order_updates_order_idx on public.order_updates (order_id);

alter table public.order_updates enable row level security;
-- Admin manages updates through the authenticated client; customers read
-- them via the portal server route (service role).
drop policy if exists order_updates_admin_all on public.order_updates;
create policy order_updates_admin_all on public.order_updates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
