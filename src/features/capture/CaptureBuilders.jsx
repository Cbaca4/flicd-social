import React from 'react';
import Pill from '../../components/shared/Pill.jsx';
import { ROLL_STAGES, getNextRollStage } from './rollPresentation.js';
import { MAX_MEDIA_COUNT, validateMediaFile, validateMediaFiles } from './mediaUpload.js';
import MusicPicker from '../music/MusicPicker.jsx';
import PostMetadataPicker from './PostMetadataPicker.jsx';

const MEDIA_ACCEPT = 'image/jpeg,image/png,image/webp';
const DUMP_MOODS = ['golden hour', 'late night', 'chaotic', 'nostalgic', 'summer'];

function FileSummary({ files }) {
  if (!files.length) return <p className="subtitle" style={{ marginTop: 10 }}>Choose the moments you want to share. JPEG, PNG, or WebP · 10 MB max each.</p>;
  return <div className="stack" style={{ marginTop: 12 }}><p className="subtitle">{files.length} {files.length === 1 ? 'photo' : 'photos'} selected</p><div className="stack" style={{ gap: 6 }}>{files.map((file, index) => <div key={`${file.name}-${file.size}-${file.lastModified}-${index}`} className="row" style={{ justifyContent: 'space-between' }}><span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span><span className="flicd-mono" style={{ flexShrink: 0, marginLeft: 10 }}>{Math.max(1, Math.round(file.size / 1024))} KB</span></div>)}</div></div>;
}

export function DumpBuilder({ activeSpaceId, onCancel, onPost }) {
  const [files, setFiles] = React.useState([]);
  const [mood, setMood] = React.useState('golden hour');
  const [expiry, setExpiry] = React.useState('24h');
  const [note, setNote] = React.useState('');
  const [error, setError] = React.useState('');
  const [posting, setPosting] = React.useState(false);
  const [musicTrack, setMusicTrack] = React.useState(null);
  const [location, setLocation] = React.useState(null);
  const [taggedUsers, setTaggedUsers] = React.useState([]);
  const cameraInputRef = React.useRef(null);

  const addFiles = (incomingFiles) => {
    try {
      const nextFiles = validateMediaFiles([...files, ...Array.from(incomingFiles || [])]);
      setFiles(nextFiles);
      setError('');
    } catch (fileError) {
      setError(fileError.message || 'Could not select those images.');
    }
  };

  const onGalleryChange = (event) => {
    addFiles(event.target.files);
    event.target.value = '';
  };

  const onCameraChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      validateMediaFile(file);
      addFiles([file]);
    } catch (fileError) {
      setError(fileError.message || 'Could not capture that photo.');
    }
  };

  const post = async () => {
    if (!files.length || posting) return;
    try {
      setPosting(true);
      setError('');
      await onPost({ mood, expiry, channel: activeSpaceId, musicTrack, location, taggedUsers, items: files.map((file, index) => ({ note: index === 0 ? note : '', imageFile: file })) });
    } catch (postError) {
      setError(postError.message || 'Could not post dump.');
      setPosting(false);
    }
  };

  return <div className="screen"><div className="topbar"><div><div className="eyebrow">New dump</div><h1 className="title">A handful of moments</h1></div><button className="btn" onClick={onCancel} disabled={posting}>Cancel</button></div><div className="stack"><div className="card"><p className="eyebrow">Photos</p><div className="row" style={{ marginTop: 10, flexWrap: 'wrap' }}><button type="button" className="btn btn-cyan" onClick={() => cameraInputRef.current?.click()} disabled={posting || files.length >= MAX_MEDIA_COUNT}>Take photo</button><label className="btn" style={{ display: 'inline-flex', cursor: posting || files.length >= MAX_MEDIA_COUNT ? 'not-allowed' : 'pointer', opacity: posting || files.length >= MAX_MEDIA_COUNT ? 0.6 : 1 }}>Choose photos<input type="file" accept={MEDIA_ACCEPT} multiple onChange={onGalleryChange} disabled={posting || files.length >= MAX_MEDIA_COUNT} style={{ display: 'none' }} /></label></div><input ref={cameraInputRef} type="file" accept={MEDIA_ACCEPT} capture="environment" onChange={onCameraChange} disabled={posting || files.length >= MAX_MEDIA_COUNT} style={{ display: 'none' }} /><FileSummary files={files} />{error && <p role="alert" className="subtitle" style={{ marginTop: 10 }}>{error}</p>}<p className="subtitle" style={{ marginTop: 10 }}>Up to {MAX_MEDIA_COUNT} photos. Mix camera shots and gallery photos in the same dump. Your first note becomes the dump context.</p></div><div className="card"><p className="eyebrow">Mood</p><div className="wrap" style={{ marginTop: 10 }}>{DUMP_MOODS.map(m => <Pill key={m} active={mood === m} onClick={() => setMood(m)}>{m}</Pill>)}</div></div><div className="card"><p className="eyebrow">Context card</p><input className="input" style={{ marginTop: 10 }} value={note} onChange={e => setNote(e.target.value)} placeholder="A memory, song, location…" maxLength={240} /></div><MusicPicker value={musicTrack} onChange={setMusicTrack} onClear={() => setMusicTrack(null)} disabled={posting} /><PostMetadataPicker location={location} onLocationChange={setLocation} taggedUsers={taggedUsers} onTaggedUsersChange={setTaggedUsers} disabled={posting} /><div className="card"><p className="eyebrow">Expires</p><div className="wrap" style={{ marginTop: 10 }}><Pill active={expiry === '24h'} onClick={() => setExpiry('24h')}>24 hours</Pill><Pill active={expiry === 'once'} onClick={() => setExpiry('once')}>View once</Pill></div></div><button className="btn btn-primary" disabled={!files.length || posting} onClick={post}>{posting ? 'Uploading…' : 'Post dump'}</button></div></div>;
}

