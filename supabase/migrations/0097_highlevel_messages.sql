-- Conversations and email in HighLevel (phase 4 of the rebuild plan,
-- September 2026).
--
-- Every client email now leaves through HighLevel's conversations, so it
-- sits on the contact's thread over there; the email log keeps recording
-- each send with HighLevel's message id in its meta. The portal's Messages
-- mirror into the same thread: a client's message becomes an inbound live
-- chat message on the contact, a studio reply becomes an outbound one, and
-- anything the studio says from inside HighLevel (email, SMS, chat) is
-- pulled back into the thread here. These columns hold the wiring.

alter table public.conversations
  add column if not exists hl_conversation_id text,
  add column if not exists hl_last_message_at timestamptz,
  add column if not exists hl_pulled_at timestamptz;
create index if not exists conversations_hl_idx
  on public.conversations (hl_conversation_id) where hl_conversation_id is not null;

alter table public.messages
  add column if not exists hl_message_id text,
  add column if not exists channel text not null default 'portal';
create unique index if not exists messages_hl_message_idx
  on public.messages (hl_message_id) where hl_message_id is not null;

comment on column public.messages.channel is
  'portal: typed here; live_chat, email, sms, whatsapp, call, note: said in HighLevel and pulled across.';

-- a brief arriving, or a video going out for review, changes what the
-- client is waiting on, and the contact carries that for the workflows
drop trigger if exists hl_order_changed on public.orders;
create trigger hl_order_changed
  after insert or update of status, customer_email, customer_id, intake_completed on public.orders
  for each row execute function public.hl_customer_of_row_changed();
