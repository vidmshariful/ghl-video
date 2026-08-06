-- Admin-editable transactional email templates. One row per email the app
-- can send (currently: order_update, sent to the client when the team posts an
-- update on their order). Body + subject carry {{variables}} filled at send
-- time. Seeded from code (scripts/seed-email-templates.mjs) so the HTML lives in
-- lib/email/templates.ts, not in SQL.

create table if not exists public.email_templates (
  key         text primary key,
  name        text not null,
  description text,
  subject     text not null,
  body        text not null,
  enabled     boolean not null default true,
  updated_at  timestamptz not null default now()
);

create or replace function public.email_templates_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists email_templates_set_updated_at on public.email_templates;
create trigger email_templates_set_updated_at
  before update on public.email_templates
  for each row execute function public.email_templates_touch();

alter table public.email_templates enable row level security;

-- Admins manage templates through the authenticated client; the send path reads
-- them with the service role (which bypasses RLS). No public/anon access.
drop policy if exists email_templates_admin_all on public.email_templates;
create policy email_templates_admin_all on public.email_templates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
