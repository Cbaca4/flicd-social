import {beforeEach,describe,it,expect,vi} from 'vitest';
import {testAuthScope} from '../../../tests/security/testAuthScope.js';
const {from,getUser,archiveWrite,json,blob,configured}=vi.hoisted(()=>({from:vi.fn(),getUser:vi.fn(),archiveWrite:vi.fn(),json:vi.fn(),blob:vi.fn(),configured:vi.fn()}));
vi.mock('../../lib/supabase',()=>({supabase:{auth:{getUser},from},createAccountClient:()=>({from})}));
vi.mock('../home/mediaSessionApi.js',()=>({isMediaGatewayConfigured:configured,mediaApi:{json,blob}}));
import {syncExpiredArchive,getArchiveDumps} from './archiveApi.js';
function table(data) {
 const q={then:(ok,no)=>Promise.resolve({data,error:null}).then(ok,no)};
 for(const name of ['select','eq','lte','not','order','in'])q[name]=vi.fn(()=>q);
 q.upsert=(rows)=>{archiveWrite(rows);return q;};return q;
}
beforeEach(()=>{vi.clearAllMocks();configured.mockReturnValue(false);getUser.mockResolvedValue({data:{user:{id:'owner'}},error:null});});
describe('archive separation from View Once claims',()=>{
 it('never uses the global once timestamp to archive or retire other viewers media',async()=>{
  from.mockImplementation(name=>{
   if(name==='dumps') {
    const q=table([]);q.eq=vi.fn((key,value)=>key==='expiry'&&value==='once'?table([{id:'once'}]):q);return q;
   }
   return table(name==='flicd_archive'?[{dump_id:'once',reason:'view_once'}]:[]);
  });
  expect(await syncExpiredArchive(testAuthScope('owner'))).toEqual([]);expect(archiveWrite).not.toHaveBeenCalled();
 });
 it('loads owner management through the trusted gateway instead of a Storage owner-prefix signing shortcut',async()=>{
  configured.mockReturnValue(true);
  json.mockResolvedValue([{id:'once',user_id:'owner',expiry:'once',dump_items:[{id:'frame',position:0,note:'Own frame'}]}]);
  blob.mockResolvedValue(new Blob([new Uint8Array([137,80,78,71])],{type:'image/png'}));
  const url=vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:owner-frame');
  try {
   const result=await getArchiveDumps(testAuthScope('owner'));expect(result).toHaveLength(1);expect(result[0].dump_items[0].archiveUrl).toBe('blob:owner-frame');
   expect(json).toHaveBeenCalledWith('owner/archive',{},{authScope:expect.objectContaining({user:'owner'})});expect(blob).toHaveBeenCalledWith('owner/frame',{itemId:'frame'},{authScope:expect.objectContaining({user:'owner'})});expect(from).not.toHaveBeenCalled();
  }finally{url.mockRestore();}
 });
});
