import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { setupMediaDatabase,seedOnce,actor,USERS } from './verify-local-media-security.mjs';
const db=await setupMediaDatabase({full:true});
try {
 const source=await seedOnce(db,USERS.owner,'24h');
 const saved=await db.rpc('media_save_photo',{...actor('owner'),dump_id:source.id,item_position:1});
 const row=(await db.rpc('media_list_keeps',actor('owner')))[0];
 assert.equal(row.item_position,1);assert.equal(row.source_item_id,source.items[1]);assert.equal(row.is_own_photo,true);
 assert.equal(JSON.stringify(row).includes('image_path'),false);
 console.log('PASS: canonical list returns original position and stable source/creator, no Storage capability');
 const board=randomUUID(),ownLegacy=randomUUID(),otherLegacy=randomUUID(),orphan=randomUUID(),onceLegacy=randomUUID();
 const once=await seedOnce(db);const publicPost=await seedOnce(db,USERS.stranger,'24h');
 await db.sql(`INSERT INTO public.boards(id,user_id,name) VALUES('${board}','${USERS.owner}','legacy');
 INSERT INTO public.board_items(id,user_id,board_id,dump_id,item_position,note,saved_author_username) VALUES
 ('${ownLegacy}','${USERS.owner}','${board}','${source.id}',0,'own legacy','wrong-name'),
 ('${otherLegacy}','${USERS.owner}','${board}','${publicPost.id}',0,'other legacy','wrong-name'),
 ('${orphan}','${USERS.owner}','${board}',null,0,'orphan','renamed'),
 ('${onceLegacy}','${USERS.owner}','${board}','${once.id}',0,'once legacy','wrong-name');
 UPDATE public.dumps SET created_at=clock_timestamp()-interval '3 days',allow_others_to_keep=false WHERE id IN('${source.id}','${publicPost.id}');`);
 const legacyPath=USERS.owner+'/boards/'+board+'/legacy.png';
 await db.sql(`UPDATE public.board_items SET saved_image_path='${legacyPath}',snapshot_bucket='flicd-archive' WHERE id='${ownLegacy}'; INSERT INTO storage.objects(bucket_id,name) VALUES('flicd-archive','${legacyPath}')`);
 const imported=await db.rpc('media_backfill_legacy_keeps',{});assert.equal(imported.imported,1);
 assert.equal(await db.sql(`SELECT count(*) FROM public.board_items WHERE id IN('${ownLegacy}','${otherLegacy}','${orphan}','${onceLegacy}')`),'4');
 const listed=await db.rpc('media_list_keeps',actor('owner'));
 const oldOwn=listed.find(item=>item.source_item_id===source.items[0]);assert.ok(oldOwn);assert.deepEqual(oldOwn.board_ids,[board]);
 for(const id of [otherLegacy,orphan,onceLegacy])assert.ok(listed.some(item=>item.id===id&&item.legacy_status));
 assert.equal(JSON.stringify(listed).includes('wrong-name'),false);
 assert.equal((await db.rpc('media_backfill_legacy_keeps',{})).imported,0);
 console.log('PASS: legacy source identities derive from UUID/position, self-owned expired photos import idempotently; other unverified/orphan/once records remain preserved without media');
 await db.sql(`DELETE FROM public.boards WHERE id='${board}'`);
 const afterBoard=await db.rpc('media_list_keeps',actor('owner'));
 assert.ok(afterBoard.some(item=>item.id===otherLegacy&&item.legacy_status));
 assert.deepEqual(afterBoard.find(item=>item.id===oldOwn.id).board_ids,[]);
 console.log('PASS: deleting a custom Board removes memberships only; canonical photos and unresolved legacy records survive independently');
 await assert.rejects(db.rpc('media_backfill_legacy_keeps',{},'authenticated'),/permission denied/);
 await db.sql(`INSERT INTO private.legacy_keep_reviews(legacy_item_id,source_item_id,saver_id,reviewed_by,evidence_reference) VALUES('${otherLegacy}','${publicPost.items[0]}','${USERS.owner}','${USERS.owner}','synthetic audited prior entitlement');`);
 assert.equal((await db.rpc('media_backfill_legacy_keeps',{})).imported,1);
 const reviewed=(await db.rpc('media_list_keeps',actor('owner'))).find(item=>item.source_item_id===publicPost.items[0]);assert.ok(reviewed);
 assert.ok((await db.rpc('media_keep_frame',{...actor('owner'),keep_id:reviewed.id})).path);
 console.log('PASS: explicitly reviewed stable-source entitlement imports without requiring current opt-in/expiry or trusting username snapshots');
 if(reviewed.board_ids.includes(board))await db.rpc('media_remove_board_photo',{...actor('owner'),keep_id:reviewed.id,board_id:board});
 await db.rpc('media_remove_keep',{...actor('owner'),keep_id:reviewed.id});
 assert.equal((await db.rpc('media_backfill_legacy_keeps',{})).imported,0);
 assert.equal((await db.rpc('media_list_keeps',actor('owner'))).some(item=>item.id===otherLegacy),false);
 console.log('PASS: removing a migrated Keep cannot resurrect it from retained legacy records');
 // Snapshot disposal needs its own exact provenance/retention approval, even
 // when the historical source entitlement is already verified as self-owned.
 await db.sql(`INSERT INTO private.legacy_snapshot_cleanup_reviews(legacy_item_id,source_item_id,source_author_id,saver_id,bucket_id,name,reviewed_by,provenance_reference,retention_reference) VALUES('${ownLegacy}','${source.items[0]}','${USERS.owner}','${USERS.owner}','flicd-archive','${legacyPath}','${USERS.stranger}','synthetic exact ownership review','synthetic snapshot retention released'); DELETE FROM public.dump_items WHERE id='${source.items[0]}'`);
 assert.equal((await db.rpc('media_list_keeps',actor('owner'))).some(item=>item.id===oldOwn.id),false);
 await assert.rejects(db.rpc('media_keep_frame',{...actor('owner'),keep_id:oldOwn.id}),/keep_forbidden/);
 assert.equal(await db.sql(`SELECT count(*) FROM private.media_cleanup_jobs WHERE name='${legacyPath}'`),'1');
 console.log('PASS: original-photo deletion revokes imported legacy Keep and memberships transactionally');
}finally{await db.close();}
