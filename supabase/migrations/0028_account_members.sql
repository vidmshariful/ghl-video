-- 0028: team members for the customer and partner portals.
--
-- Founders and partners hand day-to-day work to a VA or teammate. A row
-- here lets another login (member_email) work inside the owner's portal
-- (owner_email), limited to the features the owner granted. The member
-- signs in with their OWN Supabase account; the portal APIs resolve the
-- acting account from an X-Act-For header validated against this table.
--
-- `features` mirrors the admin roles pattern: null means everything the
-- portal offers; an array is the explicit grant list (keys defined in
-- lib/team-features.ts). Team management itself is always owner-only.
--
-- Access: service-role only through /api/*; default-deny RLS.

create table if not exists public.account_members (
  id           uuid primary key default gen_random_uuid(),
  account_type text not null check (account_type in ('customer', 'partner')),
  owner_email  text not null,
  member_email text not null,
  member_name  text,
  features     text[],
  status       text not null default 'invited'
               check (status in ('invited', 'active')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- a member appears once per account; the same person may serve
  -- several owners (a VA with multiple clients)
  unique (account_type, owner_email, member_email)
);

create index if not exists account_members_member_idx
  on public.account_members (member_email, account_type);
create index if not exists account_members_owner_idx
  on public.account_members (owner_email, account_type);

drop trigger if exists account_members_set_updated_at on public.account_members;
create trigger account_members_set_updated_at
  before update on public.account_members
  for each row execute function public.set_updated_at();

alter table public.account_members enable row level security;
