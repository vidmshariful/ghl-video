-- When each order last changed fulfillment stage. The Production board uses
-- it for "days in stage" and to keep recently delivered orders visible for
-- two weeks. The fulfillment route stamps it on every stage move.

alter table public.orders
  add column if not exists stage_changed_at timestamptz not null default now();

-- Backfill: existing rows get their paid (or created) time so old delivered
-- orders do not flood the board's two-week Delivered window.
update public.orders
  set stage_changed_at = coalesce(paid_at, created_at)
  where stage_changed_at > coalesce(paid_at, created_at);
