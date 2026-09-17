import React from 'react';
import {Heart,MessageCircle,Eye,Bookmark,ChevronRight,Search,Mic} from 'lucide-react';
import {EmptyState} from '../../components/shared/States.jsx';
import UserSearch from './UserSearch.jsx';
import PublicProfile from '../profile/PublicProfile.jsx';
import SeasonalOverlay from '../seasonal/SeasonalOverlay.jsx';
import { getDumpItemMediaUrl } from './mediaUrl.js';
import { createVoiceCommentRecorder } from '../social/voiceCommentRecorder.js';
import { getCommentMediaUrl } from '../social/commentMediaUrl.js';

function timeLeft(post){
  if(post.mode==='once')return post.viewed?'expired':'view once';
  const left=Math.max(0,1440-post.postedMinutesAgo);
  return left<=0?'expired':`${Math.floor(left/60)}h ${left%60}m left`;
}

const gradients=['linear-gradient(145deg,#2f3a40,#12161b)','linear-gradient(145deg,#493221,#17120e)','linear-gradient(145deg,#293f39,#111816)','linear-gradient(145deg,#3b293d,#17121a)'];

function MediaFrame({item,index,post}){
  const [failed,setFailed]=React.useState(false);
  const imageUrl=item?.imageUrl||getDumpItemMediaUrl(item?.imagePath);
  if(imageUrl&&!failed){
    return <div className="post-media" style={{background:gradients[(post.id+index)%gradients.length],aspectRatio:'1/1',position:'relative',overflow:'hidden'}}><img src={imageUrl} alt={item?.note||`Moment ${index+1}`} onError={()=>setFailed(true)} style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/><div style={{position:'absolute',left:12,right:12,bottom:12}}><span className="tag">@{post.author} · {post.mood}</span>{item?.note&&<div className="media-text" style={{marginTop:10}}>{item.note}</div>}</div></div>;
  }
  return <div className="post-media" style={{background:gradients[(post.id+index)%gradients.length],aspectRatio:'1/1'}}><div><span className="tag">@{post.author} · {post.mood}</span><div className="media-text" style={{marginTop:12}}>{item?.note||'a little piece of the day'}</div></div></div>;
}

