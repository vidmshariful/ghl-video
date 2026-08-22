-- The visual style guide we write FOR a client, as a PDF.
--
-- Not editing_style_guides. That is the client telling us how they want
-- their videos cut, in their words, in a form. This is the document we
-- produce from their brand and their data and then work to, and like a cut
-- it goes to them for a read and comes back with notes.
--
-- Versioned, because a guide that comes back with notes gets replaced, and
-- the notes on version 1 should still make sense after version 2 lands.

create table if not exists public.style_guide_docs (
  id uuid primary key default gen_random_uuid(),
  customer_email text not null,
  version integer not null default 1,
  -- path inside the private intake bucket; never a public url
  path text not null,
  filename text not null,
  size_bytes integer,
  -- what changed in this version, in our words
  note text,
  uploaded_by text,
  created_at timestamptz not null default now()
);

create index if not exists style_guide_docs_email_idx
  on public.style_guide_docs (lower(customer_email), version desc);

create unique index if not exists style_guide_docs_email_version_key
  on public.style_guide_docs (lower(customer_email), version);

-- Feedback, anchored to a page the way video feedback is anchored to a
-- second. A note with no page is about the guide as a whole.
create table if not exists public.style_guide_notes (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references public.style_guide_docs (id) on delete cascade,
  page integer,
  author_side text not null check (author_side in ('client', 'studio')),
  author_email text,
  author_name text,
  body text not null,
  -- a reply hangs off the note it answers
  parent_id uuid references public.style_guide_notes (id) on delete cascade,
  resolved_at timestamptz,
  resolved_by text,
  created_at timestamptz not null default now()
);

create index if not exists style_guide_notes_doc_idx
  on public.style_guide_notes (doc_id, created_at);

alter table public.style_guide_docs enable row level security;
alter table public.style_guide_notes enable row level security;

-- Default deny, like every other table here. Both portals reach these
-- through the service role, scoped to the acting account in the route.
