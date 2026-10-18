-- ONLY for a separate empty Supabase staging project. Reproduces selected
-- flic'd production schema elements without exporting private user data.
-- Refuse running on the known live production database.
do $$
begin
  if current_database() like '%xbmfphdetgmjzqnxhmgp%' then
    raise exception 'Refusing to bootstrap production';
  end if;
  if exists (select 1 from public.__flicd_staging_marker limit 1) then
    null;
  end if;
exception when undefined_table then null;
end $$;
create table if not exists public.__flicd_staging_marker (
  label text primary key,
  created_at timestamptz default now()
);
insert into public.__flicd_staging_marker(label) values ('SYNTHETIC_STAGING_ONLY')
on conflict (label) do nothing;
revoke all on public.__flicd_staging_marker from anon,authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  is_private boolean not null default false
);
create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'accepted',
  primary key (follower_id,following_id)
);
create table if not exists public.dumps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  space_id text not null default 'main',
  type text not null default 'dump',
  mood text not null default 'neutral',
  expiry text not null,
  created_at timestamptz not null default now(),
  once_viewed_at timestamptz,
  allow_others_to_keep boolean not null default false
);
create table if not exists public.dump_views (
  dump_id uuid not null references public.dumps(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key(dump_id,user_id)
);
create table if not exists public.dump_items (
  id uuid primary key default gen_random_uuid(),
  dump_id uuid not null references public.dumps(id) on delete cascade,
  position integer not null,
  note text not null default '',
  image_path text,
  created_at timestamptz not null default now(),
  unique(dump_id, position)
);
create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Saved'
);
create table if not exists public.board_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  board_id uuid not null references public.boards(id) on delete cascade,
  dump_id uuid references public.dumps(id) on delete set null,
  item_position integer not null default 0,
  saved_image_path text
);
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key(conversation_id,user_id)
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.message_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
alter table public.profiles enable row level security;
alter table public.follows enable row level security;
alter table public.dumps enable row level security;
alter table public.dump_views enable row level security;
alter table public.dump_items enable row level security;
alter table public.boards enable row level security;
alter table public.board_items enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.message_requests enable row level security;

grant usage on schema public to authenticated;
grant select on public.profiles,public.follows to authenticated;
grant select,insert,update,delete on public.dumps,public.dump_items,public.dump_views,
  public.boards,public.board_items,public.conversations,public.conversation_participants,
  public.messages,public.message_requests to authenticated;

create policy "Profiles are viewable by authenticated users" on public.profiles
for select to authenticated using (true);
create policy "Followers can view follows" on public.follows
for select to authenticated using ((select auth.uid())=follower_id or (select auth.uid())=following_id);
create policy "Visible dumps are viewable by authenticated users" on public.dumps
for select to authenticated
using (
  user_id=(select auth.uid())
  or exists(select 1 from public.profiles p where p.id=dumps.user_id and p.is_private=false)
  or exists(select 1 from public.follows f where f.follower_id=(select auth.uid()) and f.following_id=dumps.user_id and f.status='accepted')
);
create policy "Users can create their own dumps" on public.dumps
for insert to authenticated with check(user_id=(select auth.uid()));
create policy "Users can view their own dump views" on public.dump_views
for select to authenticated using(user_id=(select auth.uid()));
create policy "Users can record their own dump views" on public.dump_views
for insert to authenticated with check(user_id=(select auth.uid()));
create policy "Authenticated users can view dump items" on public.dump_items
for select to authenticated using(true);
create policy "Users can create items for their own dumps" on public.dump_items
for insert to authenticated with check(exists(
  select 1 from public.dumps d where d.id=dump_id and d.user_id=(select auth.uid())));
create policy "Users can update items for their own dumps" on public.dump_items
for update to authenticated
using(exists(select 1 from public.dumps d where d.id=dump_id and d.user_id=(select auth.uid())))
with check(exists(select 1 from public.dumps d where d.id=dump_id and d.user_id=(select auth.uid())));
create policy "Users can view their own boards" on public.boards
for select to authenticated using(user_id=(select auth.uid()));
create policy "Users can view their own board items" on public.board_items
for select to authenticated using(user_id=(select auth.uid()));

create or replace function public.is_conversation_participant(p_conversation_id uuid,p_user_id uuid)
returns boolean language sql security definer set search_path=public set row_security=off
as $f$ select exists(select 1 from public.conversation_participants cp
where cp.conversation_id=p_conversation_id and cp.user_id=p_user_id) $f$;

create policy "Participants can view participant rows" on public.conversation_participants
for select to authenticated
using(public.is_conversation_participant(conversation_id,(select auth.uid())));
create policy "Users can add themselves to conversations" on public.conversation_participants
for insert to authenticated with check(user_id=(select auth.uid()));
create policy "Participants can view conversations" on public.conversations
for select to authenticated using(exists(select 1 from public.conversation_participants cp
where cp.conversation_id=conversations.id and cp.user_id=(select auth.uid())));
create policy "Users can create conversations" on public.conversations
for insert to authenticated with check(created_by=(select auth.uid()));
create policy "Participants can view messages" on public.messages
for select to authenticated using(exists(select 1 from public.conversation_participants cp
where cp.conversation_id=messages.conversation_id and cp.user_id=(select auth.uid())));
create policy "Participants can send messages" on public.messages
for insert to authenticated with check(sender_id=(select auth.uid()) and exists(
select 1 from public.conversation_participants cp where cp.conversation_id=messages.conversation_id and cp.user_id=(select auth.uid())));
create policy "Users can view their message requests" on public.message_requests
for select to authenticated using(sender_id=(select auth.uid()) or recipient_id=(select auth.uid()));
create policy "Recipients can respond to requests" on public.message_requests
for update to authenticated using(recipient_id=(select auth.uid()))
with check(recipient_id=(select auth.uid()) and status in ('accepted','declined'));

create schema if not exists private;
create or replace function private.create_conversation_for_accepted_request()
returns trigger language plpgsql security definer set search_path=public,pg_catalog
as $f$
declare cid uuid;
begin
  if new.status='accepted' and old.status<>'accepted' then
    insert into public.conversations(created_by) values(new.recipient_id)
    returning id into cid;
    insert into public.conversation_participants(conversation_id,user_id)
    values(cid,new.sender_id),(cid,new.recipient_id);
  end if;
  return new;
end $f$;
create trigger message_request_accepted after update of status on public.message_requests
for each row execute function private.create_conversation_for_accepted_request();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('flicd-media','flicd-media',true,52428800,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
