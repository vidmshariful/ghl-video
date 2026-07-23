-- Order bumps: admin-configurable checkout add-ons (e.g. "niche customization
-- +$50/video"). Each bump targets a set of products by scope, and the checkout
-- offers the applicable ones as opt-in extras. The server is always the price
-- authority: it re-derives the effective price and total from this table.

create table if not exists public.order_bumps (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  price_cents  integer not null check (price_cents >= 0),
  -- flat: price_cents as-is. per_video: price_cents * product video_count
  -- (a single video counts as 1).
  unit         text not null default 'flat'
                 check (unit in ('flat', 'per_video')),
  -- which products show this bump. scope_values is interpreted per scope:
  --   all       -> shown on every product (scope_values ignored)
  --   kinds     -> product metadata.kind in scope_values (video/pack/bundle)
  --   prefixes  -> product code prefix in scope_values (EXP/DEMO/SHORT/...)
  --   skus      -> product sku in scope_values
  scope        text not null default 'all'
                 check (scope in ('all', 'kinds', 'prefixes', 'skus')),
  scope_values text[] not null default '{}',
  active       boolean not null default true,
  sort         integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.order_bumps enable row level security;

-- Admin-only, mirroring the products admin policy (is_admin() from 0005). The
-- checkout reads bumps with the service-role key, which bypasses RLS.
drop policy if exists "admin_all_order_bumps" on public.order_bumps;
create policy "admin_all_order_bumps" on public.order_bumps
  for all using (public.is_admin()) with check (public.is_admin());

-- Seed one real example: swap graphics/footage to fit the buyer's niche, at
-- $50 per video, offered on individual videos.
insert into public.order_bumps (name, description, price_cents, unit, scope, scope_values, active, sort)
select
  'Niche customization',
  'Swap any graphic or footage so the video fits your niche, not just your brand color.',
  5000, 'per_video', 'kinds', array['video'], true, 1
where not exists (select 1 from public.order_bumps where name = 'Niche customization');
