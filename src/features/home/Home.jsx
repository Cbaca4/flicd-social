import React from 'react';
import {Heart,MessageCircle,Eye,Bookmark,ChevronRight,Bell,Mic,Video,Music2,MapPin,Volume2,VolumeX} from 'lucide-react';
import {EmptyState} from '../../components/shared/States.jsx';
import SeasonalOverlay from '../seasonal/SeasonalOverlay.jsx';
import { getDumpItemMediaUrl } from './mediaUrl.js';
import { createVoiceCommentRecorder } from '../social/voiceCommentRecorder.js';
import { getCommentMediaUrl } from '../social/commentMediaUrl.js';
import { getCurrentUserId } from '../social/socialApi.js';
import { deleteComment, reportComment } from '../social/interactionsApi.js';
import GifPicker from '../social/GifPicker.jsx';
import VideoCommentPicker from '../social/VideoCommentPicker.jsx';
import { getActiveAudio, playAudioUrl, setAudioMuted, stopAudio } from '../music/audioController.js';
import { distanceKm, formatDistanceKm } from './distance.js';
import '../social/CommentComposer.css';

function timeLeft(post){
  if(post.mode==='once')return post.viewed?'expired':'view once';
  const left=Math.max(0,1440-post.postedMinutesAgo);
  return left<=0?'expired':`${Math.floor(left/60)}h ${left%60}m left`;
}

const gradients=['linear-gradient(145deg,#2f3a40,#12161b)','linear-gradient(145deg,#493221,#17120e)','linear-gradient(145deg,#293f39,#111816)','linear-gradient(145deg,#3b293d,#17121a)'];

function MediaFrame({ item, index, post, onUserSelect, musicMuted = false, musicPlaying = false, onToggleMusic, distanceLabel = "", blurred = false, onReveal }) {
  const [failed, setFailed] = React.useState(false);
  const imageUrl = item?.imageUrl || getDumpItemMediaUrl(item?.imagePath);
  const openAuthor = () => onUserSelect?.({ id: post.authorId || post.author, username: post.authorName || post.author });
  const authorLabel = post.authorName || post.author || "unknown";
  const authorIdentity = onUserSelect
    ? <button type="button" className="tag" onClick={(event) => { event.stopPropagation(); openAuthor(); }} aria-label={`Open profile @${authorLabel}`}>@{authorLabel}</button>
    : <span className="tag">@{authorLabel}</span>;

  const musicOverlay = post.musicTrack ? (
    <>
      <div className="post-music-overlay" aria-label="Post music">
        {post.musicTrack.cover_url ? (
          <img src={post.musicTrack.cover_url} alt="" className="post-music-art" />
        ) : (
          <span className="post-music-art post-music-art-fallback"><Music2 size={15} /></span>
        )}
        <div className="post-music-copy">
          <strong>{post.musicTrack.title}</strong>
          <span>{post.musicTrack.artist}</span>
        </div>
        {musicPlaying && <span className="post-music-live" aria-label="Music playing" />}
      </div>
      <button
        type="button"
        className="post-music-toggle"
        onClick={(event) => { event.stopPropagation(); onToggleMusic?.(); }}
        aria-label={musicMuted ? "Unmute post music" : "Mute post music"}
        aria-pressed={musicMuted}
      >
        {musicMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </button>
    </>
  ) : null;



  if (imageUrl && !failed) {
    return (
      <div
        className="post-media"
        style={{ background: gradients[(post.id + index) % gradients.length], aspectRatio: "1/1", position: "relative", overflow: "hidden" }}
      >
        <img
          src={imageUrl}
          alt={item?.note || `Moment ${index + 1}`}
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: blurred ? "blur(22px)" : "none", transform: blurred ? "scale(1.08)" : "none" }}
        />
        {musicOverlay}
        {blurred && (
          <button
            type="button"
            className="view-once-reveal"
            onClick={(event) => { event.stopPropagation(); onReveal?.(); }}
            aria-label="View once photo"
          >
            <Eye size={20} />
            <strong>Tap to view once</strong>
            <span>You'll only get one look.</span>
          </button>
        )}
        <div style={{ position: "absolute", left: 12, right: 12, bottom: 12 }}>
          <span className="tag">{authorIdentity} · {post.mood}</span>
          {item?.note && <div className="media-text" style={{ marginTop: 10 }}>{item.note}</div>}
        </div>
      </div>
    );
  }

  return (
    <div
      className="post-media"
      style={{ background: gradients[(post.id + index) % gradients.length], aspectRatio: "1/1" }}
    >
      {musicOverlay}
      {blurred && (
        <button
          type="button"
          className="view-once-reveal"
          onClick={(event) => { event.stopPropagation(); onReveal?.(); }}
          aria-label="View once photo"
        >
          <Eye size={20} />
          <strong>Tap to view once</strong>
          <span>You'll only get one look.</span>
        </button>
      )}
      <div>
        {authorIdentity}
        <span className="tag"> · {post.mood}</span>
        <div className="media-text" style={{ marginTop: 12 }}>{item?.note || "a little piece of the day"}</div>
      </div>
    </div>
  );
}

