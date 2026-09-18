import React from "react";
import { MapPin, Music2, Volume2, VolumeX } from "lucide-react";

export default function PostMetadataOverlay({
  post,
  distanceLabel = "",
  onToggleMusic,
  musicMuted = false,
  musicPlaying = false,
  className = "",
}) {
  const track = post?.musicTrack || null;
  const hasMusic = Boolean(track?.title || track?.artist || track?.audio_url);
  const canControlMusic = Boolean(onToggleMusic && track?.audio_url);
  const hasLocation = Boolean(post?.location?.name);

  if (!hasMusic && !hasLocation) return null;

  const rootClassName = ["post-metadata-overlay", className].filter(Boolean).join(" ");

  return (
    <div className={rootClassName} data-media-interactive="true" aria-label="Post details">
      <div className="post-metadata-overlay-track">
        {hasMusic && (
          canControlMusic ? (
            <button
              type="button"
              className="post-metadata-pill post-metadata-pill--music"
              onClick={(event) => {
                event.stopPropagation();
                onToggleMusic();
              }}
              aria-label={musicPlaying && !musicMuted ? "Mute post music" : "Play post music"}
              aria-pressed={Boolean(musicPlaying && !musicMuted)}
            >
              {track.cover_url ? (
                <img src={track.cover_url} alt="" className="post-metadata-art" />
              ) : (
                <span className="post-metadata-art post-metadata-art-fallback">
                  <Music2 size={13} />
                </span>
              )}
              <span className="post-metadata-copy">
                <strong>{track.title || "On repeat"}</strong>
                {track.artist && <span>{track.artist}</span>}
              </span>
              <span className="post-metadata-music-state" aria-hidden="true">
                {musicMuted || !musicPlaying ? <Volume2 size={13} /> : <VolumeX size={13} />}
              </span>
            </button>
          ) : (
            <div className="post-metadata-pill post-metadata-pill--music" aria-label="Post music">
              {track.cover_url ? (
                <img src={track.cover_url} alt="" className="post-metadata-art" />
              ) : (
                <span className="post-metadata-art post-metadata-art-fallback">
                  <Music2 size={13} />
                </span>
              )}
              <span className="post-metadata-copy">
                <strong>{track.title || "On repeat"}</strong>
                {track.artist && <span>{track.artist}</span>}
              </span>
            </div>
          )
        )}

        {hasLocation && (
          <span className="post-metadata-pill post-metadata-pill--location">
            <MapPin size={13} />
            <span>{post.location.name}</span>
            {distanceLabel && <span className="post-metadata-distance">· {distanceLabel}</span>}
          </span>
        )}
      </div>
    </div>
  );
}
