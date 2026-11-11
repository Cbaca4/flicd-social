-- LOCAL REVIEW DRAFT. Never apply to hosted staging without operator approval.
-- Requires the separately approved synthetic staging marker. No media is copied/deleted.
begin;
do $$ begin
  if not exists(select 1 from public.__flicd_staging_marker where label='SYNTHETIC_STAGING_ONLY')
     or to_regclass('auth.sessions') is null then
    raise exception 'Synthetic staging marker and Auth sessions required';
  end if;
end $$;
create schema if not exists private;
revoke create on schema public from public,anon,authenticated;
create table private.account_blocks(
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  primary key(blocker_id,blocked_id),check(blocker_id<>blocked_id)
);
create table private.media_account_restrictions(
  user_id uuid primary key references auth.users(id) on delete cascade,
  suspended boolean not null default false
);
create table private.view_once_claims(
  dump_id uuid not null references public.dumps(id) on delete cascade,
  viewer_user_id uuid not null references auth.users(id) on delete cascade,
  claim_id uuid not null unique default gen_random_uuid(),
  auth_session_id uuid,
  attempt_id uuid,
  binding_hash text,
  claimed_at timestamptz not null default clock_timestamp(),
  lease_until timestamptz not null,
  closed_at timestamptz,
  primary key(dump_id,viewer_user_id),
  check(binding_hash is null or binding_hash ~ '^[0-9a-f]{64}$')
);
alter table private.account_blocks enable row level security;
alter table private.media_account_restrictions enable row level security;
alter table private.view_once_claims enable row level security;
revoke all on private.account_blocks,private.media_account_restrictions,private.view_once_claims from public,anon,authenticated;
-- Preserve only known per-user historical consumption. Global timestamps do not consume others.
insert into private.view_once_claims(dump_id,viewer_user_id,lease_until,closed_at)
select v.dump_id,v.user_id,'-infinity',clock_timestamp() from public.dump_views v
join public.dumps d on d.id=v.dump_id where d.expiry='once'
on conflict do nothing;
drop trigger if exists dump_views_archive_once on public.dump_views;
revoke insert,update,delete on public.dump_views from public,anon,authenticated;

create function private.media_actor_valid(p_user uuid,p_session uuid) returns boolean
language sql stable security definer set search_path=pg_catalog set row_security=off as $$
 select p_user is not null and p_session is not null
 and exists(select 1 from auth.sessions s where s.id=p_session and s.user_id=p_user)
 and not exists(select 1 from private.media_account_restrictions r where r.user_id=p_user and r.suspended)
$$;
create function private.media_blocked(p_a uuid,p_b uuid) returns boolean
language sql stable security definer set search_path=pg_catalog set row_security=off as $$
 select exists(select 1 from private.account_blocks b where
 (b.blocker_id=p_a and b.blocked_id=p_b) or (b.blocker_id=p_b and b.blocked_id=p_a))
$$;
create function private.media_post_visible(p_user uuid,p_dump uuid) returns boolean
language sql stable security definer set search_path=pg_catalog set row_security=off as $$
 select p_user is not null and exists(select 1 from auth.users where id=p_user)
 and exists(select 1 from public.dumps d join public.profiles p on p.id=d.user_id
 where d.id=p_dump and not private.media_blocked(p_user,d.user_id)
 and (d.user_id=p_user or not p.is_private or exists(select 1 from public.follows f
 where f.follower_id=p_user and f.following_id=d.user_id and f.status='accepted')))
$$;
create function private.media_current_post_visible(p_dump uuid) returns boolean
language sql stable security definer set search_path=pg_catalog set row_security=off as $$
 select private.media_post_visible(auth.uid(),p_dump)
$$;
revoke all on function private.media_actor_valid(uuid,uuid),private.media_blocked(uuid,uuid),
 private.media_post_visible(uuid,uuid),private.media_current_post_visible(uuid) from public,anon,authenticated;
grant execute on function private.media_current_post_visible(uuid) to authenticated;
grant usage on schema private to authenticated,service_role;
create policy "Media account safety limits existing post visibility" on public.dumps
as restrictive for select to authenticated using(private.media_current_post_visible(id));
create policy "Once item paths require trusted delivery" on public.dump_items
as restrictive for select to authenticated using(exists(select 1 from public.dumps d
 where d.id=dump_items.dump_id and d.expiry<>'once'));

-- Old Keep paths must remain protected even after a legacy Board row is removed.
create table private.legacy_keep_objects(bucket_id text not null,name text not null,primary key(bucket_id,name));
insert into private.legacy_keep_objects
select distinct coalesce(snapshot_bucket,'flicd-media'),saved_image_path from public.board_items
where saved_image_path is not null on conflict do nothing;
alter table private.legacy_keep_objects enable row level security;
revoke all on private.legacy_keep_objects from public,anon,authenticated;
create function private.media_protected_object(p_bucket text,p_name text) returns boolean
language sql stable security definer set search_path=pg_catalog set row_security=off as $$
 select p_bucket='flicd-keeps-private'
 or (p_bucket='flicd-archive' and split_part(p_name,'/',2)='boards')
 or exists(select 1 from private.legacy_keep_objects x where x.bucket_id=p_bucket and x.name=p_name)
 or exists(select 1 from public.dump_items i join public.dumps d on d.id=i.dump_id
 where d.expiry='once' and i.media_bucket=p_bucket and i.image_path=p_name)
 or exists(select 1 from public.flicd_archive_items a join public.dumps d on d.id=a.dump_id
 where d.expiry='once' and p_bucket='flicd-archive' and a.archive_path=p_name)
