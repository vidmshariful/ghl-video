-- Editable in-app notification text, the bell's equivalent of email_templates.
--
-- Every notification the platform pushes has a default title and body in code
-- (lib/comms.ts). This table holds the team's overrides: a row exists only
-- when somebody edited the words or switched the notification off in admin,
-- so the seed writes nothing and a fresh database behaves exactly as before.
--
-- Keyed by audience AND kind, because the same event often speaks to two
-- sides in two voices: order_paid tells the client "Your order is confirmed"
-- and tells the team "New order: $495".
create table if not exists public.notification_templates (
  audience    text not null check (audience in ('admin', 'customer', 'partner')),
  kind        text not null,
  title       text not null,
  body        text,
  enabled     boolean not null default true,
  updated_at  timestamptz not null default now(),
  primary key (audience, kind)
);

comment on table public.notification_templates is
  'Admin overrides for in-app notification text and on/off, per audience and kind. Defaults live in lib/comms.ts.';

alter table public.notification_templates enable row level security;

-- Same rule as email_templates: the admin screen reads and writes directly
-- under RLS, gated on the admins allowlist. Nothing else can touch it.
drop policy if exists notification_templates_admin_all on public.notification_templates;
create policy notification_templates_admin_all on public.notification_templates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
