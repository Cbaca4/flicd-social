// Call from an operator-managed trusted worker, never a browser route.
export async function runCleanupBatch({repository,storage}) {
 await repository.rpc('media_reconcile_cleanup',{});
 const jobs=await repository.rpc('media_lease_cleanup',{}),results=[];
 for(const job of jobs) {
  const lease={job_id:job.id,lease_token:job.lease_token};
  const authorization=await repository.rpc('media_cleanup_authorized',lease);
  if(authorization?.authorized!==true){
   results.push({id:job.id,status:'retention_or_lease_denied'});continue;
  }
  try {
   await storage.remove(job.bucket_id,job.name);
  }catch{
   const scheduled=await repository.rpc('media_fail_cleanup',lease);
   results.push({id:job.id,status:scheduled?.rescheduled===false?'stale_lease':'retry_scheduled'});continue;
  }
  const result=await repository.rpc('media_finish_cleanup',lease);
  results.push({id:job.id,status:result.completed?'completed':'stale_lease'});
 }
 return results;
}
