/** @vitest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { beforeEach,afterEach,it,vi,expect } from 'vitest';
import { render,screen,fireEvent,act,cleanup,waitFor } from '@testing-library/react';
import { createAuthBoundary } from '../../app/authScope.js';
const m=vi.hoisted(()=>({getUser:vi.fn(),mutations:[],filters:[],scopedTables:[],result:null,client:null}));
vi.mock('../../lib/supabase',()=>({supabase:m.client,createAccountClient:()=>({from:table=>{m.scopedTables.push(table);return m.client.from(table);}})}));
vi.mock('../home/mediaSessionApi.js',()=>({mediaApi:{json:async()=>[],blob:async()=>new Blob(['synthetic'])}}));
beforeEach(()=>{
 m.mutations.length=0;m.filters.length=0;m.scopedTables.length=0;m.result=null;m.getUser.mockReset().mockResolvedValue({data:{user:{id:'A'}},error:null});
 m.client.auth={getUser:m.getUser};
});
// Define the fake SDK before importing the real APIs/components. It records actual
// insert/update/delete construction, not a mocked feature mutation function.
m.client={auth:{getUser:m.getUser},from(table){
 const q={select(){return q;},eq(key,value){m.filters.push({table,key,value});return q;},in(){return q;},order(){return q;},limit(){return q;},
 insert(payload){m.mutations.push({table,kind:'insert',payload});return q;},
 update(payload){m.mutations.push({table,kind:'update',payload});return q;},
 upsert(payload){m.mutations.push({table,kind:'upsert',payload});return q;},
 delete(){m.mutations.push({table,kind:'delete'});return q;},
 single:async()=>m.result?await m.result:({data:{id:'new',status:'accepted',profile_music_track_id:null},error:null}),
 maybeSingle:async()=>({data:table==='music_tracks'?{id:'song',active:true,approved:true}:null,error:null}),
 then(resolve,reject){const data=table==='follows'?[{follower_id:'friend'}]:table==='profiles'?[{id:'friend',username:'synthetic'}]:[];return Promise.resolve({data,error:null}).then(resolve,reject);}};return q;
}};
const components=async()=>({Boards:(await import('../profile/Boards.jsx')).default,FollowRequests:(await import('./FollowRequests.jsx')).default,OnRepeat:(await import('../music/OnRepeat.jsx')).default});
afterEach(cleanup);
it.each(['createBoard','approveFollowRequest','setProfileMusicTrack'])('%s rejects a resolved identity different from its originating subject even before an Auth event',async name=>{
 const boundary=createAuthBoundary(),scope=boundary.accept({user:{id:'A'},session_id:'session-A'},'SIGNED_IN');
 m.getUser.mockResolvedValue({data:{user:{id:'B'}},error:null});
 const api=name==='createBoard'?await import('../profile/boardApi.js'):name==='approveFollowRequest'?await import('./socialApi.js'):await import('../music/musicApi.js');
 const input=name==='createBoard'?{name:'A private Board'}:name==='approveFollowRequest'?'friend':null;
 const result=await api[name](input,scope).catch(e=>e);
 expect(result).toBeInstanceOf(Error);expect(m.mutations).toEqual([]);
});
for(const kind of ['Boards','FollowRequests','OnRepeat'])it.each(['B','ABA','unmount'])(`REAL ${kind} cannot dispatch a delayed mutation after %s`,async transition=>{
 const boundary=createAuthBoundary(),sessionA={user:{id:'A'},session_id:'session-A'},scope=boundary.accept(sessionA,'SIGNED_IN');
 const C=(await components())[kind],changed=vi.fn(),toast=vi.fn();
 const view=render(<C authScope={scope} onToast={toast} onTrackChange={changed} track={{id:'old-song',title:'Synthetic song'}} onTogglePlay={()=>{}}/>);
 if(kind==='Boards')await waitFor(()=>expect(screen.queryByText('Loading Boards…')).not.toBeInTheDocument());
 if(kind==='FollowRequests')await screen.findByRole('button',{name:'Accept @synthetic'});
 let finish;m.getUser.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 if(kind==='Boards'){
  fireEvent.click(screen.getByRole('button',{name:'New board'}));fireEvent.change(screen.getByPlaceholderText('Board name'),{target:{value:'A private draft'}});fireEvent.click(screen.getByRole('button',{name:'Create'}));
 }else fireEvent.click(screen.getByRole('button',{name:kind==='OnRepeat'?'Remove profile music':'Accept @synthetic'}));
 await waitFor(()=>expect(finish).toBeTypeOf('function'));
 if(transition!=='unmount'){boundary.accept({user:{id:'B'},session_id:'session-B'},'SIGNED_IN');if(transition==='ABA')boundary.accept(sessionA,'SIGNED_IN');}
 view.unmount();await act(async()=>finish({data:{user:{id:transition==='B'?'B':'A'}},error:null}));
 expect(m.mutations).toEqual([]);expect(changed).not.toHaveBeenCalled();expect(toast).not.toHaveBeenCalled();
});

const siblings = [
 ['createBoard','../profile/boardApi.js',[{name:'A private Board'}]],
 ['updateBoard','../profile/boardApi.js',['owned-board',{name:'A edit'}]],
 ['deleteBoard','../profile/boardApi.js',['owned-board']],
 ['followUser','./socialApi.js',['friend']],
 ['unfollowUser','./socialApi.js',['friend']],
 ['approveFollowRequest','./socialApi.js',['friend']],
 ['declineFollowRequest','./socialApi.js',['friend']],
 ['setProfileMusicTrack','../music/musicApi.js',['song']],
 ['setProfileMusicTrack','../music/musicApi.js',[null]],
];
it('uses the scoped credential transport for music availability lookup as well as the profile write',async()=>{
 const scope=createAuthBoundary().accept({user:{id:'A'},session_id:'login-A'},'SIGNED_IN');
 const {setProfileMusicTrack}=await import('../music/musicApi.js');await setProfileMusicTrack('song',scope);
 expect(m.scopedTables).toEqual(['music_tracks','profiles']);
});
it('uses the scoped credential transport for follow-target lookup as well as relationship mutation',async()=>{
 const scope=createAuthBoundary().accept({user:{id:'A'},session_id:'login-A'},'SIGNED_IN');
 const {followUser}=await import('./socialApi.js');await followUser('friend',scope);
 expect(m.scopedTables).toEqual(['profiles','follows']);
});
it('checks the originating scope again immediately before Board mutation construction',async()=>{
 const boundary=createAuthBoundary(),scope=boundary.accept({user:{id:'A'},session_id:'login-A'},'SIGNED_IN');
 const {createBoard}=await import('../profile/boardApi.js');
 const name={toString(){boundary.accept({user:{id:'B'},session_id:'login-B'},'SIGNED_IN');return 'A private name';}};
 await expect(createBoard({name},scope)).rejects.toThrow('context changed');expect(m.mutations).toEqual([]);
});
for(const [name,path,args] of siblings){
 it.each(['B','ABA','refresh'])(`${name} ${JSON.stringify(args)} binds its original subject during delayed identity and %s`,async transition=>{
  const boundary=createAuthBoundary(),session={user:{id:'A'},session_id:'login-A'},scope=boundary.accept(session,'SIGNED_IN');
  let finish;m.getUser.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
  const api=await import(path);const result=api[name](...args,scope).catch(error=>error);
  await waitFor(()=>expect(finish).toBeTypeOf('function'));
  if(transition==='refresh')boundary.accept({...session,access_token:'synthetic-refreshed'},'TOKEN_REFRESHED');
  else{boundary.accept({user:{id:'B'},session_id:'login-B'},'SIGNED_IN');if(transition==='ABA')boundary.accept(session,'SIGNED_IN');}
  finish({data:{user:{id:transition==='B'?'B':'A'}},error:null});
  const value=await result;
  if(transition!=='refresh'){expect(value).toBeInstanceOf(Error);expect(m.mutations).toEqual([]);return;}
  expect(value).not.toBeInstanceOf(Error);expect(m.mutations).toHaveLength(1);
  const mutation=m.mutations[0];
  if(name==='createBoard')expect(mutation.payload.user_id).toBe('A');
  else if(name==='followUser')expect(mutation.payload.follower_id).toBe('A');
  else expect(m.filters).toContainEqual(expect.objectContaining({value:'A',key:name==='unfollowUser'?'follower_id':name.includes('FollowRequest')?'following_id':name==='setProfileMusicTrack'?'id':'user_id'}));
 });
 it(`${name} rejects a missing origin before any identity lookup or mutation`,async()=>{
  const api=await import(path);await expect(api[name](...args)).rejects.toThrow('originating authentication scope');
  expect(m.getUser).not.toHaveBeenCalled();expect(m.mutations).toEqual([]);
 });
}
for(const kind of ['Boards','FollowRequests','OnRepeat'])it.each([false,true])(`REAL ${kind} suppresses stale accepted-operation completion (reject=%s)`,async reject=>{
 const scope=createAuthBoundary().accept({user:{id:'A'},session_id:'session-A'},'SIGNED_IN');
 const C=(await components())[kind],changed=vi.fn(),toast=vi.fn();
 const view=render(<C authScope={scope} onToast={toast} onTrackChange={changed} track={{id:'old-song',title:'Synthetic song'}} onTogglePlay={()=>{}}/>);
 if(kind==='Boards')await waitFor(()=>expect(screen.queryByText('Loading Boards…')).not.toBeInTheDocument());
 if(kind==='FollowRequests')await screen.findByRole('button',{name:'Accept @synthetic'});
 let finish,fail;m.result=new Promise((resolve,reject)=>{finish=resolve;fail=reject;});
 if(kind==='Boards'){
  fireEvent.click(screen.getByRole('button',{name:'New board'}));fireEvent.change(screen.getByPlaceholderText('Board name'),{target:{value:'A private draft'}});fireEvent.click(screen.getByRole('button',{name:'Create'}));
 }else fireEvent.click(screen.getByRole('button',{name:kind==='OnRepeat'?'Remove profile music':'Accept @synthetic'}));
 await waitFor(()=>expect(m.mutations).toHaveLength(1));view.unmount();
 await act(async()=>{if(reject)fail(new Error('A private write failure'));else finish({data:{id:'A-private-result'},error:null});});
 expect(changed).not.toHaveBeenCalled();expect(toast).not.toHaveBeenCalled();expect(screen.queryByText(/A private/)).not.toBeInTheDocument();
});
