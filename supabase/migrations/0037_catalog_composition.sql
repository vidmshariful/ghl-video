-- Phase 1 of the one-catalog rebuild: give the database somewhere to hold what
-- is INSIDE a pack or a bundle. Today that lives only in code
-- (lib/content/premade.ts, catalog-extra.ts, lib/bundles.ts), which is why a
-- new pack has to be entered in two places and why nobody can change one from
-- admin.
--
-- This migration is deliberately ADDITIVE and changes no behaviour. The rows
-- are seeded from the same code that renders the site today and verified
-- identical (npm run check:composition). Nothing reads from these tables yet;
-- the screens switch over in phase 2, once the data has been proven.
--
-- Three shapes, matching how they are actually sold:
--   video   sold on its own, or inside a pack
--   pack    fixed contents, decided by us   -> catalog_pack_items
--   bundle  a count per category, picked by the customer at intake
--                                            -> catalog_bundle_rules

alter table public.catalog
  add column if not exists kind text not null default 'video'
    check (kind in ('video', 'pack', 'bundle')),
  -- feature animations are real products but are only sold inside a pack;
  -- false hides a row from the buy-it-alone surfaces without deleting it
  add column if not exists sellable_alone boolean not null default true;

create index if not exists catalog_kind_idx on public.catalog (kind);

-- The videos inside a fixed pack, in display order. item_code is a catalog
-- code rather than a foreign key so a pack can list a video that has not been
-- added to the catalog yet (the AI pack ships two that are still in production).
create table if not exists public.catalog_pack_items (
  id         uuid primary key default gen_random_uuid(),
  pack_code  text not null,
  item_code  text not null,
  -- what the site calls this slot, e.g. "Master Explainer"
  group_label text,
  sort       int not null default 0,
  created_at timestamptz not null default now(),
  unique (pack_code, item_code)
);

create index if not exists catalog_pack_items_pack_idx on public.catalog_pack_items (pack_code);

-- The pick rules for a bundle: how many of what the customer chooses at
-- intake. One row per line the offer advertises.
create table if not exists public.catalog_bundle_rules (
  id          uuid primary key default gen_random_uuid(),
  bundle_code text not null,
  -- the line as the customer reads it, e.g. "2x Full Explainer"
  label       text not null,
  -- which pool it draws from: a catalog category, or null for a free choice
  category    text,
  library     text check (library in ('new', 'classic', 'any')),
  count       int not null default 1,
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists catalog_bundle_rules_bundle_idx
  on public.catalog_bundle_rules (bundle_code);

alter table public.catalog_pack_items   enable row level security;
alter table public.catalog_bundle_rules enable row level security;

-- Same policy shape as the catalog itself: the public site needs to read what
-- is inside a pack to render the offer; only admins may change it.
drop policy if exists catalog_pack_items_read on public.catalog_pack_items;
create policy catalog_pack_items_read on public.catalog_pack_items
  for select to anon, authenticated using (true);

drop policy if exists catalog_pack_items_admin on public.catalog_pack_items;
create policy catalog_pack_items_admin on public.catalog_pack_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists catalog_bundle_rules_read on public.catalog_bundle_rules;
create policy catalog_bundle_rules_read on public.catalog_bundle_rules
  for select to anon, authenticated using (true);

drop policy if exists catalog_bundle_rules_admin on public.catalog_bundle_rules;
create policy catalog_bundle_rules_admin on public.catalog_bundle_rules
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- The three feature-animation packs already sit in the catalog as videos.
-- They are packs, and they are not sold as a single video.
update public.catalog
   set kind = 'pack', sellable_alone = true
 where category = 'Feature Animation';
