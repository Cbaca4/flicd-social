-- Staging-reviewed DM request integrity: the recipient may only change status.
-- The accepted-request trigger must not be tricked into adding a different sender.
begin;

revoke update on public.message_requests from public, anon, authenticated;
grant update(status, responded_at) on public.message_requests to authenticated;

create or replace function private.enforce_message_request_transition()
returns trigger
language plpgsql security invoker
set search_path = pg_catalog, public
as $func$
begin
  if old.sender_id is distinct from new.sender_id
     or old.recipient_id is distinct from new.recipient_id
     or old.created_at is distinct from new.created_at then
    raise exception 'Message request identities cannot be changed'
      using errcode = '42501';
  end if;
  if old.status <> 'pending' or new.status not in ('accepted','declined') then
    raise exception 'Message request cannot be transitioned from its current status'
      using errcode = '42501';
  end if;
  new.responded_at := now();
  return new;
end;
$func$;

revoke all on function private.enforce_message_request_transition() from public, anon, authenticated;
drop trigger if exists enforce_message_request_transition on public.message_requests;
create trigger enforce_message_request_transition
before update on public.message_requests
for each row execute function private.enforce_message_request_transition();

commit;
