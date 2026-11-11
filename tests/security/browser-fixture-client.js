// SYNTHETIC LOCAL QA ADAPTER ONLY. Vite aliases this module only in the test server.
import { captureAuthScope } from '../../src/app/authScope.js';
export const identities = { owner: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", follower: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", stranger: "cccccccc-cccc-cccc-cccc-cccccccccccc", device2: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" };
let account = new URLSearchParams(location.search).get("actor") || "follower";
if (!Object.hasOwn(identities, account)) throw new Error("Unknown synthetic identity");
export const currentAccount = () => account;
export const setAccount = next => { if (!Object.hasOwn(identities,next)) throw new Error("Unknown synthetic identity"); account=next; };
export const fixtureSession = () => ({ user: { id: identities[account] }, session_id: 'fixture-session-'+account, access_token: 'fixture-'+account });
// One-shot deferred identity/session acquisition. Results deliberately resolve
// using the THEN-current synthetic actor, reproducing the reviewed SDK race.
export const fixtureAuth = window.fixtureAuth = { pause: null, pending: [], release() { const list=this.pending.splice(0);for(const finish of list)finish(); } };
const authResult = kind => {
 const value=()=>({data:kind==='identity'?{user:{id:identities[account]}}:{session:fixtureSession()}});
 if(fixtureAuth.pause!==kind)return Promise.resolve(value());
 fixtureAuth.pause=null;return new Promise(resolve=>fixtureAuth.pending.push(()=>resolve(value())));
};
export async function fixtureRequest(path, body = {}, authScope) {
 const scope=authScope?captureAuthScope(authScope):null;
 const session=await supabase.auth.getSession();
 scope?.assertSession(session.data.session);
 const payload=JSON.stringify(body);
 scope?.assertCurrent();
 const response = await fetch(path,{ method:"POST", headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.data.session.access_token},body:payload });
 if (!response.ok) throw new Error("Local fixture request failed: "+response.status);
 return response.json();
}
export const supabase = {
 auth:{ getUser:()=>authResult('identity'),getSession:()=>authResult('session') },
 from(table, authScope){
  if(table!=="boards")throw new Error("Unexpected provider table in component QA: "+table);
  let action="read",value=null,single=false;const filters={};
  const query={
   select(){return query;},eq(key,v){filters[key]=v;return query;},order(){return query;},limit(){return query;},
   insert(v){action="insert";value=v;return query;},update(v){action="update";value=v;return query;},delete(){action="delete";return query;},
   single(){single=true;return query;},maybeSingle(){single=true;return query;},
   then(resolve,reject){return Promise.resolve().then(()=>fixtureRequest("/fixture/boards",{action,value,filters},action==='read'?authScope:captureAuthScope(authScope))).then(data=>({data:single?data[0]||null:data,error:null})).then(resolve,reject);},
  };return query;
 },
 storage:{from(){throw new Error("Unexpected direct Storage signing/copy in component QA");}},
};
export const createAccountClient=authScope=>{
 const scope=captureAuthScope(authScope);
 return {from:table=>supabase.from(table,scope),storage:supabase.storage};
};
