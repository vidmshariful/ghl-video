-- Let the owner answer back.
--
-- The journal has been one directional: Claude writes ideas and decisions,
-- Shariful reads them. Which ones he actually likes has lived only in chat,
-- where it is lost by the next session. So an idea that excited him and one
-- he tolerated look identical a week later, and the next thing built is
-- picked on a guess.
--
-- Two columns fix that. A rating says how much he wants it, in a form that
-- sorts. A note says why, which is usually the more useful half: "yes but
-- only for agencies" changes what gets built far more than four stars does.
--
-- Deliberately NOT a comment thread. One editable note per entry, because he
-- is the only person writing them and a thread would mean reading a
-- conversation to find the current opinion. If a reply is ever needed, that
-- is a new idea rather than a schema somebody has to maintain now.

alter table public.journal
  -- 1 to 5. Null means unrated, which is different from rated low: one is
  -- "not looked at", the other is "looked at and not keen", and the idea
  -- list needs to tell those apart.
  add column if not exists rating      int check (rating between 1 and 5),
  add column if not exists feedback    text,
  add column if not exists feedback_at timestamptz,
  add column if not exists feedback_by text;

comment on column public.journal.rating is
  'Owner rating 1 to 5. Null means not yet rated, which is not the same as rated low.';
comment on column public.journal.feedback is
  'The owner note on this entry. One editable note, not a thread.';

-- The idea board sorts best first, and unrated ideas must not vanish under
-- the rated ones, so the CLI orders by rating with nulls handled explicitly.
create index if not exists journal_rating_idx
  on public.journal (kind, rating desc nulls last, created_at);
