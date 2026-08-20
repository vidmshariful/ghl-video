-- One conversation per client, everywhere.
--
-- Chat grew a thread per order plus a general one, which meant a single
-- client showed as three inboxes on the Messages screen, and their reply
-- could land in whichever tab they had open. Shariful's call: one simple
-- inbox. This merges what exists and the code stops making order threads.
--
-- The merge keeps the OLDEST general thread as the canonical row (or the
-- oldest thread of any kind when no general one exists), moves every
-- message into it, and recomputes the preview from the newest message.
-- Read stamps take the EARLIEST of the merged values on purpose: the safe
-- failure is showing somebody an unread dot for a message they have read,
-- never hiding one they have not.

begin;

-- 1. canonical per client: general first, then oldest
with ranked as (
  select id, lower(customer_email) as email,
         row_number() over (
           partition by lower(customer_email)
           order by (order_id is not null), created_at
         ) as rn
  from public.conversations
),
canon as (select id, email from ranked where rn = 1),
extras as (
  select c.id as extra_id, cn.id as canon_id
  from public.conversations c
  join canon cn on lower(c.customer_email) = cn.email
  where c.id <> cn.id
)
update public.messages m
set conversation_id = e.canon_id
from extras e
where m.conversation_id = e.extra_id;

-- 2. fold the merged threads' read stamps into the canonical row
with ranked as (
  select id, lower(customer_email) as email,
         row_number() over (
           partition by lower(customer_email)
           order by (order_id is not null), created_at
         ) as rn
  from public.conversations
),
canon as (select id, email from ranked where rn = 1),
folded as (
  select cn.id as canon_id,
         min(c.customer_last_read_at) as customer_read,
         min(c.studio_last_read_at) as studio_read
  from public.conversations c
  join canon cn on lower(c.customer_email) = cn.email
  group by cn.id
)
update public.conversations c
set customer_last_read_at = f.customer_read,
    studio_last_read_at = f.studio_read
from folded f
where c.id = f.canon_id;

-- 3. drop the now-empty extras
with ranked as (
  select id, lower(customer_email) as email,
         row_number() over (
           partition by lower(customer_email)
           order by (order_id is not null), created_at
         ) as rn
  from public.conversations
)
delete from public.conversations where id in (select id from ranked where rn > 1);

-- 4. the canonical row is the client's inbox, not an order's
update public.conversations set order_id = null where order_id is not null;

-- 5. the preview reflects the newest message it now holds
update public.conversations c
set last_message_at = m.created_at,
    last_message_preview = left(coalesce(nullif(m.body, ''), 'Attachment'), 140),
    last_sender_role = m.sender_role
from (
  select distinct on (conversation_id)
         conversation_id, body, sender_role, created_at
  from public.messages
  order by conversation_id, created_at desc
) m
where m.conversation_id = c.id;

commit;
