-- "I want this one first": demand, recorded before the video exists.
--
-- The catalogue already knows what is coming (coming_soon). This table is
-- what clients say about it. One row per person per upcoming video, with an
-- optional note, which turns the roadmap from a guess into a queue ordered
-- by people who intend to pay. The unique pair keeps a keen founder from
-- voting a video up forty times.
--
-- Votes survive launch on purpose: when a video ships, its vote rows are the
-- list of people to tell first.

create table if not exists public.catalog_votes (
  id             uuid primary key default gen_random_uuid(),
  code           text not null,
  customer_email text not null,
  note           text,
  created_at     timestamptz not null default now(),

  unique (code, customer_email)
);

comment on table public.catalog_votes is
  'Client interest in coming_soon catalog rows. One vote per person per video; notes say why.';

create index if not exists catalog_votes_code_idx on public.catalog_votes (code);

alter table public.catalog_votes enable row level security;

drop policy if exists catalog_votes_admin_read on public.catalog_votes;
create policy catalog_votes_admin_read on public.catalog_votes
  for select to authenticated using (public.is_admin());
