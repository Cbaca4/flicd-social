import React from 'react';
import Pill from '../../components/shared/Pill.jsx';
import { ROLL_STAGES, getNextRollStage } from './rollPresentation.js';

export function DumpBuilder({spaces,activeSpaceId,onCancel,onPost}){const [count,setCount]=React.useState(3);const [mood,setMood]=React.useState('golden hour');const [expiry,setExpiry]=React.useState('24h');const [postAs,setPostAs]=React.useState(activeSpaceId);const [note,setNote]=React.useState('');const moods=['golden hour','late night','chaotic','nostalgic','summer'];return <div className="screen"><div className="topbar"><div><div className="eyebrow">New dump</div><h1 className="title">A handful of moments</h1></div><button className="btn" onClick={onCancel}>Cancel</button></div><div className="stack"><div className="card"><p className="eyebrow">Items</p><div className="wrap" style={{marginTop:10}}>{Array.from({length:count}).map((_,i)=><div key={i} className="board-cover" style={{width:66}}><span style={{position:'absolute',inset:0,display:'grid',placeItems:'center',fontSize:13}}>{i+1}</span></div>)}<button className="btn" onClick={()=>setCount(c=>Math.min(20,c+1))}>+ item</button></div></div><div className="card"><p className="eyebrow">Mood</p><div className="wrap" style={{marginTop:10}}>{moods.map(m=><Pill key={m} active={mood===m} onClick={()=>setMood(m)}>{m}</Pill>)}</div></div><div className="card"><p className="eyebrow">Context card</p><input className="input" style={{marginTop:10}} value={note} onChange={e=>setNote(e.target.value)} placeholder="A memory, song, location…"/></div><div className="card"><p className="eyebrow">Expires</p><div className="wrap" style={{marginTop:10}}><Pill active={expiry==='24h'} onClick={()=>setExpiry('24h')}>24 hours</Pill><Pill active={expiry==='once'} onClick={()=>setExpiry('once')}>View once</Pill></div></div><div className="card"><p className="eyebrow">Posting as</p><div className="wrap" style={{marginTop:10}}>{spaces.map(s=><Pill key={s.id} active={postAs===s.id} onClick={()=>setPostAs(s.id)}>@{s.handle}</Pill>)}</div></div><button className="btn btn-primary" onClick={()=>onPost({mood,expiry,channel:postAs,items:Array.from({length:count},(_,i)=>({note:i===0?note:''}))})}>Post dump</button></div></div>}

function RollDeveloping({frameCount,onComplete}){
  const [stage,setStage]=React.useState('loading');
  React.useEffect(()=>{
    const delays={loading:500,winding:900,developing:1700,revealing:1100};
    const timer=setTimeout(()=>{
      const next=getNextRollStage(stage);
      setStage(next);
      if(next==='finished') onComplete?.();
    },delays[stage]||800);
    return ()=>clearTimeout(timer);
  },[stage,onComplete]);

  const labels={loading:'Preparing the camera…',winding:'Winding the film…',developing:'Developing your roll…',revealing:'Revealing the memories…',finished:'Roll developed'};
  const progress=Math.round(((ROLL_STAGES.indexOf(stage)+1)/ROLL_STAGES.length)*100);
  return <div className="roll-developing" role="status" aria-live="polite">
    <div className="roll-camera"><div className="roll-lens"><span /></div><div className="roll-flash" /></div>
    <div className="eyebrow">Disposable roll</div>
    <h2 style={{marginTop:5}}>{labels[stage]}</h2>
    <p className="subtitle" style={{marginTop:6}}>{frameCount} frames · keep the moment imperfect.</p>
    <div className="roll-film" aria-hidden="true"><div className="roll-film-track" style={{transform:`translateX(-${Math.min(ROLL_STAGES.indexOf(stage),ROLL_STAGES.length-1)*18}%)`}}>{Array.from({length:7},(_,i)=><span key={i} className={i<ROLL_STAGES.indexOf(stage)+1?'developed':''}>{i<frameCount?i+1:'•'}</span>)}</div></div>
    <div className="roll-progress"><span style={{width:`${progress}%`}} /></div>
    {stage==='finished'&&<div className="tag" style={{marginTop:12}}>Ready to post</div>}
  </div>;
}

export function RollBuilder({spaces,activeSpaceId,onCancel,onPost}){
  const [frames,setFrames]=React.useState(8);const [shot,setShot]=React.useState(0);const [expiry,setExpiry]=React.useState('once');const [postAs,setPostAs]=React.useState(activeSpaceId);const [developing,setDeveloping]=React.useState(false);const [developed,setDeveloped]=React.useState(false);
  const post=()=>onPost({mood:'roll',expiry,channel:postAs,frameCount:frames});
  if(developing)return <div className="screen"><RollDeveloping frameCount={frames} onComplete={()=>{setDeveloped(true);setDeveloping(false)}}/><div className="row" style={{justifyContent:'center',marginTop:16}}><button className="btn" onClick={onCancel}>Cancel</button><button className="btn btn-primary" disabled={!developed} onClick={post}>{developed?'Post roll':'Developing…'}</button></div></div>;
  return <div className="screen"><div className="topbar"><div><div className="eyebrow">New roll</div><h1 className="title">Disposable camera energy</h1></div><button className="btn" onClick={onCancel}>Cancel</button></div>{shot===0?<div className="stack"><div className="card"><p className="subtitle">Pick how many frames you want. Once it starts, frames cannot be deleted or reordered.</p><div className="wrap" style={{marginTop:14}}>{[8,12,24].map(n=><Pill key={n} active={frames===n} onClick={()=>setFrames(n)}>{n} frames</Pill>)}</div></div><button className="btn btn-primary" onClick={()=>setShot(1)}>Start roll</button></div>:<div className="stack"><div className="row" style={{justifyContent:'space-between'}}><span className="eyebrow">Frames</span><span className="flicd-mono">{Math.min(shot,frames)}/{frames}</span></div><div className="grid grid-3">{Array.from({length:frames}).map((_,i)=><div key={i} className="board-cover" style={{opacity:i<shot?.95:.28}}><span style={{position:'absolute',inset:0,display:'grid',placeItems:'center'}}>{i<shot?'✓':i+1}</span></div>)}</div>{shot<=frames?<button className="btn btn-cyan" onClick={()=>{if(shot===frames){setDeveloping(true)}else setShot(s=>Math.min(frames,s+1))}}>{shot===frames?'Develop roll':'Capture frame'}</button>:null}{shot===frames&&<div className="card"><p className="eyebrow">Expires</p><div className="wrap" style={{marginTop:8}}><Pill active={expiry==='24h'} onClick={()=>setExpiry('24h')}>24 hours</Pill><Pill active={expiry==='once'} onClick={()=>setExpiry('once')}>View once</Pill></div><p className="eyebrow" style={{marginTop:16}}>Posting as</p><div className="wrap" style={{marginTop:8}}>{spaces.map(s=><Pill key={s.id} active={postAs===s.id} onClick={()=>setPostAs(s.id)}>@{s.handle}</Pill>)}</div></div>}</div>}</div>}
