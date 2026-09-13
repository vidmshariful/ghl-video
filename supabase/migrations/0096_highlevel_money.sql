-- Money in HighLevel (phase 3 of the rebuild plan, September 2026).
--
-- HighLevel owns the invoice: it is raised there, paid there through the
-- studio's Stripe connection, and it carries the pay link. This table is
-- its mirror, plus what HighLevel does not know: which projects a bill
-- covers, which order it tops up, and what kind of money it is.
--
-- paid_at is the ONE test for "paid". Before this, an invoice was paid when
-- a paid order existed for a throwaway product minted per invoice (the
-- invoice product hack), and eleven screens each re-derived that. New rows
-- carry no product; the old ones keep theirs as history and get paid_at
-- backfilled from the order that settled them.

alter table public.invoices
  add column if not exists hl_invoice_id     text,
  add column if not exists hl_number         text,
  add column if not exists hl_status         text,
  add column if not exists hl_url            text,
  add column if not exists hl_sent_at        timestamptz,
  add column if not exists paid_at           timestamptz,
  add column if not exists amount_paid_cents integer not null default 0,
  add column if not exists kind              text not null default 'custom',
  add column if not exists source            text not null default 'platform',
  add column if not exists payment_note      text,
  add column if not exists updated_at        timestamptz not null default now();

alter table public.invoices alter column product_sku drop not null;

create unique index if not exists invoices_hl_invoice_idx
  on public.invoices (hl_invoice_id) where hl_invoice_id is not null;
create index if not exists invoices_open_idx
  on public.invoices (status) where paid_at is null;

alter table public.invoices drop constraint if exists invoices_kind_check;
alter table public.invoices add constraint invoices_kind_check
  check (kind in ('custom', 'addon', 'retainer', 'premade', 'plan'));
alter table public.invoices drop constraint if exists invoices_source_check;
alter table public.invoices add constraint invoices_source_check
  check (source in ('platform', 'highlevel', 'migration'));

comment on column public.invoices.paid_at is
  'When the money arrived. The one test for paid; null means still owed or void.';
comment on column public.invoices.kind is
  'custom: bespoke work; addon: extra work on an order already delivered; retainer: a month of the partnership; premade: a shelf sale; plan: an editing plan month.';
comment on column public.invoices.source is
  'platform: raised in admin; highlevel: made in HighLevel by hand or by a schedule; migration: moved across at go-live.';

/* legacy invoices settled through checkout: the order that paid them says when */
update public.invoices i
   set paid_at = o.paid_at,
       amount_paid_cents = i.total_cents
  from public.orders o
 where i.paid_at is null
   and i.product_id is not null
   and o.product_id = i.product_id
   and o.status = 'paid';

update public.invoices set kind = 'addon' where parent_order_id is not null and kind = 'custom';

/* a premade sale paid on the site is recorded in HighLevel as a paid invoice */
alter table public.orders add column if not exists hl_invoice_id text;

/* the retainer's recurring invoice in HighLevel */
alter table public.customers add column if not exists hl_retainer_schedule_id text;

/* an estimate sent from HighLevel for a project (wired in a later step) */
alter table public.projects
  add column if not exists hl_estimate_id text,
  add column if not exists hl_estimate_status text;

/* the outbox and the links learn two more kinds */
alter table public.hl_sync_outbox drop constraint if exists hl_sync_outbox_kind_check;
alter table public.hl_sync_outbox add constraint hl_sync_outbox_kind_check
  check (kind in ('customer', 'project', 'video', 'invoice', 'order'));
alter table public.hl_links drop constraint if exists hl_links_kind_check;
alter table public.hl_links add constraint hl_links_kind_check
  check (kind in ('customer', 'project', 'video', 'invoice', 'order'));
alter table public.hl_links drop constraint if exists hl_links_hl_kind_check;
alter table public.hl_links add constraint hl_links_hl_kind_check
  check (hl_kind in ('contact', 'opportunity', 'record', 'invoice', 'schedule', 'estimate'));

create or replace function public.hl_invoice_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.hl_enqueue('invoice', new.id, tg_op);
  return new;
end $$;

drop trigger if exists hl_invoice_changed on public.invoices;
create trigger hl_invoice_changed
  after insert or update on public.invoices
  for each row execute function public.hl_invoice_changed();

-- an order that becomes paid is a sale to record in HighLevel
create or replace function public.hl_order_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from 'paid') then
    perform public.hl_enqueue('order', new.id, 'paid');
  end if;
  return new;
end $$;

drop trigger if exists hl_order_paid on public.orders;
create trigger hl_order_paid
  after insert or update of status on public.orders
  for each row execute function public.hl_order_paid();
