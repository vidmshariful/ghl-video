-- One door for every customer (lib/accounts.ts), and the three facts the
-- customer list could not say.
--
-- source       Which door the account came through: checkout, plan-checkout,
--              stripe, admin, enquiry, invoice, manual-order. Written once,
--              on create. Existing rows stay null: guessing would be worse
--              than not knowing.
-- internal     True for the studio's own accounts (the demo client). They
--              sit in the list beside real clients and count in the totals,
--              which is why "lifetime value" has a number in it that nobody
--              paid. Filtered out of the list and the sums by default.
-- welcomed_at  When the portal welcome went out, whichever door sent it, so
--              it never goes out twice.
--
-- Plus two repairs found by the audit that preceded this:
--   - accounts created by hand had no slug, so the editing board had no URL
--     for them (same rule as 0075, applied to the rows that arrived since);
--   - a project created before its customer row existed never got linked.
--
-- Safe either side of the code: every column is nullable or defaulted, and
-- nothing reads them until the code that writes them is live.

alter table public.customers
  add column if not exists source      text,
  add column if not exists internal    boolean not null default false,
  add column if not exists welcomed_at timestamptz;

comment on column public.customers.source is
  'The door the account came through (checkout, plan-checkout, stripe, admin, enquiry, invoice, manual-order). Set once on create by lib/accounts.ts.';
comment on column public.customers.internal is
  'A studio-owned account (demo, test). Left out of the client list and its totals by default.';
comment on column public.customers.welcomed_at is
  'When the portal welcome email went out, by any door. Null = never.';

-- the demo client is ours
update public.customers set internal = true where lower(email) = 'shariful@ghlvideo.com';

-- handles for the accounts that arrived without one
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
  select
    t.id,
    t.stem,
    row_number() over (partition by t.stem order by t.id)
      + (select count(*) from public.customers c2 where c2.slug = t.stem or c2.slug like t.stem || '-%') as n
  from trimmed t
)
update public.customers c
set slug = case when n.n = 1 then n.stem else n.stem || '-' || n.n end
from numbered n
where c.id = n.id and c.slug is null;

-- a project filed under an email whose customer row came later
update public.projects p
set customer_id = c.id
from public.customers c
where p.customer_id is null
  and lower(p.customer_email) = lower(c.email);
