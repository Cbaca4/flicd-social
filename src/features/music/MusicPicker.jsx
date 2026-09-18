import React from "react";
import { ExternalLink, Pause, Play, Search, X } from "lucide-react";
import { getMusicTracks } from "./musicApi.js";
import { playAudioUrl, stopAudio } from "./audioController.js";

export default function MusicPicker({ value = null, onChange, onClear, disabled = false }) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [tracks, setTracks] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [previewId, setPreviewId] = React.useState(null);
  const searchRequestRef = React.useRef(0);

  React.useEffect(() => {
    if (!open) {
      searchRequestRef.current += 1;
      setLoading(false);
      return undefined;
    }

    const requestId = ++searchRequestRef.current;
    setLoading(true);
    setError("");

    const timer = setTimeout(async () => {
      try {
        const results = await getMusicTracks({ search: query, limit: 40 });
        if (requestId !== searchRequestRef.current) return;
        setTracks(results);
      } catch (loadError) {
        if (requestId !== searchRequestRef.current) return;
        setTracks([]);
        setError(loadError.message || "Could not load music.");
      } finally {
        if (requestId === searchRequestRef.current) setLoading(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [open, query]);

  React.useEffect(() => () => stopAudio(), []);

  const preview = (track) => {
    if (!track.audio_url) {
      window.open(track.provider_track_id, "_blank", "noopener,noreferrer");
      return;
    }

    if (previewId === track.id) {
      stopAudio();
      setPreviewId(null);
      return;
    }

    playAudioUrl(track.audio_url);
    setPreviewId(track.id);
  };

  const choose = (track) => {
    stopAudio();
    setPreviewId(null);
    onChange?.(track);
    setOpen(false);
  };

  const selected = value?.title ? value : null;

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="eyebrow">Music</div>
          <h3 style={{ marginTop: 5 }}>{selected ? selected.title : "Add music"}</h3>
          <p className="subtitle" style={{ marginTop: 4 }}>
            {selected ? selected.artist + " · saved to this post" : "Pick from Flic'd's verified beta catalog."}
          </p>
        </div>
        {selected && (
          <button type="button" className="btn icon-btn" onClick={() => { stopAudio(); onClear?.(); }} aria-label="Remove music">
            <X size={16} />
          </button>
        )}
      </div>

      <button type="button" className="btn" style={{ marginTop: 12 }} disabled={disabled} onClick={() => setOpen((current) => !current)}>
        <Search size={15} />
        {open ? "Close music" : selected ? "Change music" : "Choose music"}
      </button>

      {open && (
        <div className="stack" style={{ marginTop: 12 }}>
          <input
            className="input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search artist, song, or genre…"
            aria-label="Search music"
          />

          {loading && <p className="subtitle">Loading verified tracks…</p>}
          {error && <p role="alert" className="subtitle">{error}</p>}
          {!loading && !error && tracks.length === 0 && <p className="subtitle">No verified tracks found.</p>}

          {tracks.map((track) => (
            <div key={track.id} className="card" style={{ padding: 10 }}>
              <div className="row">
                <div className="avatar" aria-hidden="true">{track.artist?.[0]?.toUpperCase() || "♪"}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong>{track.title}</strong>
                  <p className="subtitle">{track.artist} · {track.genre || "Instrumental"}</p>
                </div>
                <button type="button" className="btn icon-btn" onClick={() => preview(track)} aria-label={track.audio_url ? (previewId === track.id ? "Pause preview" : "Preview track") : "Open track source"}>
                  {track.audio_url && previewId === track.id ? <Pause size={15} /> : track.audio_url ? <Play size={15} /> : <ExternalLink size={15} />}
                </button>
                <button type="button" className="btn" onClick={() => choose(track)}>Select</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
