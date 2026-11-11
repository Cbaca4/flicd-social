// Synthetic-only regression matrix for the independent audit's two blockers.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setupMediaDatabase,seedOnce,actor,USERS } from './verify-local-media-security.mjs';
import { runCleanupBatch } from '../server/media/cleanupWorker.mjs';
const db=await setupMediaDatabase({full:true,remediation:!process.argv.includes('--before-remediation')});
const asUser=(who,sql)=>db.sql(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${USERS[who]}',false); ${sql}`);
const original=(source,position=0,owner=USERS.owner)=>`${owner}/local-media/${source.id}/${position}.png`;
const checks=[];
async function check(name,fn){await fn();checks.push({name,status:'PASS'});console.log('PASS: '+name);}
async function legacyRecord(){
 const source=await seedOnce(db,USERS.owner,'24h'),board=randomUUID(),id=randomUUID();
 const snapshot=`${USERS.follower}/boards/${board}/${id}.png`;
 await db.sql(`INSERT INTO public.boards(id,user_id,name) VALUES('${board}','${USERS.follower}','historical'); INSERT INTO public.board_items(id,user_id,board_id,dump_id,item_position,note,saved_image_path,snapshot_bucket,saved_author_username) VALUES('${id}','${USERS.follower}','${board}','${source.id}',0,'unresolved evidence','${snapshot}','flicd-archive','historical-name'); INSERT INTO storage.objects(bucket_id,name) VALUES('flicd-archive','${snapshot}'); SELECT private.media_preserve_legacy_records()`);
 return {source,board,id,snapshot};
}
async function verifyLegacy(record){
 await db.sql(`INSERT INTO private.legacy_keep_reviews(legacy_item_id,source_item_id,saver_id,reviewed_by,evidence_reference) VALUES('${record.id}','${record.source.items[0]}','${USERS.follower}','${USERS.stranger}','synthetic independent entitlement review')`);
 await db.rpc('media_backfill_legacy_keeps',{});
 return (await db.rpc('media_list_keeps',actor('follower'))).find(row=>row.source_item_id===record.source.items[0]);
}
const approveSnapshot=(record,sourceId=record.source.items[0])=>db.sql(`INSERT INTO private.legacy_snapshot_cleanup_reviews(legacy_item_id,source_item_id,source_author_id,saver_id,bucket_id,name,reviewed_by,provenance_reference,retention_reference) VALUES('${record.id}','${sourceId}','${USERS.owner}','${USERS.follower}','flicd-archive','${record.snapshot}','${USERS.stranger}','synthetic exact snapshot provenance adjudication','synthetic retention released')`);
const cleanupStorage={remove:async(bucket,path)=>db.sql(`DELETE FROM storage.objects WHERE bucket_id='${bucket}' AND name='${path}'`)};
try {
 if(!process.argv.includes('--legacy-only'))await check('bound original cannot be recreated over an archived Keep by its uploader',async()=>{
  const source=await seedOnce(db,USERS.owner,'24h');
  const keep=await db.rpc('media_save_photo',{...actor('follower'),dump_id:source.id,item_position:0,item_id:source.items[0]});
  const archive=`${USERS.owner}/${source.id}/0.png`,path=original(source);
  await db.sql(`DELETE FROM storage.objects WHERE bucket_id='flicd-dump-private' AND name='${path}'; INSERT INTO storage.objects(bucket_id,name) VALUES('flicd-archive','${archive}'); INSERT INTO public.flicd_archive_items(user_id,dump_id,item_position,archive_path) VALUES('${USERS.owner}','${source.id}',0,'${archive}')`);
  assert.equal(await db.sql(`SELECT count(*) FROM private.media_cleanup_jobs WHERE name='${path}'`),'0');
  assert.deepEqual(await db.rpc('media_keep_frame',{...actor('follower'),keep_id:keep.id}),{bucket:'flicd-archive',path:archive});
  await assert.rejects(asUser('owner',`INSERT INTO storage.objects(bucket_id,name) VALUES('flicd-dump-private','${path}')`),/row-level security/);
  assert.deepEqual(await db.rpc('media_keep_frame',{...actor('follower'),keep_id:keep.id}),{bucket:'flicd-archive',path:archive});
 });
 if(!process.argv.includes('--legacy-only')){
  await check('first-time owner upload and pending-upload cleanup work; unrelated and anonymous uploads fail',async()=>{
   const path=`${USERS.owner}/pending-${randomUUID()}.png`;
   await asUser('owner',`INSERT INTO storage.objects(bucket_id,name) VALUES('flicd-dump-private','${path}')`);
   await assert.rejects(asUser('stranger',`INSERT INTO storage.objects(bucket_id,name) VALUES('flicd-dump-private','${USERS.owner}/forged-${randomUUID()}.png')`),/row-level security/);
   const removed=await asUser('owner',`WITH changed AS(DELETE FROM storage.objects WHERE name='${path}' RETURNING id) SELECT count(*) FROM changed`);
   assert.equal(removed.split(/\r?\n/).at(-1),'1');
  });
  await check('active, missing and deleted original addresses remain bound without tombstones',async()=>{
   for(const state of ['active','missing','deleted']){
    const source=await seedOnce(db,USERS.owner,'24h'),path=original(source);
    if(state!=='active')await db.sql(`DELETE FROM storage.objects WHERE name='${path}'`);
    if(state==='deleted')await db.sql(`DELETE FROM public.dump_items WHERE id='${source.items[0]}'; DELETE FROM private.media_cleanup_jobs WHERE name='${path}'`);
    for(const who of ['owner','stranger'])await assert.rejects(asUser(who,`INSERT INTO storage.objects(bucket_id,name) VALUES('flicd-dump-private','${path}')`),/row-level security/);
    assert.equal(await db.sql(`SELECT count(*) FROM private.media_source_bindings WHERE name='${path}' AND source_item_id='${source.items[0]}'`),'1');
   }
  });
  await check('missing archive paths reject uploader and unrelated INSERTs while trusted archive recovery works',async()=>{
   const source=await seedOnce(db,USERS.owner,'24h'),path=`${USERS.owner}/${source.id}/0.png`;
   await db.sql(`DELETE FROM storage.objects WHERE name='${original(source)}'; INSERT INTO public.flicd_archive_items(user_id,dump_id,item_position,archive_path) VALUES('${USERS.owner}','${source.id}',0,'${path}')`);
   for(const who of ['owner','stranger'])await assert.rejects(asUser(who,`INSERT INTO storage.objects(bucket_id,name) VALUES('flicd-archive','${path}')`),/row-level security/);
   await assert.rejects(db.rpc('media_owner_frame',{...actor('owner'),item_id:source.items[0]}),/media_unavailable/);
   // Explicit fixture grant matches the trusted provider Storage role; it does
   // not grant clients any privilege or expose private identity/retention tables.
   await db.sql(`GRANT SELECT,INSERT ON storage.objects TO service_role; SET ROLE service_role; INSERT INTO storage.objects(bucket_id,name) VALUES('flicd-archive','${path}')`);
   assert.deepEqual(await db.rpc('media_owner_frame',{...actor('owner'),item_id:source.items[0]}),{bucket:'flicd-archive',path});
  });
  await check('permissive policy overlap, forged object metadata, UPDATE rename and upsert cannot replace a bound path',async()=>{
   await db.sql(`ALTER TABLE storage.objects ADD COLUMN metadata jsonb,ADD COLUMN owner_id text; CREATE UNIQUE INDEX local_storage_address_unique ON storage.objects(bucket_id,name); CREATE POLICY local_broad_authenticated ON storage.objects FOR ALL TO authenticated USING(true) WITH CHECK(true); GRANT SELECT,INSERT ON storage.objects TO anon; CREATE POLICY local_broad_anon ON storage.objects FOR ALL TO anon USING(true) WITH CHECK(true)`);
   const source=await seedOnce(db,USERS.owner,'24h'),path=original(source),pending=`${USERS.owner}/pending-${randomUUID()}.png`;
   await asUser('owner',`INSERT INTO storage.objects(bucket_id,name) VALUES('flicd-dump-private','${pending}')`);
   await assert.rejects(asUser('owner',`UPDATE storage.objects SET name='${path}' WHERE name='${pending}'`),/row-level security/);
   await assert.rejects(asUser('owner',`INSERT INTO storage.objects(bucket_id,name) VALUES('flicd-dump-private','${path}') ON CONFLICT(bucket_id,name) DO UPDATE SET name=excluded.name`),/row-level security/);
   await db.sql(`DELETE FROM storage.objects WHERE name='${path}'`);
   await assert.rejects(asUser('owner',`INSERT INTO storage.objects(bucket_id,name,owner_id,metadata) VALUES('flicd-dump-private','${path}','${USERS.owner}','{"source_item_id":"${source.items[0]}","restore":true}')`),/row-level security/);
   await assert.rejects(db.sql(`SET ROLE anon; INSERT INTO storage.objects(bucket_id,name) VALUES('flicd-dump-private','${path}')`),/row-level security/);
   await assert.rejects(asUser('stranger',`INSERT INTO storage.objects(bucket_id,name) VALUES('flicd-dump-private','${USERS.owner}/overlap-forged.png')`),/row-level security/);
   await assert.rejects(asUser('owner',`INSERT INTO private.media_source_bindings VALUES('flicd-dump-private','forged','${randomUUID()}','${source.id}','${USERS.owner}','original')`),/permission denied/);
   await assert.rejects(asUser('owner',`INSERT INTO public.flicd_archive_items(user_id,dump_id,item_position,archive_path) VALUES('${USERS.owner}','${source.id}',0,'${USERS.owner}/${source.id}/forged.png')`),/permission denied/);
  });
  await check('source lookup rejects replacement Storage identities even when paths and client metadata are copied',async()=>{
   const source=await seedOnce(db,USERS.owner,'24h'),path=original(source),archive=`${USERS.owner}/${source.id}/0.png`;
   const keep=await db.rpc('media_save_photo',{...actor('follower'),dump_id:source.id,item_position:0});
   const oldId=await db.sql(`SELECT id FROM storage.objects WHERE name='${path}'`);
   await db.sql(`INSERT INTO storage.objects(bucket_id,name) VALUES('flicd-archive','${archive}'); INSERT INTO public.flicd_archive_items(user_id,dump_id,item_position,archive_path) VALUES('${USERS.owner}','${source.id}',0,'${archive}'); DELETE FROM storage.objects WHERE name='${path}'; INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('flicd-dump-private','${path}','{"source_item_id":"${source.items[0]}","original_object_id":"${oldId}"}')`);
   // Privileged fault injection models an old-policy/stale object or bad restore.
   // Even bypassing RLS must not make the lookup choose an unrelated object ID.
   assert.deepEqual(await db.rpc('media_keep_frame',{...actor('follower'),keep_id:keep.id}),{bucket:'flicd-archive',path:archive});
   await db.sql(`DELETE FROM storage.objects WHERE name='${path}'; INSERT INTO storage.objects(id,bucket_id,name) VALUES('${oldId}','flicd-dump-private','${path}')`);
   assert.deepEqual(await db.rpc('media_keep_frame',{...actor('follower'),keep_id:keep.id}),{bucket:'flicd-dump-private',path});
  });
  await check('deleted source UUIDs cannot be rebound and reused positions cannot borrow old archive provenance',async()=>{
   const source=await seedOnce(db,USERS.owner,'24h'),archive=`${USERS.owner}/${source.id}/0.png`;
   await db.sql(`INSERT INTO storage.objects(bucket_id,name) VALUES('flicd-archive','${archive}'); INSERT INTO public.flicd_archive_items(user_id,dump_id,item_position,archive_path) VALUES('${USERS.owner}','${source.id}',0,'${archive}'); DELETE FROM public.dump_items WHERE id='${source.items[0]}'`);
   await assert.rejects(db.sql(`INSERT INTO public.dump_items(id,dump_id,position,image_path,media_bucket) VALUES('${source.items[0]}','${source.id}',0,'${USERS.owner}/new-${randomUUID()}.png','flicd-dump-private')`),/duplicate key/);
   const replacement=randomUUID();
   await db.sql(`INSERT INTO public.dump_items(id,dump_id,position,image_path,media_bucket) VALUES('${replacement}','${source.id}',0,'${USERS.owner}/new-${randomUUID()}.png','flicd-dump-private')`);
   await assert.rejects(db.rpc('media_owner_frame',{...actor('owner'),item_id:replacement}),/media_unavailable/);
   await assert.rejects(asUser('owner',`UPDATE public.dump_items SET id='${randomUUID()}' WHERE id='${replacement}'`),/immutable_source_photo/);
  });
 }
 if(!process.argv.includes('--bound-only'))await check('source deletion preserves unresolved legacy evidence and snapshot without authorizing media',async()=>{
  const source=await seedOnce(db,USERS.owner,'24h');
  const board=randomUUID(),id=randomUUID(),snapshot=`${USERS.follower}/boards/${board}/ambiguous.png`;
  await db.sql(`INSERT INTO public.boards(id,user_id,name) VALUES('${board}','${USERS.follower}','historical'); INSERT INTO public.board_items(id,user_id,board_id,dump_id,item_position,note,saved_image_path,snapshot_bucket,saved_author_username) VALUES('${id}','${USERS.follower}','${board}','${source.id}',0,'unresolved evidence','${snapshot}','flicd-archive','historical-name'); INSERT INTO storage.objects(bucket_id,name) VALUES('flicd-archive','${snapshot}'); SELECT private.media_preserve_legacy_records(); DELETE FROM public.boards WHERE id='${board}'; DELETE FROM public.dump_items WHERE id='${source.items[0]}'`);
  assert.equal(await db.sql(`SELECT count(*) FROM private.legacy_saved_records WHERE id='${id}' AND source_item_id='${source.items[0]}' AND dump_id='${source.id}' AND note='unresolved evidence' AND snapshot_path='${snapshot}'`),'1');
  assert.equal(await db.sql(`SELECT count(*) FROM private.media_cleanup_jobs WHERE name='${snapshot}'`),'0');
  assert.ok((await db.rpc('media_list_keeps',actor('follower'))).some(row=>row.id===id&&row.legacy_status));
  await assert.rejects(db.rpc('media_keep_frame',{...actor('follower'),keep_id:id}),/keep_forbidden/);
 });
 if(!process.argv.includes('--bound-only')){
  await check('quarantine preserves source identity but does not clone unrelated original captions into retention evidence',async()=>{
   const record=await legacyRecord();
   assert.equal(await db.sql(`SELECT historical_evidence->'source_dump' ? 'context' FROM private.legacy_saved_records WHERE id='${record.id}'`),'f');
   assert.equal(await db.sql(`SELECT historical_evidence->'source_item' ? 'note' FROM private.legacy_saved_records WHERE id='${record.id}'`),'f');
   assert.equal(await db.sql(`SELECT historical_evidence->'source_item'->>'id' FROM private.legacy_saved_records WHERE id='${record.id}'`),record.source.items[0]);
  });
  await check('author role post deletion quarantines unresolved identity/provenance and revokes verified Keeps immediately',async()=>{
   await db.sql(`CREATE POLICY local_owner_dump_delete ON public.dumps FOR DELETE TO authenticated USING(user_id=auth.uid())`);
   const record=await legacyRecord();
   const keep=await db.rpc('media_save_photo',{...actor('follower'),dump_id:record.source.id,item_position:0,item_id:record.source.items[0]});
   await asUser('owner',`DELETE FROM public.dumps WHERE id='${record.source.id}'`);
   assert.equal(await db.sql(`SELECT count(*) FROM private.legacy_saved_records WHERE id='${record.id}' AND source_deleted_at IS NOT NULL AND source_author_id='${USERS.owner}' AND historical_evidence->'browser_legacy_row'->>'saved_author_username'='historical-name' AND historical_evidence->'source_item'->>'id'='${record.source.items[0]}'`),'1');
   await assert.rejects(db.rpc('media_keep_frame',{...actor('follower'),keep_id:keep.id}),/keep_forbidden/);
   assert.equal(await db.sql(`SELECT count(*) FROM private.media_cleanup_jobs WHERE name='${record.snapshot}'`),'0');
   const listed=(await db.rpc('media_list_keeps',actor('follower'))).find(row=>row.id===record.id);
   assert.ok(listed?.legacy_status);assert.equal(JSON.stringify(listed).includes(record.snapshot),false);
   const visible=await asUser('follower',`SELECT count(*) FROM storage.objects WHERE name='${record.snapshot}'`);
   assert.equal(visible.split(/\r?\n/).at(-1),'0');
  });
  await check('old pending, done and active-lease jobs cannot destroy held snapshots through lease/reconciliation/worker',async()=>{
   for(const status of ['pending','done','leased']){
    const record=await legacyRecord(),token=randomUUID();
    const jobId=randomUUID();
    await db.sql(`INSERT INTO private.media_cleanup_jobs(id,bucket_id,name,status,lease_token,lease_until) VALUES('${jobId}','flicd-archive','${record.snapshot}','${status}','${token}',clock_timestamp()+interval '1 hour')`);
    assert.equal((await db.rpc('media_lease_cleanup',{})).some(job=>job.name===record.snapshot),false);
    await db.rpc('media_reconcile_cleanup',{});
    const lease={job_id:jobId,lease_token:token};
    assert.equal((await db.rpc('media_cleanup_authorized',lease)).authorized,false);
    assert.equal((await db.rpc('media_finish_cleanup',lease)).completed,false);
    let removals=0;
    const repository={rpc:(name,payload)=>name==='media_lease_cleanup'?[{id:jobId,lease_token:token,bucket_id:'flicd-archive',name:record.snapshot}]:db.rpc(name,payload)};
    assert.deepEqual(await runCleanupBatch({repository,storage:{remove:async()=>{removals++;}}}),[{id:jobId,status:'retention_or_lease_denied'}]);
    assert.equal(removals,0);
    assert.equal(await db.sql(`SELECT count(*) FROM storage.objects WHERE name='${record.snapshot}'`),'1');
   }
  });
  await check('entitlement review and Keep removal alone never release snapshot retention',async()=>{
   const record=await legacyRecord(),keep=await verifyLegacy(record);assert.ok(keep);
   await db.sql(`DELETE FROM public.boards WHERE id='${record.board}'`);
   await db.rpc('media_remove_keep',{...actor('follower'),keep_id:keep.id});
   assert.equal(await db.sql(`SELECT count(*) FROM private.media_cleanup_jobs WHERE name='${record.snapshot}'`),'0');
   assert.equal(await db.sql(`SELECT private.media_legacy_snapshot_protected('flicd-archive','${record.snapshot}')`),'t');
   assert.equal((await db.rpc('media_backfill_legacy_keeps',{})).imported,0);
  });
  await check('a retention review for the wrong source UUID cannot release an otherwise eligible snapshot',async()=>{
   const record=await legacyRecord(),keep=await verifyLegacy(record);assert.ok(keep);
   await db.sql(`DELETE FROM public.boards WHERE id='${record.board}'`);
   await db.rpc('media_remove_keep',{...actor('follower'),keep_id:keep.id});
   await approveSnapshot(record,record.source.items[1]);
   assert.equal(await db.sql(`SELECT private.media_legacy_snapshot_protected('flicd-archive','${record.snapshot}')`),'t');
   assert.equal(await db.sql(`SELECT count(*) FROM private.media_cleanup_jobs WHERE name='${record.snapshot}'`),'0');
  });
  await check('confirmed Keep removal plus exact provenance/retention review cleans only its snapshot and preserves historical evidence',async()=>{
   const record=await legacyRecord(),keep=await verifyLegacy(record);assert.ok(keep);
   await approveSnapshot(record);
   assert.equal(await db.sql(`SELECT count(*) FROM private.media_cleanup_jobs WHERE name='${record.snapshot}'`),'0');
   await assert.rejects(db.rpc('media_remove_keep',{...actor('stranger'),keep_id:keep.id}),/keep_forbidden/);
   await db.sql(`DELETE FROM public.boards WHERE id='${record.board}'`);
   await db.rpc('media_remove_keep',{...actor('follower'),keep_id:keep.id});
   assert.equal(await db.sql(`SELECT count(*) FROM private.media_cleanup_jobs WHERE name='${record.snapshot}'`),'1');
   for(let i=0;i<5;i++)await runCleanupBatch({repository:db,storage:cleanupStorage});
   assert.equal(await db.sql(`SELECT count(*) FROM storage.objects WHERE name='${record.snapshot}'`),'0');
   assert.equal(await db.sql(`SELECT count(*) FROM storage.objects WHERE name='${original(record.source)}'`),'1');
   assert.equal(await db.sql(`SELECT count(*) FROM private.legacy_saved_records WHERE id='${record.id}' AND source_deleted_at IS NULL`),'1');
   assert.equal(await db.sql(`SELECT count(*) FROM private.legacy_keep_migrations WHERE legacy_item_id='${record.id}' AND keep_removed_at IS NOT NULL AND keep_id IS NULL`),'1');
  });
  await check('source deletion and confirmed Keep deletion have distinct audit states; only adjudicated snapshots queue',async()=>{
   const record=await legacyRecord(),keep=await verifyLegacy(record);assert.ok(keep);
   await approveSnapshot(record);
   await db.sql(`DELETE FROM public.dumps WHERE id='${record.source.id}'`);
   await assert.rejects(db.rpc('media_keep_frame',{...actor('follower'),keep_id:keep.id}),/keep_forbidden/);
   assert.equal(await db.sql(`SELECT count(*) FROM private.legacy_saved_records WHERE id='${record.id}' AND source_deleted_at IS NOT NULL`),'1');
   assert.equal(await db.sql(`SELECT count(*) FROM private.legacy_keep_reviews WHERE legacy_item_id='${record.id}' AND source_item_id='${record.source.items[0]}'`),'1');
   assert.equal(await db.sql(`SELECT count(*) FROM private.legacy_keep_migrations WHERE legacy_item_id='${record.id}' AND keep_id IS NULL AND keep_removed_at IS NULL`),'1');
   assert.equal(await db.sql(`SELECT count(*) FROM private.media_cleanup_jobs WHERE name='${record.snapshot}'`),'1');
  });
  await check('unreviewed claimant sharing a snapshot address blocks cleanup even when another claimant is approved',async()=>{
   const record=await legacyRecord(),keep=await verifyLegacy(record),other=randomUUID();assert.ok(keep);
   await db.sql(`INSERT INTO public.board_items(id,user_id,dump_id,item_position,saved_image_path,snapshot_bucket) VALUES('${other}','${USERS.follower}','${record.source.id}',0,'${record.snapshot}','flicd-archive'); SELECT private.media_preserve_legacy_records(); DELETE FROM public.boards WHERE id='${record.board}'`);
   await approveSnapshot(record);await db.rpc('media_remove_keep',{...actor('follower'),keep_id:keep.id});
   assert.equal(await db.sql(`SELECT private.media_legacy_snapshot_protected('flicd-archive','${record.snapshot}')`),'t');
   assert.equal(await db.sql(`SELECT count(*) FROM private.media_cleanup_jobs WHERE name='${record.snapshot}'`),'0');
  });
  await check('unrelated roles cannot read/approve/delete private legacy evidence or invoke cleanup; source deletion rollback preserves access',async()=>{
   const record=await legacyRecord();
   const keep=await db.rpc('media_save_photo',{...actor('follower'),dump_id:record.source.id,item_position:0});
   for(const role of ['anon','authenticated']){
    for(const table of ['legacy_saved_records','legacy_keep_reviews','legacy_snapshot_cleanup_reviews'])await assert.rejects(db.sql(`SET ROLE ${role}; SELECT * FROM private.${table}`),/permission denied/);
    await assert.rejects(db.rpc('media_cleanup_authorized',{job_id:randomUUID(),lease_token:randomUUID()},role),/permission denied/);
   }
   await assert.rejects(asUser('follower',`UPDATE private.legacy_saved_records SET source_item_id='${randomUUID()}' WHERE id='${record.id}'`),/permission denied/);
   await assert.rejects(asUser('follower',`INSERT INTO private.legacy_snapshot_cleanup_reviews(legacy_item_id,source_item_id,source_author_id,saver_id,bucket_id,name,reviewed_by,provenance_reference,retention_reference) VALUES('${record.id}','${record.source.items[0]}','${USERS.owner}','${USERS.follower}','flicd-archive','${record.snapshot}','${USERS.follower}','self-approved','self-approved')`),/permission denied/);
   await assert.rejects(db.sql(`DELETE FROM private.legacy_saved_records WHERE id='${record.id}'`),/separate_retention_review/);
   await db.sql(`BEGIN; DELETE FROM public.dumps WHERE id='${record.source.id}'; ROLLBACK`);
   assert.equal(await db.sql(`SELECT source_deleted_at IS NULL FROM private.legacy_saved_records WHERE id='${record.id}'`),'t');
   assert.ok((await db.rpc('media_keep_frame',{...actor('follower'),keep_id:keep.id})).path);
  });
 }
 console.log(JSON.stringify({suite:'audit blocker regressions',checks:checks.length,results:checks},null,2));
}finally{await db.close();}
