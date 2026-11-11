import {afterEach,describe,it,expect,vi} from 'vitest';
import {createMediaApi} from './mediaSessionApi.js';
import {testAuthScope} from '../../../tests/security/testAuthScope.js';
const dumpId='10000000-0000-4000-8000-000000000001';
const claimId='10000000-0000-4000-8000-000000000002';
const receipt={status:'claimed',dump_id:dumpId,claim_id:claimId,items:[{id:dumpId,position:0,note:'frame'}]};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
function fixture() {
 const fetchImpl=vi.fn(async(url)=>url.endsWith('/frame')?new Response(new Uint8Array([137,80,78,71]),{headers:{'Content-Type':'image/png'}}):json(receipt));
 const objectUrls={createObjectURL:vi.fn(()=> 'blob:local-frame'),revokeObjectURL:vi.fn()};
 const authScope=testAuthScope('viewer');
 const api=createMediaApi({origin:'http://127.0.0.1:9339',getSession:async()=>({user:{id:'viewer'},session_id:authScope.sessionId,access_token:'synthetic-fixture'}),fetchImpl,objectUrls});
 // Legacy protocol cases exercise real sessions with an explicit fixture-owned
 // origin; dispatch-race tests separately exercise the missing-scope rejection.
 return {api:{...api,createOnceSession:(id,options)=>api.createOnceSession(id,{authScope,...options})},fetchImpl,objectUrls};
}
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});
describe('browser media protocol',()=>{
 it('rejects an acknowledgement for another post without requesting its media',async()=>{
  const f=fixture();f.fetchImpl.mockResolvedValueOnce(json({...receipt,dump_id:claimId}));
  const page=f.api.createOnceSession(dumpId);await expect(page.claim()).rejects.toThrow('acknowledgement');expect(f.objectUrls.createObjectURL).not.toHaveBeenCalled();await page.close();
 });
 it('does no I/O or media read when constructing a page session',()=>{
  const f=fixture();f.api.createOnceSession(dumpId);expect(f.fetchImpl).not.toHaveBeenCalled();
 });
 it.each([401,403,409])('terminal frame denial %s closes the existing page instead of allowing another delivery attempt',async(status)=>{
  const f=fixture(),page=f.api.createOnceSession(dumpId);await page.claim();
  f.fetchImpl.mockResolvedValueOnce(json({error:'denied'},status));
  await expect(page.loadFrames()).rejects.toThrow();expect(page.closed).toBe(true);
  await expect(page.claim()).rejects.toThrow('ended');await page.close();
 });
 it.each([[{id:'broken',position:0}], [{id:dumpId,position:-1}], [{id:dumpId,position:0},{id:dumpId,position:1}]])('rejects malformed frame identities in the receipt before bytes',async(...items)=>{
  const f=fixture(),page=f.api.createOnceSession(dumpId);
  f.fetchImpl.mockResolvedValueOnce(json({...receipt,items}));
  await expect(page.claim()).rejects.toThrow('acknowledgement');expect(f.objectUrls.createObjectURL).not.toHaveBeenCalled();await page.close();
 });
 it('uses the same memory-only binding for lost acknowledgement recovery, distinct across page sessions',async()=>{
  const f=fixture();const page=f.api.createOnceSession(dumpId);
  f.fetchImpl.mockRejectedValueOnce(new Error('lost response'));
  await expect(page.claim()).rejects.toThrow('lost response');await page.claim();
  const first=JSON.parse(f.fetchImpl.mock.calls[0][1].body),second=JSON.parse(f.fetchImpl.mock.calls[1][1].body);
  expect(first).toEqual(second);expect(first.pageSecret).toMatch(/^[0-9a-f]{64}$/);
  const other=f.api.createOnceSession(dumpId);await other.claim();expect(JSON.parse(f.fetchImpl.mock.calls[2][1].body).pageSecret).not.toBe(first.pageSecret);
  await page.close();await other.close();
 });
 it('never fetches bytes before a confirmed claim and does not reset it after interrupted delivery',async()=>{
  const f=fixture();const page=f.api.createOnceSession(dumpId);
  await expect(page.loadFrames()).rejects.toThrow('claim');expect(f.fetchImpl).not.toHaveBeenCalled();
  await page.claim();f.fetchImpl.mockResolvedValueOnce(json({error:'delivery_interrupted'},503));
  await expect(page.loadFrames()).rejects.toThrow();expect(page.committed).toBe(true);
  expect(await page.loadFrames()).toEqual(['blob:local-frame']);await page.close();
 });
 it('closes and revokes object URLs; a closed page cannot reclaim',async()=>{
  const f=fixture(),page=f.api.createOnceSession(dumpId);await page.claim();await page.loadFrames();await page.close();
  expect(f.objectUrls.revokeObjectURL).toHaveBeenCalledWith('blob:local-frame');
  await expect(page.claim()).rejects.toThrow('ended');expect(page.closed).toBe(true);
  expect(f.fetchImpl.mock.calls.at(-1)[0]).toBe('http://127.0.0.1:9339/media/once/close');
 });
 it('late claim completion after close is closed server-side and never produces frames',async()=>{
  const f=fixture();let finish;f.fetchImpl.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
  const page=f.api.createOnceSession(dumpId);const pending=page.claim();await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));
  await page.close();finish(json(receipt));await expect(pending).rejects.toThrow('ended');
  expect(f.fetchImpl.mock.calls.at(-1)[0]).toContain('/once/close');expect(f.objectUrls.createObjectURL).not.toHaveBeenCalled();
 });
 it('heartbeat denial ends the live capability, revokes URLs and cannot create a new claim',async()=>{
  vi.useFakeTimers();const f=fixture(),ended=vi.fn(),page=f.api.createOnceSession(dumpId,{onEnded:ended});
  await page.claim();await page.loadFrames();f.fetchImpl.mockResolvedValueOnce(json({error:'denied'},403));
  await vi.advanceTimersByTimeAsync(30000);expect(page.closed).toBe(true);expect(ended).toHaveBeenCalledOnce();
  expect(f.objectUrls.revokeObjectURL).toHaveBeenCalled();await expect(page.claim()).rejects.toThrow('ended');
 });
 it('fails closed without a configured gateway and never follows redirects with a capability',async()=>{
  const f=fixture();const page=f.api.createOnceSession(dumpId);await page.claim();
  expect(f.fetchImpl.mock.calls[0][1]).toMatchObject({credentials:'omit',redirect:'error',cache:'no-store'});await page.close();
  const noGateway=createMediaApi({origin:'',getSession:async()=>null,fetchImpl:f.fetchImpl});
  await expect(noGateway.createOnceSession(dumpId,{authScope:testAuthScope('viewer')}).claim()).rejects.toThrow('configured');
 });
});