function RollDeveloping({ frameCount, onComplete }) {
  const [stage, setStage] = React.useState('loading');
  React.useEffect(() => { const delays = { loading: 500, winding: 900, developing: 1700, revealing: 1100 }; const timer = setTimeout(() => { const next = getNextRollStage(stage); setStage(next); if (next === 'finished') onComplete?.(); }, delays[stage] || 800); return () => clearTimeout(timer); }, [stage, onComplete]);
  const labels = { loading: 'Preparing the camera…', winding: 'Winding the film…', developing: 'Developing your roll…', revealing: 'Revealing the memories…', finished: 'Roll developed' };
  const progress = Math.round(((ROLL_STAGES.indexOf(stage) + 1) / ROLL_STAGES.length) * 100);
  return <div className="roll-developing" role="status" aria-live="polite"><div className="roll-camera"><div className="roll-lens"><span /></div><div className="roll-flash" /></div><div className="eyebrow">Disposable roll</div><h2 style={{ marginTop: 5 }}>{labels[stage]}</h2><p className="subtitle" style={{ marginTop: 6 }}>{frameCount} frames · keep the moment imperfect.</p><div className="roll-film" aria-hidden="true"><div className="roll-film-track" style={{ transform: `translateX(-${Math.min(ROLL_STAGES.indexOf(stage), ROLL_STAGES.length - 1) * 18}%)` }}>{Array.from({ length: 7 }, (_, i) => <span key={i} className={i < ROLL_STAGES.indexOf(stage) + 1 ? 'developed' : ''}>{i < frameCount ? i + 1 : '•'}</span>)}</div></div><div className="roll-progress"><span style={{ width: `${progress}%` }} /></div>{stage === 'finished' && <div className="tag" style={{ marginTop: 12 }}>Ready to post</div>}</div>;
}

