/** @vitest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { beforeEach,afterEach,describe,it,expect,vi } from 'vitest';
import { render,screen,fireEvent,act,waitFor,cleanup } from '@testing-library/react';
import { supabase } from '../lib/supabase';
const m=vi.hoisted(()=>({user:'A',auth:null,ui:{},feed:vi.fn(),lookup:vi.fn(),hydrate:vi.fn(),quota:vi.fn(),upload:vi.fn(),create:vi.fn(),remove:vi.fn(),profile:vi.fn(),updateProfile:vi.fn(),boards:vi.fn(),library:vi.fn(),updateBoard:vi.fn(),notifications:vi.fn(),messages:vi.fn(),save:vi.fn(),newBoard:vi.fn(),like:vi.fn(),defaultBoard:vi.fn(),ack:vi.fn(),comment:vi.fn()}));
const record=(id='old-result-A')=>({id,user_id:'A',type:'dump',expiry:'24h',created_at:new Date().toISOString(),dump_items:[{id:'photo',position:0,note:'private-A'}]});
vi.mock('../lib/supabase',()=>({createAccountClient:()=>supabase,supabase:{auth:{getSession:async()=>({data:{session:{user:{id:'A'},session_id:'login-A'}}}),getUser:async()=>({data:{user:{id:m.user}}}),onAuthStateChange:cb=>{m.auth=cb;return {data:{subscription:{unsubscribe(){}}}};}},from:()=>({select:()=>({eq:(_,id)=>({maybeSingle:()=>m.profile(id)})}),update:value=>({eq:(_,id)=>({select:()=>({single:()=>m.updateProfile(id,value)})})})})}}));
vi.mock('../features/capture/dumpApi.js',()=>({getFeedDumps:m.feed,getDumpById:m.lookup,getPostingLimitStatus:m.quota,createDump:m.create,markDumpViewed:m.ack}));
vi.mock('../features/social/commentSubmit.js',()=>({submitComment:m.comment}));
vi.mock('../features/profile/archiveApi.js',()=>({syncExpiredArchive:async()=>{}}));
vi.mock('../features/capture/mediaUpload.js',()=>({PRIVATE_DUMP_MEDIA_BUCKET:'flicd-dump-private',uploadDumpImages:m.upload,removeDumpImages:m.remove}));
vi.mock('../features/profile/boardApi.js',()=>({getBoards:m.boards,getBoardItems:m.library,getOrCreateDefaultBoard:m.defaultBoard,saveBoardItem:m.save,createBoard:m.newBoard,updateBoard:m.updateBoard}));
vi.mock('../features/social/interactionsApi.js',()=>({hydrateDumpInteractions:m.hydrate,likeDump:m.like,unlikeDump:m.like}));
vi.mock('../features/messages/messageApi.js',()=>({getMessageRequests:m.messages}));
vi.mock('../features/social/notificationsApi.js',()=>({getUnreadNotificationCount:m.notifications}));
vi.mock('../features/home/mediaSessionApi.js',()=>({closeAllMediaSessions:async()=>{}}));
vi.mock('../features/music/musicApi.js',()=>({getMusicTrack:async()=>null}));
vi.mock('./AppShell.jsx',()=>({default:props=>{m.ui.shell=props;return <div data-testid="shell" data-account={props.userId} data-screen={props.screen}>{props.children}</div>;}}));
vi.mock('../features/auth/Auth.jsx',()=>({default:()=> <div>Signed out</div>}));
vi.mock('../features/home/Home.jsx',()=>({default:props=>{m.ui.home=props;return <div data-testid="feed">{props.dumps.map(p=>p.id).join(',')}</div>;},Viewer:props=>{m.ui.viewer=props;return <div data-testid="viewer">{props.post.id}</div>;}}));
vi.mock('../features/profile/Profile.jsx',()=>({default:props=>{m.ui.profile=props;return <div data-testid="profile" data-account={props.profile.id}>{JSON.stringify(props.boards)}</div>;}}));
vi.mock('../features/profile/ProfileStudio.jsx',()=>({default:props=>{m.ui.studio=props;return <div>Profile Studio</div>;}}));
vi.mock('../features/profile/EditProfile.jsx',()=>({default:props=>{m.ui.edit=props;return <div>Edit Profile</div>;}}));
vi.mock('../features/profile/Boards.jsx',()=>({default:()=> <div>Boards</div>}));
vi.mock('../features/social/Notifications.jsx',()=>({default:props=>{m.ui.notifications=props;return <div>Notifications</div>;}}));
vi.mock('../features/capture/CaptureBuilders.jsx',()=>({DumpBuilder:props=>{m.ui.builder=props;return <div>Dump Builder</div>;},RollBuilder:props=>{m.ui.builder=props;return <div>Roll Builder</div>;}}));
import FlicdApp from './FlicdApp.jsx';
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
const settle=async()=>act(async()=>{});
async function start(){render(<FlicdApp/>);await screen.findByTestId('shell');await settle();}
async function nav(to){act(()=>m.ui.shell.onNavigate(to));await settle();}
async function auth(user,event='SIGNED_IN',login='login-'+user){m.user=user;act(()=>m.auth(event,user?{user:{id:user},session_id:login}:null));await settle();}
async function switched(back=false){await auth('B');if(back)await auth('A');await nav('profile');}
beforeEach(()=>{
 vi.resetAllMocks();m.user='A';m.ui={};m.auth=null;
 m.feed.mockImplementation(async()=>[record('feed-'+m.user)]);m.lookup.mockResolvedValue(record());m.hydrate.mockImplementation(async p=>p);
 m.quota.mockResolvedValue({remaining:3});m.upload.mockResolvedValue(['A/image.png']);m.create.mockResolvedValue(record());m.remove.mockResolvedValue(undefined);
 m.profile.mockImplementation(async id=>({data:{id,username:id},error:null}));m.updateProfile.mockResolvedValue({data:{id:'A',username:'A-updated'},error:null});
 m.boards.mockImplementation(async()=>[{id:'one',name:m.user+' secret Board',description:m.user+' description',cover_url:'https://fixture.invalid/'+m.user,user_id:m.user},{id:'two',name:'Two',user_id:m.user}]);m.library.mockResolvedValue([]);
 m.notifications.mockResolvedValue(0);m.messages.mockResolvedValue([]);m.updateBoard.mockResolvedValue({id:'one',name:'A-updated'});m.save.mockResolvedValue({});m.newBoard.mockResolvedValue({id:'new',name:'Private'});
 m.defaultBoard.mockResolvedValue({id:'one',name:'One'});m.ack.mockResolvedValue(true);m.comment.mockResolvedValue({id:'comment'});
 vi.spyOn(console,'error').mockImplementation(()=>{});
});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
describe('account-generation async isolation',()=>{
 it('invalidates A immediately across a batched A-B-A before React can commit',async()=>{
  const d=deferred();m.lookup.mockReturnValueOnce(d.promise);await start();await nav('notifications');act(()=>m.ui.notifications.onOpenDump('old-result-A'));
  await act(async()=>{m.user='B';m.auth('SIGNED_IN',{user:{id:'B'},session_id:'login-B'});m.user='A';m.auth('SIGNED_IN',{user:{id:'A'},session_id:'login-A'});d.resolve(record());});
  expect(screen.queryByTestId('viewer')).not.toBeInTheDocument();expect(screen.getByTestId('feed')).not.toHaveTextContent('old-result-A');
 });
 for(const kind of ['boards','library','profile','notifications','messages'])for(const reject of [false,true])it(`isolates deferred ${kind} ${reject?'failure':'success'} on A-B-A`,async()=>{
  const d=deferred();m[kind].mockReturnValueOnce(d.promise);await start();await switched(true);
  const value=kind==='profile'?{data:{id:'old-private',username:'old-private'},error:null}:kind==='notifications'?41:kind==='messages'?[{id:'old-private'}]:kind==='boards'?[{id:'one',name:'old-private'}]:[{id:'private',board_ids:['one']}];
  await act(async()=>{reject?d.reject(new Error('old-private')):d.resolve(value);});
  expect(screen.getByTestId('profile')).toHaveAttribute('data-account','A');expect(screen.getByTestId('profile')).not.toHaveTextContent('old-private');expect(m.ui.profile.boards[0].count).toBe(0);expect(m.ui.shell.notificationsUnread).toBe(0);expect(m.ui.shell.unread).toBe(0);
 });
 it.each([false,true])('suppresses stale Keep preparation and errors (reject=%s)',async reject=>{
  await start();const d=deferred();m.defaultBoard.mockReturnValueOnce(d.promise);let p;act(()=>{p=m.ui.home.onKeep({id:'private',mode:'24h',allowOthersToKeep:true,items:[{id:'photo',position:0}]},0);});await switched(true);await act(async()=>{reject?d.reject(new Error('old-private')):d.resolve({id:'one',name:'old-private'});await p;});expect(screen.queryByText('Where should this go?')).not.toBeInTheDocument();expect(screen.queryByText('old-private')).not.toBeInTheDocument();
 });
 it('does not continue a stale Keep save with fresh-account library requests',async()=>{
  await start();await act(async()=>m.ui.home.onKeep({id:'private',mode:'24h',allowOthersToKeep:true,items:[{id:'photo',position:0}]},0));
  const d=deferred();m.save.mockReturnValueOnce(d.promise);fireEvent.click(screen.getByRole('button',{name:/A secret Board 0 items/}));await waitFor(()=>expect(m.save).toHaveBeenCalled());await switched();const calls=m.library.mock.calls.length;await act(async()=>d.resolve({}));expect(m.library).toHaveBeenCalledTimes(calls);expect(screen.queryByText('Saved to A secret Board')).not.toBeInTheDocument();
 });
 it('does not save a private photo after stale new-Board creation',async()=>{
  await start();await act(async()=>m.ui.home.onKeep({id:'private',mode:'24h',allowOthersToKeep:true,items:[{id:'photo',position:0}]},0));
  fireEvent.click(screen.getByRole('button',{name:/New Board/}));fireEvent.change(screen.getByPlaceholderText('e.g. Gym, Memories, Trips'),{target:{value:'private draft'}});const d=deferred();m.newBoard.mockReturnValueOnce(d.promise);fireEvent.click(screen.getByRole('button',{name:'Create & Save'}));await waitFor(()=>expect(m.newBoard).toHaveBeenCalled());await switched(true);await act(async()=>d.resolve({id:'old',name:'private draft'}));expect(m.save).not.toHaveBeenCalled();expect(screen.queryByDisplayValue('private draft')).not.toBeInTheDocument();
 });
 it('late like failure cannot clear a new generation pending like or show its failure',async()=>{
  const a=deferred(),b=deferred();m.like.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);await start();let old,latest;act(()=>{old=m.ui.home.onLike('feed-A');});await switched(true);await nav('home');act(()=>{latest=m.ui.home.onLike('feed-A');});await act(async()=>{a.reject(new Error('old-private'));await old;});expect(m.ui.home.pendingLikeIds.has('feed-A')).toBe(true);expect(screen.queryByText('old-private')).not.toBeInTheDocument();await act(async()=>{b.resolve();await latest;});expect(m.ui.home.pendingLikeIds.has('feed-A')).toBe(false);
 });
 it('late comment and acknowledgement results cannot affect a replacement account Viewer/feed',async()=>{
  const comment=deferred(),ack=deferred();m.comment.mockReturnValueOnce(comment.promise);m.ack.mockReturnValueOnce(ack.promise);await start();act(()=>m.ui.home.onOpen(m.ui.home.dumps[0]));let c,a;act(()=>{c=m.ui.viewer.onComment('feed-A','private comment');a=m.ui.viewer.onMarkViewed('feed-A',{}).catch(e=>e);});await switched(true);await act(async()=>{comment.resolve({id:'old-comment',text:'private comment'});ack.resolve(true);await c;await a;});expect(screen.queryByTestId('viewer')).not.toBeInTheDocument();await nav('home');expect(m.ui.home.dumps[0].comments).toEqual([]);expect(m.ui.home.dumps[0].viewed).toBe(false);
 });
 it('suppresses rejected stale profile persistence rather than returning a private failure to callbacks',async()=>{
  const d=deferred();m.updateProfile.mockReturnValueOnce(d.promise);await start();await nav('profile-settings');let p;act(()=>{p=m.ui.studio.onSaved({}).catch(e=>e);});await waitFor(()=>expect(m.updateProfile).toHaveBeenCalled());await switched();await act(async()=>d.reject(new Error('old-private')));expect(await p).toBeUndefined();expect(screen.getByTestId('profile')).toHaveAttribute('data-account','B');
 });
 it.each([false,true])('discards deferred notification lookup and Viewer navigation after switching (return A=%s)',async back=>{
  const d=deferred();m.lookup.mockReturnValue(d.promise);await start();await nav('notifications');act(()=>m.ui.notifications.onOpenDump('old-result-A'));await switched(back);
  await act(async()=>d.resolve(record()));
  expect(screen.queryByTestId('viewer')).not.toBeInTheDocument();expect(screen.getByTestId('shell')).toHaveAttribute('data-screen','profile');
  await nav('home');expect(screen.getByTestId('feed')).not.toHaveTextContent('old-result-A');
 });
 it('discards deferred hydration and stale lookup failures',async()=>{
  await start();const d=deferred();m.hydrate.mockReturnValueOnce(d.promise);await nav('notifications');act(()=>m.ui.notifications.onOpenDump('old-result-A'));await waitFor(()=>expect(m.lookup).toHaveBeenCalled());await settle();await switched();await act(async()=>d.resolve([record()]));expect(screen.queryByTestId('viewer')).not.toBeInTheDocument();
  const f=deferred();m.lookup.mockReturnValueOnce(f.promise);await nav('notifications');act(()=>m.ui.notifications.onOpenDump('failing'));await auth('A');await act(async()=>f.reject(new Error('A private lookup failure')));expect(screen.queryByText('A private lookup failure')).not.toBeInTheDocument();
 });
 it('latest lookup wins within one session',async()=>{
  const first=deferred(),last=deferred();m.lookup.mockReturnValueOnce(first.promise).mockReturnValueOnce(last.promise);await start();await nav('notifications');const open=m.ui.notifications.onOpenDump;
  act(()=>{open('first');open('last');});await act(async()=>last.resolve(record('last')));await act(async()=>first.resolve(record('first')));expect(screen.getByTestId('viewer')).toHaveTextContent('last');
 });
 it.each(['dump','roll'])('preserves a legitimate %s completion',async type=>{
  await start();await nav('create-'+type);await act(async()=>m.ui.builder.onPost({mood:'',expiry:'24h',channel:'main',frameCount:1,items:[{note:'private',imageFile:{}}]}));expect(screen.getByTestId('feed')).toHaveTextContent('old-result-A');expect(screen.getByText(type==='dump'?'Dump posted':'Roll posted')).toBeInTheDocument();
 });
 for(const type of ['dump','roll'])for(const stage of ['quota','upload','create'])for(const reject of [false,true])it(`drops stale ${type} ${stage} ${reject?'failure':'success'} across A-B-A`,async()=>{
  const d=deferred();m[stage].mockReturnValueOnce(d.promise);await start();await nav('create-'+type);let pending;
  act(()=>{pending=m.ui.builder.onPost({mood:'',expiry:'24h',channel:'main',frameCount:1,items:[{note:'private',imageFile:{}}]}).catch(e=>e);});
  await waitFor(()=>expect(m[stage]).toHaveBeenCalled());await switched(true);
  await act(async()=>{reject?d.reject(new Error('A private posting failure')):d.resolve(stage==='quota'?{remaining:3}:stage==='upload'?['A/image.png']:record());await pending;});
  expect(screen.getByTestId('shell')).toHaveAttribute('data-screen','profile');expect(screen.queryByText(/^(Dump|Roll) posted$/)).not.toBeInTheDocument();
  if(stage==='quota')expect(m.upload).not.toHaveBeenCalled();if(stage!=='create')expect(m.create).not.toHaveBeenCalled();expect(m.remove).not.toHaveBeenCalled();
  await nav('home');expect(screen.getByTestId('feed')).not.toHaveTextContent('old-result-A');
 });
 it.each(['SIGNED_OUT','SIGNED_IN'])('invalidates old results on %s session reset',async event=>{
  const d=deferred();m.lookup.mockReturnValueOnce(d.promise);await start();await nav('notifications');act(()=>m.ui.notifications.onOpenDump('old-result-A'));
  if(event==='SIGNED_OUT'){await auth(null,event);await auth('A');}else await auth('A',event,'replacement-login');
  await nav('profile');await act(async()=>d.resolve(record()));expect(screen.queryByTestId('viewer')).not.toBeInTheDocument();
 });
 it('preserves an operation through same-session token refresh',async()=>{
  const d=deferred();m.lookup.mockReturnValueOnce(d.promise);await start();await nav('notifications');act(()=>m.ui.notifications.onOpenDump('old-result-A'));await auth('A','TOKEN_REFRESHED','login-A');await act(async()=>d.resolve(record()));expect(screen.getByTestId('viewer')).toHaveTextContent('old-result-A');
 });
 it('old feed cannot win after A-B-A or a newer same-account refresh',async()=>{
  const old=deferred();m.feed.mockReturnValueOnce(old.promise);await start();await switched(true);await act(async()=>old.resolve([record('old-result-A')]));await nav('home');expect(screen.getByTestId('feed')).not.toHaveTextContent('old-result-A');
  const a=deferred(),b=deferred();m.feed.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);const before=m.feed.mock.calls.length;act(()=>{m.ui.home.onRetry();});await waitFor(()=>expect(m.feed).toHaveBeenCalledTimes(before+1));act(()=>{m.ui.home.onRetry();});await waitFor(()=>expect(m.feed).toHaveBeenCalledTimes(before+2));await act(async()=>b.resolve([record('newest')]));await act(async()=>a.resolve([record('older')]));expect(screen.getByTestId('feed')).toHaveTextContent('newest');expect(screen.getByTestId('feed')).not.toHaveTextContent('older');
 });
 it('profile save, stale EditProfile callbacks and rejected profile saves cannot restore old identity/navigation',async()=>{
  const d=deferred();m.updateProfile.mockReturnValueOnce(d.promise);await start();await nav('profile-settings');let p;act(()=>{p=m.ui.studio.onSaved({}).catch(e=>e);});await waitFor(()=>expect(m.updateProfile).toHaveBeenCalled());await switched();await act(async()=>{d.resolve({data:{id:'A',username:'A-private'},error:null});await p;});expect(screen.getByTestId('profile')).toHaveAttribute('data-account','B');
  await nav('edit-profile');const stale=m.ui.edit.onSaved;await auth('A');await nav('profile');act(()=>stale({id:'B',username:'B-private'}));expect(screen.getByTestId('profile')).toHaveAttribute('data-account','A');
 });
 it('disposes the REAL Board Studio draft on account change and suppresses its late save callbacks',async()=>{
  const d=deferred();m.updateBoard.mockReturnValueOnce(d.promise);await start();await nav('profile');act(()=>m.ui.profile.onCustomizeBoards());await screen.findByText('Make your Boards yours');
  fireEvent.change(screen.getByRole('textbox',{name:'Name'}),{target:{value:'A private draft'}});fireEvent.click(screen.getByRole('button',{name:'Save changes'}));await waitFor(()=>expect(m.updateBoard).toHaveBeenCalled());await auth('B');
  expect(screen.queryByDisplayValue('A private draft')).not.toBeInTheDocument();expect(screen.queryByText('Make your Boards yours')).not.toBeInTheDocument();await nav('profile');act(()=>m.ui.profile.onCustomizeBoards());expect(screen.getByRole('textbox',{name:'Name'})).toHaveValue('B secret Board');expect(screen.getByDisplayValue('B description')).toBeInTheDocument();expect(screen.getByDisplayValue('https://fixture.invalid/B')).toBeInTheDocument();
  await act(async()=>d.resolve({id:'one',name:'A stale Board'}));expect(screen.getByText('Make your Boards yours')).toBeInTheDocument();expect(screen.queryByText('Board customized')).not.toBeInTheDocument();
 });
 it('counts one canonical Keep in each of its Boards without duplicating the Keep',async()=>{
  m.library.mockResolvedValue([{id:'one-keep',board_ids:['one','two']}]);await start();await nav('profile');expect(m.ui.profile.boards.map(b=>b.count)).toEqual([1,1]);
 });
});