export function DumpCard({post,onOpen}){
  const expired=timeLeft(post)==='expired';
  const firstItem=post.items.find(item=>item?.imageUrl||item?.imagePath);
  const firstImage=firstItem?.imageUrl||getDumpItemMediaUrl(firstItem?.imagePath);
  return <button className="card post-card" onClick={()=>!expired&&onOpen(post)} style={{width:'100%',textAlign:'left',opacity:expired?.45:1}}><div className="post-media" style={{background:gradients[post.id%gradients.length],position:'relative',overflow:'hidden'}}>{firstImage&&<img src={firstImage} alt="" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',opacity:.86}}/>}<div style={{position:'relative',zIndex:1}}><span className="tag">{post.mood}</span><div className="media-text" style={{marginTop:10}}>{post.items.length} moments</div></div><span className="tag flicd-mono" style={{position:'relative',zIndex:1,marginLeft:'auto',alignSelf:'flex-start',color:post.mode==='once'?'var(--danger)':'var(--amber)'}}>{post.mode==='once'&&<Eye size={11} style={{marginRight:4}}/>}{timeLeft(post)}</span></div><div className="meta"><div><strong>@{post.author}</strong><div className="subtitle" style={{marginTop:3}}>{post.context||'shared a moment'}</div></div><div className="row muted"><span className="row"><Heart size={14} fill={post.liked?'var(--amber)':'none'} color={post.liked?'var(--amber)':'currentColor'}/>{post.likes}</span><span className="row"><MessageCircle size={14}/>{post.comments.length}</span></div></div></button>;
}

export default function Home({dumps,activeSpace,onOpen,onUserSelect,loading=false,error='',onRetry}){
  const [searchOpen,setSearchOpen]=React.useState(false);
  const [publicProfile,setPublicProfile]=React.useState(null);
  const visible=dumps.filter(d=>d.channel===activeSpace.id);
  if(loading){
    return <div className="screen"><div className="stack">{[0,1,2].map(key=><div key={key} className="feed-skeleton card" data-testid="feed-skeleton" aria-hidden="true"/> )}</div></div>;
  }
  if(error){
    return <div className="screen"><div className="stack"><EmptyState title="Could not load your feed" text="Something went wrong while loading your moments." action={onRetry?<button className="btn" type="button" onClick={onRetry}>Try again</button>:null}/></div></div>;
  }
  if(publicProfile){return <PublicProfile profile={publicProfile} onBack={()=>setPublicProfile(null)}/>};
  const handleUserSelect=(user)=>{setSearchOpen(false);if(onUserSelect){onUserSelect(user);return}setPublicProfile(user)};
  return <div className="screen" style={{position:'relative'}}><SeasonalOverlay/><div className="topbar"><div><div className="eyebrow">Flic'd / {activeSpace.label}</div><h1 className="title">Your moments</h1><p className="subtitle">Following from @{activeSpace.handle}.</p></div><div className="row"><div className="tag flicd-mono">{activeSpace.followers} followers</div><button type="button" className="btn icon-btn" onClick={()=>setSearchOpen(true)} aria-label="Search users"><Search size={19}/></button></div></div><div className="stack">{visible.length===0?<EmptyState title="Nothing here yet" text="Follow people from this space or create a new dump."/>:visible.map(p=><DumpCard key={p.id} post={p} onOpen={onOpen}/>)}</div>{searchOpen&&<UserSearch onClose={()=>setSearchOpen(false)} onUserSelect={handleUserSelect}/>}</div>;
}

function SavedAudioComment({comment}){
  const [url,setUrl]=React.useState(comment?.media_url||'');
  const [error,setError]=React.useState(null);

  React.useEffect(()=>{
    let active=true;
    if(comment?.media_url){
      setUrl(comment.media_url);
      return ()=>{active=false;};
    }
    if(!comment?.media_path){
      setUrl('');
      return undefined;
    }
    getCommentMediaUrl(comment).then((resolvedUrl)=>{
      if(active)setUrl(resolvedUrl||'');
    }).catch((loadError)=>{
      if(active)setError(loadError);
    });
    return ()=>{active=false;};
  },[comment?.media_path,comment?.media_url]);

  return <div className="comment-media" aria-label="Saved audio comment">{error?<span className="subtitle">Audio unavailable.</span>:url?<audio aria-label="Audio comment" controls src={url}/>:<span className="subtitle">Loading audio…</span>}</div>;
}

export function Viewer({post,onClose,onLike,onComment,onKeep,onMarkViewed,likePending=false}){
  const [text,setText]=React.useState('');
  const [index,setIndex]=React.useState(0);
  const [recording,setRecording]=React.useState(false);
  const [voiceReviewBlob,setVoiceReviewBlob]=React.useState(null);
  const [voiceReviewUrl,setVoiceReviewUrl]=React.useState('');
  const recorderRef=React.useRef(null);
  const unsubscribeRef=React.useRef(null);
  React.useEffect(()=>{onMarkViewed?.(post.id)},[onMarkViewed,post.id]);
  React.useEffect(()=>()=>{unsubscribeRef.current?.();recorderRef.current?.cancel();},[]);
  React.useEffect(()=>{
    if(!voiceReviewBlob){
      setVoiceReviewUrl('');
      return undefined;
    }
    if(typeof URL?.createObjectURL!=='function') return undefined;
    const url=URL.createObjectURL(voiceReviewBlob);
    setVoiceReviewUrl(url);
    return ()=>URL.revokeObjectURL?.(url);
  },[voiceReviewBlob]);
  const item=post.items[index];
  const handleVoice=async()=>{
    if(recording){recorderRef.current?.stop();return;}
    const recorder=recorderRef.current||createVoiceCommentRecorder();
    recorderRef.current=recorder;
    unsubscribeRef.current?.();
    unsubscribeRef.current=recorder.subscribe?.((state)=>{
      setRecording(state==='recording');
      if(state==='review')setVoiceReviewBlob(recorder.getBlob?.()||null);
      if(state==='idle')setVoiceReviewBlob(null);
    });
    try{
      await recorder.start();
      setRecording(true);
    }catch{
      setRecording(false);
    }
  };
  const cancelVoice=()=>{
    recorderRef.current?.cancel();
    setRecording(false);
    setVoiceReviewBlob(null);
  };
  const sendVoice=()=>{
    const blob=voiceReviewBlob||recorderRef.current?.getBlob?.();
    if(!blob)return;
    onComment(post.id,{media_type:'audio',media_blob:blob});
    recorderRef.current?.cancel();
    setVoiceReviewBlob(null);
  };
  return <div className="screen" style={{paddingBottom:28}}><div className="topbar"><button className="btn icon-btn" onClick={onClose} aria-label="Close">×</button><span className="tag flicd-mono">{timeLeft(post)}</span></div><div className="card"><MediaFrame item={item} index={index} post={post}/>{post.items.length>1&&<div className="row" style={{justifyContent:'space-between',marginTop:10}}><button className="btn" disabled={index===0} onClick={()=>setIndex(i=>i-1)}><ChevronRight size={16} style={{transform:'rotate(180deg)'}}/></button><span className="flicd-mono muted">{index+1}/{post.items.length}</span><button className="btn" disabled={index===post.items.length-1} onClick={()=>setIndex(i=>i+1)}><ChevronRight size={16}/></button></div>}<div className="post-actions"><button className="btn" type="button" disabled={likePending} aria-label={post.liked?'Unlike':'Like'} onClick={()=>onLike(post.id)}><Heart size={16} fill={post.liked?'var(--amber)':'none'} color={post.liked?'var(--amber)':'currentColor'}/>{post.likes}</button><button className="btn" type="button" onClick={()=>onKeep(post,index)}><Bookmark size={16}/>Keep</button></div><section className="post-conversation" aria-label="Conversation"><div className="stack">{post.comments.length?<>{post.comments.map(c=>c.media_type==='audio'?<SavedAudioComment key={c.id} comment={c}/>:<p key={c.id} className="subtitle"><strong style={{color:'var(--text)'}}>@{c.from}</strong> {c.text}</p>)}</>:<p className="subtitle">No comments yet.</p>}</div>{voiceReviewBlob?<div className="comment-composer row" aria-label="Voice comment review"><audio aria-label="Voice comment preview" controls src={voiceReviewUrl||undefined}/><button className="btn" type="button" aria-label="Cancel voice comment" onClick={cancelVoice}>Cancel</button><button className="btn btn-primary" type="button" aria-label="Send voice comment" onClick={sendVoice}>Send</button></div>:<div className="comment-composer row"><input className="input" value={text} onChange={e=>setText(e.target.value)} placeholder="Add a comment"/><button className="btn icon-btn" type="button" aria-label={recording?'Stop voice recording':'Record voice comment'} onClick={handleVoice}><Mic size={16}/></button><button className="btn btn-primary" disabled={!text.trim()} onClick={()=>{onComment(post.id,text.trim());setText('')}}>Send</button></div>}</section></div></div>;
}
