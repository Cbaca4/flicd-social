import React from "react";
import { ArrowLeft } from "lucide-react";

export default function PublicProfile({ profile, onBack }) {
  const theme = profile?.profile_theme || {};
  const avatarSource = profile?.avatar_url || profile?.username || profile?.display_name || "?";
  const avatarLabel = avatarSource[0]?.toUpperCase() || "?";

  return (
    <div
      className="screen"
      style={{
        background: theme.background || undefined,
      }}
    >
      <div className="topbar">
        <button
          type="button"
          className="btn icon-btn"
          onClick={onBack}
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <div className="eyebrow">Public profile</div>
          <h1 className="title">@{profile?.username || "unknown"}</h1>
        </div>
      </div>

      <div className="profile-hero">
        <div className="row" style={{ alignItems: "flex-start" }}>
          <div className="avatar lg">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }}
              />
            ) : (
              avatarLabel
            )}
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ marginTop: 0 }}>{profile?.display_name || ""}</h2>
            {profile?.bio && <p className="subtitle" style={{ marginTop: 6 }}>{profile.bio}</p>}
            {theme.status && (
              <p style={{ marginTop: 8, color: theme.accent || undefined, fontSize: 12 }}>
                {theme.statusEmoji || "✦"} {theme.status}
              </p>
            )}
          </div>
        </div>

        <div className="row" style={{ gap: 28, marginTop: 22 }}>
          <div>
            <strong>{profile?.followers ?? 0}</strong>
            <div className="subtitle">followers</div>
          </div>
          <div>
            <strong>{profile?.following ?? 0}</strong>
            <div className="subtitle">following</div>
          </div>
        </div>
      </div>
    </div>
  );
}
