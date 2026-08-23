-- Project attachments: files the client and the studio pass each other.
--
-- The custom project page had nowhere to hand a file across. When we need a
-- logo, a screenshot, a raw clip or a reference from the client, or when we
-- want to hand them something, it goes here: a shared list on the project,
-- visible and deletable from both sides.
--
-- A PRIVATE bucket, same rules as intake: written and read only server-side
-- with the service-role key, no public access, no anon policies. The row that
-- names each file lives in project_files; the bytes live in the bucket. The
-- API is the only writer, so it is the one place that decides which types are
-- allowed. The bucket keeps the 10 MB ceiling as a backstop.
insert into storage.buckets (id, name, public, file_size_limit)
values ('project-files', 'project-files', false, 10485760) -- 10 MB per file
on conflict (id) do nothing;

create table if not exists public.project_files (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects (id) on delete cascade,
  -- which side put it here, so the list can say who sent what
  uploaded_by    text not null check (uploaded_by in ('client', 'studio')),
  uploader_email text,
  uploader_name  text,
  file_name      text not null,
  storage_path   text not null,
  size_bytes     bigint not null check (size_bytes >= 0),
  content_type   text,
  created_at     timestamptz not null default now()
);

create index if not exists project_files_project_idx
  on public.project_files (project_id, created_at desc);

comment on table public.project_files is
  'Attachments on a custom project, shared between the client and the studio. Bytes live in the private project-files bucket; this row names one.';

-- Default-deny, like every private table here: no policies means no anon or
-- authenticated access. Only server code with the service-role key reads or
-- writes, after it has checked the caller owns the project (client) or is an
-- admin (studio).
alter table public.project_files enable row level security;
