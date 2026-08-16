-- Keep the raw per-page measurements alongside the findings. The SEO Pages
-- editor reads them to show what each page renders TODAY (its real title and
-- description) instead of guessing, so an admin can see what they are about
-- to override before they type over it.

alter table public.seo_audits
  add column if not exists pages jsonb not null default '[]'::jsonb;
