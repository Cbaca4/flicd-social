import { describe,it,expect,vi } from 'vitest';
import { createSupabaseMediaAdapters } from './supabaseAdapter.mjs';
import { runCleanupBatch } from './cleanupWorker.mjs';
const uid='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',sid='22222222-2222-4222-8222-222222222222';
const token=(sub=uid,extra={})=>'fixture.'+Buffer.from(JSON.stringify({sub,session_id:sid,exp:Math.floor(Date.now()/1000)+300,...extra})).toString('base64url')+'.fixture';
describe('trusted backend adapters',()=>{
 it.each([{exp:0},{exp:null},{exp:'9999999999'},{session_id:'------------------------------------'}])('rejects invalid verified-token lifetime or session identifiers without normalizing them',async(extra)=>{
  const client={auth:{getUser:vi.fn().mockResolvedValue({data:{user:{id:uid}},error:null})}};
  await expect(createSupabaseMediaAdapters({client}).authorize(token(uid,extra))).rejects.toThrow('authentication_required');
 });
 it('requires Auth server validation before extracting the verified session claim',async()=>{
  const client={auth:{getUser:vi.fn().mockResolvedValue({data:{user:{id:uid}},error:null})}};
  const adapters=createSupabaseMediaAdapters({client});
  expect(await adapters.authorize(token())).toEqual({id:uid,sessionId:sid});
  await expect(adapters.authorize(token('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'))).rejects.toThrow();
  client.auth.getUser.mockResolvedValue({data:{user:null},error:new Error('rejected')});
  await expect(adapters.authorize(token())).rejects.toThrow();
 });
 it('passes only the JSON argument to the trusted RPC and never returns backend errors as data',async()=>{
  const client={rpc:vi.fn().mockResolvedValue({data:{ok:true},error:null})};const {repository}=createSupabaseMediaAdapters({client});
  expect(await repository.rpc('media_post_metadata',{viewer_id:uid})).toEqual({ok:true});
  expect(client.rpc).toHaveBeenCalledWith('media_post_metadata',{p:{viewer_id:uid}});
  client.rpc.mockResolvedValue({data:null,error:new Error('denied')});await expect(repository.rpc('media_post_metadata',{})).rejects.toThrow();
 });
 it('cleanup failures reschedule jobs; stale leases are not reported as complete',async()=>{
  const jobs=[{id:'one',lease_token:'lease-1',bucket_id:'flicd-dump-private',name:uid+'/one.png'},{id:'two',lease_token:'lease-2',bucket_id:'flicd-dump-private',name:uid+'/two.png'}];
  const repository={rpc:vi.fn(async(name)=>name==='media_lease_cleanup'?jobs:name==='media_cleanup_authorized'?{authorized:true}:name==='media_finish_cleanup'?{completed:false}:{})};
  const storage={remove:vi.fn().mockRejectedValueOnce(new Error('interruption')).mockResolvedValueOnce(undefined)};
  const result=await runCleanupBatch({repository,storage});expect(result).toEqual([{id:'one',status:'retry_scheduled'},{id:'two',status:'stale_lease'}]);
  expect(repository.rpc.mock.calls.map(x=>x[0])).toEqual(['media_reconcile_cleanup','media_lease_cleanup','media_cleanup_authorized','media_fail_cleanup','media_cleanup_authorized','media_finish_cleanup']);
 });
});
