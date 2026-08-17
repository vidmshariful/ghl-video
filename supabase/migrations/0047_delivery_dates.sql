-- Promise a date on every video, and know when we have missed it.
--
-- Most "where is my video" messages are really "when is my video". This is
-- what lets both screens answer that before anybody asks.
--
-- On when the clock starts
-- ------------------------
-- From the brief, not from the payment. We cannot start without the client's
-- logo, colours and notes, so dating from payment would promise a day we may
-- have no way of hitting through nobody's fault. It also points the incentive
-- the right way: a client who wants their video sooner sends the brief sooner.
--
-- `intake_completed` already recorded THAT the brief arrived but not WHEN, so
-- there was no moment to count from. That is the column being added here.

alter table public.orders
  add column if not exists intake_completed_at timestamptz;

comment on column public.orders.intake_completed_at is
  'When the client submitted their brief. The delivery clock starts here, not at payment.';

alter table public.order_deliverables
  add column if not exists due_at timestamptz;

comment on column public.order_deliverables.due_at is
  'When this video is promised, computed from the order intake date plus the product turnaround. Null until the brief lands.';

-- The studio board's "what is late" query.
create index if not exists order_deliverables_due_idx
  on public.order_deliverables (due_at)
  where due_at is not null;

-- Backfill the brief date for orders that already have one.
--
-- The intake route has always written an order_updates line at the moment the
-- brief is saved, so its timestamp is the moment we want. Matching on that
-- sentence is admittedly brittle, which is exactly why the column exists from
-- now on: this runs once for the history and never again.
--
-- Orders whose brief predates that line, or whose wording differed, keep a
-- null and simply show no promised date rather than a wrong one. A made up
-- date would be worse than none.
update public.orders o
set intake_completed_at = sub.first_seen
from (
  select u.order_id, min(u.created_at) as first_seen
  from public.order_updates u
  where u.body = 'Branding brief submitted by the client.'
  group by u.order_id
) as sub
where o.id = sub.order_id
  and o.intake_completed is true
  and o.intake_completed_at is null;
