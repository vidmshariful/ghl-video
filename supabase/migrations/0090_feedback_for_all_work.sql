-- The one-question ask, for work that was not a purchase.
--
-- video_feedback was built in the order era and required an order behind
-- every row. Approved work is now overwhelmingly not orders: of the fourteen
-- approved videos on the platform today, thirteen belong to a custom project
-- or an editing plan, so the ask could reach exactly one of them.
--
-- Same change deliverable_versions and deliverable_comments already took in
-- migration 0071, for the same reason. Exactly one owner is still always
-- present through order_deliverables itself, which every row references with
-- cascade.

alter table public.video_feedback alter column order_id drop not null;
