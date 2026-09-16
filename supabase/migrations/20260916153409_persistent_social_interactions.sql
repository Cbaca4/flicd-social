create table public.likes (
  dump_id uuid not null references public.dumps(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (dump_id, user_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  dump_id uuid not null references public.dumps(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now(),
  constraint comments_text_length check (char_length(trim(text)) between 1 and 500)
);

create index likes_dump_id_idx on public.likes(dump_id);
create index comments_dump_created_at_idx on public.comments(dump_id, created_at desc);
create index comments_user_id_idx on public.comments(user_id);

alter table public.likes enable row level security;
alter table public.comments enable row level security;

revoke all on table public.likes, public.comments from anon, authenticated;
grant select, insert, delete on table public.likes to authenticated;
grant select, insert, delete on table public.comments to authenticated;

create policy "Users can view likes on visible dumps"
on public.likes for select to authenticated
using (
  exists (
    select 1
    from public.dumps d
    where d.id = likes.dump_id
      and (
        d.user_id = (select auth.uid())
        or exists (
          select 1 from public.profiles p
          where p.id = d.user_id and p.is_private = false
        )
        or exists (
          select 1 from public.follows f
          where f.follower_id = (select auth.uid())
            and f.following_id = d.user_id
            and f.status = 'accepted'
        )
      )
  )
);

create policy "Users can like visible dumps as themselves"
on public.likes for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.dumps d
    where d.id = likes.dump_id
      and (
        d.user_id = (select auth.uid())
        or exists (
          select 1 from public.profiles p
          where p.id = d.user_id and p.is_private = false
        )
        or exists (
          select 1 from public.follows f
          where f.follower_id = (select auth.uid())
            and f.following_id = d.user_id
            and f.status = 'accepted'
        )
      )
  )
);

create policy "Users can remove their own likes"
on public.likes for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can view comments on visible dumps"
on public.comments for select to authenticated
using (
  exists (
    select 1
    from public.dumps d
    where d.id = comments.dump_id
      and (
        d.user_id = (select auth.uid())
        or exists (
          select 1 from public.profiles p
          where p.id = d.user_id and p.is_private = false
        )
        or exists (
          select 1 from public.follows f
          where f.follower_id = (select auth.uid())
            and f.following_id = d.user_id
            and f.status = 'accepted'
        )
      )
  )
);

create policy "Users can comment on visible dumps as themselves"
on public.comments for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and char_length(trim(text)) between 1 and 500
  and exists (
    select 1
    from public.dumps d
    where d.id = comments.dump_id
      and (
        d.user_id = (select auth.uid())
        or exists (
          select 1 from public.profiles p
          where p.id = d.user_id and p.is_private = false
        )
        or exists (
          select 1 from public.follows f
          where f.follower_id = (select auth.uid())
            and f.following_id = d.user_id
            and f.status = 'accepted'
        )
      )
  )
);

create policy "Users can delete their own comments"
on public.comments for delete to authenticated
using ((select auth.uid()) = user_id);
