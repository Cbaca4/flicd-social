-- Extends only the disposable local baseline. Never run against a hosted project.
do $$ begin
  if not exists(select 1 from pg_roles where rolname='service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;
create table auth.sessions(id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade);
alter table auth.sessions add column not_after timestamptz;
create table public.__flicd_staging_marker(label text not null);
insert into public.__flicd_staging_marker values('SYNTHETIC_STAGING_ONLY');
alter table public.dumps add column type text not null default 'dump',
  add column mood text not null default '', add column context text,
  add column frame_count integer, add column allow_others_to_keep boolean not null default false;
alter table public.dump_items add column note text not null default '';
create table public.boards(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),name text not null,pinned boolean not null default false);
alter table public.board_items add column board_id uuid references public.boards(id) on delete cascade,
  add column dump_id uuid references public.dumps(id) on delete set null,
  add column item_position integer not null default 0,
  add column note text not null default '',
  add column saved_author_username text,
  add column created_at timestamptz not null default clock_timestamp();
alter table public.boards enable row level security;
create policy local_owned_boards on public.boards for all to authenticated
  using(user_id=auth.uid()) with check(user_id=auth.uid());
grant select,insert,update,delete on public.boards to authenticated;
grant usage on schema public,auth,storage,private to service_role;
insert into auth.sessions values
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
 ('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
 ('22222222-2222-4222-8222-222222222223','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
 ('33333333-3333-4333-8333-333333333333','cccccccc-cccc-cccc-cccc-cccccccccccc');