export function RollBuilder({ activeSpaceId, onCancel, onPost }) {
  const [frames, setFrames] = React.useState(8);
  const [shot, setShot] = React.useState(0);
  const [capturedFiles, setCapturedFiles] = React.useState([]);
  const [expiry, setExpiry] = React.useState('once');
  const [developing, setDeveloping] = React.useState(false);
  const [developed, setDeveloped] = React.useState(false);
  const [error, setError] = React.useState('');
  const [posting, setPosting] = React.useState(false);
  const [musicTrack, setMusicTrack] = React.useState(null);
  const [location, setLocation] = React.useState(null);
  const [taggedUsers, setTaggedUsers] = React.useState([]);
  const captureInputRef = React.useRef(null);

  const handleCaptureClick = () => { setError(''); captureInputRef.current?.click(); };
  const handleCapture = (event) => { const file = event.target.files?.[0]; event.target.value = ''; try { validateMediaFile(file); setCapturedFiles(current => [...current, file]); setShot(current => Math.min(frames, current + 1)); setError(''); } catch (captureError) { setError(captureError.message || 'Could not capture that frame.'); } };
  const post = async () => { if (capturedFiles.length !== frames || posting) return; try { setPosting(true); setError(''); await onPost({ mood: 'roll', expiry, channel: activeSpaceId, frameCount: frames, musicTrack, location, taggedUsers, items: capturedFiles.map(file => ({ note: '', imageFile: file })) }); } catch (postError) { setError(postError.message || 'Could not post roll.'); setPosting(false); } };
  if (developing) return <div className="screen"><RollDeveloping frameCount={frames} onComplete={() => setDeveloped(true)} /><div className="row" style={{ justifyContent: 'center', marginTop: 16 }}><button className="btn" onClick={onCancel} disabled={posting}>Cancel</button><button className="btn btn-primary" disabled={!developed || posting} onClick={post}>{posting ? 'Uploading…' : developed ? 'Post roll' : 'Developing…'}</button></div>{error && <p role="alert" className="subtitle" style={{ textAlign: 'center', marginTop: 10 }}>{error}</p>}</div>;
  return <div className="screen"><div className="topbar"><div><div className="eyebrow">New roll</div><h1 className="title">Disposable camera energy</h1></div><button className="btn" onClick={onCancel}>Cancel</button></div>{shot === 0 ? <div className="stack"><div className="card"><p className="subtitle">Pick how many frames you want. Each frame is captured from an image file and cannot be deleted or reordered once captured.</p><div className="wrap" style={{ marginTop: 14 }}>{[8, 12, 24].map(n => <Pill key={n} active={frames === n} onClick={() => setFrames(n)}>{n} frames</Pill>)}</div></div><button className="btn btn-primary" onClick={() => { setCapturedFiles([]); setShot(1); }}>Start roll</button></div> : <div className="stack"><input ref={captureInputRef} type="file" accept={MEDIA_ACCEPT} capture="environment" onChange={handleCapture} style={{ display: 'none' }} /><div className="row" style={{ justifyContent: 'space-between' }}><span className="eyebrow">Frames</span><span className="flicd-mono">{capturedFiles.length}/{frames}</span></div><div className="grid grid-3">{Array.from({ length: frames }).map((_, i) => <div key={i} className="board-cover" style={{ opacity: i < capturedFiles.length ? .95 : .28 }}><span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 8, textAlign: 'center' }}>{i < capturedFiles.length ? capturedFiles[i].name : i + 1}</span></div>)}</div>{capturedFiles.length < frames ? <button className="btn btn-cyan" onClick={handleCaptureClick}>Capture frame {capturedFiles.length + 1}</button> : <button className="btn btn-cyan" onClick={() => setDeveloping(true)}>Develop roll</button>}{error && <p role="alert" className="subtitle">{error}</p>}{capturedFiles.length === frames && <><MusicPicker value={musicTrack} onChange={setMusicTrack} onClear={() => setMusicTrack(null)} disabled={posting} /><PostMetadataPicker location={location} onLocationChange={setLocation} taggedUsers={taggedUsers} onTaggedUsersChange={setTaggedUsers} disabled={posting} /><div className="card"><p className="eyebrow">Expires</p><div className="wrap" style={{ marginTop: 8 }}><Pill active={expiry === '24h'} onClick={() => setExpiry('24h')}>24 hours</Pill><Pill active={expiry === 'once'} onClick={() => setExpiry('once')}>View once</Pill></div></div></>}</div>}</div>;
}
