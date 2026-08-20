-- The library's Filter by feature vocabulary, moved from code to a table.
--
-- The rail that filters the public library by HighLevel feature was a
-- hardcoded list, which meant a new platform feature needed a deploy before
-- the shelf could speak it. Now admin edits it (Products & Packs -> Library
-- filters) and the code list is only the fallback for an unreachable table.
--
-- Aliases are plain substrings, never regex: an admin field that accepts
-- regex hands the owner a way to take the public library down with one bad
-- bracket. A substring cannot fail to compile.

begin;

create table if not exists public.library_features (
  id         uuid primary key default gen_random_uuid(),
  key        text not null unique,
  label      text not null,
  aliases    text[] not null default '{}',
  active     boolean not null default true,
  sort       integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.library_features is
  'The Filter by feature rail on /library. Aliases are case-insensitive substrings matched against video titles; a feature with no matches never renders, so a stale row cannot show a dead filter.';

alter table public.library_features enable row level security;

drop policy if exists library_features_admin on public.library_features;
create policy library_features_admin on public.library_features
  for all using (public.is_admin()) with check (public.is_admin());

drop trigger if exists library_features_set_updated_at on public.library_features;
create trigger library_features_set_updated_at
  before update on public.library_features
  for each row execute function public.set_updated_at();

-- the launch vocabulary, so admin opens populated rather than empty.
-- on conflict do nothing: re-running never overwrites an edit.
insert into public.library_features (key, label, aliases, sort) values
  ('ai-employee', 'AI Employee', '{"ai employee"}', 0),
  ('conversational-ai', 'Conversational AI', '{"conversational ai"}', 1),
  ('voice-ai', 'Voice AI', '{"voice ai"}', 2),
  ('content-ai', 'Content AI', '{"content ai"}', 3),
  ('ask-ai', 'Ask AI', '{"ask ai"}', 4),
  ('ai-receptionist', 'AI Receptionist', '{"ai receptionist"}', 5),
  ('inbox', 'Unified Inbox', '{"unified inbox","all-in-one inbox"}', 6),
  ('reputation', 'Reputation & Reviews', '{"reputation","review"}', 7),
  ('pipeline', 'Pipeline & CRM', '{"opportunity pipeline","contact management"}', 8),
  ('automation', 'Workflows & Automation', '{"automation","workflow","automated"}', 9),
  ('funnels', 'Funnels & Websites', '{"funnel","website"}', 10),
  ('email', 'Email Builder', '{"email"}', 11),
  ('social', 'Social Media Planner', '{"social media"}', 12),
  ('calendars', 'Calendars & Booking', '{"calendar"}', 13),
  ('texting', 'Two-Way Texting', '{"two-way","texting"}', 14),
  ('missed-call', 'Missed Call Text Back', '{"missed call"}', 15),
  ('calls', 'Calls & Dialer', '{"call tracking","power dialer"}', 16),
  ('payments', 'Payments & Invoicing', '{"payment","invoice","invoicing"}', 17),
  ('memberships', 'Memberships & Courses', '{"membership"}', 18),
  ('mobile', 'Mobile App', '{"mobile app"}', 19),
  ('reporting', 'Reporting', '{"reporting"}', 20),
  ('forms', 'Forms & Surveys', '{"forms","survey"}', 21),
  ('chat', 'Live Chat', '{"live chat"}', 22),
  ('platform', 'The whole platform', '{"all-in-one","all in one","platform","everything in one place","lead to close"}', 23)
on conflict (key) do nothing;

commit;
