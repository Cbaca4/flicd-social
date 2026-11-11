import {it,expect,vi,afterEach} from 'vitest';
import {createMediaApi,closeAllMediaSessions} from './mediaSessionApi.js';
import {createAuthBoundary} from '../../app/authScope.js';
const id='10000000-0000-4000-8000-000000000001';
const grant={status:'claimed',dump_id:id,claim_id:id,items:[{id,position:0}]};
const session=user=>({user:{id:user},session_id:'session-'+user,access_token:'synthetic-'+user});
afterEach(async()=>{await closeAllMediaSessions();});
it.each(['close','B','ABA'])('does not dispatch an obsolete View Once claim after token acquisition (%s)',async transition=>{
 const boundary=createAuthBoundary(),a=session('A'),scope=boundary.accept(a,'SIGNED_IN');let finish;
 const credentials=new Promise(resolve=>{finish=resolve;});
 const fetchImpl=vi.fn(async()=>new Response(JSON.stringify(grant),{headers:{'Content-Type':'application/json'}}));
 const api=createMediaApi({origin:'http://127.0.0.1:9339',getSession:()=>credentials,fetchImpl});
 const page=api.createOnceSession(id,{authScope:scope});const result=page.claim().catch(e=>e);
 if(transition==='close')await page.close();else{boundary.accept(session('B'),'SIGNED_IN');if(transition==='ABA')boundary.accept(a,'SIGNED_IN');}
 finish(transition==='B'?session('B'):a);const settled=await result;
 expect(fetchImpl).not.toHaveBeenCalled();expect(settled).toBeInstanceOf(Error);await page.close();
});
it.each(['keeps/save','keeps/link','keeps/unlink','keeps/remove','safety/block'])('does not dispatch stale %s after pending credential retrieval',async route=>{
 const boundary=createAuthBoundary(),scope=boundary.accept(session('A'),'SIGNED_IN');let finish;
 const credentials=new Promise(resolve=>{finish=resolve;});const fetchImpl=vi.fn(async()=>new Response('{}'));
 const api=createMediaApi({origin:'http://127.0.0.1:9339',getSession:()=>credentials,fetchImpl});
 const result=api.json(route,{},{authScope:scope}).catch(e=>e);boundary.accept(session('B'),'SIGNED_IN');finish(session('B'));await result;
 expect(fetchImpl).not.toHaveBeenCalled();
});

it('preserves a pending claim through matching-session refresh',async()=>{
 const boundary=createAuthBoundary(),a=session('A'),scope=boundary.accept(a,'SIGNED_IN');let finish;
 const fetchImpl=vi.fn(async()=>new Response(JSON.stringify(grant)));
 const api=createMediaApi({origin:'http://127.0.0.1:9339',getSession:()=>new Promise(resolve=>{finish=resolve;}),fetchImpl});
 const page=api.createOnceSession(id,{authScope:scope}),pending=page.claim();
 const refreshed={...a,access_token:'synthetic-A-refreshed'};boundary.accept(refreshed,'TOKEN_REFRESHED');finish(refreshed);
 expect(await pending).toEqual(grant);expect(fetchImpl).toHaveBeenCalledOnce();expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer synthetic-A-refreshed');await page.close();
});
it('isolates concurrently pending pages when only one closes during credential acquisition',async()=>{
 const scope=createAuthBoundary().accept(session('A'),'SIGNED_IN'),pendingTokens=[];
 const fetchImpl=vi.fn(async()=>new Response(JSON.stringify(grant)));
 const api=createMediaApi({origin:'http://127.0.0.1:9339',getSession:()=>new Promise(resolve=>pendingTokens.push(resolve)),fetchImpl});
 const closed=api.createOnceSession(id,{authScope:scope}),live=api.createOnceSession(id,{authScope:scope});
 const first=closed.claim().catch(error=>error),second=live.claim();await closed.close();
 expect(pendingTokens).toHaveLength(2);for(const finish of pendingTokens)finish(session('A'));
 expect(await first).toBeInstanceOf(Error);expect(await second).toEqual(grant);expect(fetchImpl).toHaveBeenCalledOnce();await live.close();
});
it('rejects replacement same-account credentials even before an Auth event',async()=>{
 const scope=createAuthBoundary().accept(session('A'),'SIGNED_IN'),fetchImpl=vi.fn();
 const api=createMediaApi({origin:'http://127.0.0.1:9339',getSession:async()=>({...session('A'),session_id:'replacement-login-A'}),fetchImpl});
 const page=api.createOnceSession(id,{authScope:scope});await expect(page.claim()).rejects.toThrow('session changed');expect(fetchImpl).not.toHaveBeenCalled();await page.close();
});
it('rechecks immediately before fetch, after payload serialization',async()=>{
 const boundary=createAuthBoundary(),scope=boundary.accept(session('A'),'SIGNED_IN'),fetchImpl=vi.fn();
 const api=createMediaApi({origin:'http://127.0.0.1:9339',getSession:async()=>session('A'),fetchImpl});
 const body={toJSON(){boundary.accept(session('B'),'SIGNED_IN');return {keepId:'private-A'};}};
 await expect(api.json('keeps/remove',body,{authScope:scope})).rejects.toThrow('context changed');expect(fetchImpl).not.toHaveBeenCalled();
});
it('never refunds an accepted claim or acquires replacement credentials to retire it',async()=>{
 const boundary=createAuthBoundary(),scope=boundary.accept(session('A'),'SIGNED_IN');let finish;
 const getSession=vi.fn().mockResolvedValueOnce(session('A')).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 const fetchImpl=vi.fn(async()=>new Response(JSON.stringify(grant)));
 const api=createMediaApi({origin:'http://127.0.0.1:9339',getSession,fetchImpl});
 const page=api.createOnceSession(id,{authScope:scope});await page.claim();const frames=page.loadFrames().catch(error=>error);
 boundary.accept(session('B'),'SIGNED_IN');finish(session('B'));expect(await frames).toBeInstanceOf(Error);expect(page.committed).toBe(true);
 await page.close();expect(getSession).toHaveBeenCalledTimes(2);expect(page.committed).toBe(true);
 expect(fetchImpl.mock.calls.map(([url])=>url.split('/').at(-1))).toEqual(['claim','close']);
 expect(fetchImpl.mock.calls[1][1].headers.Authorization).toBe('Bearer synthetic-A');
 await expect(page.claim()).rejects.toThrow('ended');
});
