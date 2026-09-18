import React from "react";
import { ExternalLink, Pause, Play, X } from "lucide-react";
import { getMusicTracks, setProfileMusicTrack } from "./musicApi.js";
import { playAudioUrl, stopAudio } from "./audioController.js";

export default function OnRepeat({ track: initialTrack = null, onTrackChange, editable = true }) {
  const [track, setTrack] = React.useState(initialTrack);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [tracks, setTracks] = React.useState([]);
  const [query, setQuery] = React.useState("");
  const [playing, setPlaying] = React.useState(false);

  React.useEffect(() => setTrack(initialTrack || null), [initialTrack]);
  React.useEffect(() => () => stopAudio(), []);

  const selectTrack = async (nextTrack) => {
    await setProfileMusicTrack(nextTrack.id);
    stopAudio();
    setPlaying(false);
    setTrack(nextTrack);
    onTrackChange?.(nextTrack);
    setPickerOpen(false);
  };

  const removeTrack = async () => {
    await setProfileMusicTrack(null);
    stopAudio();
    setPlaying(false);
    setTrack(null);
    onTrackChange?.(null);
  };

  const togglePlay = () => {
    if (!track?.audio_url) {
      if (track?.provider_track_id) window.open(track.provider_track_id, "_blank", "noopener,noreferrer");
      return;
    }
    if (playing) {
      stopAudio();
      setPlaying(false);
      return;
    }
    playAudioUrl(track.audio_url);
    setPlaying(true);
  };

  React.useEffect(() => {
    if (!pickerOpen) return;
    let active = true;
    getMusicTracks({ search: query, limit: 30 })
      .then((data) => { if (active) setTracks(data); })
      .catch(() => { if (active) setTracks([]); });
    return () => { active = false; };
  }, [pickerOpen, query]);

  return (
    <div className="card">
      <div className="eyebrow">On repeat</div>
      {track ? (
        <div className="row" style={{ marginTop: 10, alignItems: "center" }}>
          <div className="avatar lg" aria-hidden="true">{track.artist?.[0]?.toUpperCase() || "♪"}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong>{track.title}</strong>
            <p className="subtitle">{track.artist}</p>
          </div>
          <button type="button" className="btn icon-btn" onClick={togglePlay} aria-label={playing ? "Pause music" : "Play music"}>
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          {editable && <button type="button" className="btn icon-btn" onClick={removeTrack} aria-label="Remove profile music"><X size={16} /></button>}
        </div>
      ) : (
        <p className="subtitle" style={{ marginTop: 5 }}>Choose one song to represent this profile.</p>
      )}

      {editable && <button type="button" className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setPickerOpen((current) => !current)}>
        {pickerOpen ? "Close" : track ? "Change song" : "Choose song"}
      </button>}

      {pickerOpen && (
        {editable && <div className="stack" style={{ marginTop: 12 }}>
          <input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the verified catalog…" aria-label="Search profile music" />
          {tracks.map((candidate) => (
            <button key={candidate.id} type="button" className="card" style={{ textAlign: "left", width: "100%" }} onClick={() => selectTrack(candidate)}>
              <div className="row">
                <div style={{ flex: 1 }}><strong>{candidate.title}</strong><p className="subtitle">{candidate.artist}</p></div>
                {!candidate.audio_url && <ExternalLink size={15} className="muted" aria-hidden="true" />}
              </div>
            </button>
          ))}
        </div>}
      )}
    </div>
  );
}
