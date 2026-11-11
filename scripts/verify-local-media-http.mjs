// Real loopback HTTP -> trusted gateway -> independent PostgreSQL connections.
// Auth and Storage adapters are explicitly synthetic; this is NOT hosted Supabase QA.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createHash,randomUUID,randomBytes } from 'node:crypto';
import { createMediaGateway } from '../server/media/gateway.mjs';
import { runCleanupBatch } from '../server/media/cleanupWorker.mjs';
import { setupMediaDatabase,applyKeepDrafts,seedOnce,USERS,SESSIONS } from './verify-local-media-security.mjs';
const db=await setupMediaDatabase();
const files=new Map();
const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAE0lEQVR4nGP4z8DA8B+MGP4zAAAd8AP9pokTAAAAAABJRU5ErkJggg==','base64');
const digest=(bytes)=>createHash('sha256').update(bytes).digest('hex');
let reads=0,failRead=false,revokeDuringRead=null;
const storage={read:async(bucket,path)=>{
 reads++;if(failRead){failRead=false;throw new Error('injected synthetic interruption');}
 const bytes=files.get(bucket+'/'+path);if(!bytes)throw new Error('missing synthetic object');
 if(revokeDuringRead){const revoke=revokeDuringRead;revokeDuringRead=null;await revoke();}
 return {bytes,type:'image/png'};
},remove:async(bucket,path)=>{
 files.delete(bucket+'/'+path);
 const quote=(text)=>"'"+text.replaceAll("'","''")+"'";
 await db.sql(`DELETE FROM storage.objects WHERE bucket_id=${quote(bucket)} AND name=${quote(path)}`);
}};
const authorize=async(token)=>{
 const role=token==='fixture-device2'?'follower':token.replace('fixture-','');
 if(!Object.hasOwn(USERS,role))throw new Error('invalid synthetic identity');
 return {id:USERS[role],sessionId:token==='fixture-device2'?SESSIONS.secondDevice:SESSIONS[role]};
};
const handler=createMediaGateway({authorize,repository:db,storage,allowedOrigins:['http://127.0.0.1:5178']});
const server=createServer(async(req,res)=>{
 try {
  const buffers=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>8192){res.writeHead(413).end();return;}buffers.push(chunk);}
  const response=await handler(new Request('http://127.0.0.1'+req.url,{method:req.method,headers:req.headers,
   ...(req.method==='POST'?{body:Buffer.concat(buffers)}:{})}));
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(500,{'Cache-Control':'no-store'}).end('local fixture request failed');}
});
try {
 await applyKeepDrafts(db);
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const base='http://127.0.0.1:'+server.address().port;
 const post=await seedOnce(db),ordinary=await seedOnce(db,USERS.stranger,'24h');
 for(const source of [post,ordinary]) {
  const owner=source===post?USERS.owner:USERS.stranger;
  for(let i=0;i<2;i++)files.set('flicd-dump-private/'+owner+'/local-media/'+source.id+'/'+i+'.png',image);
 }
 const call=(route,body,token='fixture-follower')=>fetch(base+'/media/'+route,{method:'POST',headers:{Authorization:'Bearer '+token,Origin:'http://127.0.0.1:5178','Content-Type':'application/json'},body:JSON.stringify(body)});
 const page=()=>({dumpId:post.id,attemptId:randomUUID(),pageSecret:randomBytes(32).toString('hex')});
 const session=page();
 assert.equal((await call('post',{dumpId:post.id})).status,200);assert.equal(reads,0);
 console.log('PASS: HTTP metadata opening issues zero private byte reads');
 const raced=await Promise.all([call('once/claim',session),...Array.from({length:5},()=>call('once/claim',page()))]);
 assert.equal(raced.filter(x=>x.status===200).length,1);assert.equal(raced.filter(x=>x.status===409).length,5);
 // The deterministic page may lose this race: obtain its live capability only if it won.
 const winnerIndex=raced.findIndex(x=>x.status===200);
 // Run delivery on a fresh post rather than inventing the winning page's secret.
 const delivery=await seedOnce(db);for(let i=0;i<2;i++)files.set('flicd-dump-private/'+USERS.owner+'/local-media/'+delivery.id+'/'+i+'.png',image);
 const live={...page(),dumpId:delivery.id};
 const claimed=await call('once/claim',live);assert.equal(claimed.status,200);const grant=await claimed.json();
 const frame={claimId:grant.claim_id,itemId:delivery.items[0],pageSecret:live.pageSecret};
 failRead=true;assert.equal((await call('once/frame',frame)).status,503);
 assert.equal((await call('once/claim',live)).status,200);
 assert.equal((await call('once/claim',{...live,attemptId:randomUUID(),pageSecret:randomBytes(32).toString('hex')})).status,409);
 assert.equal((await call('once/frame',frame,'fixture-device2')).status,403);
 for(const itemId of delivery.items){const response=await call('once/frame',{...frame,itemId});assert.equal(response.status,200);assert.equal(digest(Buffer.from(await response.arrayBuffer())),digest(image));assert.equal(response.headers.get('Cache-Control'),'private, no-store, max-age=0');}
 console.log('PASS: HTTP concurrent pages have one winner; interrupted delivery recovers only same page; wrong device denied; both PNG frames match SHA-256');
 assert.ok(winnerIndex>=0);
 assert.equal((await call('once/close',{claimId:grant.claim_id,pageSecret:live.pageSecret})).status,200);
 assert.equal((await call('once/frame',frame)).status,403);assert.equal((await call('once/claim',live)).status,409);
 assert.equal((await call('post',{dumpId:delivery.id})).status,200);
 assert.equal((await call('owner/frame',{itemId:delivery.items[0]},'fixture-owner')).status,200);
 assert.equal((await call('owner/frame',{itemId:delivery.items[0]})).status,403);
 console.log('PASS: close locks bytes without hiding metadata; only legitimate author retains management access');
 const savedResponse=await call('keeps/save',{dumpId:ordinary.id,itemPosition:0,source_author_id:USERS.owner});assert.equal(savedResponse.status,200);
 const saved=await savedResponse.json();assert.equal(saved.source_author_id,USERS.stranger);
 await db.sql(`UPDATE public.dumps SET created_at=clock_timestamp()-interval '25 hours',allow_others_to_keep=false WHERE id='${ordinary.id}'`);
 assert.equal((await call('keeps/frame',{keepId:saved.id})).status,200);
 await db.sql(`DELETE FROM public.dumps WHERE id='${ordinary.id}'`);
 const readsBefore=reads;assert.equal((await call('keeps/frame',{keepId:saved.id})).status,403);assert.equal(reads,readsBefore);
 assert.ok(files.has('flicd-dump-private/'+USERS.stranger+'/local-media/'+ordinary.id+'/0.png'));
 const cleanup=await runCleanupBatch({repository:db,storage});assert.equal(cleanup.length,2);assert.ok(cleanup.every(x=>x.status==='completed'));
 assert.equal(files.has('flicd-dump-private/'+USERS.stranger+'/local-media/'+ordinary.id+'/0.png'),false);
 console.log('PASS: authorized HTTP Keep survives expiry; source deletion denies before bytes are read; actual cleanup worker removes both synthetic objects');
 const buffered=await seedOnce(db);for(let i=0;i<2;i++)files.set('flicd-dump-private/'+USERS.owner+'/local-media/'+buffered.id+'/'+i+'.png',image);
 const bufferedPage={...page(),dumpId:buffered.id};const bufferedGrant=await(await call('once/claim',bufferedPage)).json();
 revokeDuringRead=()=>db.sql(`DELETE FROM public.dumps WHERE id='${buffered.id}'`);
 const revoked=await call('once/frame',{claimId:bufferedGrant.claim_id,itemId:buffered.items[0],pageSecret:bufferedPage.pageSecret});
 assert.equal(revoked.status,403);assert.match(revoked.headers.get('Content-Type'),/application\/json/);
 assert.equal((await runCleanupBatch({repository:db,storage})).filter(job=>job.status==='completed').length,2);
 console.log('PASS: real source deletion during buffered HTTP download fails the second authorization and returns no media; cleanup then removes originals');
 const archived=await seedOnce(db,USERS.owner,'24h'),originalPath=USERS.owner+'/local-media/'+archived.id+'/0.png',archivePath=USERS.owner+'/'+archived.id+'/0.png';
 files.set('flicd-dump-private/'+originalPath,image);
 const archivedKeep=await(await call('keeps/save',{dumpId:archived.id,itemPosition:0,itemId:archived.items[0]})).json();
 const originalObjectId=await db.sql(`SELECT id FROM storage.objects WHERE name='${originalPath}'`);
 await db.sql(`DELETE FROM storage.objects WHERE name='${originalPath}'; INSERT INTO storage.objects(bucket_id,name) VALUES('flicd-archive','${archivePath}'); INSERT INTO public.flicd_archive_items(user_id,dump_id,item_position,archive_path) VALUES('${USERS.owner}','${archived.id}',0,'${archivePath}')`);
 files.delete('flicd-dump-private/'+originalPath);files.set('flicd-archive/'+archivePath,image);
 await assert.rejects(db.sql(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${USERS.owner}',false); INSERT INTO storage.objects(bucket_id,name) VALUES('flicd-dump-private','${originalPath}')`),/row-level security/);
 const archiveResponse=await call('keeps/frame',{keepId:archivedKeep.id});assert.equal(archiveResponse.status,200);assert.equal(digest(Buffer.from(await archiveResponse.arrayBuffer())),digest(image));
 // Fault injection beyond browser permissions: even copied paths cannot replace
 // the pinned Storage identity or override the archive with unrelated bytes.
 await db.sql(`INSERT INTO storage.objects(bucket_id,name) VALUES('flicd-dump-private','${originalPath}')`);
 files.set('flicd-dump-private/'+originalPath,Buffer.from('synthetic unrelated replacement bytes'));
 const protectedResponse=await call('keeps/frame',{keepId:archivedKeep.id});assert.equal(protectedResponse.status,200);assert.equal(digest(Buffer.from(await protectedResponse.arrayBuffer())),digest(image));
 console.log('PASS: archived Keep HTTP SHA-256 is unchanged after denied uploader recreation and privileged replacement-object fault injection');
 await db.sql(`DELETE FROM storage.objects WHERE name='${originalPath}'; INSERT INTO storage.objects(id,bucket_id,name) VALUES('${originalObjectId}','flicd-dump-private','${originalPath}')`);
 files.set('flicd-dump-private/'+originalPath,image);
 revokeDuringRead=()=>db.sql(`DELETE FROM storage.objects WHERE name='${originalPath}'; INSERT INTO storage.objects(bucket_id,name) VALUES('flicd-dump-private','${originalPath}')`);
 const changed=await call('keeps/frame',{keepId:archivedKeep.id});assert.equal(changed.status,403);assert.match(changed.headers.get('Content-Type'),/application\/json/);
 console.log('PASS: buffered HTTP delivery rejects a source-location change even when the archived entitlement remains valid');
}finally{
 await new Promise(resolve=>server.close(resolve));
 await db.close();
}
