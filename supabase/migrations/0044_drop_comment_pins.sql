-- Pointing a note at a spot on the frame is removed (owner's decision, after
-- trying it). The columns go with it rather than sitting unused: a column
-- nothing writes is a question every future reader has to answer.
--
-- Safe to drop. No comment ever carried a pin outside of testing, and the one
-- that did was cleared before this ran.
--
-- If it comes back, 0043 is the recipe: two nullable percentage columns, both
-- written or neither.

alter table public.deliverable_comments
  drop column if exists at_x,
  drop column if exists at_y;
