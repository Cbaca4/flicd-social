-- Executed in the same transaction as staging-integration-dependencies.sql.
-- All identities and content below are generated synthetic fixtures, rolled back.
create temporary table staging_verification_ids as select
  gen_random_uuid() as owner_id, gen_random_uuid() as other_id,
  gen_random_uuid() as dump_id, gen_random_uuid() as board_id;
grant select on staging_verification_ids to authenticated;
insert into auth.users(id) select owner_id from staging_verification_ids union all select other_id from staging_verification_ids;
insert into public.profiles(id,username,is_private)
  select owner_id,'sql_owner_'||owner_id::text,true from staging_verification_ids
  union all select other_id,'sql_other_'||other_id::text,true from staging_verification_ids;
insert into public.dumps(id,user_id,expiry)
  select dump_id,owner_id,'24h' from staging_verification_ids;

set local role authenticated;
select set_config('request.jwt.claim.sub',(select owner_id::text from staging_verification_ids),true);
insert into public.boards(id,user_id,name)
  select board_id,owner_id,'Synthetic role rehearsal' from staging_verification_ids;
insert into public.board_items(user_id,board_id,dump_id,saved_image_path,snapshot_bucket)
  select owner_id,board_id,dump_id,owner_id::text||'/boards/dummy.png','flicd-archive' from staging_verification_ids;
insert into public.flicd_archive(user_id,dump_id,reason)
  select owner_id,dump_id,'24h_expired' from staging_verification_ids;
insert into public.flicd_archive(user_id,dump_id,reason)
  select owner_id,dump_id,'24h_expired' from staging_verification_ids
  on conflict(user_id,dump_id) do update set reason=excluded.reason;
insert into public.message_requests(sender_id,recipient_id)
  select owner_id,other_id from staging_verification_ids;

do $$
begin
  begin
    insert into public.boards(user_id,name) select other_id,'Forged' from staging_verification_ids;
    raise exception 'SECURITY_FAIL: board ownership forgery succeeded';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.message_requests(sender_id,recipient_id)
      select other_id,owner_id from staging_verification_ids;
    raise exception 'SECURITY_FAIL: request sender forgery succeeded';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub',(select other_id::text from staging_verification_ids),true);
do $$
begin
  if exists(select 1 from public.boards where id=(select board_id from staging_verification_ids)) then
    raise exception 'SECURITY_FAIL: unrelated user read private board';
  end if;
  if exists(select 1 from public.board_items where board_id=(select board_id from staging_verification_ids)) then
    raise exception 'SECURITY_FAIL: unrelated user read private snapshot';
  end if;
  if exists(select 1 from public.flicd_archive where dump_id=(select dump_id from staging_verification_ids)) then
    raise exception 'SECURITY_FAIL: unrelated user read archive';
  end if;
  begin
    insert into public.board_items(user_id,board_id,snapshot_bucket)
      select other_id,board_id,'flicd-archive' from staging_verification_ids;
    raise exception 'SECURITY_FAIL: snapshot attached to another owner board';
  exception when insufficient_privilege then null; end;
  begin
    update public.message_requests set sender_id=(select other_id from staging_verification_ids)
      where recipient_id=(select other_id from staging_verification_ids);
    raise exception 'SECURITY_FAIL: recipient rewrote sender';
  exception when insufficient_privilege then null; end;
end $$;
update public.message_requests set status='accepted'
  where sender_id=(select owner_id from staging_verification_ids)
    and recipient_id=(select other_id from staging_verification_ids);
reset role;
do $$
declare members integer;
begin
  select count(*) into members from public.conversation_participants
    where user_id in (select owner_id from staging_verification_ids union all select other_id from staging_verification_ids);
  if members<>2 then raise exception 'Acceptance should create exactly two participants, got %',members; end if;
end $$;
select 'PASS: owner writes, archive upsert, unauthorized Board/archive denial, request identity integrity, legitimate two-member acceptance' as result;
