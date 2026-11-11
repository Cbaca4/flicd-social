// Synthetic API/surface seams for the REAL FlicdApp + BoardStudio browser test.
// Loaded only by the isolated account browser fixture, never the app entrypoint.
export const accountFixture=window.accountFixture={user:'A',pause:null,held:[],listeners:new Set(),switch(user){this.user=user;for(const cb of this.listeners)cb('SIGNED_IN',{user:{id:user},session_id:'login-'+user});},release(kind){const list=this.held.filter(x=>x.kind===kind);this.held=this.held.filter(x=>x.kind!==kind);for(const x of list)x.resolve(x.value);}};
const f=accountFixture;
const record=(id,user)=>({id,user_id:user,expiry:'24h',type:'dump',created_at:new Date().toISOString(),dump_items:[{id:'photo-'+user,position:0,note:'synthetic private '+user}]});
function hold(kind,value){return f.pause===kind?new Promise(resolve=>f.held.push({kind,value,resolve})):Promise.resolve(value);}
export const supabase={auth:{getSession:async()=>({data:{session:{user:{id:f.user},session_id:'login-'+f.user}}}),getUser:async()=>({data:{user:{id:f.user}}}),onAuthStateChange:cb=>{f.listeners.add(cb);return {data:{subscription:{unsubscribe:()=>f.listeners.delete(cb)}}};}},from:()=>({select:()=>({eq:(_,id)=>({maybeSingle:async()=>({data:{id,username:id},error:null})})}),update:()=>({eq:(_,id)=>({select:()=>({single:async()=>({data:{id},error:null})})})})})};
export const createAccountClient=scope=>{scope.assertCurrent();return supabase;};
export const getFeedDumps=async()=>[record('feed-'+f.user,f.user)];
export const getDumpById=()=>hold('lookup',record('private-result-'+f.user,f.user));
export const hydrateDumpInteractions=async value=>value;
export const createDump=()=>hold('create',record('private-post-'+f.user,f.user));
export const getPostingLimitStatus=async()=>({remaining:3});
export const markDumpViewed=async()=>true;
export const syncExpiredArchive=async()=>{};
export const closeAllMediaSessions=async()=>{};
export const uploadDumpImages=async()=>[];
export const removeDumpImages=async()=>{};
export const PRIVATE_DUMP_MEDIA_BUCKET='flicd-dump-private';
export const getMusicTrack=async()=>null;
export const getMessageRequests=async()=>[];
export const getUnreadNotificationCount=async()=>0;
export const getBoards=async()=>[{id:'board-'+f.user,user_id:f.user,name:f.user+' secret Board',description:f.user+' private description',cover_url:''}];
export const getBoardItems=async()=>[];
export const getOrCreateDefaultBoard=async()=>(await getBoards())[0];
export const createBoard=async()=>({id:'new-'+f.user,name:'New'});
export const saveBoardItem=async()=>({});
export const updateBoard=(id,value)=>hold('board',{id,name:value.name,description:value.description,cover_url:value.coverUrl});
export const likeDump=async()=>{};
export const unlikeDump=async()=>{};
export const addComment=async()=>({id:'synthetic-comment'});
