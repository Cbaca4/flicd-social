drop policy if exists "Users can comment on visible dumps as themselves" on public.comments;

create policy "Users can comment on visible dumps as themselves"
on public.comments
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.dumps d
    where d.id = comments.dump_id
      and (
        d.user_id = (select auth.uid())
        or exists (
          select 1
          from public.profiles p
          where p.id = d.user_id
            and p.is_private = false
        )
        or exists (
          select 1
          from public.follows f
          where f.follower_id = (select auth.uid())
            and f.following_id = d.user_id
            and f.status = 'accepted'
        )
      )
  )
);
