import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setupMediaDatabase,MEDIA_REVIEW_MIGRATIONS,seedOnce,actor,USERS,SESSIONS,binding } from './verify-local-media-security.mjs';
const db=await setupMediaDatabase({drafts:false});
const page=(dump,who='follower')=>({...actor(who),dump_id:dump.id,attempt_id:randomUUID(),binding_hash:binding(randomUUID())});
try {
 const legacy=await seedOnce(db,USERS.stranger);
 await db.sql(`UPDATE public.dumps SET created_at=clock_timestamp()-interval '40 days',once_viewed_at=clock_timestamp() WHERE id='${legacy.id}'; INSERT INTO public.dump_views(dump_id,user_id) VALUES('${legacy.id}','${USERS.owner}');`);
 for(const file of MEDIA_REVIEW_MIGRATIONS)await db.file('supabase/migrations/'+file);
 await assert.rejects(db.rpc('media_claim_view_once',page(legacy,'owner')),/media_consumed/);
 assert.equal((await db.rpc('media_claim_view_once',page(legacy))).status,'claimed');
 console.log('PASS: legacy per-account consumption backfills closed, global timestamps and 40-day age do not consume another account');
 const archived=await seedOnce(db);const archivedPath=USERS.owner+'/'+archived.id+'/0.png';
 await db.sql(`DELETE FROM storage.objects WHERE name LIKE '%${archived.id}/0.png'; INSERT INTO storage.objects(bucket_id,name) VALUES('flicd-archive','${archivedPath}'); INSERT INTO public.flicd_archive_items(user_id,dump_id,item_position,archive_path) VALUES('${USERS.owner}','${archived.id}',0,'${archivedPath}');`);
 const p=page(archived),grant=await db.rpc('media_claim_view_once',p);
 const frame={...actor('follower'),claim_id:grant.claim_id,binding_hash:p.binding_hash,item_id:archived.items[0]};
 assert.equal((await db.rpc('media_once_frame',frame)).bucket,'flicd-archive');
 console.log('PASS: eligible viewer receives legitimate retired-to-owner-archive original through same entitlement, never owner privilege');
 const forged=await seedOnce(db);const forgedPath=USERS.owner+'/'+forged.id+'/0.png';
 await db.sql(`DELETE FROM storage.objects WHERE name LIKE '%${forged.id}/0.png'; INSERT INTO storage.objects(bucket_id,name) VALUES('flicd-archive','${forgedPath}'); INSERT INTO public.flicd_archive_items(user_id,dump_id,item_position,archive_path) VALUES('${USERS.stranger}','${forged.id}',0,'${forgedPath}');`);
 await assert.rejects(db.rpc('media_claim_view_once',page(forged)),/media_unavailable/);
 console.log('PASS: wrong archive account/provenance cannot authorize legacy media');
 await db.sql(`DELETE FROM public.follows WHERE follower_id='${USERS.follower}' AND following_id='${USERS.owner}'`);
 await assert.rejects(db.rpc('media_once_frame',frame),/media_session_denied/);
 await db.sql(`INSERT INTO public.follows(follower_id,following_id,status) VALUES('${USERS.follower}','${USERS.owner}','accepted'); INSERT INTO private.media_account_restrictions(user_id,suspended) VALUES('${USERS.follower}',true)`);
 await assert.rejects(db.rpc('media_once_frame',frame),/media_session_denied/);
 await db.sql(`DELETE FROM private.media_account_restrictions`);
 await assert.rejects(db.rpc('media_once_frame',{...frame,auth_session_id:SESSIONS.stranger}),/media_session_denied/);
 await assert.rejects(db.rpc('media_once_frame',{...frame,item_id:forged.items[0]}),/wrong_session_item/);
 console.log('PASS: follower revocation, suspension, wrong account-session pairing and cross-post item delivery denied');
 await db.sql(`UPDATE auth.sessions SET not_after=clock_timestamp()-interval '1 second' WHERE id='${SESSIONS.follower}'`);
 await assert.rejects(db.rpc('media_once_frame',frame),/media_session_denied/);
 await db.sql(`UPDATE auth.sessions SET not_after=null WHERE id='${SESSIONS.follower}'`);
 console.log('PASS: expired provider-session row denies bytes even before asynchronous Auth row cleanup');
 const raced=await seedOnce(db);const request=page(raced);
 const outcomes=await Promise.allSettled([db.rpc('media_claim_view_once',request),db.sql(`DELETE FROM public.dumps WHERE id='${raced.id}'`)]);
 assert.equal(outcomes[1].status,'fulfilled');
 assert.equal(await db.sql(`SELECT count(*) FROM private.view_once_claims WHERE dump_id='${raced.id}'`),'0');
 await assert.rejects(db.rpc('media_claim_view_once',request),/media_forbidden/);
 if(outcomes[0].status==='fulfilled')await assert.rejects(db.rpc('media_once_frame',{...actor('follower'),claim_id:outcomes[0].value.claim_id,binding_hash:request.binding_hash,item_id:raced.items[0]}),/media_session_denied/);
 console.log('PASS: real source-delete/claim connection race cannot leave a grant or deliver deleted media');
 const photo=await seedOnce(db,USERS.stranger,'24h');
 for(const operation of ['UPDATE storage.objects SET name=name','DELETE FROM storage.objects']) {
  const changed=await db.sql(`BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${USERS.stranger}',true); WITH changed AS(${operation} WHERE name='${USERS.stranger}/local-media/${photo.id}/0.png' RETURNING id) SELECT count(*) FROM changed; ROLLBACK;`);
  assert.equal(changed.split(/\r?\n/).at(-2),'0');
 }
 console.log('PASS: even the uploader cannot overwrite/remove posted original bytes behind source identity and Keep grants');
 await assert.rejects(db.rpc('media_save_photo',{...actor('follower'),dump_id:photo.id,item_position:0,item_id:photo.items[1]}),/keep_forbidden/);
 const attempts=await Promise.all(Array.from({length:6},()=>db.rpc('media_save_photo',{...actor('follower'),dump_id:photo.id,item_position:0})));
 assert.equal(new Set(attempts.map(item=>item.id)).size,1);
 const [leasesA,leasesB]=await Promise.all([db.rpc('media_lease_cleanup',{}),db.rpc('media_lease_cleanup',{})]);
 assert.equal(leasesA.some(a=>leasesB.some(b=>a.id===b.id)),false);
 console.log('PASS: concurrent Keep saves converge on one entitlement; concurrent cleanup workers never share an active lease');
 // Deliberately overlapping legacy permissive policies must not reopen media.
 await db.sql(`GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO anon; CREATE POLICY synthetic_broad_anon ON storage.objects FOR ALL TO anon USING(true) WITH CHECK(true); CREATE POLICY synthetic_broad_authenticated ON storage.objects FOR ALL TO authenticated USING(true) WITH CHECK(true);`);
 const anonymous=await db.sql(`SET ROLE anon; SELECT count(*) FROM storage.objects WHERE bucket_id='flicd-dump-private' AND name LIKE '%${photo.id}%'`);
 assert.equal(anonymous.split(/\r?\n/).at(-1),'0');
 console.log('PASS: overlapping anonymous permissive policy cannot open private media');
 const privatePost=await seedOnce(db);
 const ordinaryPrivate=await seedOnce(db,USERS.owner,'24h');
 for(const target of [privatePost,ordinaryPrivate]) {
  const raw=await db.sql(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${USERS.stranger}',false); SELECT count(*) FROM storage.objects WHERE name LIKE '%${target.id}%'`);
  assert.equal(raw.split(/\r?\n/).at(-1),'0');
 }
 console.log('PASS: overlapping authenticated policy cannot bypass private-author visibility or trusted View Once delivery');
 const ordinaryCount=async who=>(await db.sql(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${USERS[who]}',false); SELECT count(*) FROM storage.objects WHERE name LIKE '%${ordinaryPrivate.id}%'`)).split(/\r?\n/).at(-1);
 assert.equal(await ordinaryCount('follower'),'2');
 await db.sql(`UPDATE public.dumps SET created_at=clock_timestamp()-interval '25 hours' WHERE id='${ordinaryPrivate.id}'`);
 assert.equal(await ordinaryCount('follower'),'0');assert.equal(await ordinaryCount('owner'),'2');
 const pending=USERS.owner+'/pending-local-upload.png';
 await db.sql(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${USERS.owner}',false); INSERT INTO storage.objects(bucket_id,name) VALUES('flicd-dump-private','${pending}')`);
 const strangerPending=await db.sql(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${USERS.stranger}',false); SELECT count(*) FROM storage.objects WHERE name='${pending}'`);
 assert.equal(strangerPending.split(/\r?\n/).at(-1),'0');
 await assert.rejects(db.sql(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${USERS.stranger}',false); INSERT INTO storage.objects(bucket_id,name) VALUES('flicd-dump-private','${USERS.owner}/forged.png')`),/row-level security/);
 const cleaned=await db.sql(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${USERS.owner}',false); WITH changed AS(DELETE FROM storage.objects WHERE name='${pending}' RETURNING id) SELECT count(*) FROM changed`);
 assert.equal(cleaned.split(/\r?\n/).at(-1),'1');
 console.log('PASS: overlap cannot bypass ordinary expiry, private upload isolation or ownership; legitimate live repeated views, owner archives and unassociated-upload cleanup remain available');
}finally{await db.close();}
