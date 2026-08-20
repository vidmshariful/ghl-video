-- Versions and review comments for project videos.
--
-- Both tables were built in the order era and required an order behind
-- every row. Custom project videos hang off a project instead, so the
-- order reference becomes optional. Exactly one of the two parents is
-- still always present through order_deliverables itself, which every
-- row references with cascade.

alter table public.deliverable_versions alter column order_id drop not null;
alter table public.deliverable_comments alter column order_id drop not null;
