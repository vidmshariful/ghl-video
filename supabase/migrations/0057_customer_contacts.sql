-- The people at a client, and which of them we actually work with.
--
-- A client is a company, not an email address. HighLevel is the case that
-- makes this obvious: Chase is the relationship, and Emma is the person who
-- writes scripts with us and answers production questions week to week. Send
-- a script question to Chase and it sits unanswered; send a contract question
-- to Emma and it goes to the wrong desk.
--
-- WHY THIS IS NOT account_members
-- -------------------------------
-- account_members is who can LOG IN to the portal, and it hangs off an auth
-- user. A contact is who we deal with, and most of them never sign in at all.
-- Conflating the two would mean inventing portal logins for people who only
-- ever appear on an email thread, or losing the person entirely because they
-- do not want an account. A contact can be given portal access later; that
-- stays account_members' job.
--
-- ROLES
-- -----
--   primary     the relationship. Contracts, invoices, the escalation.
--   production  the day to day: scripts, footage, feedback, approvals.
--   billing     where invoices should actually go, when that differs.
--   other       everyone else worth writing down.
--
-- The partial unique index is the rule that one person is in charge: a client
-- may have any number of contacts but only one primary, so "who do I call"
-- always has exactly one answer.

create table if not exists public.customer_contacts (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers (id) on delete cascade,

  name         text not null check (char_length(name) between 1 and 160),
  email        text,
  phone        text,
  role         text not null default 'other'
                 check (role in ('primary', 'production', 'billing', 'other')),
  title        text,
  notes        text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.customer_contacts is
  'People at a client and what each is for. Distinct from account_members, which is portal login access.';

create index if not exists customer_contacts_customer_idx
  on public.customer_contacts (customer_id, role);

create unique index if not exists customer_contacts_one_primary_idx
  on public.customer_contacts (customer_id) where role = 'primary';

drop trigger if exists customer_contacts_set_updated_at on public.customer_contacts;
create trigger customer_contacts_set_updated_at
  before update on public.customer_contacts
  for each row execute function public.set_updated_at();

alter table public.customer_contacts enable row level security;

drop policy if exists customer_contacts_admin_read on public.customer_contacts;
create policy customer_contacts_admin_read on public.customer_contacts
  for select to authenticated using (public.is_admin());

-- Who at the client this particular project runs through. Usually the
-- production contact, occasionally somebody brought in for one job, so it is
-- recorded per project rather than assumed from the client.
alter table public.projects
  add column if not exists contact_id uuid references public.customer_contacts (id) on delete set null;

comment on column public.projects.contact_id is
  'The person at the client running this project with us. Usually their production contact.';
