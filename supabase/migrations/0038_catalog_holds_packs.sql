-- Phase 2: let packs and bundles live in the catalog alongside videos, so
-- there is genuinely ONE list of everything sellable rather than a video list
-- here and a product list somewhere else.
--
-- The category column was written when the catalog held only videos: NOT NULL
-- and restricted to the five video types. A pack has no video category, so the
-- rule becomes conditional. Videos keep exactly the constraint they had.

alter table public.catalog alter column category drop not null;

do $$
declare c text;
begin
  -- the check was created inline, so find it by definition rather than guessing its name
  select conname into c from pg_constraint
   where conrelid = 'public.catalog'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%Feature Explainer%';
  if c is not null then execute format('alter table public.catalog drop constraint %I', c); end if;
end $$;

alter table public.catalog
  add constraint catalog_category_by_kind check (
    kind <> 'video'
    or category in ('Full Explainer', 'Feature Explainer', 'Demo', 'Marketing', 'Feature Animation')
  );

-- Fields a pack or bundle needs that a single video never did.
alter table public.catalog
  add column if not exists tagline            text,
  add column if not exists anchor_price_cents int,
  add column if not exists delivery_days      int;

comment on column public.catalog.kind is
  'video: sold alone or inside a pack. pack: fixed contents we choose. bundle: a count per category the customer picks at intake.';
comment on column public.catalog.sellable_alone is
  'false hides a row from the buy-it-alone surfaces; it still ships inside packs.';
