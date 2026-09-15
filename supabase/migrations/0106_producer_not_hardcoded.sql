-- No producer is stamped on an order by default (Premade review, 16
-- September 2026).
--
-- assigned_manager was NOT NULL with a person's name as its default, so every
-- new order carried that name before anyone had looked at it, and the client's
-- order page showed it as "Your producer". The column stays for the orders
-- that carry a name; new orders start empty, the client sees the teammate who
-- owns the job or the studio's own name until somebody does, and unassigning
-- clears the name as well as the owner.
--
-- Idempotent. Nothing here changes row security.

alter table public.orders
  alter column assigned_manager drop not null,
  alter column assigned_manager drop default;
