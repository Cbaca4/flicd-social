-- Disposable CI PostgreSQL only. Exercises the actual tracked RPC definitions.
-- Never run this fixture against hosted projects. Every fixture change rolls back.
\set ON_ERROR_STOP on
begin;

update public.profiles set username=case id
  when 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid then 'private_owner'
  when 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid then 'public_bob'
  else 'public_carol' end;
insert into public.follows(follower_id,following_id,status) values
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','accepted'),
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','cccccccc-cccc-cccc-cccc-cccccccccccc','accepted'),
 ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','cccccccc-cccc-cccc-cccc-cccccccccccc','accepted'),
 ('cccccccc-cccc-cccc-cccc-cccccccccccc','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','pending'),
 ('cccccccc-cccc-cccc-cccc-cccccccccccc','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','pending');

-- Match the restricted relationship visibility the definer RPC intentionally bypasses.
alter table public.follows enable row level security;
create policy "RPC test direct relationship visibility" on public.follows for select to authenticated
using(follower_id=auth.uid() or following_id=auth.uid());

do $$
declare valid_functions integer;
begin
  select count(*) into valid_functions from pg_proc p
  where p.oid in ('public.get_profile_followers(uuid)'::regprocedure,
                  'public.get_profile_following(uuid)'::regprocedure)
    and p.prosecdef and p.pronargs=1
    and p.proconfig @> array['search_path=public, pg_catalog']
    and has_function_privilege('authenticated',p.oid,'EXECUTE')
    and not has_function_privilege('anon',p.oid,'EXECUTE');
  if valid_functions<>2 then raise exception 'RPC definer/search-path/signature/EXECUTE contract changed'; end if;
  if has_schema_privilege('authenticated','public','CREATE') then
    raise exception 'Authenticated callers can create public objects used by definer RPCs';
  end if;
end $$;
\echo 'PASS: both RPCs have pinned paths, a single target argument, authenticated EXECUTE and no anonymous EXECUTE'

-- SECURITY INVOKER: the test helper cannot add privileges to the caller.
create function private.assert_profile_relationship_lists(target uuid, followers uuid[], following uuid[])
returns void language plpgsql security invoker set search_path=pg_catalog,public
as $$
declare actual_followers uuid[]; actual_following uuid[];
begin
  select coalesce(array_agg(r.id order by r.id),'{}'::uuid[]) into actual_followers
    from public.get_profile_followers(target) r;
  select coalesce(array_agg(r.id order by r.id),'{}'::uuid[]) into actual_following
    from public.get_profile_following(target) r;
  if actual_followers is distinct from followers or actual_following is distinct from following then
    raise exception 'RPC authorization/result mismatch for caller % and target %',auth.uid(),target;
  end if;
end $$;
grant execute on function private.assert_profile_relationship_lists(uuid,uuid[],uuid[]) to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',true);
select private.assert_profile_relationship_lists('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  array['bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb']::uuid[],
  array['bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','cccccccc-cccc-cccc-cccc-cccccccccccc']::uuid[]);
\echo 'PASS: private target owner sees both complete accepted-only lists'

select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',true);
do $$ begin
  if exists(select 1 from public.follows where follower_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
       and following_id='cccccccc-cccc-cccc-cccc-cccccccccccc') then
    raise exception 'Fixture did not enforce direct follows RLS for Bob';
  end if;
end $$;
select private.assert_profile_relationship_lists('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  array['bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb']::uuid[],
  array['bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','cccccccc-cccc-cccc-cccc-cccccccccccc']::uuid[]);
\echo 'PASS: approved follower receives authorized lists despite narrower direct-table RLS'

select set_config('request.jwt.claim.sub','cccccccc-cccc-cccc-cccc-cccccccccccc',true);
select private.assert_profile_relationship_lists('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','{}','{}');
select private.assert_profile_relationship_lists('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  array['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa']::uuid[],
  array['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','cccccccc-cccc-cccc-cccc-cccccccccccc']::uuid[]);
\echo 'PASS: pending viewer cannot read private lists; signed-in public-target access excludes pending relationships'

select private.assert_profile_relationship_lists(null,'{}','{}');
select private.assert_profile_relationship_lists('00000000-0000-0000-0000-000000000000','{}','{}');
select set_config('request.jwt.claim.sub','',true);
select private.assert_profile_relationship_lists('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','{}','{}');
\echo 'PASS: NULL/nonexistent targets and a missing caller identity do not expose private lists'

reset role;
create temporary table profiles (like public.profiles including all);
create temporary table follows (like public.follows including all);
insert into pg_temp.profiles(id,username,is_private) values
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','forged_public_target',false),
 ('cccccccc-cccc-cccc-cccc-cccccccccccc','forged_viewer',false);
insert into pg_temp.follows(follower_id,following_id,status) values
 ('cccccccc-cccc-cccc-cccc-cccccccccccc','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','accepted');
grant select on pg_temp.profiles,pg_temp.follows to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','cccccccc-cccc-cccc-cccc-cccccccccccc',true);
select private.assert_profile_relationship_lists('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','{}','{}');
\echo 'PASS: caller-created temporary tables cannot shadow the RPCs schema-qualified tables'

reset role;
delete from public.follows where follower_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  and following_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
set local role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',true);
select private.assert_profile_relationship_lists('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','{}','{}');
\echo 'PASS: revocation immediately denies both RPCs; the reverse follow does not confer access'

reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
  begin
    perform * from public.get_profile_followers('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    raise exception 'SECURITY_FAIL: anonymous follower-list execution succeeded';
  exception when insufficient_privilege then null; end;
  begin
    perform * from public.get_profile_following('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    raise exception 'SECURITY_FAIL: anonymous following-list execution succeeded';
  exception when insufficient_privilege then null; end;
end $$;
\echo 'PASS: anonymous execution is rejected for both RPCs even for a public target'
reset role;
rollback;
