-- Runs only in a disposable CI PostgreSQL instance.
-- Verifies public profile media without loosening the private Dump policies.
\set ON_ERROR_STOP on

do $$
begin
  if not exists (
    select 1 from storage.buckets where id='flicd-media' and public
      and allowed_mime_types @> array['video/mp4','video/webm','video/quicktime']::text[]
  ) then raise exception 'Public profile media bucket lacks background formats'; end if;
end $$;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',true);

-- Owner may upload an avatar and a background, both under profile/.
insert into storage.objects(bucket_id,name) values
  ('flicd-media','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/profile/avatar.png'),
  ('flicd-media','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/profile/background/video.mp4');

-- A different owner's prefix and unrelated public-media paths remain forbidden.
do $$
begin
  begin
    insert into storage.objects(bucket_id,name)
      values ('flicd-media','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/profile/forged.png');
    raise exception 'SECURITY_FAIL: cross-account profile image upload succeeded';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects(bucket_id,name)
      values ('flicd-media','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/unrelated/post.png');
    raise exception 'SECURITY_FAIL: non-profile upload succeeded';
  exception when insufficient_privilege then null; end;
end $$;

-- Owner can delete only the path beneath their own profile/.
delete from storage.objects
where bucket_id='flicd-media'
  and name='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/profile/avatar.png';

select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',true);
do $$
declare deleted integer;
begin
  delete from storage.objects
  where bucket_id='flicd-media'
    and name='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/profile/background/video.mp4';
  get diagnostics deleted=row_count;
  if deleted <> 0 then raise exception 'SECURITY_FAIL: another account deleted public profile media'; end if;
end $$;
rollback;

\echo 'PASS: only profile owners can upload/delete public avatar and background media'
