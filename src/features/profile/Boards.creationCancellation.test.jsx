/** @vitest-environment jsdom */
import React from 'react';
import {it,expect,vi,beforeEach,afterEach} from 'vitest';
import {render,screen,fireEvent,act,waitFor,cleanup} from '@testing-library/react';
import Boards from './Boards.jsx';
import {supabase} from '../../lib/supabase.js';
import {createAuthBoundary} from '../../app/authScope.js';

// Real Boards, boardApi and installed SDK. Only Auth, gateway reads and wire are synthetic.
vi.mock('../home/mediaSessionApi.js',()=>({mediaApi:{json:async()=>[]}}));
const A={user:{id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'},session_id:'11111111-1111-4111-8111-111111111111',access_token:'synthetic-original'};
const B={user:{id:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'},session_id:'22222222-2222-4222-8222-222222222222',access_token:'synthetic-replacement'};
let wire;
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const mutations=()=>wire.mock.calls.filter(([,init])=>init?.method==='POST');
beforeEach(()=>{
 wire=vi.fn(async(input,init)=>{
  const body=init?.method==='POST'&&init.body?JSON.parse(init.body):null;
  return new Response(JSON.stringify(body?{id:'new-board',...body}:[]),{status:200,headers:{'Content-Type':'application/json'}});
 });
 vi.stubGlobal('fetch',wire);
 vi.spyOn(supabase.auth,'getSession').mockResolvedValue({data:{session:A},error:null});
 vi.spyOn(supabase.auth,'getUser').mockResolvedValue({data:{user:A.user},error:null});
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
async function mount(){
 const boundary=createAuthBoundary(),scope=boundary.accept(A,'SIGNED_IN'),toast=vi.fn();
 const view=render(<Boards authScope={scope} onToast={toast}/>);
 await waitFor(()=>expect(screen.queryByText('Loading Boards…')).toBeNull());
 return {boundary,scope,toast,view};
}
function openDraft(name='cancelled private draft'){
 fireEvent.click(screen.getByRole('button',{name:'New board'}));
 fireEvent.change(screen.getByPlaceholderText('Board name'),{target:{value:name}});
}
const submit=()=>fireEvent.click(screen.getByRole('button',{name:'Create'}));
it.each([false,true])('A3-R3-001: Cancel before identity prevents first INSERT (replacement=%s)',async replacement=>{
 const {toast}=await mount(),identity=deferred();
 supabase.auth.getUser.mockReturnValueOnce(identity.promise);
 openDraft();submit();await waitFor(()=>expect(supabase.auth.getUser).toHaveBeenCalledTimes(2));
 fireEvent.click(screen.getByRole('button',{name:'Cancel'}));
 if(replacement)openDraft('replacement draft');
 await act(async()=>identity.resolve({data:{user:A.user},error:null}));
 expect(mutations()).toEqual([]);
 if(replacement)expect(screen.getByPlaceholderText('Board name').value).toBe('replacement draft');
 else expect(screen.queryByPlaceholderText('Board name')).toBeNull();
 expect(toast).not.toHaveBeenCalled();
});

it.each([false,true])('Cancel before real SDK dispatch blocks late credentials (replacement=%s)',async replacement=>{
 const {toast}=await mount(),credentials=deferred();
 supabase.auth.getSession.mockClear().mockImplementation(()=>credentials.promise);
 openDraft();submit();
 // The installed SDK also acquires credentials for Realtime initialization.
 // Hold all calls and wait for the actual PostgREST acquisition, not just the first.
 await waitFor(()=>expect(supabase.auth.getSession.mock.calls.length).toBeGreaterThanOrEqual(2));
 fireEvent.click(screen.getByRole('button',{name:'Cancel'}));
 if(replacement)openDraft('replacement draft');
 await act(async()=>credentials.resolve({data:{session:A},error:null}));
 expect(mutations()).toEqual([]);expect(toast).not.toHaveBeenCalled();
 if(replacement)expect(screen.getByPlaceholderText('Board name').value).toBe('replacement draft');
});

it('rechecks cancellation between SDK credential validation and final fetch',async()=>{
 const {toast}=await mount();let cancelled=false;
 const credentials={...A};
 Object.defineProperty(credentials,'access_token',{get(){
  if(!cancelled){cancelled=true;fireEvent.click(screen.getByRole('button',{name:'Cancel'}));openDraft('replacement draft');}
  return A.access_token;
 }});
 supabase.auth.getSession.mockClear().mockResolvedValueOnce({data:{session:A},error:null}).mockResolvedValue({data:{session:credentials},error:null});
 openDraft();await act(async()=>submit());
 await waitFor(()=>expect(cancelled).toBe(true));
 expect(mutations()).toEqual([]);expect(toast).not.toHaveBeenCalled();
 expect(screen.getByPlaceholderText('Board name').value).toBe('replacement draft');
});

it.each([false,true])('stale dispatched response cannot mutate a replacement draft (error=%s)',async error=>{
 const {toast}=await mount(),response=deferred(),consoleError=vi.spyOn(console,'error').mockImplementation(()=>{});
 wire.mockImplementation(()=>response.promise);
 openDraft();submit();await waitFor(()=>expect(mutations()).toHaveLength(1));
 fireEvent.click(screen.getByRole('button',{name:'Cancel'}));openDraft('replacement draft');
 fireEvent.change(screen.getByPlaceholderText('Description (optional)'),{target:{value:'replacement description'}});
 await act(async()=>{
  if(error)response.reject(new Error('obsolete private error'));
  else response.resolve(new Response(JSON.stringify({id:'old-board',name:'cancelled private draft'}),{headers:{'Content-Type':'application/json'}}));
 });
 expect(screen.getByPlaceholderText('Board name').value).toBe('replacement draft');
 expect(screen.getByPlaceholderText('Description (optional)').value).toBe('replacement description');
 expect(screen.queryByText('cancelled private draft')).toBeNull();
 expect(toast).not.toHaveBeenCalled();expect(consoleError).not.toHaveBeenCalled();
 // A first request was already dispatched. No rollback/delete is attempted.
 expect(wire.mock.calls.filter(([,init])=>init?.method!=='GET')).toHaveLength(1);
});

it.each(['B','ABA','unmount','refresh'])('pending create retains account/component isolation and matching-session positive control (%s)',async change=>{
 const {boundary,view,toast}=await mount(),identity=deferred();
 supabase.auth.getUser.mockReturnValueOnce(identity.promise);openDraft('original draft');submit();
 await waitFor(()=>expect(supabase.auth.getUser).toHaveBeenCalledTimes(2));
 if(change==='unmount')view.unmount();
 else if(change==='refresh'){
  const refreshed={...A,access_token:'synthetic-refreshed'};boundary.accept(refreshed,'TOKEN_REFRESHED');
  supabase.auth.getSession.mockResolvedValue({data:{session:refreshed},error:null});
 }else{boundary.accept(B,'SIGNED_IN');if(change==='ABA')boundary.accept(A,'SIGNED_IN');}
 await act(async()=>identity.resolve({data:{user:change==='B'?B.user:A.user},error:null}));
 if(change==='refresh'){
  expect(mutations()).toHaveLength(1);expect(JSON.parse(mutations()[0][1].body)).toMatchObject({user_id:A.user.id,name:'original draft'});
  expect(toast).toHaveBeenCalledExactlyOnceWith('Board created');expect(screen.queryByPlaceholderText('Board name')).toBeNull();
 }else{expect(mutations()).toEqual([]);expect(toast).not.toHaveBeenCalled();}
});

it.each(['identity','credentials'])('replacement submit wins while cancelled %s acquisition remains pending',async phase=>{
 const {toast}=await mount(),gate=deferred();
 if(phase==='identity')supabase.auth.getUser.mockReturnValueOnce(gate.promise);
 else supabase.auth.getSession.mockClear().mockImplementation(()=>gate.promise);
 openDraft('old draft');submit();
 await waitFor(()=>expect(phase==='identity'?supabase.auth.getUser.mock.calls.length:supabase.auth.getSession.mock.calls.length).toBeGreaterThanOrEqual(2));
 fireEvent.click(screen.getByRole('button',{name:'Cancel'}));openDraft('replacement draft');
 supabase.auth.getSession.mockResolvedValue({data:{session:A},error:null});submit();
 await waitFor(()=>expect(toast).toHaveBeenCalledExactlyOnceWith('Board created'));
 await act(async()=>gate.resolve(phase==='identity'?{data:{user:A.user},error:null}:{data:{session:A},error:null}));
 expect(mutations()).toHaveLength(1);expect(JSON.parse(mutations()[0][1].body).name).toBe('replacement draft');
 expect(screen.queryByText('old draft')).toBeNull();expect(toast).toHaveBeenCalledTimes(1);
});

it('a newer submit invalidates an earlier undispatched attempt without losing the current result',async()=>{
 const {toast}=await mount(),identity=deferred();supabase.auth.getUser.mockReturnValueOnce(identity.promise);
 openDraft('first attempt');submit();await waitFor(()=>expect(supabase.auth.getUser).toHaveBeenCalledTimes(2));
 fireEvent.change(screen.getByPlaceholderText('Board name'),{target:{value:'latest attempt'}});submit();
 await waitFor(()=>expect(toast).toHaveBeenCalledExactlyOnceWith('Board created'));
 await act(async()=>identity.resolve({data:{user:A.user},error:null}));
 expect(mutations()).toHaveLength(1);expect(JSON.parse(mutations()[0][1].body).name).toBe('latest attempt');
 expect(toast).toHaveBeenCalledTimes(1);expect(screen.queryByText('first attempt')).toBeNull();
});

it.each(['identity','credentials'])('New board replaces an open draft and invalidates its pending %s operation',async phase=>{
 const {toast}=await mount(),gate=deferred();
 if(phase==='identity')supabase.auth.getUser.mockReturnValueOnce(gate.promise);
 else supabase.auth.getSession.mockClear().mockImplementation(()=>gate.promise);
 openDraft('old draft');submit();
 await waitFor(()=>expect(phase==='identity'?supabase.auth.getUser.mock.calls.length:supabase.auth.getSession.mock.calls.length).toBeGreaterThanOrEqual(2));
 openDraft('replacement draft');
 await act(async()=>gate.resolve(phase==='identity'?{data:{user:A.user},error:null}:{data:{session:A},error:null}));
 expect(mutations()).toEqual([]);expect(toast).not.toHaveBeenCalled();
 expect(screen.getByPlaceholderText('Board name').value).toBe('replacement draft');
});

it.each([false,true])('old dispatched completion leaves a newer submitted operation live (error=%s)',async error=>{
 const {toast}=await mount(),oldResponse=deferred(),newIdentity=deferred();
 wire.mockImplementationOnce(()=>oldResponse.promise);
 openDraft('old draft');submit();await waitFor(()=>expect(mutations()).toHaveLength(1));
 fireEvent.click(screen.getByRole('button',{name:'Cancel'}));openDraft('replacement draft');
 supabase.auth.getUser.mockReturnValueOnce(newIdentity.promise);submit();
 await waitFor(()=>expect(supabase.auth.getUser).toHaveBeenCalledTimes(3));
 await act(async()=>{
  if(error)oldResponse.reject(new Error('obsolete response'));
  else oldResponse.resolve(new Response(JSON.stringify({id:'old-board',name:'old draft'}),{headers:{'Content-Type':'application/json'}}));
 });
 expect(screen.getByPlaceholderText('Board name').value).toBe('replacement draft');expect(toast).not.toHaveBeenCalled();
 await act(async()=>newIdentity.resolve({data:{user:A.user},error:null}));
 expect(mutations().map(([,init])=>JSON.parse(init.body).name)).toEqual(['old draft','replacement draft']);
 expect(toast).toHaveBeenCalledExactlyOnceWith('Board created');expect(screen.queryByPlaceholderText('Board name')).toBeNull();
 expect(screen.queryByText('old draft')).toBeNull();
});
