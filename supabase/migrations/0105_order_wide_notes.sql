-- A note that applies to every video on the order (Premade review, 16
-- September 2026).
--
-- One client wrote the same note on all nine videos of a pack: the logo was
-- the wrong one. Eighteen notes, one cause, nine fixes to track. A note can
-- now be marked as applying to every video on the order. It is stored once,
-- on the video it was written on, and the job page lists it above the videos
-- so the studio makes one fix and marks it done once.
--
-- Idempotent. No new table; nothing here changes row security.

alter table public.deliverable_comments
  add column if not exists order_wide boolean not null default false;

comment on column public.deliverable_comments.order_wide is
  'True when the client marked the note as applying to every video on the order.';

create index if not exists deliverable_comments_order_wide_idx
  on public.deliverable_comments (order_id)
  where order_wide and resolved_at is null;
