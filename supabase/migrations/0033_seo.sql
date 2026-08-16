-- SEO control room (admin -> CMS -> SEO). Three concerns, three tables:
--   seo_pages  page title/description overrides, editable without a deploy
--   redirects  301/302 rules added from admin instead of vercel.json
--   seo_audits the stored result of a site health crawl
--
-- Design note, learned from lib/chrome.ts: the page DEFAULTS stay in code.
-- This table only OVERRIDES them, so an unreachable Supabase can never blank
-- a title tag or de-index a page. Empty/absent row = the code default wins.

create table if not exists public.seo_pages (
  path        text primary key,            -- canonical path with trailing slash, e.g. "/about/"
  title       text,                        -- null or '' = keep the page's built-in title
  description text,                        -- null or '' = keep the built-in description
  og_image    text,                        -- absolute or site-relative share image
  noindex     boolean not null default false,
  updated_at  timestamptz not null default now(),
  updated_by  text
);

-- Redirect rules. `source` is stored normalized (lowercase, leading slash, no
-- trailing slash) so lookups from the edge are a plain map hit.
create table if not exists public.redirects (
  id           uuid primary key default gen_random_uuid(),
  source       text not null unique,
  destination  text not null,
  permanent    boolean not null default true,   -- true = 301, false = 302
  active       boolean not null default true,
  hits         integer not null default 0,      -- best-effort counter (see bump fn)
  last_hit_at  timestamptz,
  note         text,
  created_at   timestamptz not null default now(),
  created_by   text
);

create index if not exists redirects_active_idx on public.redirects (active);

-- One row per health crawl. findings is an array of
-- { id, severity, kind, path, message, detail } objects.
create table if not exists public.seo_audits (
  id            uuid primary key default gen_random_uuid(),
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  pages_checked integer not null default 0,
  error_count   integer not null default 0,
  warn_count    integer not null default 0,
  findings      jsonb not null default '[]'::jsonb,
  run_by        text
);

create index if not exists seo_audits_started_idx on public.seo_audits (started_at desc);

alter table public.seo_pages  enable row level security;
alter table public.redirects  enable row level security;
alter table public.seo_audits enable row level security;

-- Admins manage everything.
drop policy if exists seo_pages_admin_all on public.seo_pages;
create policy seo_pages_admin_all on public.seo_pages
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists redirects_admin_all on public.redirects;
create policy redirects_admin_all on public.redirects
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists seo_audits_admin_all on public.seo_audits;
create policy seo_audits_admin_all on public.seo_audits
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- The public site renders titles/descriptions and the edge resolves redirects
-- with the anon key, so both need read access. Neither holds anything private:
-- these are the strings and URLs the site already shows the world. Audit
-- results stay admin-only (they describe our own weak spots).
drop policy if exists seo_pages_public_read on public.seo_pages;
create policy seo_pages_public_read on public.seo_pages
  for select to anon, authenticated using (true);

drop policy if exists redirects_public_read on public.redirects;
create policy redirects_public_read on public.redirects
  for select to anon, authenticated using (active = true);

-- Best-effort usage counter for a redirect. The edge calls this fire-and-forget
-- after issuing the redirect, so a dropped call costs a count and nothing else.
-- SECURITY DEFINER with a narrow body: it can only bump a counter on a row that
-- already exists, and returns nothing.
create or replace function public.bump_redirect_hit(p_source text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.redirects
     set hits = hits + 1, last_hit_at = now()
   where source = p_source and active = true;
$$;

revoke all on function public.bump_redirect_hit(text) from public;
grant execute on function public.bump_redirect_hit(text) to anon, authenticated;
