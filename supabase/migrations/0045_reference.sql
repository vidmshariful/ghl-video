-- Things the owner and the team need often, in one place.
--
-- Keys, links, ids, the exact format of something: the stuff that currently
-- lives in a chat thread, a note on a phone, or somebody's memory. Being able
-- to grab it in two clicks is the whole point.
--
-- On sensitive values
-- -------------------
-- Some of what goes in here is a secret, so `secret` marks those and the API
-- never returns their value in a list. They are fetched one at a time, on
-- purpose, because the admin gets screenshotted and a wall of visible keys is
-- how one ends up in a screenshot.
--
-- What must NOT go in here: anything that moves money or opens the database.
-- Stripe's secret key, the Supabase service role key, the database URL. Those
-- belong in the hosting settings, which are encrypted and not readable through
-- any request. Copying one here would turn a single admin login into full
-- access to everything, and this table is not built to carry that.

create table if not exists public.reference_items (
  id          uuid primary key default gen_random_uuid(),
  label       text not null check (length(btrim(label)) > 0),
  value       text not null,
  -- what it is for, in the owner's words
  note        text,
  -- free text rather than an enum: the categories somebody actually wants are
  -- not knowable up front, and a wrong enum is worse than a typo
  category    text not null default 'General',
  secret      boolean not null default false,
  sort        int not null default 0,
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists reference_items_category_idx
  on public.reference_items (category, sort);

alter table public.reference_items enable row level security;

-- Admin only, both ways. There is no anon policy and there must never be one:
-- a public read here would hand out every key in the table.
drop policy if exists reference_items_admin on public.reference_items;
create policy reference_items_admin on public.reference_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

comment on table public.reference_items is
  'Owner and team quick reference. Never store payment or database credentials here; those live in the hosting environment.';
comment on column public.reference_items.secret is
  'true hides the value in lists; it is only ever returned for a single item on request.';
