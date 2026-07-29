-- Native invoices: itemized, sendable, payable invoices for custom videos and
-- one-off deals.
--
-- Each invoice is backed by an active one_time product row, so payment runs
-- through the EXISTING checkout -> order -> webhook -> HighLevel path with no
-- money-path changes; the invoice's "paid" state is derived from that order
-- (a paid order for the backing product). The public /invoice/<token> page is
-- read server-side with the service-role key, gated by the unguessable token
-- (same capability model as the intake link). Admin-only RLS like the other
-- money tables; no anon policies.

create sequence if not exists public.invoice_number_seq start 1001;

create table if not exists public.invoices (
  id                uuid primary key default gen_random_uuid(),
  number            text not null unique default ('INV-' || nextval('public.invoice_number_seq')),
  token             uuid not null unique default gen_random_uuid(),
  product_id        uuid references public.products(id) on delete set null,
  product_sku       text not null,
  customer_name     text,
  customer_email    text,
  customer_company  text,
  line_items        jsonb not null default '[]'::jsonb, -- [{description, amount_cents}]
  currency          text not null default 'usd',
  total_cents       integer not null check (total_cents >= 0),
  notes             text,
  due_date          date,
  status            text not null default 'open' check (status in ('open', 'void')),
  sent_at           timestamptz,
  created_by        text,
  created_at        timestamptz not null default now()
);
create index if not exists invoices_product_idx on public.invoices (product_id);
create index if not exists invoices_created_idx on public.invoices (created_at desc);

alter table public.invoices enable row level security;
drop policy if exists invoices_admin_all on public.invoices;
create policy invoices_admin_all on public.invoices
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
