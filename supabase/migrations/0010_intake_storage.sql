-- Branding-brief intake uploads.
--
-- A PRIVATE storage bucket for the customer's logo + dashboard screenshots.
-- It is written and read only server-side with the service-role key: the
-- intake route validates the order's unguessable UUID before touching it, and
-- the admin views files via short-lived signed URLs. No public access, no anon
-- policies. The intake's text fields (colors, voiceover, notes) live on
-- orders.metadata.intake; only the files go here.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'intake',
  'intake',
  false,
  10485760, -- 10 MB per file
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'application/pdf']
)
on conflict (id) do nothing;
