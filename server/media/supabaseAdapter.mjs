// Storage may deliver a verified image object with a generic
// application/octet-stream Blob type. Recognize only supported image magic
// signatures; never treat an arbitrary response as image data.
function imageMimeFromBytes(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'image/png';
  if (bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
      String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}

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
    const bytes = new Uint8Array(await data.arrayBuffer());
    const verifiedType = imageMimeFromBytes(bytes);
    // The trusted media gateway authorizes the source separately and only
    // serves supported images. A generic Storage response type must not
    // prevent delivery of genuine JPEG, PNG or WebP bytes.
    return {bytes,type:verifiedType || data.type};
   },
   remove:async(bucket,path)=>{
    const {error}=await client.storage.from(bucket).remove([path]);
    if(error&&String(error.statusCode)!=='404')throw new Error('storage_cleanup_failed');
   },
  },
 };
}
