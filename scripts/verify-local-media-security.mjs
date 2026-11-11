import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { createLocalDatabase } from '../tests/security/localPostgres.mjs';
export const USERS = { owner:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', follower:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', stranger:'cccccccc-cccc-cccc-cccc-cccccccccccc' };
export const SESSIONS = { owner:'11111111-1111-4111-8111-111111111111', follower:'22222222-2222-4222-8222-222222222222', secondDevice:'22222222-2222-4222-8222-222222222223', stranger:'33333333-3333-4333-8333-333333333333' };
export const binding = (value) => createHash('sha256').update(value).digest('hex');
export const actor = (role) => ({ viewer_id:USERS[role],auth_session_id:SESSIONS[role] });
export const MEDIA_REVIEW_MIGRATIONS = [
 '20261019010000_per_account_view_once.sql','20261019011000_managed_photo_keeps.sql',
 '20261020010000_keep_library_and_legacy_review.sql','20261020011000_media_authority_final_boundaries.sql',
 '20261021010000_preserve_media_identity_and_legacy_evidence.sql',
];
export async function applyKeepDrafts(db,{remediation=true}={}) {
 for(const file of MEDIA_REVIEW_MIGRATIONS.slice(1,remediation?undefined:-1))await db.file('supabase/migrations/'+file);
}
export async function setupMediaDatabase({drafts=true,full=false,remediation=true}={}) {
  const db=await createLocalDatabase();
  try {
    for(const file of [
      'tests/security/bootstrap.sql','tests/security/local-media-bootstrap.sql',
      'supabase/migrations/20260918050000_flicd_archive_and_expiry.sql',
      'supabase/migrations/20261018050000_stage_private_dump_media_and_membership.sql',
      'supabase/migrations/20261018163000_restrict_message_request_updates.sql',
      'supabase/migrations/20261018170000_move_member_rls_helper_private.sql',
    ])await db.file(file);
    if(drafts)await db.file('supabase/migrations/20261019010000_per_account_view_once.sql');
    if(full)await applyKeepDrafts(db,{remediation});
    return db;
  }catch(error){await db.close();throw error;}
}
export async function seedOnce(db,owner=USERS.owner,expiry='once') {
  const id=randomUUID(),items=[randomUUID(),randomUUID()];
  await db.sql(`INSERT INTO public.dumps(id,user_id,expiry,context,allow_others_to_keep) VALUES('${id}','${owner}','${expiry}','synthetic local media',true);`);
  for(let position=0;position<items.length;position++) {
    const path=`${owner}/local-media/${id}/${position}.png`;
    await db.sql(`INSERT INTO public.dump_items(id,dump_id,position,image_path,media_bucket,note) VALUES('${items[position]}','${id}',${position},'${path}','flicd-dump-private','synthetic frame'); INSERT INTO storage.objects(bucket_id,name) VALUES('flicd-dump-private','${path}');`);
  }
  return {id,items};
}
async function run() {
 const db=await setupMediaDatabase({drafts:!process.argv.includes('--without-drafts'),full:!process.argv.includes('--without-drafts')});
 try {
  const post=await seedOnce(db);
  const payload={...actor('follower'),dump_id:post.id,attempt_id:randomUUID(),binding_hash:binding('page-one')};
  const results=[];
  const check=async(name,fn)=>{await fn();results.push({name,status:'PASS'});console.log(`PASS: ${name}`);};
  let claim;
  await check('eligible accepted follower receives a database claim',async()=>{
    claim=await db.rpc('media_claim_view_once',payload);assert.equal(claim.status,'claimed');assert.equal(claim.dump_id,post.id);
  });
  await check('same live-page lost-ack retry recovers only the same claim',async()=>{
    const recovered=await db.rpc('media_claim_view_once',payload);
    assert.equal(recovered.status,'recovered');assert.equal(recovered.claim_id,claim.claim_id);
  });
  await check('new tab and second authenticated device cannot reclaim',async()=>{
    await assert.rejects(db.rpc('media_claim_view_once',{...payload,attempt_id:randomUUID(),binding_hash:binding('another-tab')}),/media_consumed/);
    await assert.rejects(db.rpc('media_claim_view_once',{...payload,auth_session_id:SESSIONS.secondDevice}),/media_consumed/);
  });
  const frame={...actor('follower'),claim_id:claim.claim_id,binding_hash:payload.binding_hash};
  await check('all frames are authorized within the single session',async()=>{
    for(const item_id of post.items)assert.equal((await db.rpc('media_once_frame',{...frame,item_id})).item_id,item_id);
  });
  await check('post metadata survives consumption without media paths',async()=>{
    const metadata=await db.rpc('media_post_metadata',{...actor('follower'),dump_id:post.id});
    assert.equal(metadata.id,post.id);assert.equal(metadata.viewed,true);assert.equal(metadata.dump_items.length,2);
    assert.equal(JSON.stringify(metadata).includes('image_path'),false);
    assert.equal(await db.sql(`SELECT once_viewed_at IS NULL FROM public.dumps WHERE id='${post.id}'`),'t');
    assert.equal(await db.sql(`SELECT count(*) FROM public.flicd_archive WHERE dump_id='${post.id}'`),'0');
  });
  await check('closing never refunds consumption or permits a frame retry',async()=>{
    await db.rpc('media_close_view_once',frame);
    await assert.rejects(db.rpc('media_once_frame',{...frame,item_id:post.items[0]}),/media_session_denied/);
    await assert.rejects(db.rpc('media_claim_view_once',payload),/media_consumed/);
  });
  await check('pending and unrelated private-author viewers are denied',async()=>{
    const fresh=await seedOnce(db);
    await assert.rejects(db.rpc('media_claim_view_once',{...actor('stranger'),dump_id:fresh.id,attempt_id:randomUUID(),binding_hash:binding('private-stranger')}),/media_forbidden/);
    await db.sql(`UPDATE public.follows SET status='pending' WHERE follower_id='${USERS.follower}' AND following_id='${USERS.owner}'`);
    await assert.rejects(db.rpc('media_claim_view_once',{...payload,dump_id:fresh.id}),/media_forbidden/);
    await db.sql(`UPDATE public.follows SET status='accepted' WHERE follower_id='${USERS.follower}' AND following_id='${USERS.owner}'`);
  });
  await check('concurrent same-account independent pages yield exactly one claim',async()=>{
    const fresh=await seedOnce(db);
    const attempts=await Promise.allSettled(Array.from({length:8},(_,index)=>db.rpc('media_claim_view_once',{
      ...actor('follower'),dump_id:fresh.id,attempt_id:randomUUID(),binding_hash:binding('race-'+index),
    })));
    assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);
    for(const rejected of attempts.filter(x=>x.status==='rejected'))assert.match(rejected.reason.message,/media_consumed/);
    assert.equal(await db.sql(`SELECT count(*) FROM private.view_once_claims WHERE dump_id='${fresh.id}'`),'1');
  });
  await check('different accounts reveal public-author post concurrently and independently',async()=>{
    const fresh=await seedOnce(db,USERS.stranger);
    const grants=await Promise.all(['owner','follower','stranger'].map(role=>db.rpc('media_claim_view_once',{
      ...actor(role),dump_id:fresh.id,attempt_id:randomUUID(),binding_hash:binding(role),
    })));
    assert.equal(new Set(grants.map(x=>x.claim_id)).size,3);assert.ok(grants.every(x=>x.status==='claimed'));
  });
  await check('expired transport lease does not reset the permanent claim',async()=>{
    const fresh=await seedOnce(db);const request={...payload,dump_id:fresh.id};
    const grant=await db.rpc('media_claim_view_once',request);
    await db.sql(`UPDATE private.view_once_claims SET lease_until=clock_timestamp()-interval '1 second' WHERE claim_id='${grant.claim_id}'`);
    await assert.rejects(db.rpc('media_claim_view_once',request),/media_consumed/);
    await assert.rejects(db.rpc('media_once_frame',{...frame,claim_id:grant.claim_id,item_id:fresh.items[0]}),/media_session_denied/);
  });
  await check('bilateral blocks deny new claims and suspend active delivery',async()=>{
    const fresh=await seedOnce(db);const grant=await db.rpc('media_claim_view_once',{...payload,dump_id:fresh.id});
    for(const [a,b] of [[USERS.owner,USERS.follower],[USERS.follower,USERS.owner]]) {
      await db.sql(`INSERT INTO private.account_blocks VALUES('${a}','${b}')`);
      await assert.rejects(db.rpc('media_once_frame',{...frame,claim_id:grant.claim_id,item_id:fresh.items[0]}),/media_session_denied/);
      await assert.rejects(db.rpc('media_post_metadata',{...actor('follower'),dump_id:fresh.id}),/media_forbidden/);
      await db.sql('DELETE FROM private.account_blocks');
    }
  });
  await check('revoked login session cannot deliver or recover; new login cannot refund',async()=>{
    const fresh=await seedOnce(db);const grant=await db.rpc('media_claim_view_once',{...payload,dump_id:fresh.id});
    await db.sql(`DELETE FROM auth.sessions WHERE id='${SESSIONS.follower}'`);
    await assert.rejects(db.rpc('media_once_frame',{...frame,claim_id:grant.claim_id,item_id:fresh.items[0]}),/media_session_denied/);
    await assert.rejects(db.rpc('media_claim_view_once',{...payload,dump_id:fresh.id,auth_session_id:SESSIONS.secondDevice}),/media_consumed/);
    await db.sql(`INSERT INTO auth.sessions VALUES('${SESSIONS.follower}','${USERS.follower}')`);
  });
  await check('authenticated/anonymous callers cannot invoke privileged claims or write consumption',async()=>{
    for(const role of ['authenticated','anon'])await assert.rejects(db.rpc('media_claim_view_once',payload,role),/permission denied/);
    await assert.rejects(db.sql(`SET ROLE authenticated; INSERT INTO public.dump_views VALUES('${post.id}','${USERS.owner}')`),/permission denied/);
  });
  await check('direct Storage SELECT hides once media even from its uploader',async()=>{
    for(const role of ['owner','follower','stranger']) {
      const response=await db.sql(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${USERS[role]}',false); SELECT count(*) FROM storage.objects WHERE name LIKE '%${post.id}%';`);
      assert.equal(response.split(/\r?\n/).at(-1),'0');
    }
  });
  await check('raw once item paths stay inaccessible while parent metadata stays visible',async()=>{
    const response=await db.sql(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${USERS.follower}',false); SELECT count(*) FROM public.dumps WHERE id='${post.id}'; SELECT count(*) FROM public.dump_items WHERE dump_id='${post.id}';`);
    assert.deepEqual(response.split(/\r?\n/).slice(-2),['1','0']);
  });
  await check('24-hour posts cannot consume a View Once grant',async()=>{
    const fresh=await seedOnce(db,USERS.owner,'24h');
    await assert.rejects(db.rpc('media_claim_view_once',{...payload,dump_id:fresh.id}),/not_view_once/);
  });
  console.log(JSON.stringify({suite:'local PostgreSQL media authorization',database:db.database,checks:results.length,results},null,2));
 }finally{await db.close();}
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/verify-local-media-security.mjs'))run().catch(error=>{console.error(error.message);process.exitCode=1;});
