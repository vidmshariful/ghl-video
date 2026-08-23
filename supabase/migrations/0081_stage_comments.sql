-- Feedback tied to one production-line stage.
--
-- A custom project is reviewed stage by stage now: the client reads the
-- script, hears the voiceover, opens the design PDF, watches the animation,
-- and can say something on each. Every note lives on the project's one main
-- carrier deliverable, the same row the video review already uses, tagged
-- with the stage it is about so each stage's review room shows only its own.
--
-- Null stays meaning the video review that predates this, so the animation
-- room reads its legacy notes as well as the newly tagged ones.

alter table public.deliverable_comments
  add column if not exists stage text;

create index if not exists deliverable_comments_stage_idx
  on public.deliverable_comments (deliverable_id, stage, created_at);
