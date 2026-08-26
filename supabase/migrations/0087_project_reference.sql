-- A reference on a custom project: the video they want theirs to feel like.
--
-- Editing requests have had one since 0060 and it is the single field that
-- saves the most back and forth, because "like this one" carries more than a
-- paragraph describing it. A client briefing their own project should be
-- able to say the same thing.
alter table public.projects
  add column if not exists reference_url text;

comment on column public.projects.reference_url is
  'A video the client wants this one to feel like. Optional, and worth a round of revisions when it is there.';
