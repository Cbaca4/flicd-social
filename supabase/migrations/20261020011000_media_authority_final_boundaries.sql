-- LOCAL REVIEW DRAFT. Shared immutable original/archive provenance and tombstones.
begin;
do $$ begin
 if not exists(select 1 from public.__flicd_staging_marker where label='SYNTHETIC_STAGING_ONLY') then raise exception 'Synthetic staging marker required';end if;
end $$;
-- A provider session row may remain until delayed cleanup after its hard expiry.
create or replace function private.media_actor_valid(p_user uuid,p_session uuid) returns boolean
language sql stable security definer set search_path=pg_catalog set row_security=off as $$
 select p_user is not null and p_session is not null
 and exists(select 1 from auth.sessions s where s.id=p_session and s.user_id=p_user
  and (s.not_after is null or s.not_after>clock_timestamp()))
 and not exists(select 1 from private.media_account_restrictions r where r.user_id=p_user and r.suspended)
$$;
revoke all on function private.media_actor_valid(uuid,uuid) from public,anon,authenticated;

create or replace function private.media_source_location(p_item uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog set row_security=off as $$
declare result jsonb;
begin
 select jsonb_build_object('bucket',i.media_bucket,'path',i.image_path) into result
 from public.dump_items i join public.dumps d on d.id=i.dump_id where i.id=p_item
 and i.media_bucket='flicd-dump-private' and split_part(i.image_path,'/',1)=d.user_id::text
 and not private.media_tombstoned(i.media_bucket,i.image_path)
 and exists(select 1 from storage.objects o where o.bucket_id=i.media_bucket and o.name=i.image_path);
 if result is null then
  select jsonb_build_object('bucket','flicd-archive','path',a.archive_path) into result
  from public.dump_items i join public.dumps d on d.id=i.dump_id
  join public.flicd_archive_items a on a.dump_id=d.id and a.item_position=i.position and a.user_id=d.user_id
  where i.id=p_item and starts_with(a.archive_path,d.user_id::text||'/'||d.id::text||'/')
  and not private.media_tombstoned('flicd-archive',a.archive_path)
  and exists(select 1 from storage.objects o where o.bucket_id='flicd-archive' and o.name=a.archive_path);
 end if;
 if result is null then raise exception 'media_unavailable'; end if;
 return result;
end $$;

create or replace function public.media_claim_view_once(p jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog set row_security=off as $$
declare
 u uuid=(p->>'viewer_id')::uuid; s uuid=(p->>'auth_session_id')::uuid;
 d uuid=(p->>'dump_id')::uuid; attempt uuid=(p->>'attempt_id')::uuid;
 binding text=p->>'binding_hash'; expiry_mode text; c private.view_once_claims%rowtype;
 fresh boolean=false; frames jsonb; frame record;
begin
 if not private.media_actor_valid(u,s) or not private.media_post_visible(u,d) then
   raise exception using errcode='42501',message='media_forbidden'; end if;
 if attempt is null or binding is null or binding !~ '^[0-9a-f]{64}$' then
   raise exception using errcode='22023',message='invalid_page_binding'; end if;
 select expiry into expiry_mode from public.dumps where id=d for key share;
 if expiry_mode is distinct from 'once' then raise exception 'not_view_once'; end if;
 if not exists(select 1 from public.dump_items where dump_id=d) then raise exception 'media_unavailable';end if;
 for frame in select id from public.dump_items where dump_id=d loop
  perform private.media_source_location(frame.id);
 end loop;
 insert into private.view_once_claims(dump_id,viewer_user_id,auth_session_id,attempt_id,binding_hash,lease_until)
 values(d,u,s,attempt,binding,clock_timestamp()+interval '120 seconds')
 on conflict(dump_id,viewer_user_id) do nothing returning * into c;
 fresh=found;
 if not fresh then
   select * into c from private.view_once_claims where dump_id=d and viewer_user_id=u for update;
   if c.closed_at is not null or c.lease_until<=clock_timestamp()
      or c.auth_session_id is distinct from s or c.attempt_id is distinct from attempt
      or c.binding_hash is distinct from binding then
     raise exception using errcode='42501',message='media_consumed'; end if;
 end if;
 -- Read-only compatibility status; no global archiving trigger remains.
 insert into public.dump_views(dump_id,user_id) values(d,u) on conflict do nothing;
 select jsonb_agg(jsonb_build_object('id',id,'position',position,'note',note) order by position)
 into frames from public.dump_items where dump_id=d;
 return jsonb_build_object('status',case when fresh then 'claimed' else 'recovered' end,
   'dump_id',d,'claim_id',c.claim_id,'lease_until',c.lease_until,'items',frames);
end $$;

create or replace function public.media_once_frame(p jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog set row_security=off as $$
declare u uuid=(p->>'viewer_id')::uuid; s uuid=(p->>'auth_session_id')::uuid;
 c private.view_once_claims%rowtype; result jsonb;
begin
 select * into c from private.view_once_claims where claim_id=(p->>'claim_id')::uuid for update;
 if not found or not private.media_actor_valid(u,s) or c.viewer_user_id<>u
 or c.auth_session_id is distinct from s or c.binding_hash is distinct from p->>'binding_hash'
 or c.closed_at is not null or c.lease_until<=clock_timestamp()
 or not private.media_post_visible(u,c.dump_id) then
   raise exception using errcode='42501',message='media_session_denied'; end if;
 if p->>'item_id' is not null then
   if not exists(select 1 from public.dump_items where dump_id=c.dump_id and id=(p->>'item_id')::uuid) then
    raise exception using errcode='42501',message='wrong_session_item';end if;
   result=private.media_source_location((p->>'item_id')::uuid)||jsonb_build_object('item_id',(p->>'item_id')::uuid);
 else result=jsonb_build_object('active',true); end if;
 update private.view_once_claims set lease_until=clock_timestamp()+interval '120 seconds'
 where claim_id=c.claim_id;
 return result;
end $$;
create or replace function public.media_save_photo(p jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog set row_security=off as $$
declare u uuid=(p->>'viewer_id')::uuid;d public.dumps%rowtype;i public.dump_items%rowtype;k private.photo_keeps%rowtype;
begin
 if not private.media_actor_valid(u,(p->>'auth_session_id')::uuid) then raise exception 'keep_forbidden';end if;
 select * into d from public.dumps where id=(p->>'dump_id')::uuid for update;
 select * into i from public.dump_items where dump_id=d.id and position=(p->>'item_position')::integer for update;
 if d.id is null or i.id is null or (p ? 'item_id' and i.id is distinct from (p->>'item_id')::uuid)
 or private.media_blocked(u,d.user_id) or d.expiry<>'24h' then raise exception 'keep_forbidden';end if;
 select * into k from private.photo_keeps where saver_id=u and source_item_id=i.id;
 if not found then
  if (d.user_id<>u and d.created_at<=clock_timestamp()-interval '24 hours') or not private.media_post_visible(u,d.id)
   or (d.user_id<>u and not d.allow_others_to_keep) then raise exception 'keep_forbidden';end if;
  perform private.media_source_location(i.id);
  insert into private.photo_keeps(saver_id,source_item_id,source_dump_id,source_author_id,saved_note)
  values(u,i.id,d.id,d.user_id,coalesce(i.note,'')) returning * into k;
 end if;
 if p->>'board_id' is not null then
  if not exists(select 1 from public.boards where id=(p->>'board_id')::uuid and user_id=u) then raise exception 'keep_forbidden';end if;
  insert into private.keep_board_memberships values(k.id,(p->>'board_id')::uuid) on conflict do nothing;
 end if;
 return to_jsonb(k);
end $$;
revoke all on function public.media_save_photo(jsonb) from public,anon,authenticated;
grant execute on function public.media_save_photo(jsonb) to service_role;

-- Preserve existing legacy archive provenance; new browser writes cannot retarget it.
revoke insert,update on public.flicd_archive_items from public,anon,authenticated;
revoke all on function private.media_source_location(uuid) from public,anon,authenticated;
revoke all on function public.media_claim_view_once(jsonb),public.media_once_frame(jsonb) from public,anon,authenticated;
grant execute on function public.media_claim_view_once(jsonb),public.media_once_frame(jsonb) to service_role;
create function public.media_account_block_status(p jsonb) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog set row_security=off as $$
declare u uuid=(p->>'viewer_id')::uuid;a uuid=(p->>'account_id')::uuid;
begin
 if not private.media_actor_valid(u,(p->>'auth_session_id')::uuid) or a is null then raise exception 'media_forbidden';end if;
 return jsonb_build_object('is_self',u=a,'blocked_by_me',exists(select 1 from private.account_blocks where blocker_id=u and blocked_id=a));
end $$;
create function public.media_set_account_block(p jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog set row_security=off as $$
declare u uuid=(p->>'viewer_id')::uuid;a uuid=(p->>'account_id')::uuid;
begin
 if not private.media_actor_valid(u,(p->>'auth_session_id')::uuid) or a is null or u=a
 or jsonb_typeof(p->'blocked') is distinct from 'boolean' then raise exception 'media_forbidden';end if;
 if (p->>'blocked')::boolean then
  insert into private.account_blocks values(u,a) on conflict do nothing;
 else delete from private.account_blocks where blocker_id=u and blocked_id=a;end if;
 return public.media_account_block_status(p);
end $$;
revoke all on function public.media_account_block_status(jsonb),public.media_set_account_block(jsonb) from public,anon,authenticated;
grant execute on function public.media_account_block_status(jsonb),public.media_set_account_block(jsonb) to service_role;

-- Existing permissive ordinary-media policies cannot bypass a bilateral block.
create function private.media_current_object_safe(b text,n text) returns boolean
language sql stable security definer set search_path=pg_catalog set row_security=off as $$
 select not exists(select 1 from private.media_account_restrictions r where r.user_id=auth.uid() and r.suspended)
 and not exists(select 1 from public.dump_items i join public.dumps d on d.id=i.dump_id
  where i.media_bucket=b and i.image_path=n and (not private.media_post_visible(auth.uid(),d.id)
   or (d.expiry='24h' and d.user_id<>auth.uid() and d.created_at<=clock_timestamp()-interval '24 hours')))
 and not exists(select 1 from public.flicd_archive_items a join public.dumps d on d.id=a.dump_id
  where b='flicd-archive' and a.archive_path=n and (a.user_id is distinct from auth.uid() or private.media_blocked(auth.uid(),d.user_id)))
 and (b not in('flicd-dump-private','flicd-archive','flicd-keeps-private')
  or split_part(n,'/',1)=auth.uid()::text
  or exists(select 1 from public.dump_items i where i.media_bucket=b and i.image_path=n))
$$;
revoke all on function private.media_current_object_safe(text,text) from public,anon;
grant execute on function private.media_current_object_safe(text,text) to authenticated;
create policy "Bilateral media blocks limit every signed original" on storage.objects
as restrictive for select to authenticated using(private.media_current_object_safe(bucket_id,name));
-- A posted source's bytes must not be replaceable behind canonical entitlements.
-- Deleting the DB source runs revocation/outbox first; only the trusted worker
-- removes the associated object. Unassociated uploads retain ordinary cleanup.
create function private.media_bound_source_object(b text,n text) returns boolean
language sql stable security definer set search_path=pg_catalog set row_security=off as $$
 select exists(select 1 from public.dump_items i where i.media_bucket=b and i.image_path=n)
 or exists(select 1 from public.flicd_archive_items a where b='flicd-archive' and a.archive_path=n)
$$;
revoke all on function private.media_bound_source_object(text,text) from public,anon;
grant execute on function private.media_bound_source_object(text,text) to authenticated;
create policy "Posted original bytes cannot be browser replaced" on storage.objects
as restrictive for update to authenticated
using(not private.media_bound_source_object(bucket_id,name)) with check(not private.media_bound_source_object(bucket_id,name));
create policy "Source revocation precedes object removal" on storage.objects
as restrictive for delete to authenticated using(not private.media_bound_source_object(bucket_id,name));
-- Old permissive policies combine with OR. An anonymous grant must never open
-- private media or permit an unauthenticated overwrite behind an entitlement.
create policy "Anonymous policies cannot open private media" on storage.objects
as restrictive for all to anon
using(bucket_id not in('flicd-dump-private','flicd-archive','flicd-keeps-private'))
with check(bucket_id not in('flicd-dump-private','flicd-archive','flicd-keeps-private'));
create policy "Private object inserts remain owner scoped under policy overlap" on storage.objects
as restrictive for insert to authenticated with check(bucket_id not in('flicd-dump-private','flicd-archive','flicd-keeps-private') or split_part(name,'/',1)=auth.uid()::text);
create policy "Private object updates remain owner scoped under policy overlap" on storage.objects
as restrictive for update to authenticated
using(bucket_id not in('flicd-dump-private','flicd-archive','flicd-keeps-private') or split_part(name,'/',1)=auth.uid()::text)
with check(bucket_id not in('flicd-dump-private','flicd-archive','flicd-keeps-private') or split_part(name,'/',1)=auth.uid()::text);
create policy "Private object deletes remain owner scoped under policy overlap" on storage.objects
as restrictive for delete to authenticated using(bucket_id not in('flicd-dump-private','flicd-archive','flicd-keeps-private') or split_part(name,'/',1)=auth.uid()::text);
commit;
