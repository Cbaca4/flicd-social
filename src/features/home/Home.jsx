import React from 'react';
import {Heart,MessageCircle,Eye,Bookmark,ChevronRight,Search,Mic,Video} from 'lucide-react';
import {EmptyState} from '../../components/shared/States.jsx';
import UserSearch from './UserSearch.jsx';
import PublicProfile from '../profile/PublicProfile.jsx';
import SeasonalOverlay from '../seasonal/SeasonalOverlay.jsx';
import { getDumpItemMediaUrl } from './mediaUrl.js';
import { createVoiceCommentRecorder } from '../social/voiceCommentRecorder.js';
import { getCommentMediaUrl } from '../social/commentMediaUrl.js';
import { getCurrentUserId } from '../social/socialApi.js';
import { deleteComment } from '../social/interactionsApi.js';
import GifPicker from '../social/GifPicker.jsx';
import VideoCommentPicker from '../social/VideoCommentPicker.jsx';
import '../social/CommentComposer.css';

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

function SavedCommentMedia({comment}){
  const [url,setUrl]=React.useState(comment?.media_url||'');
  const [error,setError]=React.useState(null);

  React.useEffect(()=>{
    let active=true;
    setError(null);
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

  if(comment?.media_type==='gif'){
    return <div className="comment-media">{error?<span className="subtitle">GIF unavailable.</span>:url?<img aria-label="GIF comment" src={url} alt={comment?.media_metadata?.title||'GIF comment'} style={{maxWidth:'100%',borderRadius:14,display:'block'}}/>:<span className="subtitle">Loading GIF…</span>}</div>;
  }

  if(comment?.media_type==='video'){
    const durationSeconds=Number(comment?.media_metadata?.duration_seconds);
    const durationLabel=Number.isFinite(durationSeconds)&&durationSeconds>0?`${Math.round(durationSeconds)}s`:null;
    return <div className="comment-media" aria-label="Saved video comment"><div style={{position:'relative'}}>{error?<span className="subtitle">Video unavailable.</span>:url?<video aria-label="Video comment" controls src={url}/>:<span className="subtitle">Loading video…</span>}{durationLabel&&<span className="tag flicd-mono" style={{position:'absolute',top:8,right:8}}>{durationLabel}</span>}</div></div>;
  }

  return <div className="comment-media" aria-label="Saved audio comment">{error?<span className="subtitle">Audio unavailable.</span>:url?<audio aria-label="Audio comment" controls src={url}/>:<span className="subtitle">Loading audio…</span>}</div>;
}

export function Viewer({post,onClose,onLike,onComment,onKeep,onMarkViewed,likePending=false,currentUserId=null,onDeleteComment}){
  const [text,setText]=React.useState('');
  const [index,setIndex]=React.useState(0);
  const [recording,setRecording]=React.useState(false);
  const [voiceReviewBlob,setVoiceReviewBlob]=React.useState(null);
  const [voiceReviewUrl,setVoiceReviewUrl]=React.useState('');
  const [pendingComment,setPendingComment]=React.useState(null);
  const [pendingVideoUrl,setPendingVideoUrl]=React.useState('');
  const [commentSending,setCommentSending]=React.useState(false);
  const [resolvedCurrentUserId,setResolvedCurrentUserId]=React.useState(currentUserId);
  const [deletingCommentId,setDeletingCommentId]=React.useState(null);
  const [deletedCommentIds,setDeletedCommentIds]=React.useState(()=>new Set());
  const [gifPickerOpen,setGifPickerOpen]=React.useState(false);
  const [videoPickerOpen,setVideoPickerOpen]=React.useState(false);
  const recorderRef=React.useRef(null);
  const unsubscribeRef=React.useRef(null);
  React.useEffect(()=>{onMarkViewed?.(post.id)},[onMarkViewed,post.id]);
  React.useEffect(()=>{
    if(currentUserId){
      setResolvedCurrentUserId(currentUserId);
      return undefined;
    }
    let active=true;
    getCurrentUserId().then((id)=>{
      if(active)setResolvedCurrentUserId(id);
    }).catch(()=>{});
    return ()=>{active=false;};
  },[currentUserId]);
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
  React.useEffect(()=>{
    if(pendingComment?.media_type!=='video'||!pendingComment?.media_blob||typeof URL?.createObjectURL!=='function'){
      setPendingVideoUrl('');
      return undefined;
    }
    const url=URL.createObjectURL(pendingComment.media_blob);
    setPendingVideoUrl(url);
    return ()=>URL.revokeObjectURL?.(url);
  },[pendingComment]);
  const confirmAttachmentReplace=(nextType)=>{
    if(!pendingComment||pendingComment.media_type===nextType)return true;
    if(typeof window==='undefined'||typeof window.confirm!=='function')return true;
    return window.confirm('Replace the current attachment?');
  };
  const openAttachmentPicker=(type)=>{
    if(!confirmAttachmentReplace(type))return;
    if(type==='gif'){
      setVideoPickerOpen(false);
      setGifPickerOpen(true);
    }else{
      setGifPickerOpen(false);
      setVideoPickerOpen(true);
    }
  };
  const handleVoice=async()=>{
    if(recording){recorderRef.current?.stop();return;}
    if(pendingComment&&!confirmAttachmentReplace('audio'))return;
    setPendingComment(null);
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
  const handleGifSelect=(gif)=>{
    if(!gif?.mediaUrl)return;
    setText('');
    setPendingComment({media_type:'gif',media_url:gif.mediaUrl,media_metadata:{provider:'giphy',id:gif.id,title:gif.title||''}});
    setGifPickerOpen(false);
  };
  const handleVideoSelect=(video)=>{
    if(!video?.mediaBlob)return;
    setText('');
    setPendingComment({media_type:'video',media_blob:video.mediaBlob,media_metadata:video.mediaMetadata||null});
    setVideoPickerOpen(false);
  };
  const cancelVoice=()=>{
    recorderRef.current?.cancel();
    setRecording(false);
    setVoiceReviewBlob(null);
  };
  const sendVoice=()=>{
    const blob=voiceReviewBlob||recorderRef.current?.getBlob?.();
    if(!blob)return;
    onComment?.(post.id,{media_type:'audio',media_blob:blob});
    recorderRef.current?.cancel();
    setVoiceReviewBlob(null);
  };
  const removeAttachment=()=>setPendingComment(null);
  const sendComment=async()=>{
    if(commentSending)return;
    const input=pendingComment||text.trim();
    if(!input)return;
    setCommentSending(true);
    try{
      const result=await onComment?.(post.id,input);
      if(result!==null){
        setPendingComment(null);
        setText('');
      }
    }finally{
      setCommentSending(false);
    }
  };
  const handleDeleteComment=async(commentId)=>{
    if(deletingCommentId)return;
    const handler=onDeleteComment||deleteComment;
    setDeletingCommentId(commentId);
    try{
      const result=await handler(commentId);
      if(result!==false){
        setDeletedCommentIds((current)=>{
          const next=new Set(current);
          next.add(commentId);
          return next;
        });
      }
    }finally{
      setDeletingCommentId(null);
    }
  };
  const visibleComments=(post.comments||[]).filter((comment)=>!deletedCommentIds.has(comment.id));
  const pendingType=pendingComment?.media_type;
  return <div className="screen" style={{paddingBottom:28}}><div className="topbar"><button className="btn icon-btn" onClick={onClose} aria-label="Close">×</button><span className="tag flicd-mono">{timeLeft(post)}</span></div><div className="card"><MediaFrame item={post.items[index]} index={index} post={post}/>{post.items.length>1&&<div className="row" style={{justifyContent:'space-between',marginTop:10}}><button className="btn" disabled={index===0} onClick={()=>setIndex(i=>i-1)}><ChevronRight size={16} style={{transform:'rotate(180deg)'}}/></button><span className="flicd-mono muted">{index+1}/{post.items.length}</span><button className="btn" disabled={index===post.items.length-1} onClick={()=>setIndex(i=>i+1)}><ChevronRight size={16}/></button></div>}<div className="post-actions"><button className="btn" type="button" disabled={likePending} aria-label={post.liked?'Unlike':'Like'} onClick={()=>onLike(post.id)}><Heart size={16} fill={post.liked?'var(--amber)':'none'} color={post.liked?'var(--amber)':'currentColor'}/>{post.likes}</button><button className="btn" type="button" onClick={()=>onKeep(post,index)}><Bookmark size={16}/>Keep</button></div><section className="post-conversation" aria-label="Conversation"><div className="stack">{visibleComments.length?visibleComments.map(c=><div key={c.id} className="comment-row">{(c.media_type==='audio'||c.media_type==='video'||c.media_type==='gif')?<SavedCommentMedia comment={c}/>:<p className="subtitle"><strong style={{color:'var(--text)'}}>@{c.from}</strong> {c.text}</p>}{resolvedCurrentUserId&&c.user_id===resolvedCurrentUserId&&<button className="btn comment-delete-btn" type="button" aria-label="Delete comment" disabled={deletingCommentId===c.id} onClick={()=>handleDeleteComment(c.id)}>{deletingCommentId===c.id?'Deleting…':'Delete'}</button>}</div>):<p className="subtitle">No comments yet.</p>}</div>{voiceReviewBlob?<div className="comment-composer row" aria-label="Voice comment review"><audio aria-label="Voice comment preview" controls src={voiceReviewUrl||undefined}/><button className="btn" type="button" aria-label="Cancel voice comment" onClick={cancelVoice}>Cancel</button><button className="btn btn-primary" type="button" aria-label="Send voice comment" onClick={sendVoice}>Send</button></div>:<>{pendingComment&&<div className="comment-pending" aria-label={pendingType==='gif'?'Pending GIF attachment':pendingType==='video'?'Pending video attachment':''}>{pendingType==='gif'&&<img src={pendingComment.media_url} alt={pendingComment.media_metadata?.title||'GIF attachment'}/>} {pendingType==='video'&&<div className="comment-pending__video-wrap">{pendingVideoUrl?<video aria-label="Pending video preview" controls src={pendingVideoUrl}/>:<span className="subtitle">Preparing video preview…</span>}{Number.isFinite(Number(pendingComment.media_metadata?.duration_seconds))&&<span className="tag flicd-mono comment-pending__duration">{Math.round(Number(pendingComment.media_metadata.duration_seconds))}s</span>}</div>}<button className="btn icon-btn" type="button" aria-label="Remove attachment" onClick={removeAttachment}>×</button></div>}<div className="comment-composer row"><input className="input" value={text} onChange={e=>setText(e.target.value)} placeholder="Add a comment" disabled={Boolean(pendingComment)||commentSending}/><button className="btn" type="button" aria-label="Choose GIF" onClick={()=>openAttachmentPicker('gif')} disabled={commentSending}>GIF</button><button className="btn icon-btn" type="button" aria-label="Choose video" onClick={()=>openAttachmentPicker('video')} disabled={commentSending}><Video size={16}/></button><button className="btn icon-btn" type="button" aria-label={recording?'Stop voice recording':'Record voice comment'} onClick={handleVoice} disabled={commentSending}><Mic size={16}/></button><button className="btn btn-primary" aria-label="Send comment" disabled={(!text.trim()&&!pendingComment)||commentSending} onClick={sendComment}>{commentSending?'Sending…':'Send'}</button></div></>}{gifPickerOpen&&<GifPicker onSelect={handleGifSelect} onClose={()=>setGifPickerOpen(false)}/>} {videoPickerOpen&&<VideoCommentPicker onSelect={handleVideoSelect} onClose={()=>setVideoPickerOpen(false)}/>}</section></div></div>;
}
