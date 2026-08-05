-- The video catalog as a real table, so the site + checkout render from it
-- and the admin manages it directly (Phase 1 of the code->DB catalog move).
-- Individual videos only; packs/bundles/stack/editing keep their products
-- rows. Seeded from the code catalog with the new SKU scheme
-- (scripts/seed-catalog.ts). Every row carries its old_code for redirects.

create table if not exists public.catalog (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique check (code = lower(code)), -- the sku, e.g. "fexp-001"
  old_code     text,                                            -- previous sku, for redirects
  title        text not null,
  subject      text,                                            -- capability / subject line
  category     text not null
               check (category in ('Full Explainer', 'Feature Explainer', 'Demo', 'Marketing', 'Feature Animation')),
  library      text not null default 'new' check (library in ('new', 'classic')),
  price_cents  int not null check (price_cents >= 0),
  video_url    text,        -- preview mp4 (LeadConnector CDN)
  poster_url   text,
  wistia_id    text,        -- classic videos embed from Wistia
  pack_count   int,         -- feature-animation packs
  featured     boolean not null default false,
  release_date date,        -- powers the Recent Launch rolling window
  on_site      boolean not null default true,
  coming_soon  boolean not null default false,
  sort         int not null default 0,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists catalog_category_idx on public.catalog (category);
create index if not exists catalog_old_code_idx on public.catalog (old_code);

drop trigger if exists catalog_set_updated_at on public.catalog;
create trigger catalog_set_updated_at
  before update on public.catalog
  for each row execute function public.set_updated_at();

alter table public.catalog enable row level security;

-- Public read of on-site items: the marketing library renders from this, and
-- video listings + prices are public marketing data (like site_settings).
drop policy if exists catalog_public_read on public.catalog;
create policy catalog_public_read on public.catalog
  for select to anon, authenticated using (on_site = true);

-- Admins manage everything (and can read off-site rows).
drop policy if exists catalog_admin_all on public.catalog;
create policy catalog_admin_all on public.catalog
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
