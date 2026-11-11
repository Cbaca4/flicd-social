// Trusted, dependency-injected server boundary. Never import into the browser bundle.
import { createHash } from 'node:crypto';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY=8192;
const MAX_IMAGE=20*1024*1024;
const PRIVATE_BUCKETS=new Set(['flicd-dump-private','flicd-archive','flicd-keeps-private']);
const IMAGE_TYPES=new Set(['image/jpeg','image/png','image/webp']);
const invalid=()=>{throw Object.assign(new Error('invalid_request'),{status:400});};
const uuid=(value)=>typeof value==='string'&&UUID.test(value)?value:invalid();
const binding=(value)=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value)?createHash('sha256').update(value).digest('hex'):invalid();
export function createMediaGateway({authorize,repository,storage,allowedOrigins}) {
 if(typeof authorize!=='function'||typeof repository?.rpc!=='function'||typeof storage?.read!=='function'||!Array.isArray(allowedOrigins))throw new Error('Explicit trusted adapters and origins are required.');
 const origins=new Set(allowedOrigins);
 return async function handle(request) {
  const headers=new Headers({'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff','Vary':'Origin'});
  const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:new Headers([...headers,['Content-Type','application/json']])});
  try {
   const url=new URL(request.url),origin=request.headers.get('Origin');
   if(url.search)return json({error:'query_capabilities_not_allowed'},400);
   if(origin&&!origins.has(origin))return json({error:'origin_denied'},403);
   if(origin)headers.set('Access-Control-Allow-Origin',origin);
   if(request.method==='OPTIONS') {
    headers.set('Access-Control-Allow-Headers','Authorization, Content-Type');headers.set('Access-Control-Allow-Methods','POST');
    return new Response(null,{status:204,headers});
   }
   if(request.method!=='POST')return json({error:'method_not_allowed'},405);
   const token=request.headers.get('Authorization')?.match(/^Bearer ([^\s]+)$/)?.[1];
   if(!token)return json({error:'authentication_required'},401);
   let user;
   try {user=await authorize(token);uuid(user?.id);uuid(user?.sessionId);}catch{return json({error:'authentication_required'},401);}
   const bodyText=await request.text();
   if(new TextEncoder().encode(bodyText).length>MAX_BODY)return json({error:'request_too_large'},413);
   let body;try{body=JSON.parse(bodyText);}catch{invalid();}
   if(!body||Array.isArray(body)||typeof body!=='object')invalid();
   const actor={viewer_id:user.id,auth_session_id:user.sessionId};
   const oncePayload=()=>({...actor,claim_id:uuid(body.claimId),binding_hash:binding(body.pageSecret)});
   const imageResponse=async(rpc,payload)=>{
    const location=await repository.rpc(rpc,payload);
    if(!PRIVATE_BUCKETS.has(location?.bucket)||typeof location?.path!=='string'||location.path.split('/').some(x=>!x||x==='.'||x==='..'))throw new Error('media_unavailable');
    let image;
    try {image=await storage.read(location.bucket,location.path);}catch{return json({error:'delivery_interrupted_claim_not_refunded'},503);}
    if(!IMAGE_TYPES.has(image?.type)||!(image.bytes instanceof Uint8Array)||image.bytes.byteLength>MAX_IMAGE)return json({error:'unsupported_media'},415);
    const confirmed=await repository.rpc(rpc,payload);
    if(confirmed?.bucket!==location.bucket||confirmed?.path!==location.path)throw new Error('media_source_changed');
    headers.set('Content-Type',image.type);
    return new Response(image.bytes,{status:200,headers});
   };
   switch(url.pathname) {
    case '/media/safety/status':return json(await repository.rpc('media_account_block_status',{...actor,account_id:uuid(body.accountId)}));
    case '/media/safety/block':
     if(typeof body.blocked!=='boolean')invalid();
     return json(await repository.rpc('media_set_account_block',{...actor,account_id:uuid(body.accountId),blocked:body.blocked}));
    case '/media/post':return json(await repository.rpc('media_post_metadata',{...actor,dump_id:uuid(body.dumpId)}));
    case '/media/owner/archive':return json(await repository.rpc('media_owner_archive',actor));
    case '/media/once/claim':return json(await repository.rpc('media_claim_view_once',{
     ...actor,dump_id:uuid(body.dumpId),attempt_id:uuid(body.attemptId),binding_hash:binding(body.pageSecret),
    }));
    case '/media/once/heartbeat':return json(await repository.rpc('media_once_frame',oncePayload()));
    case '/media/once/close':return json(await repository.rpc('media_close_view_once',oncePayload()));
    case '/media/once/frame':return await imageResponse('media_once_frame',{...oncePayload(),item_id:uuid(body.itemId)});
    case '/media/keeps/save':
     if(!Number.isInteger(body.itemPosition)||body.itemPosition<0)invalid();
     return json(await repository.rpc('media_save_photo',{...actor,dump_id:uuid(body.dumpId),item_position:body.itemPosition,...(body.itemId!==undefined?{item_id:uuid(body.itemId)}:{}),...(body.boardId?{board_id:uuid(body.boardId)}:{})}));
    case '/media/keeps/list':return json(await repository.rpc('media_list_keeps',actor));
    case '/media/keeps/link':return json(await repository.rpc('media_link_keep',{...actor,keep_id:uuid(body.keepId),board_id:uuid(body.boardId)}));
    case '/media/keeps/unlink':return json(await repository.rpc('media_remove_board_photo',{...actor,keep_id:uuid(body.keepId),board_id:uuid(body.boardId)}));
    case '/media/keeps/remove':return json(await repository.rpc('media_remove_keep',{...actor,keep_id:uuid(body.keepId)}));
    case '/media/keeps/frame':return await imageResponse('media_keep_frame',{...actor,keep_id:uuid(body.keepId)});
    case '/media/owner/frame':return await imageResponse('media_owner_frame',{...actor,item_id:uuid(body.itemId)});
    default:return json({error:'not_found'},404);
   }
  }catch(error) {
   if(error.status===400)return json({error:'invalid_request'},400);
   if(/media_consumed/.test(error.message))return json({error:'media_consumed'},409);
   // Do not relay SQL statements, object locations, backend failures or tokens.
   return json({error:'media_denied'},403);
  }
 };
}
