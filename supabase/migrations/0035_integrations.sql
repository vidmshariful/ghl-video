-- Credentials for services connected from inside admin rather than from an
-- environment variable, starting with the Google service account that reads
-- Search Console and Analytics.
--
-- SECURITY: row level security is ON and there are deliberately NO POLICIES.
-- That makes the table unreachable by every browser client, admin included;
-- only server code holding the service-role key can read or write it, and the
-- API routes above it never return the secret half back to the browser. The
-- screen sees "connected, as this account", never the key itself.

create table if not exists public.integrations (
  id            text primary key,               -- 'google'
  config        jsonb not null,                 -- SECRET. never leaves the server.
  meta          jsonb not null default '{}'::jsonb, -- safe to display: account, project, chosen property
  connected_at  timestamptz not null default now(),
  connected_by  text,
  last_ok_at    timestamptz,                    -- last time the credential actually worked
  last_error    text
);

alter table public.integrations enable row level security;
-- no policies on purpose; see the note above
