-- FORWARD-ONLY LOCAL REVIEW DRAFT. Apply after all four October 19-20 drafts.
-- Never apply to hosted/persistent environments under local-test approval.
begin;
do $$ begin
 if not exists(select 1 from public.__flicd_staging_marker where label='SYNTHETIC_STAGING_ONLY') then
  raise exception 'Synthetic staging marker required';
 end if;
end $$;

-- Address history is independent of Storage presence, cleanup jobs and FK cascades.
-- Never infer this identity from a Storage object's client-writable metadata.
create table private.media_source_bindings(
 bucket_id text not null,name text not null,
 source_item_id uuid not null,source_dump_id uuid not null,source_author_id uuid not null,
 kind text not null check(kind in('original','archive')),object_id uuid,
 primary key(bucket_id,name)
);
create unique index media_original_identity_unique on private.media_source_bindings(source_item_id) where kind='original';
alter table private.media_source_bindings enable row level security;
revoke all on private.media_source_bindings from public,anon,authenticated;
insert into private.media_source_bindings
select i.media_bucket,i.image_path,i.id,i.dump_id,d.user_id,'original',
 (select o.id from storage.objects o where o.bucket_id=i.media_bucket and o.name=i.image_path)
from public.dump_items i join public.dumps d on d.id=i.dump_id where i.image_path is not null;
insert into private.media_source_bindings
select 'flicd-archive',a.archive_path,i.id,i.dump_id,d.user_id,'archive',
 (select o.id from storage.objects o where o.bucket_id='flicd-archive' and o.name=a.archive_path)
from public.flicd_archive_items a join public.dumps d on d.id=a.dump_id
join public.dump_items i on i.dump_id=a.dump_id and i.position=a.item_position
where a.user_id=d.user_id and starts_with(a.archive_path,d.user_id::text||'/'||d.id::text||'/');

create function private.media_bind_source_address() returns trigger
language plpgsql security definer set search_path=pg_catalog set row_security=off as $$
declare i public.dump_items%rowtype;u uuid;
begin
 if tg_table_name='dump_items' then
  if new.image_path is null then return new;end if;
  select user_id into u from public.dumps where id=new.dump_id;
  -- Duplicate IDs/addresses fail closed, including recreation after source deletion.
  insert into private.media_source_bindings values(new.media_bucket,new.image_path,new.id,new.dump_id,u,'original',
   (select o.id from storage.objects o where o.bucket_id=new.media_bucket and o.name=new.image_path));
 else
  select * into i from public.dump_items where dump_id=new.dump_id and position=new.item_position;
  select user_id into u from public.dumps where id=new.dump_id;
  if i.id is null or new.user_id is distinct from u
   or not starts_with(new.archive_path,u::text||'/'||new.dump_id::text||'/') then return new;end if;
  insert into private.media_source_bindings values('flicd-archive',new.archive_path,i.id,i.dump_id,u,'archive',
   (select o.id from storage.objects o where o.bucket_id='flicd-archive' and o.name=new.archive_path))
  on conflict(bucket_id,name) do nothing;
  if not exists(select 1 from private.media_source_bindings b where b.bucket_id='flicd-archive'
   and b.name=new.archive_path and b.source_item_id=i.id and b.source_dump_id=i.dump_id and b.source_author_id=u and b.kind='archive') then
   raise exception 'media_address_already_bound';
  end if;
 end if;
 return new;
end $$;
revoke all on function private.media_bind_source_address() from public,anon,authenticated;
create trigger managed_bind_original after insert on public.dump_items for each row execute function private.media_bind_source_address();
create trigger managed_bind_archive after insert on public.flicd_archive_items for each row execute function private.media_bind_source_address();

-- Posting normally binds an already uploaded object. A trusted archive/recovery
-- operation may create the first object later; freeze its database UUID once.
-- Replaced objects never inherit identity from their path or JSON metadata.
create function private.media_capture_source_object() returns trigger
language plpgsql security definer set search_path=pg_catalog set row_security=off as $$
declare actor name=coalesce(nullif(current_setting('role',true),'none'),session_user);
begin
 if exists(select 1 from pg_roles where rolname=actor and rolsuper)
  or pg_has_role(actor,'service_role','member') then
  update private.media_source_bindings set object_id=new.id
  where bucket_id=new.bucket_id and name=new.name and object_id is null;
 end if;
 return new;
end $$;
revoke all on function private.media_capture_source_object() from public,anon,authenticated;
create trigger managed_capture_source_object after insert on storage.objects for each row execute function private.media_capture_source_object();

create or replace function private.media_bound_source_object(b text,n text) returns boolean
language sql stable security definer set search_path=pg_catalog set row_security=off as $$
 select exists(select 1 from private.media_source_bindings x where x.bucket_id=b and x.name=n)
 or exists(select 1 from public.dump_items i where i.media_bucket=b and i.image_path=n)
 or exists(select 1 from public.flicd_archive_items a where b='flicd-archive' and a.archive_path=n)
