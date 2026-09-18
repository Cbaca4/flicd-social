insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'flicd-music',
  'flicd-music',
  false,
  52428800,
  array['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/ogg','audio/mp4']
)
on conflict (id) do update
set public = false,
    file_size_limit = 52428800,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated users can read beta music" on storage.objects;
create policy "Authenticated users can read beta music"
on storage.objects
for select
to authenticated
using (bucket_id = 'flicd-music');
