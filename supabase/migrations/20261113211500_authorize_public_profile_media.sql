-- Profile avatars and backgrounds are intentionally PUBLIC profile assets.
-- Keep private Dumps, Keeps and Archives in their separate protected buckets.
-- Only the signed-in owner may create or delete assets beneath
-- flicd-media/<auth.uid()>/profile/, including profile/background/.
--
-- Public download is inherent to the existing public flicd-media bucket;
-- this policy does not grant unrestricted object upload or access to private media.

do $$
begin
  if not exists (
    select 1 from storage.buckets where id = 'flicd-media' and public = true
  ) then
    raise exception 'Expected public flicd-media bucket is not configured';
  end if;
end $$;

-- Profile Studio supports short MP4/WebM/MOV backgrounds as well as images.
-- This adjusts only the existing public profile-capable bucket.
update storage.buckets
set allowed_mime_types = array[
  'image/jpeg','image/png','image/webp',
  'video/mp4','video/webm','video/quicktime'
]::text[]
where id='flicd-media'
  and allowed_mime_types is distinct from array[
  'image/jpeg','image/png','image/webp',
  'video/mp4','video/webm','video/quicktime'
]::text[];

drop policy if exists "Owners upload public profile assets" on storage.objects;
create policy "Owners upload public profile assets"
on storage.objects for insert to authenticated
with check (
  bucket_id='flicd-media'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and (storage.foldername(name))[2]='profile'
);

drop policy if exists "Owners remove public profile assets" on storage.objects;
create policy "Owners remove public profile assets"
on storage.objects for delete to authenticated
using (
  bucket_id='flicd-media'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and (storage.foldername(name))[2]='profile'
);
