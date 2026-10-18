-- STAGING FIRST: coordinated privacy hardening for flic'd.
-- Do not deploy until the media-bucket client changes and legacy-object cutover have passed staging QA.
begin;

do $guard$
begin
  if not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='message_requests'
      and t.tgname='message_request_accepted' and not t.tgisinternal
  ) then
    raise exception 'Accepted-request conversation trigger missing; refuse to restrict membership writes';
  end if;
end
$guard$;

-- Conversation membership is controlled by the trusted accepted-request trigger,
-- not a direct insert API that permits self-enrollment with a known conversation UUID.
drop policy if exists "Users can add themselves to conversations" on public.conversation_participants;
revoke insert on public.conversation_participants from public, anon, authenticated;
drop policy if exists "Users can create conversations" on public.conversations;
revoke insert on public.conversations from public, anon, authenticated;

-- Existing SELECT RLS relies on this definer helper to avoid recursive policies.
-- Never allow a caller to ask about a different user's membership.
create or replace function public.is_conversation_participant(
  p_conversation_id uuid, p_user_id uuid
) returns boolean
language sql stable security definer
set search_path = public, pg_catalog
set row_security = off
as $fn$
  select (select auth.uid()) is not null
    and p_user_id = (select auth.uid())
    and exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = p_conversation_id
        and cp.user_id = (select auth.uid())
    );
$fn$;
revoke execute on function public.is_conversation_participant(uuid,uuid) from public, anon;
grant execute on function public.is_conversation_participant(uuid,uuid) to authenticated;

-- Avoid sending every post's media path to every signed-in account.
-- Parent dumps RLS continues to gate ownership and accepted-follow relationships.
-- Owners can read their own expired posts for archiving.
drop policy if exists "Authenticated users can view dump items" on public.dump_items;
drop policy if exists "Authorized users can view live dump items" on public.dump_items;
create policy "Authorized users can view live dump items"
on public.dump_items for select to authenticated
using (
  exists (
    select 1 from public.dumps d
    where d.id = dump_items.dump_id
      and (
        d.user_id = (select auth.uid())
        or (
          (d.expiry = '24h' and d.created_at > now() - interval '24 hours')
          or (
            d.expiry = 'once'
            and d.once_viewed_at is null
            and not exists (
              select 1 from public.dump_views v
              where v.dump_id = d.id and v.user_id = (select auth.uid())
            )
          )
        )
      )
  )
);

-- Existing public media must be copied to private storage and referenced by
-- media_bucket BEFORE removing legacy public objects. Do not flip the old bucket.
alter table public.dump_items
  add column if not exists media_bucket text not null default 'flicd-media';
do $guard$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='dump_items_media_bucket_check'
      and conrelid='public.dump_items'::regclass
  ) then
    alter table public.dump_items
      add constraint dump_items_media_bucket_check
      check (media_bucket in ('flicd-media','flicd-dump-private'));
  end if;
end
$guard$;
create index if not exists dump_items_media_object_idx
  on public.dump_items(media_bucket,image_path)
  where image_path is not null;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('flicd-dump-private','flicd-dump-private',false,20971520,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false;

drop policy if exists "Owner uploads private dump media" on storage.objects;
create policy "Owner uploads private dump media" on storage.objects
for insert to authenticated
with check (
  bucket_id='flicd-dump-private'
  and (storage.foldername(name))[1]=(select auth.uid())::text
);

drop policy if exists "Owner deletes private dump media" on storage.objects;
create policy "Owner deletes private dump media" on storage.objects
for delete to authenticated
using (
  bucket_id='flicd-dump-private'
  and (storage.foldername(name))[1]=(select auth.uid())::text
);

-- Storage validates SELECT RLS before signing/downloading the object.
-- Owner's unassociated uploads remain accessible for cleanup.
drop policy if exists "Authorized reads for private dump media" on storage.objects;
create policy "Authorized reads for private dump media" on storage.objects
for select to authenticated
using (
  bucket_id='flicd-dump-private'
  and (
    (storage.foldername(name))[1]=(select auth.uid())::text
    or exists (
      select 1 from public.dump_items i
      where i.media_bucket='flicd-dump-private'
        and i.image_path=storage.objects.name
    )
  )
);

commit;
