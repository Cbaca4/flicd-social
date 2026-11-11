import { describe,it,expect,vi } from 'vitest';
import { runCleanupBatch } from './cleanupWorker.mjs';
const job={id:'one',lease_token:'lease-one',bucket_id:'flicd-archive',name:'synthetic/boards/held.png'};
function fixture(authorization){
 const repository={rpc:vi.fn(async name=>name==='media_lease_cleanup'?[job]:name==='media_cleanup_authorized'?authorization:{completed:true})};
 const storage={remove:vi.fn().mockResolvedValue(undefined)};
 return {repository,storage};
}
describe('cleanup retention boundary',()=>{
 it.each([{authorized:false},{},null])('fails closed before Storage IO when authorization is %j',async authorization=>{
  const {repository,storage}=fixture(authorization);
  expect(await runCleanupBatch({repository,storage})).toEqual([{id:job.id,status:'retention_or_lease_denied'}]);
  expect(storage.remove).not.toHaveBeenCalled();
  expect(repository.rpc).not.toHaveBeenCalledWith('media_finish_cleanup',expect.anything());
 });
 it('requires a current database authorization of the exact lease before deleting bytes',async()=>{
  const {repository,storage}=fixture({authorized:true});
  expect(await runCleanupBatch({repository,storage})).toEqual([{id:job.id,status:'completed'}]);
  expect(repository.rpc).toHaveBeenCalledWith('media_cleanup_authorized',{job_id:job.id,lease_token:job.lease_token});
  expect(storage.remove).toHaveBeenCalledWith(job.bucket_id,job.name);
  expect(repository.rpc.mock.invocationCallOrder[2]).toBeLessThan(storage.remove.mock.invocationCallOrder[0]);
 });
 it('an authorization failure cannot fall through to object removal',async()=>{
  const {repository,storage}=fixture({authorized:true});
  repository.rpc.mockImplementation(async name=>{if(name==='media_cleanup_authorized')throw new Error('authority unavailable');return name==='media_lease_cleanup'?[job]:{};});
  await expect(runCleanupBatch({repository,storage})).rejects.toThrow('authority unavailable');
  expect(storage.remove).not.toHaveBeenCalled();
 });
});
