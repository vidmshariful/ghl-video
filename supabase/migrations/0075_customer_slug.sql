-- A readable handle for a client, so a screen about them can have a URL
-- worth sending: /admin/editing/extendly rather than a row of hex.
--
-- Taken from the company name, falling back to the person's name and then
-- to the part of their email before the @, because every client has at
-- least one of those. Kept as its own column rather than derived on the
-- fly: renaming a company should not break a link somebody bookmarked.

alter table public.customers add column if not exists slug text;

-- Backfill, lowercase, spaces and punctuation to single hyphens, and a
-- numeric suffix where two clients would otherwise land on the same word.
with base as (
  select
    id,
    nullif(
      regexp_replace(
        lower(trim(coalesce(nullif(company, ''), nullif(name, ''), split_part(email, '@', 1)))),
        '[^a-z0-9]+', '-', 'g'
      ),
      ''
    ) as raw
  from public.customers
  where slug is null
),
trimmed as (
  select id, trim(both '-' from raw) as stem from base where raw is not null
),
numbered as (
  select id, stem, row_number() over (partition by stem order by id) as n from trimmed
)
update public.customers c
set slug = case when n.n = 1 then n.stem else n.stem || '-' || n.n end
from numbered n
where c.id = n.id and c.slug is null;

-- One client per handle, from here on.
create unique index if not exists customers_slug_key on public.customers (slug)
  where slug is not null;
