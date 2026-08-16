-- First-touch attribution on an order: the page the buyer first landed on,
-- where they came from, and when. Real columns rather than metadata keys so
-- the revenue-per-page report can group and index on them once there are
-- enough orders to make a pattern (see the Journal idea board).
--
-- Nothing backfills: these are null for every order placed before today, and
-- that is expected. The point of shipping the capture early is that the gap
-- stops growing.

alter table public.orders
  add column if not exists first_landing_path text,
  add column if not exists first_referrer     text,
  add column if not exists first_campaign     text,
  add column if not exists first_seen_at      timestamptz;

create index if not exists orders_first_landing_idx
  on public.orders (first_landing_path)
  where first_landing_path is not null;
