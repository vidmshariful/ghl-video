-- Make the admin allowlist check case-insensitive.
--
-- The API gate lowercases the session email (lib/account/session.ts) and the
-- admins table is seeded lowercase, but is_admin() compared the raw JWT email,
-- so an admin whose JWT email carried different casing would pass the API gate
-- yet be denied by RLS (and vice versa). Lower() both sides so the two gates
-- can never disagree. Safe create-or-replace; no data or policy changes.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;
