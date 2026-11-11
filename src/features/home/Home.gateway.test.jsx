// @vitest-environment jsdom
import React from 'react';
import '@testing-library/jest-dom/vitest';
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {act,cleanup,fireEvent,screen,waitFor} from '@testing-library/react';
import { renderAccount } from '../../../tests/security/renderAccount.jsx';
const render = (ui, options) => renderAccount(ui, 'viewer', options);
const {factory,sign,claim,frames,close}=vi.hoisted(()=>({factory:vi.fn(),sign:vi.fn(async()=> 'https://old-signer.invalid/image'),claim:vi.fn(),frames:vi.fn(),close:vi.fn()}));
vi.mock('./mediaSessionApi.js',()=>({createOnceMediaSession:factory}));
vi.mock('./mediaUrl.js',()=>({PRIVATE_DUMP_MEDIA_BUCKET:'flicd-dump-private',getDumpItemMediaUrl:()=>null,resolveDumpItemMediaUrl:sign}));
vi.mock('../social/socialApi.js',()=>({getCurrentUserId:async()=> 'viewer'}));
vi.mock('../seasonal/SeasonalOverlay.jsx',()=>({default:()=>null}));
import Home,{Viewer} from './Home.jsx';
const post={id:'once',channel:'main',author:'owner',mode:'once',viewed:false,postedMinutesAgo:0,likes:0,comments:[],items:[{id:'frame',note:'Private frame',imagePath:'owner/private.png',mediaBucket:'flicd-dump-private'}]};
const receipt={status:'claimed',claim_id:'10000000-0000-4000-8000-000000000001',items:[{id:'frame',note:'Private frame',position:0}]};
beforeEach(()=>{vi.clearAllMocks();claim.mockResolvedValue(receipt);frames.mockResolvedValue(['blob:private-frame']);close.mockResolvedValue();factory.mockReturnValue({claim,loadFrames:frames,close});});
afterEach(cleanup);
describe('View Once trusted React boundary',()=>{
 it('allows own 24-hour photos with Keep off but never allows a View Once owner shortcut',()=>{
  const {rerender}=render(<Viewer post={{...post,mode:'24h',allowOthersToKeep:false,authorId:'owner'}} currentUserId='owner'/>);
  expect(screen.getByRole('button',{name:'Keep'})).toBeEnabled();
  rerender(<Viewer post={{...post,authorId:'owner',allowOthersToKeep:true}} currentUserId='owner'/>);
  expect(screen.getByRole('button',{name:'Keep unavailable'})).toBeDisabled();
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
