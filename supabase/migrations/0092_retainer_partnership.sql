-- A retainer partnership, starting with HighLevel (September 2026).
--
-- HighLevel pays a flat monthly fee for 8 to 12 videos a month, two in
-- production at a time, three business days each, a white-label version of
-- every one, paid upfront on the first of the month. Nothing on the platform
-- could say that. Their projects read "no price yet" in admin and "Not set"
-- in their portal, which is the opposite of the message a partner should get,
-- and nobody could answer "how many have we made them this month" without
-- counting by hand.
--
-- Two additions.
--
-- customers.retainer   The terms, as one JSON document, null for everyone
--                      else. Read by lib/retainer.ts (parseRetainer), which
--                      is the only place the shape is decided. Kept as JSON
--                      rather than eight columns because it is one fact
--                      ("this account is on a retainer, on these terms")
--                      edited on one card, and a second partner will have
--                      different terms rather than different columns.
--
-- projects.retainer_month   Which month a job counts in, as YYYY-MM. Stamped
--                      when the job is briefed and editable, so a video that
--                      slips past month end still belongs to the month it was
--                      asked for (owner decision, 12 September 2026). Null
--                      means the job is not under a retainer at all.
-- projects.retainer_kind    'video' counts toward the month's 8 to 12.
--                      'animation' is the small social piece that is
--                      included in the fee but sits outside the count
--                      (owner decision, same day).
--
-- Safe to run before or after the code deploys: the code only writes these
-- columns for a customer whose retainer is set, and nobody's is until the
-- card exists.

alter table public.customers
  add column if not exists retainer jsonb;

comment on column public.customers.retainer is
  'Retainer partnership terms as JSON (monthlyCents, videosMin, videosMax, activeMax, turnaroundDays, whiteLabel, startedOn, checkInOn, name, note). Null = not on a retainer. Shape decided in lib/retainer.ts.';

alter table public.projects
  add column if not exists retainer_month text
    check (retainer_month is null or retainer_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  add column if not exists retainer_kind text
    check (retainer_kind is null or retainer_kind in ('video', 'animation'));

comment on column public.projects.retainer_month is
  'The retainer month this job counts in, YYYY-MM. Stamped at brief, editable. Null = not retainer work.';
comment on column public.projects.retainer_kind is
  'video = counts toward the month. animation = included in the fee, outside the count.';

create index if not exists projects_retainer_month_idx
  on public.projects (customer_email, retainer_month)
  where retainer_month is not null;
