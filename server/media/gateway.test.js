import { describe, it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { createMediaGateway } from './gateway.mjs';
const uid='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const session='22222222-2222-4222-8222-222222222222';
const id='10000000-0000-4000-8000-000000000001';
const secret='a'.repeat(64);
const origin='http://127.0.0.1:5178';
const request=(route,body={},headers={})=>new Request('http://127.0.0.1:9339/media/'+route,{
 method:'POST',headers:{Origin:origin,Authorization:'Bearer synthetic-test-token','Content-Type':'application/json',...headers},body:JSON.stringify(body),
});
function fixture() {
 const authorize=vi.fn().mockResolvedValue({id:uid,sessionId:session});
 const repository={rpc:vi.fn().mockResolvedValue({claim_id:id,status:'claimed',items:[]})};
 const storage={read:vi.fn().mockResolvedValue({bytes:new Uint8Array([137,80,78,71]),type:'image/png'})};
 return {authorize,repository,storage,handler:createMediaGateway({authorize,repository,storage,allowedOrigins:[origin]})};
}
describe('trusted media gateway',()=>{
 it('derives claim identity and binding from verified authentication, never body identity',async()=>{
  const f=fixture();const response=await f.handler(request('once/claim',{dumpId:id,attemptId:id,pageSecret:secret,viewer_id:id,auth_session_id:id,binding_hash:'forged'}));
  expect(response.status).toBe(200);
  expect(f.repository.rpc).toHaveBeenCalledWith('media_claim_view_once',{
   viewer_id:uid,auth_session_id:session,dump_id:id,attempt_id:id,
   binding_hash:createHash('sha256').update(secret).digest('hex'),
  });
  expect(f.storage.read).not.toHaveBeenCalled();
 });
 it('metadata does not claim entitlement or request media bytes',async()=>{
  const f=fixture();await f.handler(request('post',{dumpId:id}));
  expect(f.repository.rpc).toHaveBeenCalledWith('media_post_metadata',{viewer_id:uid,auth_session_id:session,dump_id:id});
  expect(f.storage.read).not.toHaveBeenCalled();
 });
 it('owner archive listing derives ownership from verified identity, not a requested owner',async()=>{
  const f=fixture();const response=await f.handler(request('owner/archive',{viewer_id:id}));
  expect(response.status).toBe(200);
  expect(f.repository.rpc).toHaveBeenCalledWith('media_owner_archive',{viewer_id:uid,auth_session_id:session});
  expect(f.storage.read).not.toHaveBeenCalled();
 });
 it('denies unverified callers before touching authority or Storage',async()=>{
  const f=fixture();f.authorize.mockRejectedValue(new Error('invalid auth'));
  const response=await f.handler(request('post',{dumpId:id}));
  expect(response.status).toBe(401);expect(f.repository.rpc).not.toHaveBeenCalled();
 });
 it('does not expose a frame when authority is revoked during backend download',async()=>{
  const f=fixture();f.repository.rpc.mockResolvedValueOnce({bucket:'flicd-dump-private',path:uid+'/frame.png'}).mockRejectedValueOnce(new Error('media_session_denied'));
  const response=await f.handler(request('once/frame',{claimId:id,itemId:id,pageSecret:secret}));
  expect(response.status).toBe(403);expect(f.storage.read).toHaveBeenCalledOnce();
  expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0');
 });
 it('returns bytes only after authorization and a post-download recheck, never signed URLs',async()=>{
  const f=fixture();f.repository.rpc.mockResolvedValue({bucket:'flicd-dump-private',path:uid+'/frame.png'});
  const response=await f.handler(request('once/frame',{claimId:id,itemId:id,pageSecret:secret,path:'attacker/path',bucket:'flicd-media'}));
  expect(response.status).toBe(200);expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([137,80,78,71]);
  expect(f.repository.rpc).toHaveBeenCalledTimes(2);
  expect(f.storage.read).toHaveBeenCalledWith('flicd-dump-private',uid+'/frame.png');
  expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
 });
 it.each([['once/frame',{claimId:id,itemId:id,pageSecret:secret}],['keeps/frame',{keepId:id}],['owner/frame',{itemId:id}]])('rejects a changed source location during buffered %s delivery',async(route,body)=>{
  const f=fixture();
  f.repository.rpc.mockResolvedValueOnce({bucket:'flicd-dump-private',path:uid+'/frame.png'}).mockResolvedValueOnce({bucket:'flicd-archive',path:uid+'/archived.png'});
  const response=await f.handler(request(route,body));
  expect(response.status).toBe(403);expect(response.headers.get('Content-Type')).toContain('application/json');
  expect(await response.text()).not.toContain('frame.png');
 });
 it('download failure cannot issue a refund or create a replacement claim',async()=>{
  const f=fixture();f.repository.rpc.mockResolvedValue({bucket:'flicd-dump-private',path:uid+'/frame.png'});
  f.storage.read.mockRejectedValue(new Error('synthetic interruption'));
  const response=await f.handler(request('once/frame',{claimId:id,itemId:id,pageSecret:secret}));
  expect(response.status).toBe(503);expect(f.repository.rpc).toHaveBeenCalledTimes(1);
 });
 it('rejects hostile origins, query capabilities, malformed keys and anonymous bearer input',async()=>{
  const f=fixture();expect((await f.handler(request('post',{dumpId:id},{Origin:'https://untrusted.invalid'}))).status).toBe(403);
  expect((await f.handler(new Request('http://127.0.0.1:9339/media/once/frame?pageSecret='+secret))).status).toBe(400);
  expect((await f.handler(request('once/claim',{dumpId:id,attemptId:id,pageSecret:'short'}))).status).toBe(400);
  expect((await f.handler(request('post',{dumpId:id},{Authorization:''}))).status).toBe(401);
  expect(f.repository.rpc).not.toHaveBeenCalled();
 });
 it('heartbeat and close can only reuse the authenticated live-page capability',async()=>{
  const f=fixture();const body={claimId:id,pageSecret:secret};
  expect((await f.handler(request('once/heartbeat',body))).status).toBe(200);
  expect((await f.handler(request('once/close',body))).status).toBe(200);
  expect(f.repository.rpc.mock.calls.map(x=>x[0])).toEqual(['media_once_frame','media_close_view_once']);
 });
 it('routes canonical Keep actions through verified identity instead of legacy Board snapshots',async()=>{
  const f=fixture();
  const actions=[['keeps/save',{dumpId:id,itemPosition:0,boardId:id},'media_save_photo'],['keeps/list',{},'media_list_keeps'],
   ['keeps/link',{keepId:id,boardId:id},'media_link_keep'],['keeps/unlink',{keepId:id,boardId:id},'media_remove_board_photo'],['keeps/remove',{keepId:id},'media_remove_keep']];
  for(const [route,body,rpc] of actions){
   expect((await f.handler(request(route,{...body,viewer_id:id,source_author_id:id}))).status).toBe(200);
   const [name,payload]=f.repository.rpc.mock.calls.at(-1);expect(name).toBe(rpc);expect(payload.viewer_id).toBe(uid);expect(payload).not.toHaveProperty('source_author_id');
  }
 });
 it('validates and forwards the original source item ID on a Keep',async()=>{
  const f=fixture();
  expect((await f.handler(request('keeps/save',{dumpId:id,itemPosition:7,itemId:id,boardId:id}))).status).toBe(200);
  expect(f.repository.rpc.mock.calls.at(-1)[1].item_id).toBe(id);
  expect((await f.handler(request('keeps/save',{dumpId:id,itemPosition:7,itemId:'malformed'}))).status).toBe(400);
 });
 it('Kept and owner-archive frame delivery rechecks source authority and uses no viewer allowance',async()=>{
  const f=fixture();f.repository.rpc.mockResolvedValue({bucket:'flicd-archive',path:uid+'/archive.png'});
  expect((await f.handler(request('keeps/frame',{keepId:id}))).status).toBe(200);
  expect((await f.handler(request('owner/frame',{itemId:id}))).status).toBe(200);
  expect(f.repository.rpc.mock.calls.map(x=>x[0])).toEqual(['media_keep_frame','media_keep_frame','media_owner_frame','media_owner_frame']);
 });
});
