-- Quotes, the retainer agreement, leads and partners in HighLevel (phase 5
-- of the rebuild plan, September 2026). Owner decision, 14 September: the
-- client accepts a quote and signs the agreement on OUR pages; HighLevel
-- mirrors what happened (the deal card's value, a note on the contact, a
-- field). Nothing is managed inside HighLevel.
--
-- quotes            A priced scope sent to a lead or a client, accepted or
--                   declined by them on the public quote page or in the
--                   portal. Accepting one makes the project (or sets its
--                   agreed price) and marks the enquiry won. Money then
--                   follows through invoices (phase 3).

create table if not exists public.quotes (
  id                uuid primary key default gen_random_uuid(),
  number            text not null unique default ('Q-' || nextval('public.invoice_number_seq')),
  token             uuid not null unique default gen_random_uuid(),
  customer_email    text not null,
  customer_name     text,
  customer_company  text,
  request_id        uuid references public.project_requests(id) on delete set null,
  project_id        uuid references public.projects(id) on delete set null,
  title             text not null,
  line_items        jsonb not null default '[]'::jsonb,
  subtotal_cents    integer not null default 0 check (subtotal_cents >= 0),
  discount_kind     text check (discount_kind in ('percent', 'flat')),
  discount_value    integer,
  total_cents       integer not null check (total_cents >= 0),
  scope             text,
  valid_until       date,
  status            text not null default 'draft'
                    check (status in ('draft', 'sent', 'accepted', 'declined', 'void')),
  sent_at           timestamptz,
  accepted_at       timestamptz,
  accepted_by       text,
  accepted_ip       text,
  declined_at       timestamptz,
  decline_reason    text,
  created_by        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists quotes_email_idx on public.quotes (customer_email);
create index if not exists quotes_project_idx on public.quotes (project_id);
create index if not exists quotes_request_idx on public.quotes (request_id);
alter table public.quotes enable row level security;
drop policy if exists quotes_admin_all on public.quotes;
create policy quotes_admin_all on public.quotes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

comment on table public.quotes is
  'A priced scope the client accepts on our page. Accepting it makes or prices the project; money then follows through invoices.';

/* the outbox and the links learn leads and partners */
alter table public.hl_sync_outbox drop constraint if exists hl_sync_outbox_kind_check;
alter table public.hl_sync_outbox add constraint hl_sync_outbox_kind_check
  check (kind in ('customer', 'project', 'video', 'invoice', 'order', 'lead', 'partner'));
alter table public.hl_links drop constraint if exists hl_links_kind_check;
alter table public.hl_links add constraint hl_links_kind_check
  check (kind in ('customer', 'project', 'video', 'invoice', 'order', 'lead', 'partner'));

create or replace function public.hl_lead_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.hl_enqueue('lead', new.id, tg_op);
  return new;
end $$;

drop trigger if exists hl_lead_changed on public.project_requests;
create trigger hl_lead_changed
  after insert or update on public.project_requests
  for each row execute function public.hl_lead_changed();

create or replace function public.hl_partner_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.hl_enqueue('partner', new.id, tg_op);
  return new;
end $$;

drop trigger if exists hl_partner_changed on public.partners;
create trigger hl_partner_changed
  after insert or update on public.partners
  for each row execute function public.hl_partner_changed();

/* a quote's life is told on the contact as notes; the deal card follows the project */
create or replace function public.hl_quote_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cust uuid;
begin
  select id into cust from public.customers where lower(email) = lower(new.customer_email) limit 1;
  if cust is not null then
    perform public.hl_enqueue('customer', cust, 'quote ' || tg_op);
  end if;
  return new;
end $$;

drop trigger if exists hl_quote_changed on public.quotes;
create trigger hl_quote_changed
  after insert or update on public.quotes
  for each row execute function public.hl_quote_changed();
