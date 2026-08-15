-- 0024: the affiliate partner portal (phase 1).
--
-- `partners` moves the affiliate registry into the database so the team can
-- add and manage partners from /admin without a deploy. It also holds the
-- public application queue: a row with status 'applied' is an application,
-- and approving it is just editing the same row. The customer discount
-- terms mirror lib/affiliates.ts; the checkout money path still reads the
-- code registry for now (the DB bridge is a later phase, on purpose, so
-- this migration cannot touch payments).
--
-- `partner_assets` is the promo-material library partners see in their
-- portal: banners, logos, swipe copy. A row scoped to partner_id is that
-- partner's alone; null is global. Files live in the PUBLIC partner-assets
-- bucket (they are marketing material meant to be shared); swipe copy is
-- text on the row itself with a {{LINK}} placeholder the portal fills in.
--
-- Access: admins manage both tables from /admin via RLS (is_admin), the
-- partner portal reads through /api/partners/* with the service role after
-- verifying the session email. No anon policies.

create table if not exists public.partners (
  id               uuid primary key default gen_random_uuid(),
  ref              text not null unique
                   check (ref ~ '^[a-z0-9][a-z0-9_-]{0,31}$'),
  name             text not null,
  email            text,
  status           text not null default 'applied'
                   check (status in ('applied', 'invited', 'active', 'paused', 'rejected')),
  -- public partner-page fields
  photo_path       text,
  role_line        text not null default 'GHL Video affiliate partner',
  tagline          text,
  bio              text,
  -- customer-facing discount terms (mirror of the code registry for now)
  coupon_code      text,
  discount_percent int not null default 10 check (discount_percent between 0 and 90),
  discount_months  int not null default 3 check (discount_months between 0 and 36),
  stripe_coupon_id text,
  -- FirstPromoter linkage (phase 2 reads stats with these)
  fp_ref           text,
  fp_promoter_id   text,
  -- the public application form's answers, kept as submitted
  application      jsonb,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- one account per email (case-insensitive), but email may be unset until
-- the team fills it in (e.g. a partner added by hand before intake)
create unique index if not exists partners_email_key
  on public.partners (lower(email))
  where email is not null;

drop trigger if exists partners_set_updated_at on public.partners;
create trigger partners_set_updated_at
  before update on public.partners
  for each row execute function public.set_updated_at();

alter table public.partners enable row level security;

drop policy if exists partners_admin_all on public.partners;
create policy partners_admin_all
  on public.partners
  for all
  using (public.is_admin())
  with check (public.is_admin());

create table if not exists public.partner_assets (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null
              check (kind in ('banner', 'graphic', 'logo', 'video', 'copy', 'doc')),
  title       text not null,
  description text,
  -- a path inside the partner-assets bucket, or a full external URL
  file_path   text,
  -- swipe copy body; {{LINK}} becomes the partner's tracked link
  body        text,
  partner_id  uuid references public.partners (id) on delete cascade,
  sort        int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists partner_assets_set_updated_at on public.partner_assets;
create trigger partner_assets_set_updated_at
  before update on public.partner_assets
  for each row execute function public.set_updated_at();

alter table public.partner_assets enable row level security;

drop policy if exists partner_assets_admin_all on public.partner_assets;
create policy partner_assets_admin_all
  on public.partner_assets
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- The PUBLIC bucket for partner promo files. Public on purpose: these are
-- marketing assets partners embed and share; the URL is the distribution.
-- Uploads happen from /admin in the browser, so storage RLS admits admins.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'partner-assets',
  'partner-assets',
  true,
  52428800, -- 50 MB per file
  array[
    'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif',
    'application/pdf', 'application/zip', 'video/mp4', 'video/quicktime'
  ]
)
on conflict (id) do nothing;

drop policy if exists partner_assets_storage_select on storage.objects;
create policy partner_assets_storage_select
  on storage.objects for select
  using (bucket_id = 'partner-assets' and public.is_admin());

drop policy if exists partner_assets_storage_insert on storage.objects;
create policy partner_assets_storage_insert
  on storage.objects for insert
  with check (bucket_id = 'partner-assets' and public.is_admin());

drop policy if exists partner_assets_storage_update on storage.objects;
create policy partner_assets_storage_update
  on storage.objects for update
  using (bucket_id = 'partner-assets' and public.is_admin())
  with check (bucket_id = 'partner-assets' and public.is_admin());

drop policy if exists partner_assets_storage_delete on storage.objects;
create policy partner_assets_storage_delete
  on storage.objects for delete
  using (bucket_id = 'partner-assets' and public.is_admin());

-- Seed the first partner from the code registry (lib/affiliates.ts) so the
-- portal has a real account on day one. Email is filled in by the team from
-- /admin before inviting him.
insert into public.partners
  (ref, name, status, photo_path, tagline, coupon_code,
   discount_percent, discount_months, stripe_coupon_id)
values
  ('jonah', 'Jonah Cockshaw', 'active', '/partners/jonah-cockshaw.jpg',
   'A friend of Jonah is a friend of GHL Video.', 'JONAH10', 10, 3, 'bzD89jmL')
on conflict (ref) do nothing;

-- Starter swipe copy so the assets library is not empty on first login.
insert into public.partner_assets (kind, title, description, body, sort)
select 'copy', 'Intro email to your list',
       'A short plain-text email introducing GHL Video to your audience.',
       'Subject: The video studio I use for HighLevel' || E'\n\n' ||
       'Quick one. If you run your SaaS on HighLevel and need videos, explainers, demos, feature videos, or editing, I partner with GHL Video. They only do HighLevel, so you never explain the platform.' || E'\n\n' ||
       'Through my link you get a discount on everything they make, applied automatically:' || E'\n' ||
       '{{LINK}}' || E'\n\n' ||
       'Worth a look before you brief another generic studio.', 10
where not exists (
  select 1 from public.partner_assets where title = 'Intro email to your list'
);

insert into public.partner_assets (kind, title, description, body, sort)
select 'copy', 'Short DM / community post',
       'A two-line recommendation for a DM, community, or social post.',
       'If you need videos for your HighLevel SaaS (explainers, demos, editing), GHL Video is the studio I send people to. My link gets you a discount on everything, applied automatically: {{LINK}}', 20
where not exists (
  select 1 from public.partner_assets where title = 'Short DM / community post'
);
