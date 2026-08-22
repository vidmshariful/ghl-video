-- What kind of video a project is: Ads / Promo, Explainer, Demo,
-- Onboarding Series. The same four formats the website sells, so the list
-- can answer "what are we making" at a glance. Free text on purpose: a
-- one-off format should not need a migration.

alter table public.projects add column if not exists category text;
