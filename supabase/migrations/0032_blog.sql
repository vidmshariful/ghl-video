-- The blog: posts written in admin (CMS group), rendered on the main site
-- at /blog. Built for SEO and objection handling, so every post carries its
-- own meta title/description and a canonical slug. Categories build topic
-- clusters and each gets its own page.

create table if not exists public.blog_categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug = lower(slug)),
  name        text not null,
  description text,
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.blog_posts (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug = lower(slug)),
  title            text not null,
  excerpt          text,                          -- card + meta fallback
  content_html     text not null default '',      -- the article body (editor output)
  cover_url        text,                          -- public URL, card + og:image
  category_id      uuid references public.blog_categories(id) on delete set null,
  author_email     text,                          -- who wrote it (admins row)
  author_name      text,                          -- display name at publish time
  status           text not null default 'draft' check (status in ('draft', 'published')),
  published_at     timestamptz,                   -- future date = scheduled
  seo_title        text,                          -- overrides title in <title>
  seo_description  text,                          -- overrides excerpt in meta
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists blog_posts_status_idx
  on public.blog_posts (status, published_at desc);
create index if not exists blog_posts_category_idx on public.blog_posts (category_id);

alter table public.blog_categories enable row level security;
alter table public.blog_posts enable row level security;

-- Admins manage everything (the shared is_admin() check); everyone else
-- reads only published, past-dated posts.
drop policy if exists blog_categories_admin_all on public.blog_categories;
create policy blog_categories_admin_all on public.blog_categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists blog_posts_admin_all on public.blog_posts;
create policy blog_posts_admin_all on public.blog_posts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists blog_categories_public_read on public.blog_categories;
create policy blog_categories_public_read on public.blog_categories
  for select to anon, authenticated using (true);

drop policy if exists blog_posts_public_read on public.blog_posts;
create policy blog_posts_public_read on public.blog_posts
  for select to anon, authenticated
  using (status = 'published' and published_at is not null and published_at <= now());

-- The PUBLIC bucket for blog images (covers and in-article images).
-- Uploads go through the admin API (service role) which validates type and
-- size, so no storage.objects policies are needed.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'blog',
  'blog',
  true,
  5242880, -- 5 MB per image
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do nothing;

-- Starter category so imported posts have a home; rename freely in admin.
insert into public.blog_categories (slug, name, description, sort)
values ('highlevel-saas', 'HighLevel SaaS', 'Growth, video strategy, and playbooks for HighLevel SaaS founders.', 0)
on conflict (slug) do nothing;
