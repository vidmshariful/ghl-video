-- 0027: the account layer for all three portals.
--
-- `profiles` is one row per signed-in person (admin, customer, or partner):
-- the display name and profile photo shown in the portal top bar. It is
-- keyed on the auth user id and NEVER holds money or permissions; those
-- stay on admins / customers / partners. Photos live in the PUBLIC avatars
-- bucket (an avatar is meant to be seen; the filename carries a timestamp
-- so a change busts caches).
--
-- `notifications` feeds the bell in every portal top bar. One row per
-- recipient per event, written server-side at the same exactly-once points
-- that send the transactional emails (lib/email/notify.ts), so the bell and
-- the inbox can never disagree about what happened. Chat messages do NOT
-- write rows here on purpose: chat has its own icon and unread badges.
--
-- Access: service-role only through /api/*; default-deny RLS, no anon or
-- authenticated policies on either table.

create table if not exists public.profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  email        text not null,
  display_name text,
  -- a path inside the avatars bucket (e.g. "ab12cd-1723711111.webp")
  avatar_path  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index if not exists profiles_email_key
  on public.profiles (lower(email));

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create table if not exists public.notifications (
  id              uuid primary key default gen_random_uuid(),
  -- which portal shows it: the same email can be an admin AND a customer
  audience        text not null check (audience in ('admin', 'customer', 'partner')),
  recipient_email text not null,
  kind            text not null,
  title           text not null,
  body            text,
  -- an in-portal destination hint the portal shell knows how to open,
  -- e.g. "orders", "orders/<id>", "messages", "partners"
  href            text,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists notifications_recipient_idx
  on public.notifications (recipient_email, audience, created_at desc);

alter table public.notifications enable row level security;

-- The PUBLIC bucket for profile photos. Small images only; uploads go
-- through the portal APIs (service role) which validate type and size,
-- so no storage.objects policies are needed.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152, -- 2 MB per photo
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;
