// Local synthetic fixture server. No environment credentials or hosted clients.
import { createServer } from 'vite';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { setupMediaDatabase,seedOnce,actor,USERS,SESSIONS } from '../../scripts/verify-local-media-security.mjs';
import { createMediaGateway } from '../../server/media/gateway.mjs';
const quote=value=>value===null?'NULL':"'"+String(value).replaceAll("'","''")+"'";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function startBrowserFixture({scratch}) {
 const db=await setupMediaDatabase({full:true});let vite;
 try {
  await db.sql(`ALTER TABLE public.boards ADD COLUMN description text,ADD COLUMN cover_url text,ADD COLUMN style_config jsonb DEFAULT '{}'::jsonb,ADD COLUMN created_at timestamptz DEFAULT clock_timestamp(),ADD COLUMN updated_at timestamptz DEFAULT clock_timestamp();`);
  const ordinary=await seedOnce(db,USERS.stranger,'24h'),own=await seedOnce(db,USERS.follower,'24h'),once=await seedOnce(db,USERS.stranger),raceOnce=await seedOnce(db,USERS.stranger);
  const pendingOnce=await seedOnce(db,USERS.stranger);
  const sparseItem=randomUUID(),sparsePath=USERS.follower+'/local-media/'+own.id+'/7.png';
  await db.sql(`INSERT INTO public.dump_items(id,dump_id,position,image_path,media_bucket,note) VALUES('${sparseItem}','${own.id}',7,'${sparsePath}','flicd-dump-private','sparse original photo'); INSERT INTO storage.objects(bucket_id,name) VALUES('flicd-dump-private','${sparsePath}'); DELETE FROM public.dump_items WHERE id='${own.items[1]}'`);
  own.items[1]=sparseItem;
  const board='99999999-1111-4111-8111-111111111111',secondBoard='99999999-2222-4222-8222-222222222222';
  for(const role of ['owner','follower','stranger'])await db.sql(`INSERT INTO public.boards(id,user_id,name) VALUES(gen_random_uuid(),'${USERS[role]}','Saved')`);
  await db.sql(`INSERT INTO public.boards(id,user_id,name) VALUES('${board}','${USERS.follower}','Trips'),('${secondBoard}','${USERS.follower}','Ideas')`);
  const foreign=await db.rpc('media_save_photo',{...actor('follower'),dump_id:ordinary.id,item_position:1,board_id:board});
  const ownKeep=await db.rpc('media_save_photo',{...actor('follower'),dump_id:own.id,item_position:0});
  const legacy='99999999-3333-4333-8333-333333333333';
  await db.sql(`INSERT INTO public.board_items(id,user_id,board_id,note) VALUES('${legacy}','${USERS.follower}','${board}','Unverified old Save'); SELECT private.media_preserve_legacy_records(); UPDATE public.dumps SET created_at=clock_timestamp()-interval '25 hours',allow_others_to_keep=false WHERE id IN('${ordinary.id}','${own.id}');`);
  const files=new Map();
  const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAE0lEQVR4nGP4z8DA8B+MGP4zAAAd8AP9pokTAAAAAABJRU5ErkJggg==','base64');
  for(const [source,user] of [[ordinary,USERS.stranger],[own,USERS.follower],[once,USERS.stranger],[raceOnce,USERS.stranger],[pendingOnce,USERS.stranger]])for(let i=0;i<2;i++)files.set('flicd-dump-private/'+user+'/local-media/'+source.id+'/'+i+'.png',image);
  files.set('flicd-dump-private/'+sparsePath,image);
  const network=[];
  const authorize=async token=>{const role=token.replace(/^fixture-/,'');if(role==='device2')return{id:USERS.follower,sessionId:SESSIONS.secondDevice};if(token!=='fixture-'+role||!Object.hasOwn(USERS,role))throw new Error('invalid synthetic actor');return{id:USERS[role],sessionId:SESSIONS[role]};};
  const storage={read:async(bucket,path)=>{const bytes=files.get(bucket+'/'+path);if(!bytes)throw new Error('missing synthetic file');return{bytes,type:'image/png'};}};
  const base='http://127.0.0.1:5178';
  const gateway=createMediaGateway({authorize,repository:db,storage,allowedOrigins:[base]});
  const fixtureClient=resolve('tests/security/browser-fixture-client.js');
  vite=await createServer({configFile:false,root:process.cwd(),envDir:resolve(scratch,'no-env-files'),server:{host:'127.0.0.1',port:5178,strictPort:true},define:{'import.meta.env.VITE_MEDIA_GATEWAY_URL':JSON.stringify(base)},plugins:[
   {name:'synthetic-local-client',enforce:'pre',resolveId(id){if(/(?:^|\/)lib\/supabase(?:\.js)?$/.test(id))return fixtureClient;}},
   {name:'synthetic-media-fixture',configureServer(server){server.middlewares.use(async(req,res,next)=>{
    const path=req.url?.split('?')[0];if(path!=='/'&&!path?.startsWith('/media/')&&!path?.startsWith('/fixture/'))return next();
    if(path==='/'){res.setHeader('Content-Type','text/html');res.end(await server.transformIndexHtml('/',`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Local Boards QA</title></head><body><div id="root"></div><script type="module" src="/tests/security/browser-fixture-page.jsx"></script></body></html>`));return;}
    try {
     const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>8192){res.writeHead(413).end();return;}chunks.push(chunk);}const text=Buffer.concat(chunks).toString();
     if(path.startsWith('/media/')){const response=await gateway(new Request(base+req.url,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:text}:{})}));network.push({route:path,status:response.status});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;}
     const user=await authorize(req.headers.authorization?.replace(/^Bearer /,''));const body=JSON.parse(text||'{}');let result;
     if(path==='/fixture/info')result={once:once.id,raceOnce:raceOnce.id,pendingOnce:pendingOnce.id,board,secondBoard,ordinary:ordinary.id};
     else if(path==='/fixture/boards'){
      const tableId=body.filters?.id;if(tableId!==undefined&&!UUID.test(tableId))throw new Error('bad Board identifier');
      let sql=`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${user.id}',false); `;
      if(body.action==='read')sql+=`SELECT coalesce(json_agg(b ORDER BY b.pinned DESC,b.created_at),'[]') FROM public.boards b WHERE b.user_id='${user.id}'${tableId?` AND b.id='${tableId}'`:''}${body.filters?.name?` AND b.name=${quote(body.filters.name)}`:''}`;
      else if(body.action==='insert'){const v=body.value;sql+=`WITH changed AS(INSERT INTO public.boards(id,user_id,name,description,pinned,style_config) VALUES(gen_random_uuid(),'${user.id}',${quote(v.name)},${quote(v.description||'')},${Boolean(v.pinned)},${quote(JSON.stringify(v.style_config||{}))}::jsonb) RETURNING *) SELECT coalesce(json_agg(changed),'[]') FROM changed`;}
      else if(body.action==='update'&&tableId){const v=body.value,allowed=['name','description','cover_url','pinned','style_config','updated_at'];const sets=Object.entries(v).filter(([key])=>allowed.includes(key)).map(([key,value])=>key+'='+(key==='pinned'?String(Boolean(value)):key==='style_config'?quote(JSON.stringify(value))+'::jsonb':quote(value)));if(!sets.length)throw new Error('empty mutation');sql+=`WITH changed AS(UPDATE public.boards SET ${sets.join(',')} WHERE id='${tableId}' RETURNING *) SELECT coalesce(json_agg(changed),'[]') FROM changed`;}
      else if(body.action==='delete'&&tableId)sql+=`WITH changed AS(DELETE FROM public.boards WHERE id='${tableId}' RETURNING *) SELECT coalesce(json_agg(changed),'[]') FROM changed`;
      else throw new Error('invalid fixture operation');
      // json_agg(composite) may contain newlines. Remove only SET/set_config
      // envelope lines, not JSON whitespace or user-supplied Board values.
      result=JSON.parse((await db.sql(sql)).split(/\r?\n/).slice(2).join('\n'));
     } else throw new Error('unknown fixture route');
     res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(result));
    }catch{res.writeHead(400,{'Content-Type':'application/json'}).end(JSON.stringify({error:'synthetic_fixture_denied'}));}
   });}},
  ]});
  await vite.listen();
  return{db,base,network,sources:{ordinary,own,once,raceOnce,pendingOnce},board,secondBoard,foreign,ownKeep,stop:async()=>{await vite.close();await db.close();}};
 }catch(error){await vite?.close();await db.close();throw error;}
}
