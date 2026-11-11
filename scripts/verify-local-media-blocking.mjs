import assert from 'node:assert/strict';
import { setupMediaDatabase,seedOnce,actor,USERS } from './verify-local-media-security.mjs';
const db=await setupMediaDatabase({full:true});
try {
 const source=await seedOnce(db,USERS.stranger,'24h');
 const saved=await db.rpc('media_save_photo',{...actor('follower'),dump_id:source.id,item_position:0});
 for(const [a,b] of [['follower','stranger'],['stranger','follower']]) {
  await db.rpc('media_set_account_block',{...actor(a),account_id:USERS[b],blocked:true});
  assert.equal((await db.rpc('media_account_block_status',{...actor(a),account_id:USERS[b]})).blocked_by_me,true);
  assert.deepEqual(await db.rpc('media_list_keeps',actor('follower')),[]);
  await assert.rejects(db.rpc('media_keep_frame',{...actor('follower'),keep_id:saved.id}),/keep_forbidden/);
  const raw=await db.sql(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${USERS.follower}',false); SELECT count(*) FROM storage.objects WHERE name LIKE '%${source.id}%';`);
  assert.equal(raw.split(/\r?\n/).at(-1),'0');
  await db.rpc('media_set_account_block',{...actor(b),account_id:USERS[a],blocked:false});
  assert.equal((await db.rpc('media_list_keeps',actor('follower'))).length,0);
  await db.rpc('media_set_account_block',{...actor(a),account_id:USERS[b],blocked:false});
  assert.equal((await db.rpc('media_list_keeps',actor('follower')))[0].id,saved.id);
 }
 console.log('PASS: actual block/unblock RPCs suspend canonical Keep and direct original Storage access in both directions without deleting grants; only blocker can remove their block');
 await assert.rejects(db.rpc('media_set_account_block',{...actor('follower'),account_id:USERS.follower,blocked:true}),/media_forbidden/);
 await assert.rejects(db.rpc('media_set_account_block',{...actor('follower'),account_id:USERS.stranger,blocked:true},'authenticated'),/permission denied/);
 console.log('PASS: self-block and direct untrusted safety RPC calls denied');
}finally{await db.close();}
