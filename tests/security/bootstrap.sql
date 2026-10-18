-- Disposable PostgreSQL 17 baseline. Fake principals only: NO live rows or secrets.
create schema if not exists auth;
create schema if not exists storage;
create schema if not exists private;
do $$
begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;
grant usage on schema public,auth,storage to authenticated;
grant usage on schema public,auth,storage to anon;

create or replace function auth.uid() returns uuid language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant execute on function auth.uid() to authenticated,anon;

create table auth.users(id uuid primary key);
create table public.profiles(
  id uuid primary key references auth.users(id),
  is_private boolean not null default false
);
create table public.follows(
  follower_id uuid not null references auth.users(id),
  following_id uuid not null references auth.users(id),
  status text not null,
  primary key(follower_id,following_id)
);
create table public.dumps(
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  expiry text not null,
  created_at timestamptz not null default now(),
  once_viewed_at timestamptz
);
create table public.dump_views(
  dump_id uuid not null references public.dumps(id),
  user_id uuid not null references auth.users(id),
  primary key(dump_id,user_id)
);
create table public.dump_items(
  id uuid primary key,
  dump_id uuid not null references public.dumps(id),
  image_path text,
  position integer not null default 0
);
create table public.board_items(
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  saved_image_path text
);

create table public.conversations(
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id)
);
create table public.conversation_participants(
  conversation_id uuid not null references public.conversations(id),
  user_id uuid not null references auth.users(id),
  primary key(conversation_id,user_id)
);
create table public.messages(
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id),
  sender_id uuid not null references auth.users(id),
  body text not null
);
create table public.message_requests(
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id),
  recipient_id uuid not null references auth.users(id),
  status text not null default 'pending'
);

create table storage.buckets(
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects(
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets(id),
  name text not null
);
create or replace function storage.foldername(name text)
returns text[] language sql immutable
as $$ select string_to_array(name, '/') $$;
grant execute on function storage.foldername(text) to authenticated,anon;

alter table public.dumps enable row level security;
alter table public.dump_items enable row level security;
alter table public.dump_views enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.message_requests enable row level security;
alter table storage.objects enable row level security;

grant select,insert,update,delete on all tables in schema public to authenticated;
grant select,insert,update,delete on storage.objects to authenticated;
grant select on storage.buckets to authenticated;
grant select on public.follows,public.profiles to authenticated;
grant usage on schema private to authenticated;

create policy "Visible dumps are viewable by authenticated users"
on public.dumps for select to authenticated
using (
  user_id=auth.uid()
  or exists(select 1 from public.profiles p where p.id=dumps.user_id and not p.is_private)
  or exists(select 1 from public.follows f where f.follower_id=auth.uid() and f.following_id=dumps.user_id and f.status='accepted')
);
create policy "Users can create their own dumps" on public.dumps for insert to authenticated
with check(user_id=auth.uid());

create policy "Authenticated users can view dump items"
on public.dump_items for select to authenticated using(true);
create policy "Users can create items for their own dumps"
on public.dump_items for insert to authenticated
with check(exists(select 1 from public.dumps d where d.id=dump_id and d.user_id=auth.uid()));
create policy "Users can update items for their own dumps"
on public.dump_items for update to authenticated
using(exists(select 1 from public.dumps d where d.id=dump_id and d.user_id=auth.uid()))
with check(exists(select 1 from public.dumps d where d.id=dump_id and d.user_id=auth.uid()));

create policy "Users can view their own dump views" on public.dump_views
for select to authenticated using(user_id=auth.uid());
create policy "Users can record their own dump views" on public.dump_views
for insert to authenticated with check(user_id=auth.uid());

create or replace function public.is_conversation_participant(p_conversation_id uuid,p_user_id uuid)
returns boolean language sql security definer set search_path=public set row_security=off as $$
  select exists(select 1 from public.conversation_participants cp
    where cp.conversation_id=p_conversation_id and cp.user_id=p_user_id)
$$;
create policy "Participants can view participant rows"
on public.conversation_participants for select to authenticated
using(public.is_conversation_participant(conversation_id,auth.uid()));
create policy "Users can add themselves to conversations"
on public.conversation_participants for insert to authenticated
with check(user_id=auth.uid());
create policy "Participants can view conversations"
on public.conversations for select to authenticated
using(exists(select 1 from public.conversation_participants cp
  where cp.conversation_id=conversations.id and cp.user_id=auth.uid()));
create policy "Users can create conversations"
on public.conversations for insert to authenticated with check(created_by=auth.uid());
create policy "Participants can view messages"
on public.messages for select to authenticated
using(exists(select 1 from public.conversation_participants cp
  where cp.conversation_id=messages.conversation_id and cp.user_id=auth.uid()));
create policy "Participants can send messages"
on public.messages for insert to authenticated
with check(sender_id=auth.uid() and exists(select 1 from public.conversation_participants cp
  where cp.conversation_id=messages.conversation_id and cp.user_id=auth.uid()));

create policy "Users can view their message requests" on public.message_requests
for select to authenticated using(sender_id=auth.uid() or recipient_id=auth.uid());
create policy "Recipients can respond to requests" on public.message_requests
for update to authenticated
using(recipient_id=auth.uid())
with check(recipient_id=auth.uid() and status in ('accepted','declined'));

create or replace function private.create_conversation_for_accepted_request()
returns trigger language plpgsql security definer set search_path=public,pg_catalog
as $$
declare new_conversation_id uuid;
begin
  if new.status='accepted' and old.status<>'accepted' then
    insert into public.conversations(created_by) values(new.recipient_id)
      returning id into new_conversation_id;
    insert into public.conversation_participants(conversation_id,user_id)
      values (new_conversation_id,new.sender_id),(new_conversation_id,new.recipient_id);
  end if;
  return new;
end
$$;
create trigger message_request_accepted after update of status
on public.message_requests for each row
execute function private.create_conversation_for_accepted_request();

insert into auth.users(id) values
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
 ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
 ('cccccccc-cccc-cccc-cccc-cccccccccccc');
insert into public.profiles(id,is_private) values
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',true),
 ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',false),
 ('cccccccc-cccc-cccc-cccc-cccccccccccc',false);
insert into public.follows(follower_id,following_id,status) values
 ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','accepted');
insert into public.dumps(id,user_id,expiry,created_at) values
 ('dddddddd-dddd-dddd-dddd-dddddddddd01','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','24h',now()),
 ('dddddddd-dddd-dddd-dddd-dddddddddd02','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','once',now()),
 ('dddddddd-dddd-dddd-dddd-dddddddddd03','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','24h',now()-interval '25 hours');
insert into public.dump_items(id,dump_id,image_path,position) values
 ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01','dddddddd-dddd-dddd-dddd-dddddddddd01','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/active.jpg',0),
 ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02','dddddddd-dddd-dddd-dddd-dddddddddd02','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/once.jpg',0),
 ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee03','dddddddd-dddd-dddd-dddd-dddddddddd03','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/expired.jpg',0);
insert into public.conversations(id,created_by) values
 ('ffffffff-ffff-ffff-ffff-fffffffffff1','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
insert into public.conversation_participants(conversation_id,user_id) values
 ('ffffffff-ffff-ffff-ffff-fffffffffff1','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
 ('ffffffff-ffff-ffff-ffff-fffffffffff1','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
insert into public.messages(conversation_id,sender_id,body) values
 ('ffffffff-ffff-ffff-ffff-fffffffffff1','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','synthetic hello');
insert into public.message_requests(sender_id,recipient_id,status) values
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','pending');
insert into storage.buckets(id,name,public) values ('flicd-media','flicd-media',true);
