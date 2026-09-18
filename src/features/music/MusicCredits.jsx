import React from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { supabase } from "../../lib/supabase";

export default function MusicCredits({ onBack }) {
  const [tracks, setTracks] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    supabase
      .from("music_tracks")
      .select("title,artist,provider_track_id,music_licenses(license_type,license_url,attribution_text)")
      .eq("active", true)
      .eq("approved", true)
      .order("artist", { ascending: true })
      .order("title", { ascending: true })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error("Failed to load music credits:", error);
          setTracks([]);
        } else {
          setTracks(data || []);
        }
        setLoading(false);
      });
    return () => { active = false; };
  }, []);

  return (
    <div className="screen">
      <div className="topbar">
        <div className="row">
          <button type="button" className="btn icon-btn" onClick={onBack} aria-label="Back"><ArrowLeft size={17} /></button>
          <div>
            <div className="eyebrow">Music</div>
            <h1 className="title">Credits & licenses</h1>
          </div>
        </div>
      </div>
      <div className="card">
        <p className="subtitle">
          Flic'd's beta catalog contains individually verified tracks. Each track remains subject to its listed license and attribution requirements.
        </p>
      </div>
      {loading ? <p className="subtitle">Loading credits…</p> : (
        <div className="stack">
          {tracks.map((track) => {
            const license = Array.isArray(track.music_licenses) ? track.music_licenses[0] : track.music_licenses;
            return (
              <div className="card" key={track.provider_track_id}>
                <strong>{track.title}</strong>
                <p className="subtitle">{track.artist}</p>
                <p className="subtitle" style={{ marginTop: 6 }}>{license?.attribution_text || "Attribution required"}</p>
                <div className="row" style={{ marginTop: 8, flexWrap: "wrap" }}>
                  <a className="btn" href={track.provider_track_id} target="_blank" rel="noreferrer">
                    Source <ExternalLink size={13} />
                  </a>
                  {license?.license_url && <a className="btn" href={license.license_url} target="_blank" rel="noreferrer">{license.license_type}</a>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
