-- Two logos and the brand's own paperwork, uploaded by the client.
--
-- One logo was never enough: a video has light scenes and dark scenes, and a
-- dark logo dropped on a dark frame disappears. So the kit holds both faces
-- of the mark. The naming follows what the file IS, not where it goes: the
-- dark logo is the dark-coloured artwork (shown on a white ground), the
-- light logo is the white artwork (shown on a dark ground).
--
-- The old single logo_path stays. It is what every existing client's logo
-- lives in and what the intake brief falls back to; new uploads land in the
-- two named slots and the old column simply stops being written.
--
-- Guideline files are jsonb rather than text[] because a path alone cannot
-- be shown to a person: the original filename is the label the client
-- recognises, so each entry keeps { path, name, size }.

alter table public.brand_kits
  add column if not exists logo_dark_path  text,
  add column if not exists logo_light_path text,
  add column if not exists guideline_files jsonb not null default '[]'::jsonb;

comment on column public.brand_kits.logo_dark_path is
  'The dark-coloured logo artwork, previewed on a white ground.';
comment on column public.brand_kits.logo_light_path is
  'The white logo artwork, previewed on a dark ground.';
comment on column public.brand_kits.guideline_files is
  'Brand guideline uploads: array of { path, name, size } in the intake bucket.';
