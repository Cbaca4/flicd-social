// @vitest-environment jsdom
import React from 'react';
import '@testing-library/jest-dom/vitest';
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {act,cleanup,fireEvent,screen,waitFor} from '@testing-library/react';
import { renderAccount } from '../../../tests/security/renderAccount.jsx';
import { testAuthScope } from '../../../tests/security/testAuthScope.js';
import { captureAuthScope, createAuthBoundary } from '../../app/authScope.js';
const render = (ui, options) => renderAccount(ui, 'viewer', options);
const {factory,ownerFactory,ownerFrames,sign,claim,frames,close}=vi.hoisted(()=>({factory:vi.fn(),ownerFactory:vi.fn(),ownerFrames:vi.fn(),sign:vi.fn(async()=> 'https://old-signer.invalid/image'),claim:vi.fn(),frames:vi.fn(),close:vi.fn()}));
vi.mock('./mediaSessionApi.js',()=>({createOnceMediaSession:factory,createOwnerMediaSession:ownerFactory}));
vi.mock('./mediaUrl.js',()=>({PRIVATE_DUMP_MEDIA_BUCKET:'flicd-dump-private',getDumpItemMediaUrl:()=>null,resolveDumpItemMediaUrl:sign}));
vi.mock('../social/socialApi.js',()=>({getCurrentUserId:async()=> 'viewer'}));
vi.mock('../seasonal/SeasonalOverlay.jsx',()=>({default:()=>null}));
import Home,{Viewer} from './Home.jsx';
const post={id:'once',channel:'main',author:'owner',mode:'once',viewed:false,postedMinutesAgo:0,likes:0,comments:[],items:[{id:'frame',note:'Private frame',imagePath:'owner/private.png',mediaBucket:'flicd-dump-private'}]};
const receipt={status:'claimed',claim_id:'10000000-0000-4000-8000-000000000001',items:[{id:'frame',note:'Private frame',position:0}]};
beforeEach(()=>{vi.clearAllMocks();claim.mockResolvedValue(receipt);frames.mockResolvedValue(['blob:private-frame']);ownerFrames.mockResolvedValue(['blob:owner-frame']);close.mockResolvedValue();factory.mockReturnValue({claim,loadFrames:frames,close});ownerFactory.mockReturnValue({loadFrames:ownerFrames,close});});
afterEach(cleanup);
describe('View Once trusted React boundary',()=>{
 it('allows own 24-hour photos with Keep off but never allows a View Once owner shortcut',()=>{
  const {rerender}=render(<Viewer post={{...post,mode:'24h',allowOthersToKeep:false,authorId:'owner'}} currentUserId='owner'/>);
  expect(screen.getByRole('button',{name:'Keep'})).toBeEnabled();
  rerender(<Viewer post={{...post,authorId:'owner',allowOthersToKeep:true}} currentUserId='owner'/>);
  expect(screen.getByRole('button',{name:'Keep unavailable'})).toBeDisabled();
 });
 it('lets the owner reopen their own view-once photo even after a viewed flag without consuming a one-time claim',async()=>{
  const ownPost={...post,authorId:'owner'};
  const onMarkViewed=vi.fn();
  const first=renderAccount(<Viewer post={ownPost} currentUserId='owner' onMarkViewed={onMarkViewed}/>, 'owner');
  expect(await screen.findByRole('img',{name:'Private frame'})).toHaveAttribute('src','blob:owner-frame');
  expect(ownerFactory).toHaveBeenCalledWith(ownPost.items,expect.objectContaining({authScope:expect.any(Object)}));
  expect(factory).not.toHaveBeenCalled();
  expect(onMarkViewed).not.toHaveBeenCalled();
  first.unmount();
  ownerFrames.mockClear();
  renderAccount(<Viewer post={{...ownPost,viewed:true}} currentUserId='owner' onMarkViewed={onMarkViewed}/>, 'owner');
  expect(await screen.findByRole('img',{name:'Private frame'})).toHaveAttribute('src','blob:owner-frame');
  expect(ownerFrames).toHaveBeenCalledOnce();
  expect(factory).not.toHaveBeenCalled();
  expect(onMarkViewed).not.toHaveBeenCalled();
 });
 it('lets the creator retry a transient owner-frame failure without ever consuming a one-time claim',async()=>{
  ownerFrames.mockRejectedValueOnce(Object.assign(new Error('gateway offline'),{status:503}))
    .mockResolvedValueOnce(['blob:owner-frame']);
  const ownPost={...post,authorId:'owner'};
  renderAccount(<Viewer post={ownPost} currentUserId='owner'/>,'owner');
  expect(await screen.findByRole('alert')).toHaveTextContent('temporarily unavailable (503)');
  expect(screen.queryByRole('img',{name:'Private frame'})).not.toBeInTheDocument();
  expect(factory).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Retry photo'}));
  expect(await screen.findByRole('img',{name:'Private frame'})).toHaveAttribute('src','blob:owner-frame');
  expect(ownerFrames).toHaveBeenCalledTimes(2);
  expect(factory).not.toHaveBeenCalled();
  expect(claim).not.toHaveBeenCalled();
 });

 it('explains missing source IDs instead of claiming that a user consumed a view',async()=>{
  ownerFactory.mockImplementationOnce(()=>{throw new Error('Valid original photo identities are required.');});
  renderAccount(<Viewer post={{...post,authorId:'owner'}} currentUserId='owner'/>,'owner');
  expect(await screen.findByRole('alert')).toHaveTextContent('missing original photo identifiers');
  expect(screen.getByRole('button',{name:'Retry photo'})).toBeInTheDocument();
  expect(factory).not.toHaveBeenCalled();
 });

 it('replays the creator load safely in root Strict Mode without a one-view claim',async()=>{
  const ownPost={...post,authorId:'owner'};
  renderAccount(
    <React.StrictMode><Viewer post={ownPost} currentUserId='owner'/></React.StrictMode>,
    'owner',
  );
  expect(await screen.findByRole('img',{name:'Private frame'})).toHaveAttribute('src','blob:owner-frame');
  expect(factory).not.toHaveBeenCalled();
  expect(claim).not.toHaveBeenCalled();
 });

 it('uses AccountApp generation for creator media in root StrictMode',async()=>{
  const appScope=testAuthScope('owner');
  ownerFactory.mockImplementation((_items,options)=>{
    const scope=captureAuthScope(options.authScope);
    expect(scope.user).toBe('owner');
    expect(scope.isCurrent()).toBe(true);
    return {loadFrames:ownerFrames,close};
  });
  renderAccount(<React.StrictMode><Viewer post={{...post,authorId:'owner'}} currentUserId='owner' authScope={appScope}/></React.StrictMode>,'owner');
  expect(await screen.findByRole('img',{name:'Private frame'})).toHaveAttribute('src','blob:owner-frame');
  expect(ownerFactory).toHaveBeenCalled();
  expect(factory).not.toHaveBeenCalled();
  expect(claim).not.toHaveBeenCalled();
 });

 it('never renews owner access from a replaced app generation',async()=>{
  const boundary=createAuthBoundary();
  const oldScope=boundary.accept({user:{id:'owner'},session_id:'owner-session'},'SIGNED_IN');
  boundary.accept({user:{id:'replacement'},session_id:'replacement-session'},'SIGNED_IN');
  renderAccount(<Viewer post={{...post,authorId:'owner'}} currentUserId='owner' authScope={oldScope}/>, 'owner');
  expect(await screen.findByRole('alert')).toHaveTextContent('signed-in account changed');
  expect(ownerFactory).not.toHaveBeenCalled();
  expect(factory).not.toHaveBeenCalled();
  expect(claim).not.toHaveBeenCalled();
 });

 it('still locks an already-consumed non-owner view-once post without loading frames',()=>{
  render(<Viewer post={{...post,viewed:true,authorId:'owner'}} currentUserId='viewer' onMarkViewed={vi.fn()}/>);
  expect(screen.getByText('Already viewed once')).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Tap to view once'})).not.toBeInTheDocument();
  expect(ownerFactory).not.toHaveBeenCalled();
  expect(factory).not.toHaveBeenCalled();
 });
 it('labels the creator feed entry as re-openable without revealing media bytes in the feed',()=>{
  const open=vi.fn();
  render(<Home dumps={[{...post,authorId:'owner',viewed:true}]} activeSpace={{id:'main'}} currentUserId='owner' onOpen={open}/>);
  fireEvent.click(screen.getByRole('button',{name:'Open your view-once post'}));
  expect(open).toHaveBeenCalledWith(expect.objectContaining({id:'once'}));
  expect(ownerFactory).not.toHaveBeenCalled();
  expect(screen.queryAllByRole('img')).toHaveLength(0);
 });
 it('does not treat a missing other-user Keep opt-in as permission',()=>{
  render(<Viewer post={{...post,mode:'24h',allowOthersToKeep:undefined}} currentUserId='viewer'/>);
  expect(screen.getByRole('button',{name:'Keep unavailable'})).toBeDisabled();
 });
 it('retains consumed post opening, likes and comments without loading its media',()=>{
  const open=vi.fn(),like=vi.fn(),comments=vi.fn();
  render(<Home dumps={[{...post,viewed:true}]} activeSpace={{id:'main'}} onOpen={open} onLike={like} onCommentOpen={comments}/>);
  expect(screen.getByRole('button',{name:'Open already viewed once post'})).toBeEnabled();
  fireEvent.click(screen.getByRole('button',{name:'Like'}));fireEvent.click(screen.getByRole('button',{name:'Open comments'}));
  expect(like).toHaveBeenCalledWith('once');expect(comments).toHaveBeenCalled();expect(screen.queryAllByRole('img')).toHaveLength(0);expect(factory).not.toHaveBeenCalled();
 });
 it('claims before fetching bytes and never signs browser Storage URLs',async()=>{
  const acknowledged=vi.fn(async()=>true);render(<Viewer post={post} currentUserId='viewer' onMarkViewed={acknowledged}/>);
  expect(factory).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Tap to view once'}));
  expect(await screen.findByRole('img',{name:'Private frame'})).toHaveAttribute('src','blob:private-frame');
  expect(claim).toHaveBeenCalledOnce();expect(acknowledged).toHaveBeenCalledWith('once',receipt);expect(sign).not.toHaveBeenCalled();
  expect(claim.mock.invocationCallOrder[0]).toBeLessThan(frames.mock.invocationCallOrder[0]);
 });
 it('recovers when an earlier local image blob fails but the next authorized blob changes',async()=>{
  const oldPost={...post,mode:'24h',items:[{id:'frame',note:'Private frame',imagePath:null,imageUrl:'blob:old-invalid'}]};
  const {rerender}=render(<Viewer post={oldPost} currentUserId='viewer'/>);
  const previous=screen.getByRole('img',{name:'Private frame'});
  fireEvent.error(previous);
  expect(screen.queryByRole('img',{name:'Private frame'})).not.toBeInTheDocument();
  rerender(<Viewer post={{...oldPost,items:[{...oldPost.items[0],imageUrl:'blob:new-valid'}]}} currentUserId='viewer'/>);
  expect(screen.getByRole('img',{name:'Private frame'})).toHaveAttribute('src','blob:new-valid');
 });

 it('keeps every byte request behind the confirmed acknowledgement and retains its visible pending overlay',async()=>{
  let confirm;const acknowledge=vi.fn(()=>new Promise(resolve=>{confirm=resolve;}));
  render(<Viewer post={post} currentUserId='viewer' onMarkViewed={acknowledge}/>);fireEvent.click(screen.getByRole('button',{name:'Tap to view once'}));
  await waitFor(()=>expect(confirm).toBeTypeOf('function'));expect(frames).not.toHaveBeenCalled();expect(screen.queryAllByRole('img')).toHaveLength(0);
  expect(screen.getByRole('status').closest('.viewer-media-layer')).toBeNull();
  await act(async()=>confirm(true));expect(await screen.findByRole('img',{name:'Private frame'})).toBeInTheDocument();
 });
 it('closes the old page on navigation and cannot reveal its late result in the next post',async()=>{
  let finish;claim.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
  const {rerender}=render(<Viewer post={post} currentUserId='viewer' onMarkViewed={async()=>true}/>);
  fireEvent.click(screen.getByRole('button',{name:'Tap to view once'}));await waitFor(()=>expect(finish).toBeTypeOf('function'));
  rerender(<Viewer post={{...post,id:'different'}} currentUserId='viewer' onMarkViewed={async()=>true}/>);
  expect(close).toHaveBeenCalledOnce();await act(async()=>finish(receipt));expect(screen.queryAllByRole('img')).toHaveLength(0);expect(frames).not.toHaveBeenCalled();
 });
});
