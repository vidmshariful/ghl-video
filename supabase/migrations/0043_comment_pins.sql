-- Point at the thing, not just the moment.
--
-- A note can already say "at 0:12". This lets it also say "that logo, there".
-- Stored as percentages of the frame rather than pixels, because the player is
-- a different size on every screen: 50/50 is the middle of the video whether it
-- is rendered at 1600px or on a phone.
--
-- Deliberately a point and not a box. Pointing answers "which thing do you
-- mean" for almost every note on a 2D explainer, and a drawing layer is a lot
-- of machinery to maintain for the rest. If pins turn out not to be enough we
-- add a box later, on top of these same two columns.

alter table public.deliverable_comments
  add column if not exists at_x numeric(5, 2) check (at_x is null or (at_x >= 0 and at_x <= 100)),
  add column if not exists at_y numeric(5, 2) check (at_y is null or (at_y >= 0 and at_y <= 100));

comment on column public.deliverable_comments.at_x is
  'Horizontal position of the pin as a percentage of the frame width. Null when the note is not pinned to a spot.';
comment on column public.deliverable_comments.at_y is
  'Vertical position of the pin as a percentage of the frame height.';