export function DumpCard({post,onOpen}){
  const expired=timeLeft(post)==='expired';
  const viewOnceLocked=post.mode==='once'&&!post.viewed;
  const firstItem=post.items.find(item=>item?.imageUrl||item?.imagePath);
  const firstImage=firstItem?.imageUrl||getDumpItemMediaUrl(firstItem?.imagePath);
  return <button className="card post-card" onClick={()=>!expired&&onOpen(post)} style={{width:'100%',textAlign:'left',opacity:expired?.45:1}}>
    <div className="post-media" style={{background:gradients[post.id%gradients.length],position:'relative',overflow:'hidden'}}>
      {firstImage&&<img src={firstImage} alt="" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',opacity:viewOnceLocked?.5:.86,filter:viewOnceLocked?'blur(22px)':'none',transform:viewOnceLocked?'scale(1.08)':'none'}}/>}
      {viewOnceLocked&&<div className="view-once-feed-overlay"><Eye size={20}/><strong>View once</strong><span>Tap to open</span></div>}
      <div style={{position:'relative',zIndex:1}}><span className="tag">{post.mood}</span><div className="media-text" style={{marginTop:10}}>{post.items.length} moments</div></div>
      <span className="tag flicd-mono" style={{position:'relative',zIndex:1,marginLeft:'auto',alignSelf:'flex-start',color:post.mode==='once'?'var(--danger)':'var(--amber)'}}>{post.mode==='once'&&<Eye size={11} style={{marginRight:4}}/>}{timeLeft(post)}</span>
    </div>
    <div className="meta"><div><strong>@{post.authorName||post.author}</strong><div className="subtitle" style={{marginTop:3}}>{post.context||'shared a moment'}</div></div><div className="row muted"><span className="row"><Heart size={14} fill={post.liked?'var(--amber)':'none'} color={post.liked?'var(--amber)':'currentColor'}/>{post.likes}</span><span className="row"><MessageCircle size={14}/>{post.comments.length}</span></div></div>
  </button>;
}

export default function Home({dumps,activeSpace,onOpen,onUserSelect,onNotifications,notificationsUnread=0,loading=false,error='',onRetry}){
  const visible=dumps.filter(d=>d.channel===activeSpace.id);

  if(loading){
    return <div className="screen"><div className="stack">{[0,1,2].map(key=><div key={key} className="feed-skeleton card" data-testid="feed-skeleton" aria-hidden="true"/> )}</div></div>;
  }

  if(error){
    return <div className="screen"><div className="stack"><EmptyState title="Could not load your feed" text="Something went wrong while loading your moments." action={onRetry?<button className="btn" type="button" onClick={onRetry}>Try again</button>:null}/></div></div>;
  }

  return <div className="screen home-screen" style={{position:'relative'}}>
    <SeasonalOverlay/>
    <div className="topbar home-topbar">
      <div className="home-wordmark">Flic'd</div>
      <button type="button" className="btn icon-btn" onClick={onNotifications} aria-label="Notifications" style={{position:"relative"}}>
        <Bell size={19}/>
        {notificationsUnread>0&&<span className="nav-unread-badge">{notificationsUnread>9?"9+":notificationsUnread}</span>}
      </button>
    </div>
    <div className="stack">{visible.length===0?<EmptyState title="Nothing here yet" text="Follow people from this space or create a new dump."/>:visible.map(p=><DumpCard key={p.id} post={p} onOpen={onOpen}/>)}</div>
  </div>;
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

const REPORT_REASONS=[
  ['spam','Spam'],
  ['harassment','Harassment or bullying'],
  ['hate','Hate or abuse'],
  ['violence','Violence or threats'],
  ['sexual','Sexual content'],
  ['other','Other'],
];

export function Viewer({post,onClose,onLike,onComment,onKeep,onMarkViewed,likePending=false,currentUserId=null,onDeleteComment,onReportComment,onUserSelect}){
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
  const [reportingCommentId,setReportingCommentId]=React.useState(null);
  const [reporting,setReporting]=React.useState(false);
  const [reportedCommentIds,setReportedCommentIds]=React.useState(()=>new Set());
  const [musicMuted,setMusicMuted]=React.useState(false);
  const [musicPlaying,setMusicPlaying]=React.useState(false);
  const [viewerLocation,setViewerLocation]=React.useState(null);
  const [revealedOnce,setRevealedOnce]=React.useState(post.mode !== "once" || Boolean(post.viewed));
  const [reportError,setReportError]=React.useState('');
  const [reportMessage,setReportMessage]=React.useState('');
  const [gifPickerOpen,setGifPickerOpen]=React.useState(false);
  const [videoPickerOpen,setVideoPickerOpen]=React.useState(false);
  const recorderRef=React.useRef(null);
  const unsubscribeRef=React.useRef(null);

  React.useEffect(() => {
    setRevealedOnce(post.mode !== "once" || Boolean(post.viewed));
  }, [post.id, post.mode, post.viewed]);

  React.useEffect(() => {
    const track = post.musicTrack;
    setMusicMuted(false);
    setMusicPlaying(false);

    if (!track?.audio_url) {
      stopAudio();
      return undefined;
    }

    let active = true;
    const audio = playAudioUrl(track.audio_url, {
      loop: true,
      muted: false,
      onFallbackToMuted: () => {
        if (active) setMusicMuted(true);
      },
    });

    if (!audio) return () => { active = false; };

    const handlePlay = () => active && setMusicPlaying(true);
    const handlePause = () => active && setMusicPlaying(false);
    audio.addEventListener?.("play", handlePlay);
    audio.addEventListener?.("pause", handlePause);

    return () => {
      active = false;
      audio.removeEventListener?.("play", handlePlay);
      audio.removeEventListener?.("pause", handlePause);
      stopAudio();
    };
  }, [post.id, post.musicTrack?.audio_url]);

  React.useEffect(() => {
    const location = post.location;
    if (!location || !Number.isFinite(Number(location.latitude)) || !Number.isFinite(Number(location.longitude))) {
      setViewerLocation(null);
      return undefined;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setViewerLocation(null);
      return undefined;
    }

    let active = true;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (active) {
          setViewerLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        }
      },
      () => {
        if (active) setViewerLocation(null);
      },
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 8000 },
    );

    return () => { active = false; };
  }, [post.location?.latitude, post.location?.longitude]);

  const toggleMusic = () => {
    const audio = getActiveAudio();
    if (!audio || !post.musicTrack?.audio_url) return;

    if (audio.muted) {
      audio.muted = false;
      setAudioMuted(false);
      audio.play().then(() => {
        setMusicMuted(false);
        setMusicPlaying(true);
      }).catch(() => {
        setAudioMuted(true);
        setMusicMuted(true);
      });
      return;
    }

    setAudioMuted(true);
    setMusicMuted(true);
  };

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

  const handleReportComment=async(reason)=>{
    if(!reportingCommentId||reporting)return;
    const handler=onReportComment||reportComment;
    setReporting(true);
    setReportError('');
    try{
      const result=await handler(reportingCommentId,reason);
      if(result!==false){
        setReportedCommentIds((current)=>{
          const next=new Set(current);
          next.add(reportingCommentId);
          return next;
        });
        setReportingCommentId(null);
        setReportMessage('Comment reported.');
      }
    }catch(error){
      setReportError(error.message||'Could not report this comment.');
    }finally{
      setReporting(false);
    }
  };

  const visibleComments=(post.comments||[]).filter((comment)=>!deletedCommentIds.has(comment.id));
  const pendingType=pendingComment?.media_type;
  const openCommentAuthor=(comment)=>onUserSelect?.({id:comment.user_id,username:comment.from});

  const canKeep = post.mode !== "once" && post.allowOthersToKeep !== false;
  return <div className="screen viewer-screen">
    <div className="topbar">
      <button className="btn icon-btn" onClick={onClose} aria-label="Close">×</button>
      <span className="tag flicd-mono">{timeLeft(post)}</span>
    </div>
    <div className="card">
      <MediaFrame
        item={post.items[index]}
        index={index}
        post={post}
        onUserSelect={onUserSelect}
        musicMuted={musicMuted}
        musicPlaying={musicPlaying}
        onToggleMusic={toggleMusic}
        blurred={post.mode === "once" && !revealedOnce}
        onReveal={() => {
          if (post.mode !== "once" || revealedOnce) return;
          setRevealedOnce(true);
          onMarkViewed?.(post.id);
        }}
        distanceLabel={
          viewerLocation && post.location
            ? formatDistanceKm(distanceKm(
                viewerLocation.latitude,
                viewerLocation.longitude,
                post.location.latitude,
                post.location.longitude,
              ))
            : ""
        }
      />
      {post.items.length>1&&<div className="row" style={{justifyContent:'space-between',marginTop:10}}><button className="btn" disabled={index===0} onClick={()=>setIndex(i=>i-1)}><ChevronRight size={16} style={{transform:'rotate(180deg)'}}/></button><span className="flicd-mono muted">{index+1}/{post.items.length}</span><button className="btn" disabled={index===post.items.length-1} onClick={()=>setIndex(i=>i+1)}><ChevronRight size={16}/></button></div>}
      <div className="post-actions">
        <button className="btn" type="button" disabled={likePending} aria-label={post.liked?'Unlike':'Like'} onClick={()=>onLike(post.id)}><Heart size={16} fill={post.liked?'var(--amber)':'none'} color={post.liked?'var(--amber)':'currentColor'}/>{post.likes}</button>
        <button className="btn" type="button" disabled={!canKeep} onClick={()=>canKeep&&onKeep(post,index)} aria-label={canKeep ? "Keep" : "Keep unavailable"}><Bookmark size={16}/>{canKeep ? "Keep" : "Keep unavailable"}</button>
      </div>
      {(post.location || post.taggedUsers?.length) && (
        <div className="post-metadata-row">
          {post.location && <div className="post-location-chip"><MapPin size={13} />{post.location.name}{viewerLocation && <span>· {formatDistanceKm(distanceKm(viewerLocation.latitude, viewerLocation.longitude, post.location.latitude, post.location.longitude))}</span>}</div>}
          {post.taggedUsers?.length > 0 && (
            <div className="post-tagged-users">
              {post.taggedUsers.map((user) => (
                onUserSelect
                  ? <button key={user.id} type="button" className="tag" onClick={() => onUserSelect(user)}>@{user.username}</button>
                  : <span key={user.id} className="tag">@{user.username}</span>
              ))}
            </div>
          )}
        </div>
      )}
      <section className="post-conversation" aria-label="Conversation">
        <div className="stack">
          {visibleComments.length?visibleComments.map(c=><div key={c.id} className="comment-row">
            {(c.media_type==='audio'||c.media_type==='video'||c.media_type==='gif')?<SavedCommentMedia comment={c}/>:<p className="subtitle">{onUserSelect?<button type="button" className="comment-author-link" onClick={()=>openCommentAuthor(c)} aria-label={`Open profile @${c.from}`}>@{c.from}</button>:<strong style={{color:'var(--text)'}}>@{c.from}</strong>} {c.text}</p>}
            {resolvedCurrentUserId&&c.user_id===resolvedCurrentUserId&&<button className="btn comment-delete-btn" type="button" aria-label="Delete comment" disabled={deletingCommentId===c.id} onClick={()=>handleDeleteComment(c.id)}>{deletingCommentId===c.id?'Deleting…':'Delete'}</button>}
            {resolvedCurrentUserId&&c.user_id&&c.user_id!==resolvedCurrentUserId&&!reportedCommentIds.has(c.id)&&<button className="btn comment-report-btn" type="button" aria-label="Report comment" disabled={reporting} onClick={()=>{setReportMessage('');setReportError('');setReportingCommentId(c.id);}}>Report</button>}
            {resolvedCurrentUserId&&reportedCommentIds.has(c.id)&&<span className="tag" aria-label="Comment reported">Reported</span>}
          </div>):<p className="subtitle">No comments yet.</p>}
          {reportMessage&&<p className="subtitle" role="status">{reportMessage}</p>}
        </div>
        {reportingCommentId&&<div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Report comment" onMouseDown={(event)=>{if(event.target===event.currentTarget&&!reporting)setReportingCommentId(null);}}>
          <div className="modal" style={{width:'100%',maxWidth:520}}>
            <div className="row" style={{justifyContent:'space-between',alignItems:'flex-start'}}>
              <div>
                <div className="eyebrow">Report comment</div>
                <h2 style={{marginTop:4}}>Report this comment</h2>
                <p className="subtitle" style={{marginTop:5}}>Choose the reason that best describes the problem.</p>
              </div>
              <button type="button" className="btn icon-btn" aria-label="Close report" disabled={reporting} onClick={()=>setReportingCommentId(null)}>×</button>
            </div>
            <div className="stack" style={{marginTop:16}}>
              {REPORT_REASONS.map(([value,label])=><button key={value} type="button" className="card" disabled={reporting} onClick={()=>handleReportComment(value)} style={{width:'100%',textAlign:'left',cursor:reporting?'wait':'pointer',opacity:reporting?0.65:1}}>{label}</button>)}
            </div>
            {reportError&&<p className="subtitle" role="status" style={{marginTop:10,color:'var(--danger, #ff6b6b)'}}>{reportError}</p>}
            <div className="row" style={{justifyContent:'flex-end',marginTop:16}}><button type="button" className="btn" disabled={reporting} onClick={()=>setReportingCommentId(null)}>Cancel</button></div>
          </div>
        </div>}
        {voiceReviewBlob?<div className="comment-composer row" aria-label="Voice comment review"><audio aria-label="Voice comment preview" controls src={voiceReviewUrl||undefined}/><button className="btn" type="button" aria-label="Cancel voice comment" onClick={cancelVoice}>Cancel</button><button className="btn btn-primary" type="button" aria-label="Send voice comment" onClick={sendVoice}>Send</button></div>:<>
          {pendingComment&&<div className="comment-pending" aria-label={pendingType==='gif'?'Pending GIF attachment':pendingType==='video'?'Pending video attachment':''}>{pendingType==='gif'&&<img src={pendingComment.media_url} alt={pendingComment.media_metadata?.title||'GIF attachment'}/>} {pendingType==='video'&&<div className="comment-pending__video-wrap">{pendingVideoUrl?<video aria-label="Pending video preview" controls src={pendingVideoUrl}/>:<span className="subtitle">Preparing video preview…</span>}{Number.isFinite(Number(pendingComment.media_metadata?.duration_seconds))&&<span className="tag flicd-mono comment-pending__duration">{Math.round(Number(pendingComment.media_metadata.duration_seconds))}s</span>}</div>}<button className="btn icon-btn" type="button" aria-label="Remove attachment" onClick={removeAttachment}>×</button></div>}
          <div className="comment-composer row"><input className="input" value={text} onChange={e=>setText(e.target.value)} placeholder="Add a comment" disabled={Boolean(pendingComment)||commentSending}/><button className="btn" type="button" aria-label="Choose GIF" onClick={()=>openAttachmentPicker('gif')} disabled={commentSending}>GIF</button><button className="btn icon-btn" type="button" aria-label="Choose video" onClick={()=>openAttachmentPicker('video')} disabled={commentSending}><Video size={16}/></button><button className="btn icon-btn" type="button" aria-label={recording?'Stop voice recording':'Record voice comment'} onClick={handleVoice} disabled={commentSending}><Mic size={16}/></button><button className="btn btn-primary" aria-label="Send comment" disabled={(!text.trim()&&!pendingComment)||commentSending} onClick={sendComment}>{commentSending?'Sending…':'Send'}</button></div>
        </>}
        {gifPickerOpen&&<GifPicker onSelect={handleGifSelect} onClose={()=>setGifPickerOpen(false)}/>} {videoPickerOpen&&<VideoCommentPicker onSelect={handleVideoSelect} onClose={()=>setVideoPickerOpen(false)}/>} 
      </section>
    </div>
  </div>;
}
