-- The client record: what admin needs to hold about one customer.
--
-- Four additions, each answering something the customers screen could not.
--
-- tags            Purchase tags were pushed to HighLevel and never kept here,
--                 which is why the screen showed none. Service tags (premade,
--                 custom, editing) are DERIVED from what a client actually has
--                 and are never stored, because a stored one goes stale the
--                 first time somebody buys something. This column is only for
--                 the hand-written ones: "agency", "priority", "referred by X".
--
-- hidden_sections Per client menu visibility. A client who only ever buys
--                 custom video should not be shown a premade library, and
--                 HighLevel is exactly that case. Empty means show everything,
--                 so every existing account is unaffected and the safe state is
--                 the default rather than something to remember to set.
--
-- last_seen_at    Written by the portal, so a valuable client going quiet is
--                 visible. Reading auth.users would work but costs a paginated
--                 admin API call per screen, and this is one indexed column.
--
-- internal notes  Their own table rather than a text column, because who wrote
--                 a note and when is most of what makes it worth reading.

alter table public.customers
  add column if not exists tags            text[] not null default '{}',
  add column if not exists hidden_sections text[] not null default '{}',
  add column if not exists last_seen_at    timestamptz;

comment on column public.customers.tags is
  'Hand-written tags only. Service tags are derived from orders, projects and subscriptions.';
comment on column public.customers.hidden_sections is
  'Portal sections hidden from this account. Empty = show everything.';

create index if not exists customers_last_seen_idx
  on public.customers (last_seen_at desc nulls last);

create table if not exists public.customer_notes (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  author      text not null,
  body        text not null check (char_length(body) between 1 and 4000),
  created_at  timestamptz not null default now()
);

comment on table public.customer_notes is
  'Internal notes on a client. Never shown in the portal.';

create index if not exists customer_notes_customer_idx
  on public.customer_notes (customer_id, created_at desc);

-- Default deny. Admin reads through the SPA like orders; the portal never
-- touches this table at all, which is the point of it.
alter table public.customer_notes enable row level security;

drop policy if exists customer_notes_admin_read on public.customer_notes;
create policy customer_notes_admin_read on public.customer_notes
  for select to authenticated using (public.is_admin());
