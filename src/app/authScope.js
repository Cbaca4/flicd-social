// Lifetime identity, not authorization. The verified Supabase client owns Auth.
// Never persist or log tokens; use the session UUID only to detect replacement.
export function sessionIdentity(session) {
 if (session?.session_id) return session.session_id;
 try {
  const payload=session?.access_token?.split('.')[1];
  return payload?JSON.parse(atob(payload.replaceAll('-','+').replaceAll('_','/'))).session_id||null:null;
 } catch { return null; }
}
export function createAuthBoundary() {
 let serial=0,current=null;
 return {
  accept(session,event) {
   const user=session?.user?.id||null,id=sessionIdentity(session);
   const reset=event==='SIGNED_OUT'||event==='PASSWORD_RECOVERY'||event==='USER_DELETED';
   const changed=!current||!current.isCurrent()||reset||current.user!==user||current.sessionId!==id
    ||(event==='SIGNED_IN'&&!id);
   if(changed){
    current?.invalidate();
    let alive=true;const lanes=new Map();
    const scope={generation:++serial,user,sessionId:id,isCurrent:()=>alive,
     invalidate:()=>{alive=false;},
     cancel:lane=>lanes.set(lane,(lanes.get(lane)||0)+1),
     begin:lane=>{const version=(lanes.get(lane)||0)+1;lanes.set(lane,version);return ()=>alive&&lanes.get(lane)===version;},
     guard:callback=>(...args)=>alive?callback(...args):undefined,
    };
    current=scope;
   }
   return current;
  },
  invalidate(){current?.invalidate();},
 };
}

// Capture the subject BEFORE any identity await. Missing scopes fail closed.
export function captureAuthScope(origin, predicate) {
 if (!origin || typeof origin.user !== 'string' || !origin.user || !Number.isSafeInteger(origin.generation) || typeof origin.isCurrent !== 'function') {
  throw new Error('An originating authentication scope is required.');
 }
 const user=origin.user,generation=origin.generation,sessionId=origin.sessionId ?? null;
 const isCurrent=()=>origin.isCurrent() && origin.user===user && origin.generation===generation && (origin.sessionId ?? null)===sessionId && (!predicate || predicate());
 const assertCurrent=()=>{if(!isCurrent())throw new Error('Authenticated context changed.');};
 const assertUser=id=>{assertCurrent();if(id!==user)throw new Error('Authenticated account changed.');};
 const assertSession=session=>{assertUser(session?.user?.id);if(sessionIdentity(session)!==sessionId)throw new Error('Authenticated session changed.');};
 assertCurrent();
 return Object.freeze({user,generation,sessionId,isCurrent,assertCurrent,assertUser,assertSession});
}
