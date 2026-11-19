import React from "react";
import { createPortal } from "react-dom";
import { useAccountScope } from "../../app/AuthScopeContext.js";
import { AudioLines, ExternalLink, Music2, Pause, Play, Search, X } from "lucide-react";
import { getMusicTracks, setProfileMusicTrack } from "./musicApi.js";
import { getActiveAudio, pauseAudio, playAudioUrl, resumeAudio, stopAudio } from "./audioController.js";

function formatMusicTime(seconds) {
  const safe = Number.isFinite(Number(seconds)) ? Math.max(0, Math.floor(Number(seconds))) : 0;
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

function readTrackDuration(track) {
  if (typeof track?.duration === "number") return Math.max(0, track.duration);
  const raw = String(track?.duration || "");
  if (/^\d+:\d{1,2}$/.test(raw)) {
    const [minutes, seconds] = raw.split(":").map(Number);
    return minutes * 60 + seconds;
  }
  return Math.max(0, Number(raw) || 0);
}

export default function OnRepeat({
  track: initialTrack = null,
  onTrackChange,
  editable = true,
  playing: controlledPlaying,
  onTogglePlay,
  className = "card",
  style,
  cinematic = false,
  authScope,
}) {
  const account = useAccountScope(authScope);
  const [track, setTrack] = React.useState(initialTrack);
  const [tracks, setTracks] = React.useState([]);
  const [query, setQuery] = React.useState("");
  const [localPlaying, setLocalPlaying] = React.useState(false);
  const [playback, setPlayback] = React.useState({ current: 0, duration: 0 });
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [searchError, setSearchError] = React.useState("");
  const [saveError, setSaveError] = React.useState("");
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const changeButtonRef = React.useRef(null);
  const searchInputRef = React.useRef(null);
  const searchRequestRef = React.useRef(0);
  const controlled = typeof onTogglePlay === "function";
  const playing = controlled ? Boolean(controlledPlaying) : localPlaying;

  React.useEffect(() => setTrack(initialTrack || null), [initialTrack]);

  React.useEffect(() => {
    if (controlled) return undefined;
    const current = track?.audio_url;
    if (!current) {
      stopAudio();
      setLocalPlaying(false);
      return undefined;
    }

    const existing = getActiveAudio();
    if (!existing || existing.src !== current) {
      playAudioUrl(current, { loop: true, muted: false });
    }

    const audio = getActiveAudio();
    const sync = () => setLocalPlaying(Boolean(audio && !audio.paused));
    audio?.addEventListener?.("play", sync);
    audio?.addEventListener?.("pause", sync);
    sync();

    return () => {
      audio?.removeEventListener?.("play", sync);
      audio?.removeEventListener?.("pause", sync);
    };
  }, [controlled, track?.audio_url]);

  React.useEffect(() => {
    if (!cinematic || !track) return undefined;
    const audio = getActiveAudio();
    const sync = () => {
      const duration = Number.isFinite(audio?.duration) ? audio.duration : readTrackDuration(track);
      const current = Number.isFinite(audio?.currentTime) ? audio.currentTime : 0;
      setPlayback({ current, duration });
    };
    sync();
    audio?.addEventListener?.("timeupdate", sync);
    audio?.addEventListener?.("loadedmetadata", sync);
    audio?.addEventListener?.("durationchange", sync);
    audio?.addEventListener?.("seeked", sync);
    return () => {
      audio?.removeEventListener?.("timeupdate", sync);
      audio?.removeEventListener?.("loadedmetadata", sync);
      audio?.removeEventListener?.("durationchange", sync);
      audio?.removeEventListener?.("seeked", sync);
    };
  }, [cinematic, track, playing]);

  const persistTrack = async (nextTrack) => {
    let scope;
    try {
      scope = account.capture();
      setSaveError("");
      await setProfileMusicTrack(nextTrack?.id || null, scope);
      if (!scope.isCurrent()) return;
      if (!controlled) stopAudio();
      setLocalPlaying(false);
      setTrack(nextTrack);
      onTrackChange?.(nextTrack);
      setQuery("");
      setPickerOpen(false);
    } catch (error) {
      if (scope?.isCurrent()) setSaveError(error.message || "Could not update profile music.");
    }
  };
  const selectTrack = (nextTrack) => persistTrack(nextTrack);
  const removeTrack = () => persistTrack(null);

  const togglePlay = async () => {
    if (controlled) {
      await onTogglePlay?.();
      return;
    }

    if (!track?.audio_url) {
      if (track?.provider_track_id) window.open(track.provider_track_id, "_blank", "noopener,noreferrer");
      return;
    }

    const audio = getActiveAudio();
    if (playing && audio?.src === track.audio_url) {
      pauseAudio();
      setLocalPlaying(false);
      return;
    }

    if (audio?.src === track.audio_url) {
      const resumed = await resumeAudio();
      setLocalPlaying(Boolean(resumed && !resumed.paused));
      return;
    }

    const next = playAudioUrl(track.audio_url, { loop: true, muted: false });
    setLocalPlaying(Boolean(next));
  };

  React.useEffect(() => {
    if (!editable || !pickerOpen) {
      searchRequestRef.current += 1;
      setSearchLoading(false);
      return undefined;
    }

    const requestId = ++searchRequestRef.current;
    setSearchLoading(true);
    setSearchError("");

    const timer = setTimeout(async () => {
      try {
        const data = await getMusicTracks({ search: query, limit: 100 });
        if (requestId !== searchRequestRef.current) return;
        setTracks(data);
      } catch (error) {
        if (requestId !== searchRequestRef.current) return;
        setTracks([]);
        setSearchError(error.message || "Could not search music.");
      } finally {
        if (requestId === searchRequestRef.current) setSearchLoading(false);
      }
    }, 220);

    return () => { clearTimeout(timer); searchRequestRef.current += 1; };
  }, [editable, pickerOpen, query]);

  const closePicker = React.useCallback(() => {
    setPickerOpen(false);
    setQuery("");
    setSearchError("");
    setSaveError("");
    changeButtonRef.current?.focus();
  }, []);

  React.useEffect(() => {
    if (!pickerOpen) return undefined;
    searchInputRef.current?.focus();
    const onKey = (event) => { if (event.key === "Escape") closePicker(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pickerOpen, closePicker]);

  return (
    <div className={`${className}${cinematic ? " cinematic-on-repeat" : ""}`} style={style}>
      <h2 className="profile-space-panel-title">{cinematic && <AudioLines size={17} aria-hidden="true" />} On Repeat</h2>
      {saveError && <p role="alert">{saveError}</p>}

      {track ? (
        <div className="row" style={{ marginTop: 10, alignItems: "center" }}>
          <div className="avatar lg cinematic-track-art" aria-hidden="true">{cinematic && track.cover_url ? <img src={track.cover_url} alt="" /> : cinematic ? <Music2 size={24} /> : track.artist?.[0]?.toUpperCase() || "♪"}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong>{track.title}</strong>
            <p className="subtitle">{track.artist}</p>
          </div>
          <button type="button" className="btn icon-btn" onClick={togglePlay}
            aria-label={playing ? "Pause music" : "Play music"}>
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
        </div>
      ) : (
        <p className="subtitle on-repeat-no-track">No song selected. Give your profile a soundtrack.</p>
      )}

      {cinematic && track && (
        <div className="cinematic-music-progress">
          <span>{formatMusicTime(playback.current)}</span>
          <input type="range" min="0" max={Math.max(1, playback.duration)} step="1" value={Math.min(playback.current, Math.max(1, playback.duration))}
            aria-label="Music position" style={{ "--music-progress": `${Math.min(100, 100 * playback.current / Math.max(1, playback.duration))}%` }}
            onChange={(event) => { const audio = getActiveAudio(); if (audio && Number.isFinite(audio.duration)) { audio.currentTime = Number(event.target.value); setPlayback({ current: audio.currentTime, duration: audio.duration }); } }} />
          <span>{formatMusicTime(playback.duration)}</span>
        </div>
      )}

      {editable && (
        <button type="button" ref={changeButtonRef} className="on-repeat-change-song"
          aria-haspopup="dialog" aria-expanded={pickerOpen}
          onClick={() => { setSaveError(""); setPickerOpen(true); }}>
          <Music2 size={14} aria-hidden="true" /> {track ? "Change Song" : "Choose Song"}
        </button>
      )}
      {editable && pickerOpen && createPortal(
        <div className="on-repeat-picker-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closePicker();
        }}>
          <section className="on-repeat-picker-sheet" role="dialog" aria-modal="true" aria-label="Select profile music">
            <div className="on-repeat-picker-heading">
              <div><strong>Choose your On Repeat</strong><p>One song, your sound.</p></div>
              <button type="button" className="on-repeat-picker-close" onClick={closePicker} aria-label="Close music picker"><X size={20} /></button>
            </div>
            <div className="on-repeat-picker-search">
              <Search size={17} aria-hidden="true" />
              <input ref={searchInputRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)}
                placeholder="Search artist or song…" aria-label="Search profile music" />
            </div>
            {saveError && <p role="alert" className="on-repeat-picker-error">{saveError}</p>}
            <div className="on-repeat-picker-results" role="listbox" aria-label="Profile music tracks">
              {searchLoading && <p role="status" className="on-repeat-picker-status">Searching music…</p>}
              {searchError && <p role="alert" className="on-repeat-picker-status">{searchError}</p>}
              {!searchLoading && !searchError && tracks.length === 0 && <p className="on-repeat-picker-status">No verified tracks found.</p>}
              {!searchLoading && !searchError && tracks.map((candidate) => (
                <button key={candidate.id} type="button" role="option" aria-selected={track?.id === candidate.id}
                  className="on-repeat-picker-option" onClick={() => selectTrack(candidate)}>
                  <span className="on-repeat-picker-option-art"><Music2 size={18} /></span>
                  <span className="on-repeat-picker-option-name"><strong>{candidate.title}</strong><small>{candidate.artist}</small></span>
                  {!candidate.audio_url && <ExternalLink size={14} aria-hidden="true" />}
                </button>
              ))}
            </div>
            {track && (
              <button type="button" className="on-repeat-remove-track" onClick={removeTrack}>
                Remove current song
              </button>
            )}
          </section>
        </div>,
        document.querySelector(".flicd-app") || document.body,
      )}
    </div>
  );
}
