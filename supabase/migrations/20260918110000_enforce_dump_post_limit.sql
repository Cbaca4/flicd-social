create index if not exists dumps_user_created_at_idx
  on public.dumps (user_id, created_at desc);

create or replace function private.enforce_dump_post_limit()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  recent_post_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));

  select count(*)::integer
    into recent_post_count
  from public.dumps
  where user_id = new.user_id
    and created_at > now() - interval '24 hours';

  if recent_post_count >= 3 then
    raise exception using
      errcode = 'P0001',
      message = 'You can post up to 3 Flic''d posts every 24 hours.',
      detail = 'POST_LIMIT_REACHED';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_dump_post_limit on public.dumps;

create trigger enforce_dump_post_limit
before insert on public.dumps
for each row
execute function private.enforce_dump_post_limit();
