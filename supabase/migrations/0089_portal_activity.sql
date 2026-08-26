-- Who is actually in the portal, and who has been.
--
-- customers.last_seen_at already existed and answers neither question well.
-- It is stamped once per profile load, it is per ACCOUNT rather than per
-- person, so a teammate signing in reads as the owner visiting, and it cannot
-- tell an open tab from somebody who left three hours ago.
--
-- Two tables because they are two different shapes of question.
--
--   portal_activity is a log: it only ever grows, and it answers "has anyone
--   from HighLevel been in this week".
--
--   portal_presence is a scoreboard: one row per person per account, rewritten
--   by a heartbeat while a tab is open, and it answers "is Emma in there right
--   now". Keeping the heartbeat OUT of the log is the point. A ping a minute
--   per open tab would bury the sign ins nobody could then find.
--
-- Both record the actor and the account separately, because a teammate works
-- inside somebody else's account and "Emma signed in" and "somebody was in
-- HighLevel's portal" are different facts.
--
-- Studio staff using View as client write nothing here. Us looking at a
-- client's portal is not the client using it, and a log that cannot tell the
-- difference answers the question wrongly in the direction that flatters us.

create table if not exists public.portal_activity (
  id            uuid primary key default gen_random_uuid(),
  account_email text not null,
  actor_email   text not null,
  kind          text not null check (kind in ('signed_in', 'signed_out')),
  at            timestamptz not null default now()
);

create index if not exists portal_activity_account_idx
  on public.portal_activity (account_email, at desc);
create index if not exists portal_activity_at_idx
  on public.portal_activity (at desc);

create table if not exists public.portal_presence (
  actor_email   text not null,
  account_email text not null,
  last_seen_at  timestamptz not null default now(),
  primary key (actor_email, account_email)
);

create index if not exists portal_presence_seen_idx
  on public.portal_presence (last_seen_at desc);

-- Default deny, like every other table here. Both are written by server code
-- holding the service role and read only through the admin API.
alter table public.portal_activity enable row level security;
alter table public.portal_presence enable row level security;

drop policy if exists portal_activity_admin_all on public.portal_activity;
create policy portal_activity_admin_all on public.portal_activity
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists portal_presence_admin_all on public.portal_presence;
create policy portal_presence_admin_all on public.portal_presence
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

comment on table public.portal_activity is
  'Append-only log of portal sign ins and sign outs. Staff View as client is never recorded.';
comment on table public.portal_presence is
  'One row per person per account, refreshed by a heartbeat while a tab is open.';
