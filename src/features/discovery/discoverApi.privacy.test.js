import {beforeEach,describe,it,expect,vi} from 'vitest';
const {from}=vi.hoisted(()=>({from:vi.fn()}));
vi.mock('../../lib/supabase',()=>({supabase:{from}}));
vi.mock('../social/socialApi.js',()=>({getCurrentUserId:async()=> 'viewer',getFollowingIds:async()=> ({privateAuthor:'accepted'})}));
vi.mock('../social/interactionsApi.js',()=>({hydrateDumpInteractions:async value=>value}));
vi.mock('../music/musicApi.js',()=>({hydrateMusicTracks:async value=>value}));
import {getExploreCandidates} from './discoverApi.js';
const query=(data)=>{
 const q={then:(ok,no)=>Promise.resolve({data,error:null}).then(ok,no)};
 for(const method of ['select','eq','order','limit','in'])q[method]=vi.fn(()=>q);
 q.maybeSingle=async()=>({data,error:null});return q;
};
beforeEach(()=>vi.clearAllMocks());
describe('discovery metadata privacy',()=>{
 it('retains consumed/global-marked public once metadata while preserving ordinary expiry and private-author discovery boundaries',async()=>{
  let profileCalls=0;
  from.mockImplementation(table=>{
   if(table==='profiles')return profileCalls++===0?query({interests:[]}):query([{id:'publicAuthor',is_private:false,username:'public'},{id:'privateAuthor',is_private:true,username:'private'}]);
   if(table==='dump_views')return query([{dump_id:'consumed'}]);
   return query([
    {id:'consumed',user_id:'publicAuthor',expiry:'once',created_at:'2020-01-01'},
    {id:'globally-marked',user_id:'publicAuthor',expiry:'once',once_viewed_at:'2020-01-01',created_at:'2020-01-01'},
    {id:'old-24h',user_id:'publicAuthor',expiry:'24h',created_at:'2020-01-01'},
    {id:'private',user_id:'privateAuthor',expiry:'once',created_at:new Date().toISOString()},
    {id:'current',user_id:'publicAuthor',expiry:'24h',created_at:new Date().toISOString(),dump_items:[{id:'frame',position:0,image_path:'publicAuthor/private.png',media_bucket:'flicd-dump-private'}]},
   ]);
  });
  const result=await getExploreCandidates();
  expect(result.candidates.map(post=>post.id)).toEqual(['consumed','globally-marked','current']);
  expect(result.candidates[0].viewed).toBe(true);expect(result.candidates[1].viewed).toBe(false);
  expect(result.candidates[2].items[0].mediaBucket).toBe('flicd-dump-private');
 });
});
