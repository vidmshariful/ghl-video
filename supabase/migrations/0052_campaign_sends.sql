-- Who has already been emailed which offer, so nobody is ever emailed twice.
--
-- The dashboard half of campaigns has a quiet flaw idea #132 named: a dormant
-- client, the exact person a win-back offer is aimed at, by definition does
-- not log in to see it. Email is how the offer reaches them. This table is
-- the memory that makes those sends safe to repeat: the send button can be
-- pressed twice on Tuesday and again next month, and each person still gets
-- a given offer exactly once. New matches (somebody who went dormant since
-- the last press) are the only people a re-press reaches.

create table if not exists public.campaign_sends (
  id             uuid primary key default gen_random_uuid(),
  campaign_id    uuid not null references public.campaigns (id) on delete cascade,
  customer_email text not null,
  sent_at        timestamptz not null default now(),

  unique (campaign_id, customer_email)
);

comment on table public.campaign_sends is
  'One row per offer email delivered. The unique pair is the never-twice rule.';

alter table public.campaign_sends enable row level security;

drop policy if exists campaign_sends_admin_read on public.campaign_sends;
create policy campaign_sends_admin_read on public.campaign_sends
  for select to authenticated using (public.is_admin());
