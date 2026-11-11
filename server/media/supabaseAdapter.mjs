// Supply a backend-only privileged Supabase client explicitly. No env/file lookup,
// no automatic connection, no fallback synthetic authorization.
export function createSupabaseMediaAdapters({client}) {
 if(!client)throw new Error('An explicit backend client is required.');
 return {
  authorize:async(token)=>{
   const {data,error}=await client.auth.getUser(token);
   if(error||!data?.user?.id)throw new Error('authentication_required');
   let claims;try{claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString('utf8'));}catch{throw new Error('authentication_required');}
   if(claims.sub!==data.user.id||typeof claims.session_id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claims.session_id)
    ||!Number.isFinite(claims.exp)||claims.exp<=Date.now()/1000)throw new Error('authentication_required');
   // Every media RPC additionally checks auth.sessions for logout/revocation.
   return {id:data.user.id,sessionId:claims.session_id};
  },
  repository:{rpc:async(name,payload)=>{
   if(!/^media_[a-z_]+$/.test(name))throw new Error('invalid_rpc');
   const {data,error}=await client.rpc(name,{p:payload});if(error)throw error;return data;
  }},
  storage:{
   read:async(bucket,path)=>{
    const {data,error}=await client.storage.from(bucket).download(path);if(error||!data)throw new Error('delivery_interrupted');
    if(data.size>20*1024*1024)throw new Error('media_too_large');
    return {bytes:new Uint8Array(await data.arrayBuffer()),type:data.type};
   },
   remove:async(bucket,path)=>{
    const {error}=await client.storage.from(bucket).remove([path]);
    if(error&&String(error.statusCode)!=='404')throw new Error('storage_cleanup_failed');
   },
  },
 };
}
