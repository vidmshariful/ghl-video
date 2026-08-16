-- Orders become the commercial record; Production becomes the studio's job.
--
-- Two things this adds:
--
-- 1. A real assignee. assigned_manager is free text defaulting to a name typed
--    into a box, which cannot drive a "my jobs" filter and cannot tell the
--    feedback notifications in phase 6 who to wake up. The text column stays
--    for display and history; the new column is the one that means something.
--
-- 2. A record of who last set the stage by hand, so the board can be honest
--    about whether a stage was calculated from the videos or typed.

alter table public.orders
  add column if not exists assigned_admin_email text
    references public.admins(email) on update cascade on delete set null,
  add column if not exists stage_set_by text,
  add column if not exists stage_is_derived boolean not null default false;

create index if not exists orders_assigned_admin_idx
  on public.orders (assigned_admin_email);

-- Best-effort backfill: match the typed name to an admin's name. Anything that
-- does not match stays unassigned rather than being guessed at.
update public.orders o
   set assigned_admin_email = a.email
  from public.admins a
 where o.assigned_admin_email is null
   and o.assigned_manager is not null
   and lower(trim(o.assigned_manager)) = lower(trim(coalesce(a.name, '')));

comment on column public.orders.assigned_admin_email is
  'Who owns this job. Drives the my-jobs filter and who gets told when a client leaves feedback.';
comment on column public.orders.stage_is_derived is
  'true when the stage was calculated from the order deliverables rather than set by hand.';
