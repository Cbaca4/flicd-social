// Rehearse forward application to an existing synthetic four-draft database.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setupMediaDatabase,seedOnce,actor,USERS,MEDIA_REVIEW_MIGRATIONS } from './verify-local-media-security.mjs';
const db=await setupMediaDatabase({full:true,remediation:false});
try {
 const source=await seedOnce(db,USERS.owner,'24h');
 const keep=await db.rpc('media_save_photo',{...actor('follower'),dump_id:source.id,item_position:0,item_id:source.items[0]});
 const id=randomUUID(),board=randomUUID(),snapshot=`${USERS.follower}/boards/${board}/old.png`;
 await db.sql(`INSERT INTO public.boards(id,user_id,name) VALUES('${board}','${USERS.follower}','old Board'); INSERT INTO public.board_items(id,user_id,board_id,dump_id,item_position,note,saved_image_path,snapshot_bucket,saved_author_username) VALUES('${id}','${USERS.follower}','${board}','${source.id}',0,'old unresolved evidence','${snapshot}','flicd-archive','old name'); INSERT INTO storage.objects(bucket_id,name) VALUES('flicd-archive','${snapshot}'); SELECT private.media_preserve_legacy_records(); DELETE FROM public.boards WHERE id='${board}'; INSERT INTO private.media_cleanup_jobs(bucket_id,name) VALUES('flicd-archive','${snapshot}')`);
 const before=await db.sql(`SELECT json_build_object('items',(SELECT json_agg(row(id,position,image_path)) FROM public.dump_items WHERE dump_id='${source.id}'),'keep',(SELECT row_to_json(k) FROM private.photo_keeps k WHERE id='${keep.id}'))`);
 const forward='supabase/migrations/'+MEDIA_REVIEW_MIGRATIONS.at(-1);
 await db.sql('DELETE FROM public.__flicd_staging_marker');
 await assert.rejects(db.file(forward),/Synthetic staging marker required/);
 assert.equal(await db.sql("SELECT to_regclass('private.media_source_bindings') IS NULL"),'t');
 await db.sql("INSERT INTO public.__flicd_staging_marker VALUES('SYNTHETIC_STAGING_ONLY')");
 console.log('PASS: forward migration fails transactionally without the synthetic marker, leaving prior schema unchanged');
 await db.file(forward);
 assert.equal(await db.sql(`SELECT json_build_object('items',(SELECT json_agg(row(id,position,image_path)) FROM public.dump_items WHERE dump_id='${source.id}'),'keep',(SELECT row_to_json(k) FROM private.photo_keeps k WHERE id='${keep.id}'))`),before);
 assert.ok((await db.rpc('media_keep_frame',{...actor('follower'),keep_id:keep.id})).path);
 assert.equal(await db.sql(`SELECT count(*) FROM private.legacy_saved_records WHERE id='${id}' AND board_id IS NULL AND historical_evidence<>'{}'::jsonb AND source_author_id='${USERS.owner}'`),'1');
 assert.equal((await db.rpc('media_lease_cleanup',{})).some(job=>job.name===snapshot),false);
 console.log('PASS: forward upgrade preserves existing Keep/source UUIDs and positions, detached legacy evidence and protected preexisting jobs');
 await db.sql(`DELETE FROM public.dumps WHERE id='${source.id}'`);
 assert.equal(await db.sql(`SELECT count(*) FROM private.legacy_saved_records WHERE id='${id}' AND dump_id='${source.id}' AND source_item_id='${source.items[0]}' AND source_deleted_at IS NOT NULL`),'1');
 await assert.rejects(db.rpc('media_keep_frame',{...actor('follower'),keep_id:keep.id}),/keep_forbidden/);
 console.log('PASS: upgraded source deletion revokes existing entitlements without destroying unresolved evidence');
}finally{await db.close();}
