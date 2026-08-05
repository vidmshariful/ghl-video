-- Roles + per-user feature access for the admin allowlist.
--
-- role:
--   admin      full access, and the only role that manages the team
--   manager    broad day-to-day access, no team and no site code
--   sales_rep  sales-focused (orders, clients, invoices, buy links)
--
-- features: NULL means "use the role's default menu set"; an explicit
-- text[] is a per-user override, so an admin can add or remove individual
-- menu items for a manager or sales rep. Admin always has full access
-- regardless of features. Who may manage the team is enforced server-side
-- (role = 'admin'); the menu gating is a client-side layer on top.

alter table public.admins
  add column if not exists role text not null default 'manager'
    check (role in ('admin', 'manager', 'sales_rep')),
  add column if not exists features text[];

-- The owner is the top-level admin. Any other pre-existing admin keeps the
-- 'manager' default (broad access, no team / site code) until changed in the
-- new Team screen.
update public.admins set role = 'admin' where lower(email) = 'shariful@vidiosa.com';
