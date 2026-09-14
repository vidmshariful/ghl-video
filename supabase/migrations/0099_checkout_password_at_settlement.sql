-- The password typed at checkout is applied to the portal login only when
-- the payment settles (audit, 15 September 2026). Until then it is kept as
-- a bcrypt hash on the pending row, and cleared the moment it is applied.
-- Before this, finalize created a confirmed login with the caller's
-- password before any money moved, so anyone who knew a prospect's email
-- could own their account ahead of them.
alter table public.orders add column if not exists password_hash text;
alter table public.subscriptions add column if not exists password_hash text;
comment on column public.orders.password_hash is
  'bcrypt of the password typed at checkout, applied to the login when the order settles, then cleared';
comment on column public.subscriptions.password_hash is
  'bcrypt of the password typed at plan checkout, applied to the login when the plan first activates, then cleared';
