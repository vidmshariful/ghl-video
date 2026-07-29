-- 0015: a video-type label on each Studio Insights board entry.
--
-- Explainer / Demo / Marketing (or any short label the team sets), shown
-- as a small tag on the card so viewers can tell a demo from an explainer
-- at a glance. Nullable: existing and future rows without one just omit
-- the tag.

alter table public.studio_updates
  add column if not exists format text;
