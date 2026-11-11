-- LOCAL REVIEW DRAFT: canonical library contract and conservative legacy recovery.
-- No Storage IO or destructive legacy cleanup. Backfill is an explicit service job.
begin;
do $$ begin
 if not exists(select 1 from public.__flicd_staging_marker where label='SYNTHETIC_STAGING_ONLY') then raise exception 'Synthetic staging marker required'; end if;
end $$;
-- Independent preserved records survive Board deletion. Capture stable source ID
-- now; never retarget a legacy grant if a deleted position is later reused.
create table private.legacy_saved_records(
 id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,
 board_id uuid references public.boards(id) on delete set null,
 dump_id uuid references public.dumps(id) on delete cascade,
 source_item_id uuid references public.dump_items(id) on delete cascade,
 item_position integer,note text,created_at timestamptz,
 snapshot_bucket text,snapshot_path text
);
alter table private.legacy_saved_records enable row level security;
revoke all on private.legacy_saved_records from public,anon,authenticated;
create function private.media_preserve_legacy_records() returns void
language sql security definer set search_path=pg_catalog set row_security=off as $$
 insert into private.legacy_saved_records
 select b.id,b.user_id,case when board.user_id=b.user_id then b.board_id else null end,
 b.dump_id,i.id,b.item_position,b.note,b.created_at,b.snapshot_bucket,b.saved_image_path
 from public.board_items b left join public.boards board on board.id=b.board_id
 left join public.dump_items i on i.dump_id=b.dump_id and i.position=b.item_position
 on conflict(id) do nothing
$$;
revoke all on function private.media_preserve_legacy_records() from public,anon,authenticated;
select private.media_preserve_legacy_records();

create table private.legacy_keep_reviews(
 legacy_item_id uuid primary key references private.legacy_saved_records(id) on delete cascade,
 source_item_id uuid not null references public.dump_items(id) on delete cascade,
 saver_id uuid not null references auth.users(id) on delete cascade,
 reviewed_by uuid not null references auth.users(id),
 evidence_reference text not null check(length(trim(evidence_reference))>0),
 reviewed_at timestamptz not null default clock_timestamp()
);
create table private.legacy_keep_migrations(
 legacy_item_id uuid primary key references private.legacy_saved_records(id) on delete cascade,
 keep_id uuid references private.photo_keeps(id) on delete set null,
 migrated_at timestamptz not null default clock_timestamp()
);
alter table private.legacy_keep_reviews enable row level security;
alter table private.legacy_keep_migrations enable row level security;
revoke all on private.legacy_keep_reviews,private.legacy_keep_migrations from public,anon,authenticated;
-- Legacy records are preserved, not offered as raw snapshot/signing capabilities.
revoke select,delete on public.board_items from public,anon,authenticated;

create function public.media_backfill_legacy_keeps(p jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog set row_security=off as $$
declare b private.legacy_saved_records%rowtype;d public.dumps%rowtype;i public.dump_items%rowtype;k uuid;n integer=0;
begin
 perform private.media_preserve_legacy_records();
 for b in select * from private.legacy_saved_records order by id for update loop
  if exists(select 1 from private.legacy_keep_migrations m where m.legacy_item_id=b.id) then continue;end if;
  select * into d from public.dumps where id=b.dump_id for update;
  select * into i from public.dump_items where id=b.source_item_id and dump_id=d.id and position=b.item_position for update;
  if d.id is null or i.id is null or d.expiry<>'24h'
   or (b.board_id is not null and not exists(select 1 from public.boards where id=b.board_id and user_id=b.user_id)) then continue;end if;
  -- Historical browser-writable rows/username snapshots do NOT prove opt-in.
  -- Owners need no opt-in; every other legacy grant needs separately audited evidence.
  if d.user_id<>b.user_id and not exists(select 1 from private.legacy_keep_reviews r
    where r.legacy_item_id=b.id and r.source_item_id=i.id and r.saver_id=b.user_id) then continue;end if;
  begin
   perform private.media_source_location(i.id);
  exception when raise_exception then
   if sqlerrm='media_unavailable' then continue;else raise;end if;
  end;
  insert into private.photo_keeps(saver_id,source_item_id,source_dump_id,source_author_id,saved_note,saved_at)
  values(b.user_id,i.id,d.id,d.user_id,coalesce(b.note,''),coalesce(b.created_at,clock_timestamp()))
  on conflict(saver_id,source_item_id) do update set saver_id=excluded.saver_id returning id into k;
  if b.board_id is not null then insert into private.keep_board_memberships values(k,b.board_id) on conflict do nothing;end if;
  insert into private.legacy_keep_migrations(legacy_item_id,keep_id) values(b.id,k);
  n=n+1;
 end loop;
 return jsonb_build_object('imported',n);
end $$;
revoke all on function public.media_backfill_legacy_keeps(jsonb) from public,anon,authenticated;
grant execute on function public.media_backfill_legacy_keeps(jsonb) to service_role;

create or replace function public.media_list_keeps(p jsonb) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog set row_security=off as $$
declare u uuid=(p->>'viewer_id')::uuid;result jsonb;legacy jsonb;
begin
 if not private.media_actor_valid(u,(p->>'auth_session_id')::uuid) then raise exception 'keep_forbidden';end if;
 select coalesce(jsonb_agg(to_jsonb(k)||jsonb_build_object('source_username',profile.username,
  'item_position',i.position,'is_own_photo',k.source_author_id=u,
  'board_ids',coalesce((select jsonb_agg(m.board_id order by m.board_id) from private.keep_board_memberships m where m.keep_id=k.id),'[]'::jsonb)) order by k.saved_at desc),'[]'::jsonb)
 into result from private.photo_keeps k join public.dump_items i on i.id=k.source_item_id
 left join public.profiles profile on profile.id=k.source_author_id
 where k.saver_id=u and not private.media_blocked(u,k.source_author_id);
 select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'legacy_status',
  case when d.id is null then 'source_unverified' when d.expiry='once' then 'view_once_disallowed' else 'needs_review' end,
  'saved_note',coalesce(b.note,''),'saved_at',b.created_at,
  'board_ids',case when exists(select 1 from public.boards where id=b.board_id and user_id=u) then jsonb_build_array(b.board_id) else '[]'::jsonb end)
  order by b.created_at desc),'[]'::jsonb)
 into legacy from private.legacy_saved_records b left join public.dumps d on d.id=b.dump_id
 where b.user_id=u and not exists(select 1 from private.legacy_keep_migrations m where m.legacy_item_id=b.id)
 and (d.id is null or not private.media_blocked(u,d.user_id));
 return result||legacy;
end $$;
revoke all on function public.media_list_keeps(jsonb) from public,anon,authenticated;
grant execute on function public.media_list_keeps(jsonb) to service_role;

-- Preserved snapshot inventory still schedules cleanup if its old Board is gone.
create function private.media_delete_legacy_record() returns trigger
language plpgsql security definer set search_path=pg_catalog set row_security=off as $$
begin
 if old.snapshot_bucket in('flicd-media','flicd-archive')
 and starts_with(old.snapshot_path,old.user_id::text||'/boards/')
 and old.snapshot_path !~ '(^|/)\.\.?(/|$)' then
  insert into private.media_cleanup_jobs(bucket_id,name) values(old.snapshot_bucket,old.snapshot_path) on conflict do nothing;
 end if;
 return old;
end $$;
revoke all on function private.media_delete_legacy_record() from public,anon,authenticated;
create trigger managed_legacy_record_delete before delete on private.legacy_saved_records
for each row execute function private.media_delete_legacy_record();
commit;
