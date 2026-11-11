-- LOCAL REVIEW DRAFT. Atomic Keep/deletion rollout; no backfill or Storage IO.
begin;
do $$ begin
 if not exists(select 1 from public.__flicd_staging_marker where label='SYNTHETIC_STAGING_ONLY') then raise exception 'Synthetic staging marker required'; end if;
end $$;
-- Normalize only the single-column source FKs; reject an unexpected schema.
-- Draft requires review of existing FK definitions before any hosted application.
do $$ declare child regclass;f record;n integer;begin
 foreach child in array array['public.dump_items'::regclass,'public.dump_views'::regclass] loop
  n=0;
  for f in select c.conname,c.confdeltype from pg_constraint c
   where c.conrelid=child and c.confrelid='public.dumps'::regclass and c.contype='f'
   and c.conkey=array[(select attnum from pg_attribute where attrelid=child and attname='dump_id')] loop
   n=n+1;
   if f.confdeltype<>'c' then
    execute format('alter table %s drop constraint %I',child,f.conname);
    execute format('alter table %s add constraint %I foreign key(dump_id) references public.dumps(id) on delete cascade',child,f.conname);
   end if;
  end loop;
  if n<>1 then raise exception 'Unexpected source FK shape: %',child;end if;
 end loop;
end $$;
create unique index managed_item_position_unique on public.dump_items(dump_id,position);
create unique index managed_private_source_unique on public.dump_items(media_bucket,image_path)
where image_path is not null and media_bucket='flicd-dump-private';
create unique index managed_item_dump_unique on public.dump_items(id,dump_id);
create unique index managed_dump_author_unique on public.dumps(id,user_id);
create table private.photo_keeps(
 id uuid primary key default gen_random_uuid(),
 saver_id uuid not null references auth.users(id) on delete cascade,
 source_item_id uuid not null,
 source_dump_id uuid not null,
 source_author_id uuid not null,
 saved_note text not null default '',
 saved_at timestamptz not null default clock_timestamp(),
 foreign key(source_item_id,source_dump_id) references public.dump_items(id,dump_id) on delete cascade,
 foreign key(source_dump_id,source_author_id) references public.dumps(id,user_id) on delete cascade,
 unique(saver_id,source_item_id)
);
create table private.keep_board_memberships(
 keep_id uuid not null references private.photo_keeps(id) on delete cascade,
 board_id uuid not null references public.boards(id) on delete cascade,
 primary key(keep_id,board_id)
);
create table private.media_cleanup_jobs(
 id uuid primary key default gen_random_uuid(),bucket_id text not null,name text not null,
 status text not null default 'pending' check(status in('pending','leased','done')),
 attempts integer not null default 0,next_attempt_at timestamptz not null default clock_timestamp(),
 lease_token uuid,lease_until timestamptz,last_error_code text,completed_at timestamptz,
 unique(bucket_id,name)
);
create index media_cleanup_ready on private.media_cleanup_jobs(status,next_attempt_at,lease_until);
alter table private.photo_keeps enable row level security;
alter table private.keep_board_memberships enable row level security;
alter table private.media_cleanup_jobs enable row level security;
revoke all on private.photo_keeps,private.keep_board_memberships,private.media_cleanup_jobs from public,anon,authenticated;
-- Retire the old client snapshot write API; legacy rows await reviewed backfill.
revoke insert,update on public.board_items from public,anon,authenticated;
-- All addresses are permanently tombstoned: completed jobs must not simply be purged.
create function private.media_tombstoned(p_bucket text,p_name text) returns boolean
language sql stable security definer set search_path=pg_catalog set row_security=off as $$
 select exists(select 1 from private.media_cleanup_jobs j where j.bucket_id=p_bucket and j.name=p_name)
$$;
revoke all on function private.media_tombstoned(text,text) from public,anon;
grant execute on function private.media_tombstoned(text,text) to authenticated;
create policy "Deleted media stays unreadable before and after cleanup" on storage.objects
as restrictive for select to authenticated using(not private.media_tombstoned(bucket_id,name));
create policy "Deleted object addresses cannot be reused" on storage.objects
as restrictive for insert to authenticated with check(not private.media_tombstoned(bucket_id,name));
create policy "Deleted object addresses cannot be rewritten" on storage.objects
as restrictive for update to authenticated
using(not private.media_tombstoned(bucket_id,name)) with check(not private.media_tombstoned(bucket_id,name));

