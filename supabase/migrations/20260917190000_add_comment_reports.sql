create table if not exists public.comment_reports (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint comment_reports_reason_check check (reason in ('spam', 'harassment', 'hate', 'violence', 'sexual', 'other')),
  constraint comment_reports_unique_report unique (comment_id, reporter_id)
);

create index if not exists comment_reports_comment_id_idx
  on public.comment_reports (comment_id);

alter table public.comment_reports enable row level security;

revoke all on table public.comment_reports from anon, authenticated;
grant insert on table public.comment_reports to authenticated;

drop policy if exists "Users can report comments as themselves" on public.comment_reports;
create policy "Users can report comments as themselves"
on public.comment_reports
for insert
to authenticated
with check ((select auth.uid()) = reporter_id);
