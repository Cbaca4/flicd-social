-- READ-ONLY checklist for ISOLATED staging after migration.
select
  not has_table_privilege('authenticated','public.conversation_participants','INSERT') as self_enrollment_blocked,
  not has_table_privilege('authenticated','public.conversations','INSERT') as direct_conversation_insert_blocked,
  not has_function_privilege('anon','public.is_conversation_participant(uuid,uuid)','EXECUTE') as anon_membership_probe_blocked;

select exists (
  select 1 from pg_policies where schemaname='public' and tablename='dump_items'
  and policyname='Authorized users can view live dump items'
) as scoped_dump_items_select_exists;

select id, public=false as private_bucket, file_size_limit
from storage.buckets where id='flicd-dump-private';

select policyname, qual from pg_policies
where schemaname='public' and tablename='dump_items' and cmd='SELECT'
order by policyname;

-- An initial rollout has legitimate legacy entries; the count must be zero
-- *after* the migration/cutover before making strong privacy claims.
select media_bucket, count(*) from public.dump_items
where image_path is not null group by media_bucket order by media_bucket;