create function private.media_immutable_source() returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 if tg_table_name='dumps' then
  if new.user_id is distinct from old.user_id or new.expiry is distinct from old.expiry then raise exception 'immutable_post_media_mode'; end if;
 else
  if new.dump_id is distinct from old.dump_id or new.position is distinct from old.position
    or new.image_path is distinct from old.image_path or new.media_bucket is distinct from old.media_bucket then
   raise exception 'immutable_source_photo_delete_and_create_instead'; end if;
 end if;
 return new;
end $$;
revoke all on function private.media_immutable_source() from public,anon,authenticated;
create trigger managed_immutable_post before update on public.dumps for each row execute function private.media_immutable_source();
create trigger managed_immutable_photo before update on public.dump_items for each row execute function private.media_immutable_source();
create function private.media_enqueue_source(p_dump uuid,p_item uuid default null) returns void
language plpgsql security definer set search_path=pg_catalog set row_security=off as $$
begin
 insert into private.media_cleanup_jobs(bucket_id,name)
 select i.media_bucket,i.image_path from public.dump_items i join public.dumps d on d.id=i.dump_id
 where d.id=p_dump and (p_item is null or i.id=p_item) and i.image_path is not null
 and i.media_bucket in('flicd-dump-private','flicd-media') and split_part(i.image_path,'/',1)=d.user_id::text
 on conflict do nothing;
 insert into private.media_cleanup_jobs(bucket_id,name)
 select 'flicd-archive',a.archive_path from public.flicd_archive_items a join public.dumps d on d.id=a.dump_id
 join public.dump_items i on i.dump_id=d.id and i.position=a.item_position
 where d.id=p_dump and (p_item is null or i.id=p_item) and a.user_id=d.user_id
 and starts_with(a.archive_path,d.user_id::text||'/'||d.id::text||'/')
 on conflict do nothing;
 insert into private.media_cleanup_jobs(bucket_id,name)
 select b.snapshot_bucket,b.saved_image_path from public.board_items b
 join public.dump_items i on i.dump_id=b.dump_id and i.position=b.item_position
 where b.dump_id=p_dump and (p_item is null or i.id=p_item)
 and b.saved_image_path is not null and b.snapshot_bucket in('flicd-archive','flicd-media')
 and starts_with(b.saved_image_path,b.user_id::text||'/boards/')
 on conflict do nothing;
 -- Do not leave SET NULL legacy rows that retain private snapshot capabilities.
 delete from public.board_items b where b.dump_id=p_dump
 and (p_item is null or exists(select 1 from public.dump_items i where i.id=p_item and i.position=b.item_position));
end $$;
create function private.media_delete_source() returns trigger
language plpgsql security definer set search_path=pg_catalog set row_security=off as $$
begin
 if tg_table_name='dumps' then perform private.media_enqueue_source(old.id);
 else perform private.media_enqueue_source(old.dump_id,old.id); end if;
 return old;
end $$;
revoke all on function private.media_enqueue_source(uuid,uuid),private.media_delete_source() from public,anon,authenticated;
create trigger managed_dump_delete before delete on public.dumps for each row execute function private.media_delete_source();
create trigger managed_photo_delete before delete on public.dump_items for each row execute function private.media_delete_source();

create function private.media_source_location(p_item uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog set row_security=off as $$
declare result jsonb;
begin
 select jsonb_build_object('bucket',i.media_bucket,'path',i.image_path) into result
 from public.dump_items i join public.dumps d on d.id=i.dump_id where i.id=p_item
 and i.media_bucket='flicd-dump-private' and split_part(i.image_path,'/',1)=d.user_id::text
 and exists(select 1 from storage.objects o where o.bucket_id=i.media_bucket and o.name=i.image_path);
 if result is null then
  select jsonb_build_object('bucket','flicd-archive','path',a.archive_path) into result
  from public.dump_items i join public.dumps d on d.id=i.dump_id
  join public.flicd_archive_items a on a.dump_id=d.id and a.item_position=i.position and a.user_id=d.user_id
  where i.id=p_item and starts_with(a.archive_path,d.user_id::text||'/'||d.id::text||'/')
  and exists(select 1 from storage.objects o where o.bucket_id='flicd-archive' and o.name=a.archive_path);
 end if;
 if result is null then raise exception 'media_unavailable'; end if;
 return result;
end $$;
revoke all on function private.media_source_location(uuid) from public,anon,authenticated;
create function public.media_owner_archive(p jsonb) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog set row_security=off as $$
declare u uuid=(p->>'viewer_id')::uuid;result jsonb;
begin
 if not private.media_actor_valid(u,(p->>'auth_session_id')::uuid) then raise exception 'media_forbidden'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'user_id',d.user_id,'expiry',d.expiry,
 'type',d.type,'mood',d.mood,'context',d.context,'created_at',d.created_at,
 'archive',jsonb_build_object('reason',case when d.expiry='once' then 'view_once' else '24h_expired' end,
 'archived_at',coalesce(a.archived_at,d.created_at)),
 'dump_items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'position',i.position,'note',i.note) order by i.position)
 from public.dump_items i where i.dump_id=d.id),'[]'::jsonb)) order by d.created_at desc),'[]'::jsonb)
 into result from public.dumps d left join public.flicd_archive a on a.dump_id=d.id and a.user_id=u
 where d.user_id=u and (d.expiry='once' or (d.expiry='24h' and d.created_at<=clock_timestamp()-interval '24 hours') or a.dump_id is not null);
 return result;