$$;
revoke all on function private.media_protected_object(text,text) from public,anon;
grant execute on function private.media_protected_object(text,text) to authenticated;
create policy "Protected media cannot be signed or downloaded directly" on storage.objects
as restrictive for select to authenticated using(not private.media_protected_object(bucket_id,name));
create policy "Protected originals are not browser mutable" on storage.objects
as restrictive for update to authenticated
using(not private.media_protected_object(bucket_id,name)) with check(not private.media_protected_object(bucket_id,name));
create policy "Protected originals are not browser removable" on storage.objects
as restrictive for delete to authenticated using(not private.media_protected_object(bucket_id,name));

create function public.media_claim_view_once(p jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog set row_security=off as $$
declare
 u uuid=(p->>'viewer_id')::uuid; s uuid=(p->>'auth_session_id')::uuid;
 d uuid=(p->>'dump_id')::uuid; attempt uuid=(p->>'attempt_id')::uuid;
 binding text=p->>'binding_hash'; expiry_mode text; c private.view_once_claims%rowtype;
 fresh boolean=false; frames jsonb;
begin
 if not private.media_actor_valid(u,s) or not private.media_post_visible(u,d) then
   raise exception using errcode='42501',message='media_forbidden'; end if;
 if attempt is null or binding is null or binding !~ '^[0-9a-f]{64}$' then
   raise exception using errcode='22023',message='invalid_page_binding'; end if;
 select expiry into expiry_mode from public.dumps where id=d for key share;
 if expiry_mode is distinct from 'once' then raise exception 'not_view_once'; end if;
 if not exists(select 1 from public.dump_items where dump_id=d)
 or exists(select 1 from public.dump_items i join public.dumps source on source.id=i.dump_id
 where i.dump_id=d and (i.media_bucket<>'flicd-dump-private' or i.image_path is null
 or split_part(i.image_path,'/',1)<>source.user_id::text
 or not exists(select 1 from storage.objects o where o.bucket_id=i.media_bucket and o.name=i.image_path))) then
   raise exception 'media_unavailable'; end if;
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

create function public.media_once_frame(p jsonb) returns jsonb
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
   select jsonb_build_object('bucket',i.media_bucket,'path',i.image_path,'item_id',i.id)
   into result from public.dump_items i where i.dump_id=c.dump_id and i.id=(p->>'item_id')::uuid;
   if result is null then raise exception using errcode='42501',message='wrong_session_item'; end if;
 else result=jsonb_build_object('active',true); end if;
 update private.view_once_claims set lease_until=clock_timestamp()+interval '120 seconds'
 where claim_id=c.claim_id;
 return result;
end $$;
create function public.media_close_view_once(p jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog set row_security=off as $$
declare u uuid=(p->>'viewer_id')::uuid; s uuid=(p->>'auth_session_id')::uuid;
begin
 if not private.media_actor_valid(u,s) then raise exception using errcode='42501',message='media_forbidden'; end if;
 update private.view_once_claims set closed_at=coalesce(closed_at,clock_timestamp())
 where claim_id=(p->>'claim_id')::uuid and viewer_user_id=u and auth_session_id=s
 and binding_hash=p->>'binding_hash';
 if not found then raise exception using errcode='42501',message='media_session_denied'; end if;
 return jsonb_build_object('closed',true);
end $$;
create function public.media_post_metadata(p jsonb) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog set row_security=off as $$
declare u uuid=(p->>'viewer_id')::uuid; s uuid=(p->>'auth_session_id')::uuid; d uuid=(p->>'dump_id')::uuid;
 result jsonb;
begin
 if not private.media_actor_valid(u,s) or not private.media_post_visible(u,d) then
   raise exception using errcode='42501',message='media_forbidden'; end if;
 select jsonb_build_object('id',source.id,'user_id',source.user_id,'expiry',source.expiry,
 'context',source.context,'created_at',source.created_at,'type',source.type,'mood',source.mood,
 'allow_others_to_keep',source.allow_others_to_keep,
 'viewed',exists(select 1 from private.view_once_claims c where c.dump_id=d and c.viewer_user_id=u),
 'dump_items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'position',i.position,'note',i.note)
 order by i.position) from public.dump_items i where i.dump_id=d),'[]'::jsonb))
 into result from public.dumps source where id=d;
 return result;
end $$;
revoke all on function public.media_claim_view_once(jsonb),public.media_once_frame(jsonb),
 public.media_close_view_once(jsonb),public.media_post_metadata(jsonb) from public,anon,authenticated;
grant execute on function public.media_claim_view_once(jsonb),public.media_once_frame(jsonb),
 public.media_close_view_once(jsonb),public.media_post_metadata(jsonb) to service_role;
comment on table private.view_once_claims is 'Permanent per-account consumption; 120s renewable transport lease is NOT a post expiration or reset.';
commit;
