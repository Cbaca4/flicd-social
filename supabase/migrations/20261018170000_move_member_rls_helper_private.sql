-- Keep membership recursion helper in an unexposed schema and never accept
-- a caller-provided user identity. Access is always scoped to auth.uid().
begin;
create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.is_authenticated_conversation_member(p_conversation_id uuid)
returns boolean
language sql stable security definer
set search_path=public,pg_catalog
set row_security=off
as $fn$
  select (select auth.uid()) is not null
  and exists(
    select 1 from public.conversation_participants cp
    where cp.conversation_id=p_conversation_id
    and cp.user_id=(select auth.uid())
  );
$fn$;

revoke execute on function private.is_authenticated_conversation_member(uuid)
from public,anon;
grant execute on function private.is_authenticated_conversation_member(uuid)
to authenticated;

drop policy if exists "Participants can view participant rows"
on public.conversation_participants;
create policy "Participants can view participant rows"
on public.conversation_participants
for select to authenticated
using (private.is_authenticated_conversation_member(conversation_id));

-- No longer expose a SECURITY DEFINER RPC accepting arbitrary identity input.
revoke execute on function public.is_conversation_participant(uuid,uuid)
from public,anon,authenticated;
commit;
