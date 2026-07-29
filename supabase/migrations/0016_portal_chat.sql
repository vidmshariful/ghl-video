-- Portal chat: two-way messaging between a signed-in customer and the studio.
--
-- Mirrors the order_updates model (0006) and the intake bucket (0010): the
-- team drives it through the authenticated admin client (is_admin() RLS), and
-- the customer reads / writes via server routes with the service-role key,
-- scoped to their verified email. No anon or customer RLS policies exist; all
-- customer access is server-mediated, exactly like orders and updates.
--
-- Threads come in two shapes (the studio wanted both):
--   * general   -> one per customer   (order_id is null)
--   * per-order -> one per project     (order_id set)
--
-- Unread is tracked per side with the two *_last_read_at stamps; the
-- denormalized last_message_* columns keep the list + unread badge cheap
-- (no message scan needed to render either).

create table if not exists public.conversations (
  id                     uuid primary key default gen_random_uuid(),
  customer_email         text not null,
  customer_id            uuid references public.customers(id) on delete set null,
  order_id               uuid references public.orders(id) on delete cascade,
  last_message_at        timestamptz,
  last_message_preview   text,
  last_sender_role       text check (last_sender_role in ('customer','studio')),
  customer_last_read_at  timestamptz,
  studio_last_read_at    timestamptz,
  created_at             timestamptz not null default now()
);

-- One general thread per customer; one thread per order.
create unique index if not exists conversations_general_uniq
  on public.conversations (customer_email) where order_id is null;
create unique index if not exists conversations_order_uniq
  on public.conversations (order_id) where order_id is not null;
create index if not exists conversations_email_idx on public.conversations (customer_email);
create index if not exists conversations_last_msg_idx
  on public.conversations (last_message_at desc nulls last);

create table if not exists public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  sender_role      text not null check (sender_role in ('customer','studio')),
  sender_name      text,
  body             text not null default '',
  attachments      jsonb not null default '[]'::jsonb,
  created_at       timestamptz not null default now()
);
create index if not exists messages_conversation_idx
  on public.messages (conversation_id, created_at);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Admin manages chat through the authenticated client; customers read / write
-- via the portal server routes (service role). No customer policies.
drop policy if exists conversations_admin_all on public.conversations;
create policy conversations_admin_all on public.conversations
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists messages_admin_all on public.messages;
create policy messages_admin_all on public.messages
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Private bucket for chat attachments. Server-only, signed-URL reads, exactly
-- like the intake bucket (0010): no public access, no anon policies.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat',
  'chat',
  false,
  10485760, -- 10 MB per file
  array[
    'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml',
    'application/pdf', 'application/zip', 'text/plain'
  ]
)
on conflict (id) do nothing;