$$;
create policy "Bound source addresses cannot be browser recreated" on storage.objects
as restrictive for insert to authenticated with check(not private.media_bound_source_object(bucket_id,name));

create or replace function private.media_immutable_source() returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 if tg_table_name='dumps' then
  if new.id is distinct from old.id or new.user_id is distinct from old.user_id or new.expiry is distinct from old.expiry then raise exception 'immutable_post_media_mode';end if;
 else
  if new.id is distinct from old.id or new.dump_id is distinct from old.dump_id or new.position is distinct from old.position
   or new.image_path is distinct from old.image_path or new.media_bucket is distinct from old.media_bucket then
   raise exception 'immutable_source_photo_delete_and_create_instead';end if;
 end if;
 return new;
end $$;
create or replace function private.media_source_location(p_item uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog set row_security=off as $$
declare result jsonb;
begin
 select jsonb_build_object('bucket',i.media_bucket,'path',i.image_path) into result
 from public.dump_items i join public.dumps d on d.id=i.dump_id
 join private.media_source_bindings b on b.bucket_id=i.media_bucket and b.name=i.image_path
  and b.source_item_id=i.id and b.source_dump_id=d.id and b.source_author_id=d.user_id and b.kind='original'
 where i.id=p_item and i.media_bucket='flicd-dump-private' and split_part(i.image_path,'/',1)=d.user_id::text
 and not private.media_tombstoned(i.media_bucket,i.image_path)
 and exists(select 1 from storage.objects o where o.bucket_id=i.media_bucket and o.name=i.image_path and o.id=b.object_id);
 if result is null then
  select jsonb_build_object('bucket','flicd-archive','path',a.archive_path) into result
  from public.dump_items i join public.dumps d on d.id=i.dump_id
  join public.flicd_archive_items a on a.dump_id=d.id and a.item_position=i.position and a.user_id=d.user_id
  join private.media_source_bindings b on b.bucket_id='flicd-archive' and b.name=a.archive_path
   and b.source_item_id=i.id and b.source_dump_id=d.id and b.source_author_id=d.user_id and b.kind='archive'
  where i.id=p_item and starts_with(a.archive_path,d.user_id::text||'/'||d.id::text||'/')
  and not private.media_tombstoned('flicd-archive',a.archive_path)
  and exists(select 1 from storage.objects o where o.bucket_id='flicd-archive' and o.name=a.archive_path and o.id=b.object_id);
 end if;
 if result is null then raise exception 'media_unavailable';end if;
 return result;
end $$;
-- Historical identifiers are evidence, not live authorization foreign keys.
-- Preserve them through source/account removal, including separately reviewed facts.
alter table private.legacy_saved_records
 drop constraint legacy_saved_records_dump_id_fkey,
 drop constraint legacy_saved_records_source_item_id_fkey,
 drop constraint legacy_saved_records_user_id_fkey,
 add column source_author_id uuid,
 add column historical_evidence jsonb not null default '{}'::jsonb,
 add column source_deleted_at timestamptz;
alter table private.legacy_keep_reviews
 drop constraint legacy_keep_reviews_source_item_id_fkey,
 drop constraint legacy_keep_reviews_saver_id_fkey,
 drop constraint legacy_keep_reviews_reviewed_by_fkey;
alter table private.legacy_keep_migrations add column keep_removed_at timestamptz;

create or replace function private.media_preserve_legacy_records() returns void
language plpgsql security definer set search_path=pg_catalog set row_security=off as $$
begin
 insert into private.legacy_saved_records(id,user_id,board_id,dump_id,source_item_id,item_position,note,created_at,snapshot_bucket,snapshot_path,source_author_id,historical_evidence)
 select b.id,b.user_id,case when board.user_id=b.user_id then b.board_id else null end,
 b.dump_id,i.id,b.item_position,b.note,b.created_at,b.snapshot_bucket,b.saved_image_path,d.user_id,
 jsonb_build_object('browser_legacy_row',to_jsonb(b),
  'source_dump',jsonb_build_object('id',d.id,'user_id',d.user_id,'expiry',d.expiry,'created_at',d.created_at,'allow_others_to_keep',d.allow_others_to_keep),
  'source_item',jsonb_build_object('id',i.id,'dump_id',i.dump_id,'position',i.position,'media_bucket',i.media_bucket,'image_path',i.image_path),
  'source_link_verified',false)
 from public.board_items b left join public.boards board on board.id=b.board_id
 left join public.dumps d on d.id=b.dump_id
 left join public.dump_items i on i.dump_id=b.dump_id and i.position=b.item_position
 on conflict(id) do nothing;
 -- Older captured records may have outlived their Board. Never guess a missing
 -- source UUID from a reused position, or overwrite evidence captured earlier.
 update private.legacy_saved_records l set source_author_id=d.user_id,
 historical_evidence=jsonb_build_object('legacy_record',to_jsonb(l)-'historical_evidence',
  'browser_legacy_row',to_jsonb(b),
  'source_dump',jsonb_build_object('id',d.id,'user_id',d.user_id,'expiry',d.expiry,'created_at',d.created_at,'allow_others_to_keep',d.allow_others_to_keep),
  'source_item',jsonb_build_object('id',i.id,'dump_id',i.dump_id,'position',i.position,'media_bucket',i.media_bucket,'image_path',i.image_path),
  'source_link_verified',false)
 from private.legacy_saved_records old_l
 left join public.board_items b on b.id=old_l.id
 left join public.dumps d on d.id=old_l.dump_id
 left join public.dump_items i on i.id=old_l.source_item_id
 where l.id=old_l.id and l.historical_evidence='{}'::jsonb;
 insert into private.legacy_keep_objects(bucket_id,name)
 select distinct snapshot_bucket,snapshot_path from private.legacy_saved_records
 where snapshot_bucket in('flicd-media','flicd-archive') and snapshot_path is not null on conflict do nothing;
end $$;
select private.media_preserve_legacy_records();

-- Entitlement review alone is NOT a determination that snapshot bytes may be
-- destroyed. A separate, exact-address provenance AND retention adjudication is
-- private/operator-only. No browser or service-role table-write grant is added.
create table private.legacy_snapshot_cleanup_reviews(
 legacy_item_id uuid primary key references private.legacy_saved_records(id) on delete restrict,
 source_item_id uuid not null,source_author_id uuid not null,saver_id uuid not null,
 bucket_id text not null,name text not null,reviewed_by uuid not null,
 provenance_reference text not null check(length(trim(provenance_reference))>0),
 retention_reference text not null check(length(trim(retention_reference))>0),
 reviewed_at timestamptz not null default clock_timestamp()
);
alter table private.legacy_snapshot_cleanup_reviews enable row level security;
revoke all on private.legacy_snapshot_cleanup_reviews from public,anon,authenticated;
create function private.media_legacy_snapshot_protected(b text,n text) returns boolean
language sql stable security definer set search_path=pg_catalog set row_security=off as $$
 select exists(select 1 from private.legacy_saved_records l where l.snapshot_bucket=b and l.snapshot_path=n
 and not exists(select 1 from private.legacy_snapshot_cleanup_reviews r
  join private.legacy_keep_migrations m on m.legacy_item_id=r.legacy_item_id
  where r.legacy_item_id=l.id and r.source_item_id=l.source_item_id and r.source_author_id=l.source_author_id
   and r.saver_id=l.user_id and r.bucket_id=l.snapshot_bucket and r.name=l.snapshot_path
   and m.keep_id is null and (m.keep_removed_at is not null or l.source_deleted_at is not null)))
$$;
revoke all on function private.media_legacy_snapshot_protected(text,text) from public,anon,authenticated;
create function private.media_queue_reviewed_legacy_snapshot() returns trigger
language plpgsql security definer set search_path=pg_catalog set row_security=off as $$
begin
 insert into private.media_cleanup_jobs(bucket_id,name)
 select l.snapshot_bucket,l.snapshot_path from private.legacy_saved_records l
 where l.id=new.legacy_item_id and l.snapshot_bucket in('flicd-media','flicd-archive')
 and starts_with(l.snapshot_path,l.user_id::text||'/boards/')
 and l.snapshot_path !~ '(^|/)\.\.?(/|$)'
 and not private.media_legacy_snapshot_protected(l.snapshot_bucket,l.snapshot_path)
 on conflict do nothing;
 return new;
end $$;
revoke all on function private.media_queue_reviewed_legacy_snapshot() from public,anon,authenticated;
create trigger managed_reviewed_snapshot after insert or update on private.legacy_snapshot_cleanup_reviews
for each row execute function private.media_queue_reviewed_legacy_snapshot();
create trigger managed_removed_legacy_keep after update on private.legacy_keep_migrations
for each row execute function private.media_queue_reviewed_legacy_snapshot();

-- Keep the historical record even after adjudicated snapshot cleanup. A source
-- deletion is revocation/quarantine, not permission to erase historical evidence.
create or replace function private.media_delete_legacy_record() returns trigger
language plpgsql security definer set search_path=pg_catalog set row_security=off as $$
begin
 raise exception 'legacy_evidence_requires_separate_retention_review';
end $$;
create or replace function private.media_enqueue_source(p_dump uuid,p_item uuid default null) returns void
language plpgsql security definer set search_path=pg_catalog set row_security=off as $$
begin
 perform private.media_preserve_legacy_records();
 update private.legacy_saved_records l set source_deleted_at=coalesce(l.source_deleted_at,clock_timestamp())
 where l.dump_id=p_dump and (p_item is null or l.source_item_id=p_item);
 insert into private.media_cleanup_jobs(bucket_id,name)
 select i.media_bucket,i.image_path from public.dump_items i join public.dumps d on d.id=i.dump_id
 where d.id=p_dump and (p_item is null or i.id=p_item) and i.image_path is not null
 and i.media_bucket in('flicd-dump-private','flicd-media') and split_part(i.image_path,'/',1)=d.user_id::text
 on conflict do nothing;
 insert into private.media_cleanup_jobs(bucket_id,name)
 select 'flicd-archive',a.archive_path from public.flicd_archive_items a join public.dumps d on d.id=a.dump_id
 join public.dump_items i on i.dump_id=d.id and i.position=a.item_position
 where d.id=p_dump and (p_item is null or i.id=p_item) and a.user_id=d.user_id
 and starts_with(a.archive_path,d.user_id::text||'/'||d.id::text||'/') on conflict do nothing;
 -- Revoke the obsolete browser links, but their private capture is retained.
 -- Do NOT enqueue snapshots merely because a browser-written source link matches.
 delete from public.board_items b where b.dump_id=p_dump
 and (p_item is null or exists(select 1 from public.dump_items i where i.id=p_item and i.position=b.item_position));
end $$;
create or replace function public.media_remove_keep(p jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog set row_security=off as $$
declare u uuid=(p->>'viewer_id')::uuid;k private.photo_keeps%rowtype;
begin
 select * into k from private.photo_keeps where id=(p->>'keep_id')::uuid and saver_id=u for update;
 if not found or not private.media_actor_valid(u,(p->>'auth_session_id')::uuid) then raise exception 'keep_forbidden';end if;
 if exists(select 1 from private.keep_board_memberships where keep_id=k.id) then raise exception 'keep_still_organized';end if;
 update private.legacy_keep_migrations set keep_removed_at=coalesce(keep_removed_at,clock_timestamp()) where keep_id=k.id;
 delete from private.photo_keeps where id=k.id;
 return jsonb_build_object('removed',true);
end $$;

-- Holds win even over jobs already queued by older drafts. Revalidate leased jobs
-- immediately before Storage IO; drain old workers before any approved rollout.
create or replace function public.media_lease_cleanup(p jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog set row_security=off as $$
declare result jsonb;
begin
 with eligible as(select id from private.media_cleanup_jobs
 where ((status='pending' and next_attempt_at<=clock_timestamp()) or (status='leased' and lease_until<clock_timestamp()))
 and not private.media_legacy_snapshot_protected(bucket_id,name)
 order by next_attempt_at for update skip locked limit 20),leased as(
 update private.media_cleanup_jobs j set status='leased',lease_token=gen_random_uuid(),
 lease_until=clock_timestamp()+interval '60 seconds',attempts=attempts+1 from eligible e where j.id=e.id returning j.*)
 select coalesce(jsonb_agg(to_jsonb(leased)),'[]'::jsonb) into result from leased;
 return result;
end $$;
create function public.media_cleanup_authorized(p jsonb) returns jsonb
language sql stable security definer set search_path=pg_catalog set row_security=off as $$
 select jsonb_build_object('authorized',exists(select 1 from private.media_cleanup_jobs j
 where j.id=(p->>'job_id')::uuid and j.lease_token=(p->>'lease_token')::uuid
 and j.status='leased' and j.lease_until>clock_timestamp()
 and not private.media_legacy_snapshot_protected(j.bucket_id,j.name)))
$$;
revoke all on function public.media_cleanup_authorized(jsonb) from public,anon,authenticated;
grant execute on function public.media_cleanup_authorized(jsonb) to service_role;
create or replace function public.media_finish_cleanup(p jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog set row_security=off as $$
begin
 update private.media_cleanup_jobs set status='done',completed_at=clock_timestamp(),last_error_code=null
 where id=(p->>'job_id')::uuid and lease_token=(p->>'lease_token')::uuid and status='leased' and lease_until>clock_timestamp()
 and not private.media_legacy_snapshot_protected(bucket_id,name);
 return jsonb_build_object('completed',found);
end $$;
create or replace function public.media_reconcile_cleanup(p jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog set row_security=off as $$
declare n integer;
begin
 update private.media_cleanup_jobs j set status='pending',next_attempt_at=clock_timestamp(),completed_at=null
 where id in(select x.id from private.media_cleanup_jobs x where x.status='done'
 and not private.media_legacy_snapshot_protected(x.bucket_id,x.name)
 and exists(select 1 from storage.objects o where o.bucket_id=x.bucket_id and o.name=x.name) limit 100);
 get diagnostics n=row_count;return jsonb_build_object('requeued',n);
end $$;
commit;
