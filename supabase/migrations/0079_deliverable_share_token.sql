-- A shareable link for a finished cut, so a client can show it to their own
-- team without giving them a portal login.
--
-- The token is the whole key: a random, unguessable handle that resolves to
-- one video on a lightly branded public page (owner decision, 23 August
-- 2026). Minted the first time a client shares a video, and it can be
-- revoked by clearing it, which kills every link that was ever copied.
--
-- Nothing sensitive rides on the token: it opens exactly one video and the
-- studio's name, nothing about the account, the money or the other work.

alter table public.order_deliverables
  add column if not exists share_token text;

create unique index if not exists order_deliverables_share_token_key
  on public.order_deliverables (share_token)
  where share_token is not null;
