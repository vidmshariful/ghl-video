-- 0029: pause a team member without removing them.
--
-- Owners manage their portal team from Settings. Removing someone is
-- final; pausing keeps the row (name, grants, history) while the person
-- is locked out. The context resolver rejects paused members, and paused
-- members receive no notifications or emails (teamRecipients already
-- fans out to active members only).

alter table public.account_members
  drop constraint if exists account_members_status_check;
alter table public.account_members
  add constraint account_members_status_check
  check (status in ('invited', 'active', 'paused'));
