// Real application components; only Auth/Board-metadata transport is synthetic.
import React from "react";
import { createRoot } from "react-dom/client";
import Boards from "../../src/features/profile/Boards.jsx";
import Archive from "../../src/features/profile/Archive.jsx";
import AccountSafety from "../../src/features/social/AccountSafety.jsx";
import { Viewer } from "../../src/features/home/Home.jsx";
import { mediaApi, closeAllMediaSessions } from "../../src/features/home/mediaSessionApi.js";
import { saveBoardItem } from "../../src/features/profile/boardApi.js";
import { identities, currentAccount, setAccount, fixtureRequest, fixtureSession } from "./browser-fixture-client.js";
import { createAuthBoundary } from '../../src/app/authScope.js';
import { AuthScopeContext } from '../../src/app/AuthScopeContext.js';
import "../../src/styles.css";
import "../../src/mobile.css";

export default function FixturePage() {
 const [boundary]=React.useState(createAuthBoundary);
 const [authScope,setAuthScope]=React.useState(()=>boundary.accept(fixtureSession(),'SIGNED_IN'));
 const [actor,setActor]=React.useState(currentAccount());
 const [screen,setScreen]=React.useState("boards");
 const [info,setInfo]=React.useState(null),[post,setPost]=React.useState(null),[message,setMessage]=React.useState("");
 React.useEffect(()=>{let live=true;fixtureRequest("/fixture/info").then(result=>{if(live)setInfo(result);});return()=>{live=false;};},[actor]);
 async function open(label) {
  const result=await mediaApi.json("post",{dumpId:info[label]},{authScope});
  setPost({...result,author:result.user_id,authorId:result.user_id,mode:result.expiry,viewed:result.viewed,likes:0,liked:false,comments:[],items:result.dump_items});setScreen("viewer");
 }
 if(!info)return <p role="status">Loading synthetic local fixtures…</p>;
 return <AuthScopeContext.Provider value={authScope}><main style={{maxWidth:1100,margin:"0 auto",padding:16}}>
  <p>Local synthetic component QA — not hosted Supabase</p>
  <nav className="row" style={{flexWrap:"wrap",gap:8,marginBottom:16}}>
   <label>Test account <select aria-label="Test account" value={actor} onChange={event=>{const next=event.target.value;setAccount(next);setAuthScope(boundary.accept(fixtureSession(),'SIGNED_IN'));void closeAllMediaSessions();setActor(next);setPost(null);setScreen("boards");}}>{Object.keys(identities).map(id=><option key={id}>{id}</option>)}</select></label>
   <button className="btn" onClick={()=>setScreen("boards")}>Open Boards</button>
   <button className="btn" onClick={()=>setScreen("archive")}>Open Archive</button>
   <button className="btn" onClick={()=>open("once")}>Open View Once</button>
   <button className="btn" onClick={()=>open("raceOnce")}>Open race View Once</button>
   <button className="btn" onClick={()=>open("pendingOnce")}>Open pending View Once</button>
   <button className="btn" onClick={()=>setScreen("safety")}>Account Safety</button>
  </nav>
  {screen==="boards"&&<Boards key={actor} onBack={()=>setScreen("boards")} />}
  {screen==="archive"&&<Archive key={actor} onBack={()=>setScreen("boards")} onKeep={async(source,index)=>{const item=source.items[index];await saveBoardItem({dumpId:source.id,itemPosition:item.position,itemId:item.id,boardId:info.board},authScope);if(authScope.isCurrent())setMessage("Archived photo saved");}} />}
  {screen==="safety"&&<AccountSafety key={actor} accountId={identities.stranger} />}
  {screen==="viewer"&&post&&<Viewer post={post} currentUserId={identities[actor]} onClose={()=>{setPost(null);setScreen("boards");}} onMarkViewed={async()=>{setPost(current=>({...current,viewed:true}));return true;}} onLike={()=>setPost(current=>({...current,liked:!current.liked,likes:current.liked?0:1}))} onComment={async()=>true} />}
  {message&&<p role="status">{message}</p>}
 </main></AuthScopeContext.Provider>;
}
createRoot(document.getElementById("root")).render(<React.StrictMode><FixturePage /></React.StrictMode>);
