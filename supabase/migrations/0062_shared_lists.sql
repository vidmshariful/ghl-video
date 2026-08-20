-- A list of videos somebody can send to the person who has to agree.
--
-- A founder picking six videos is very often not the only person deciding.
-- They want to show a cofounder or a marketing lead before spending, and the
-- only way to do that today is a screenshot. That is a real sale falling out
-- of the funnel at the last step, and it also keeps our library away from a
-- second person who never visited the site.
--
-- Deliberately NOT a cart. This platform charges one sku per checkout on
-- purpose (see CLAUDE.md), and the money path is the last thing that should
-- grow a new shape for a convenience feature. A list is a shortlist: it says
-- what somebody wants and what it comes to, and the two ways out of it are
-- buying an item on its own or asking us to invoice the set, which is how
-- buying at these prices actually happens anyway.
--
-- The token is the capability. Anyone holding the link may read the list,
-- which is the point, so the link carries no money, no account and nothing
-- about the person who made it beyond a first name.

begin;

create table if not exists public.shared_lists (
  id            uuid primary key default gen_random_uuid(),
  token         uuid not null unique default gen_random_uuid(),

  owner_email   text not null,
  owner_name    text,
  title         text not null default 'Videos we are considering',
  note          text,

  -- catalog codes, in the order they were picked
  item_codes    text[] not null default '{}',

  -- what it came to when it was shared. Kept so a price change later never
  -- silently rewrites what somebody was shown and agreed to.
  quoted_cents  integer not null default 0,

  opened_count  integer not null default 0,
  last_opened_at timestamptz,
  -- set when somebody asks us to invoice it, so we can tell a list that
  -- worked from a list that was ignored
  requested_at  timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.shared_lists is
  'A shortlist of catalog videos shared by link so somebody else can agree to it. Not a cart: checkout still charges one sku at a time.';
comment on column public.shared_lists.token is
  'The capability. Holding the link is the whole permission, so the row carries nothing sensitive.';
comment on column public.shared_lists.quoted_cents is
  'The total as shown when shared, so a later price change cannot rewrite what somebody agreed to.';

create index if not exists shared_lists_owner_idx on public.shared_lists (owner_email);

alter table public.shared_lists enable row level security;

-- Default deny. The public page reads it through the service role by token,
-- never through the anon key, so a guessed id gets nothing.
drop policy if exists shared_lists_admin on public.shared_lists;
create policy shared_lists_admin on public.shared_lists
  for all using (public.is_admin()) with check (public.is_admin());

drop trigger if exists shared_lists_set_updated_at on public.shared_lists;
create trigger shared_lists_set_updated_at
  before update on public.shared_lists
  for each row execute function public.set_updated_at();

commit;
