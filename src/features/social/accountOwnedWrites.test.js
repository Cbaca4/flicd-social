import { it,vi,expect,beforeEach } from 'vitest';
import { testAuthScope } from '../../../tests/security/testAuthScope.js';
const m=vi.hoisted(()=>({getUser:vi.fn(),from:vi.fn(),storageFrom:vi.fn()}));
vi.mock('../../lib/supabase',()=>({supabase:{auth:{getUser:m.getUser},from:m.from,storage:{from:m.storageFrom}},createAccountClient:()=>({from:m.from,storage:{from:m.storageFrom}})}));
beforeEach(()=>{
 vi.clearAllMocks();const chain={select(){return this;},eq(){return this;},order(){return this;},limit(){return this;},upsert(){return this;},delete(){return this;},insert(){return this;},update(){return this;},single:async()=>({data:{id:'comment',is_private:true},error:null}),maybeSingle:async()=>({data:{},error:null}),then(resolve){return Promise.resolve({data:null,error:null}).then(resolve);}};
 m.from.mockReturnValue(chain);m.storageFrom.mockReturnValue({upload:async()=>({data:{path:'B/comments/private.webm'},error:null}),remove:async()=>({})});
});
it.each(['likeDump','unlikeDump','addComment','setPrivateAccount','uploadCommentMedia','createDump','createBoard','getOrCreateDefaultBoard'])('%s cannot attribute a stale draft/action to the replacement account',async name=>{
 let finish;m.getUser.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));let active=true;const context=testAuthScope('A',()=>active);
 const api=name==='setPrivateAccount'?await import('./socialApi.js'):name==='uploadCommentMedia'?await import('./commentMediaUpload.js'):await import('./interactionsApi.js');
 const scopedApi=name==='createDump'?await import('../capture/dumpApi.js'):['createBoard','getOrCreateDefaultBoard'].includes(name)?await import('../profile/boardApi.js'):api;
 const args=name==='createDump'?[{context:'A private text'},context]:name==='createBoard'?[{name:'A private Board'},context]:name==='getOrCreateDefaultBoard'?[context]:name==='addComment'?['post','private A text',context]:name==='setPrivateAccount'?[true,context]:name==='uploadCommentMedia'?[new Blob(['private audio'],{type:'audio/webm'}),{mediaType:'audio',authScope:context}]:['post',context];
 const pending=scopedApi[name](...args).catch(e=>e);await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));active=false;finish({data:{user:{id:'B'}},error:null});
 expect(await pending).toBeInstanceOf(Error);expect(m.from).not.toHaveBeenCalled();expect(m.storageFrom).not.toHaveBeenCalled();
});
it('does not insert photos or tags, or run cleanup with replacement credentials after a deferred post insert',async()=>{
 m.getUser.mockResolvedValue({data:{user:{id:'A'}},error:null});let finish;
 m.from.mockReturnValueOnce({insert:()=>new Promise(resolve=>{finish=resolve;})});
 const {createDump}=await import('../capture/dumpApi.js');let active=true;
 const pending=createDump({items:[{imagePath:'A/private.jpg'}],taggedUserIds:['friend']},testAuthScope('A',()=>active)).catch(e=>e);
 await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));active=false;finish({data:{id:'A-post'},error:null});
 expect(await pending).toBeInstanceOf(Error);expect(m.from).toHaveBeenCalledTimes(1);
});
it.each(['dump_items','dump_tags'])('does not continue or clean up after a stale rejected %s stage',async stage=>{
 m.getUser.mockResolvedValue({data:{user:{id:'A'}},error:null});let finish;
 m.from.mockImplementation(table=>table==='dumps'?{insert:async()=>({error:null}),select:()=>({eq:()=>({single:async()=>({data:{id:'A-post'},error:null})})})}:{insert:()=>table===stage?new Promise(resolve=>{finish=resolve;}):Promise.resolve({error:null})});
 const {createDump}=await import('../capture/dumpApi.js');let active=true;
 const pending=createDump({items:[{imagePath:'A/private.jpg'}],taggedUserIds:['friend']},testAuthScope('A',()=>active)).catch(e=>e);
 await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));active=false;finish({error:new Error('old stage failure')});
 expect(await pending).toBeInstanceOf(Error);expect(m.from.mock.calls.filter(([table])=>table==='dumps')).toHaveLength(1);
});
it.each(['createDump','createBoard','getOrCreateDefaultBoard'])('%s preserves a live context',async name=>{
 m.getUser.mockResolvedValue({data:{user:{id:'A'}},error:null});const context=testAuthScope('A');
 const api=name==='createDump'?await import('../capture/dumpApi.js'):await import('../profile/boardApi.js');
 await expect(api[name](...(name==='getOrCreateDefaultBoard'?[context]:[{name:'A Board',context:'A draft'},context]))).resolves.not.toBeInstanceOf(Error);
 expect(m.from).toHaveBeenCalledTimes(name==='createDump'?2:1);
});
it.each(['likeDump','unlikeDump','addComment','setPrivateAccount','uploadCommentMedia'])('%s preserves legitimate same-generation operations',async name=>{
 m.getUser.mockResolvedValue({data:{user:{id:'A'}},error:null});const context=testAuthScope('A');
 const api=name==='setPrivateAccount'?await import('./socialApi.js'):name==='uploadCommentMedia'?await import('./commentMediaUpload.js'):await import('./interactionsApi.js');
 const args=name==='addComment'?['post','A text',context]:name==='setPrivateAccount'?[true,context]:name==='uploadCommentMedia'?[new Blob(['audio'],{type:'audio/webm'}),{mediaType:'audio',authScope:context}]:['post',context];
 await expect(api[name](...args)).resolves.not.toBeInstanceOf(Error);
 expect(name==='uploadCommentMedia'?m.storageFrom:m.from).toHaveBeenCalledTimes(1);
});
