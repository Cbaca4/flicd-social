-- This script is executed only against the ephemeral CI PostgreSQL container.
-- All users, rows, and objects in bootstrap.sql are synthetic.
\set ON_ERROR_STOP on

-- Simulate newly uploaded private media after applying the migration.
update public.dump_items set media_bucket='flicd-dump-private';
insert into storage.objects(bucket_id,name) values
('flicd-dump-private','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/active.jpg'),
('flicd-dump-private','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/once.jpg'),
('flicd-dump-private','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/expired.jpg');

-- 1) Ownership and negative authorization for unapproved user Carol.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','cccccccc-cccc-cccc-cccc-cccccccccccc',true);
do $$
declare n integer;
begin
  select count(*) into n from public.dump_items;
  if n <> 0 then raise exception 'Unapproved user can read % private Dump items',n; end if;
  select count(*) into n from storage.objects where bucket_id='flicd-dump-private';
  if n <> 0 then raise exception 'Unapproved user can read % private Storage entries',n; end if;
  select count(*) into n from public.messages;
  if n <> 0 then raise exception 'Unapproved user can read a private message'; end if;

  if private.is_authenticated_conversation_member(
    'ffffffff-ffff-ffff-ffff-fffffffffff1'
  ) then raise exception 'Unrelated user passed private membership helper'; end if;
  if has_function_privilege('authenticated','public.is_conversation_participant(uuid,uuid)','EXECUTE')
  then raise exception 'Privileged membership helper remains exposed as public RPC'; end if;

  begin
    insert into public.conversation_participants(conversation_id,user_id) values
      ('ffffffff-ffff-ffff-ffff-fffffffffff1','cccccccc-cccc-cccc-cccc-cccccccccccc');
    raise exception 'Unapproved self-enrollment was allowed';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.conversations(created_by) values
      ('cccccccc-cccc-cccc-cccc-cccccccccccc');
    raise exception 'Unapproved direct conversation creation was allowed';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.dump_items(id,dump_id,image_path,media_bucket) values
      ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee04',
       'dddddddd-dddd-dddd-dddd-dddddddddd01',
       'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/spoofed.jpg',
       'flicd-dump-private');
    raise exception 'Unapproved private Dump path insertion was allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;

-- 2) Accepted follower Bob sees active posts, not expired posts.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',true);
do $$
declare n integer;
begin
  select count(*) into n from public.dump_items;
  if n <> 2 then raise exception 'Follower should see active and once, got % items',n; end if;
  select count(*) into n from storage.objects where bucket_id='flicd-dump-private';
  if n <> 2 then raise exception 'Follower should see two private Storage entries, got %',n; end if;
  select count(*) into n from public.messages;
  if n <> 1 then raise exception 'Participant Bob should see a conversation message'; end if;
  if not private.is_authenticated_conversation_member(
    'ffffffff-ffff-ffff-ffff-fffffffffff1'
  ) then raise exception 'Helper denied genuine participant Bob'; end if;
end $$;
rollback;

-- 3) Simulate view-once consumption and ensure future reads are denied.
insert into public.dump_views(dump_id,user_id) values
 ('dddddddd-dddd-dddd-dddd-dddddddddd02','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
update public.dumps set once_viewed_at=now()
where id='dddddddd-dddd-dddd-dddd-dddddddddd02';

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',true);
do $$
declare n integer;
begin
  select count(*) into n from public.dump_items;
  if n <> 1 then raise exception 'Consumed once Dump should disappear, got %',n; end if;
  select count(*) into n from storage.objects where bucket_id='flicd-dump-private';
  if n <> 1 then raise exception 'Consumed once object is still readable, got %',n; end if;
end $$;
rollback;

-- 4) The owner still has access needed to complete the archive.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',true);
do $$
declare n integer;
begin
  select count(*) into n from public.dump_items;
  if n <> 3 then raise exception 'Owner lost old/expired media needed for archive, got %',n; end if;
  select count(*) into n from storage.objects where bucket_id='flicd-dump-private';
  if n <> 3 then raise exception 'Owner cannot archive all private objects, got %',n; end if;
end $$;
rollback;

-- 5) Accepted request must continue creating two genuine DM members.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',true);
update public.message_requests set status='accepted'
where sender_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  and recipient_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  and status='pending';
commit;
do $$
declare n integer;
begin
  select count(*) into n from public.conversations
  where created_by='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  if n <> 1 then raise exception 'Request trigger failed to create conversation, count %',n; end if;
  select count(*) into n from public.conversation_participants cp
  join public.conversations c on c.id=cp.conversation_id
  where c.created_by='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  if n <> 2 then raise exception 'Request trigger did not create exactly two legitimate members, got %',n; end if;
end $$;
\echo 'PASS: synthetic database RLS tests for private Dump media, view-once, DM and requests'

-- 6) Strict column privileges prevent a recipient from impersonating the
-- sender while accepting a message request.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',true);
do $$
begin
  if has_column_privilege('authenticated','public.message_requests','sender_id','UPDATE')
     or has_column_privilege('authenticated','public.message_requests','recipient_id','UPDATE') then
    raise exception 'Request sender/recipient fields are writable by authenticated clients';
  end if;
  if not has_column_privilege('authenticated','public.message_requests','status','UPDATE') then
    raise exception 'Legitimate recipients cannot accept their message requests';
  end if;
  begin
    update public.message_requests
    set sender_id='cccccccc-cccc-cccc-cccc-cccccccccccc',status='accepted'
    where recipient_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
      and status='pending';
    raise exception 'SECURITY_FAIL: recipient forged message request sender';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
\echo 'PASS: authenticated client cannot rewrite request identities'

-- Keep the actual tracked RPC definitions and their authorization regression
-- matrix in this existing disposable-PostgreSQL CI entrypoint. No hosted keys.
\ir ../../supabase/migrations/20260918030000_add_post_locations_tags_notifications.sql
\ir profile-relationship-rpc.assertions.sql
