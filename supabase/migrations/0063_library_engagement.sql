-- Loves and plays on the catalogue, and share lists anyone can make.
--
-- The library is public now, so the two signals a catalogue page runs on
-- need somewhere to live: who loved a video (an explicit heart) and how
-- often one gets watched (a preview open). "Most loved" and "Most popular"
-- are those two columns sorted, nothing cleverer, and both start at zero
-- because invented numbers are worse than small ones.

begin;

create table if not exists public.catalog_stats (
  code       text primary key,
  loves      integer not null default 0 check (loves >= 0),
  plays      integer not null default 0 check (plays >= 0),
  updated_at timestamptz not null default now()
);

comment on table public.catalog_stats is
  'Per-video engagement counters. loves = explicit hearts, plays = preview opens. Anonymous and approximate by design; the page rate limits, the browser remembers its own hearts.';

alter table public.catalog_stats enable row level security;
-- default deny: only the service role writes, via the function below

/* One atomic bump, so two hearts landing together cannot lose one and a
   racing unlove can never push a counter below zero. */
create or replace function public.catalog_react(p_code text, p_loves int, p_plays int)
returns void language sql security definer set search_path = public as $$
  insert into public.catalog_stats (code, loves, plays)
  values (p_code, greatest(p_loves, 0), greatest(p_plays, 0))
  on conflict (code) do update set
    loves = greatest(0, catalog_stats.loves + p_loves),
    plays = greatest(0, catalog_stats.plays + p_plays),
    updated_at = now();
$$;

revoke all on function public.catalog_react(text, int, int) from public, anon, authenticated;

-- A share list no longer needs an account. The public library lets anyone
-- pick a few and hand a colleague the link; the row simply has no owner,
-- and the portal's own listing never shows ownerless rows because it
-- filters by owner email.
alter table public.shared_lists alter column owner_email drop not null;
alter table public.shared_lists add column if not exists source text not null default 'portal';

comment on column public.shared_lists.source is
  'Where the list was made: portal or library. Telemetry, so we can tell which door the feature actually earns its keep at.';

commit;