end $$;
create function public.media_owner_frame(p jsonb) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog set row_security=off as $$
declare u uuid=(p->>'viewer_id')::uuid;item uuid=(p->>'item_id')::uuid;
begin
 if not private.media_actor_valid(u,(p->>'auth_session_id')::uuid)
 or not exists(select 1 from public.dump_items i join public.dumps d on d.id=i.dump_id
 where i.id=item and d.user_id=u) then raise exception 'media_forbidden'; end if;
 return private.media_source_location(item);
end $$;
create function public.media_save_photo(p jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog set row_security=off as $$
declare u uuid=(p->>'viewer_id')::uuid;d public.dumps%rowtype;i public.dump_items%rowtype;k private.photo_keeps%rowtype;
begin
 if not private.media_actor_valid(u,(p->>'auth_session_id')::uuid) then raise exception 'keep_forbidden'; end if;
 select * into d from public.dumps where id=(p->>'dump_id')::uuid for update;
 select * into i from public.dump_items where dump_id=d.id and position=(p->>'item_position')::integer for update;
 if d.id is null or i.id is null or private.media_blocked(u,d.user_id) or d.expiry<>'24h' then raise exception 'keep_forbidden'; end if;
 select * into k from private.photo_keeps where saver_id=u and source_item_id=i.id;
 if not found then
  if (d.user_id<>u and d.created_at<=clock_timestamp()-interval '24 hours') or not private.media_post_visible(u,d.id)
    or (d.user_id<>u and not d.allow_others_to_keep) or i.media_bucket<>'flicd-dump-private'
    or split_part(i.image_path,'/',1) is distinct from d.user_id::text then raise exception 'keep_forbidden'; end if;
  perform private.media_source_location(i.id);
  insert into private.photo_keeps(saver_id,source_item_id,source_dump_id,source_author_id,saved_note)
  values(u,i.id,d.id,d.user_id,coalesce(i.note,'')) returning * into k;
 end if;
 if p->>'board_id' is not null then
  if not exists(select 1 from public.boards where id=(p->>'board_id')::uuid and user_id=u) then raise exception 'keep_forbidden'; end if;
  insert into private.keep_board_memberships values(k.id,(p->>'board_id')::uuid) on conflict do nothing;
 end if;
 return to_jsonb(k);
end $$;
create function public.media_keep_frame(p jsonb) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog set row_security=off as $$
declare u uuid=(p->>'viewer_id')::uuid;k private.photo_keeps%rowtype;
begin
 select * into k from private.photo_keeps where id=(p->>'keep_id')::uuid and saver_id=u;
 if not found or not private.media_actor_valid(u,(p->>'auth_session_id')::uuid)
 or private.media_blocked(u,k.source_author_id) then raise exception 'keep_forbidden'; end if;
 return private.media_source_location(k.source_item_id);
end $$;
create function public.media_list_keeps(p jsonb) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog set row_security=off as $$
declare u uuid=(p->>'viewer_id')::uuid;result jsonb;
begin
 if not private.media_actor_valid(u,(p->>'auth_session_id')::uuid) then raise exception 'keep_forbidden'; end if;
 select coalesce(jsonb_agg(to_jsonb(k)||jsonb_build_object('source_username',profile.username,
 'is_own_photo',k.source_author_id=u,'board_ids',coalesce((select jsonb_agg(m.board_id) from private.keep_board_memberships m where m.keep_id=k.id),'[]'::jsonb)) order by k.saved_at desc),'[]'::jsonb)
 into result from private.photo_keeps k join public.profiles profile on profile.id=k.source_author_id
 where k.saver_id=u and not private.media_blocked(u,k.source_author_id);
 return result;
end $$;
create function public.media_link_keep(p jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog set row_security=off as $$
declare u uuid=(p->>'viewer_id')::uuid;k private.photo_keeps%rowtype;
begin
 select * into k from private.photo_keeps where id=(p->>'keep_id')::uuid and saver_id=u for update;
 if not found or not private.media_actor_valid(u,(p->>'auth_session_id')::uuid) or private.media_blocked(u,k.source_author_id)
 or not exists(select 1 from public.boards where id=(p->>'board_id')::uuid and user_id=u) then raise exception 'keep_forbidden'; end if;
 insert into private.keep_board_memberships values(k.id,(p->>'board_id')::uuid) on conflict do nothing;
 return jsonb_build_object('linked',true);
end $$;
create function public.media_remove_board_photo(p jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog set row_security=off as $$
declare u uuid=(p->>'viewer_id')::uuid;
begin
 if not private.media_actor_valid(u,(p->>'auth_session_id')::uuid)
 or not exists(select 1 from private.photo_keeps where id=(p->>'keep_id')::uuid and saver_id=u)
 or not exists(select 1 from public.boards where id=(p->>'board_id')::uuid and user_id=u) then raise exception 'keep_forbidden'; end if;
 delete from private.keep_board_memberships where keep_id=(p->>'keep_id')::uuid and board_id=(p->>'board_id')::uuid;
 return jsonb_build_object('removed',true);
end $$;
create function public.media_remove_keep(p jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog set row_security=off as $$
declare u uuid=(p->>'viewer_id')::uuid;k private.photo_keeps%rowtype;
begin
 select * into k from private.photo_keeps where id=(p->>'keep_id')::uuid and saver_id=u for update;
 if not found or not private.media_actor_valid(u,(p->>'auth_session_id')::uuid) then raise exception 'keep_forbidden'; end if;
 if exists(select 1 from private.keep_board_memberships where keep_id=k.id) then raise exception 'keep_still_organized'; end if;
 delete from private.photo_keeps where id=k.id;
 return jsonb_build_object('removed',true);
end $$;
create function public.media_reconcile_cleanup(p jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog set row_security=off as $$
declare n integer;
begin
 update private.media_cleanup_jobs j set status='pending',next_attempt_at=clock_timestamp(),completed_at=null
 where id in(select x.id from private.media_cleanup_jobs x where x.status='done'
 and exists(select 1 from storage.objects o where o.bucket_id=x.bucket_id and o.name=x.name) limit 100);
 get diagnostics n=row_count;return jsonb_build_object('requeued',n);
end $$;
create function public.media_lease_cleanup(p jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog set row_security=off as $$
declare result jsonb;
begin
 with eligible as(select id from private.media_cleanup_jobs
 where (status='pending' and next_attempt_at<=clock_timestamp()) or (status='leased' and lease_until<clock_timestamp())
 order by next_attempt_at for update skip locked limit 20),leased as(
 update private.media_cleanup_jobs j set status='leased',lease_token=gen_random_uuid(),
 lease_until=clock_timestamp()+interval '60 seconds',attempts=attempts+1 from eligible e where j.id=e.id returning j.*)
 select coalesce(jsonb_agg(to_jsonb(leased)),'[]'::jsonb) into result from leased;
 return result;
end $$;
create function public.media_finish_cleanup(p jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog set row_security=off as $$
begin
 update private.media_cleanup_jobs set status='done',completed_at=clock_timestamp(),last_error_code=null
 where id=(p->>'job_id')::uuid and lease_token=(p->>'lease_token')::uuid and status='leased' and lease_until>clock_timestamp();
 return jsonb_build_object('completed',found);
end $$;
create function public.media_fail_cleanup(p jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog set row_security=off as $$
begin
 update private.media_cleanup_jobs set status='pending',last_error_code='transient_storage_failure',
 next_attempt_at=clock_timestamp()+make_interval(secs=>least(3600,power(2,least(attempts,12))::integer))
 where id=(p->>'job_id')::uuid and lease_token=(p->>'lease_token')::uuid and status='leased' and lease_until>clock_timestamp();
 return jsonb_build_object('rescheduled',found);
end $$;
do $$ declare f text;begin
 foreach f in array array['media_owner_archive','media_owner_frame','media_save_photo','media_keep_frame','media_list_keeps','media_link_keep','media_remove_board_photo','media_remove_keep',
 'media_reconcile_cleanup','media_lease_cleanup','media_finish_cleanup','media_fail_cleanup'] loop
  execute format('revoke all on function public.%I(jsonb) from public,anon,authenticated',f);
  execute format('grant execute on function public.%I(jsonb) to service_role',f);
 end loop;
end $$;
commit;
