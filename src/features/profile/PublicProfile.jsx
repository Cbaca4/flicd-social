import React from "react";
import { ArrowLeft } from "lucide-react";
import FollowButton from "../social/FollowButton.jsx";
import { getPublicProfile, getRelationshipCounts } from "../social/socialApi.js";
import { getMusicTrack } from "../music/musicApi.js";
import OnRepeat from "../music/OnRepeat.jsx";
import RelationshipList from "../social/RelationshipList.jsx";

export default function PublicProfile({ profile, onBack, onUserSelect }) {
  const [resolvedProfile, setResolvedProfile] = React.useState(profile || null);
  const [musicTrack, setMusicTrack] = React.useState(null);
  const [relationshipList, setRelationshipList] = React.useState(null);
  const relationshipSource = resolvedProfile?.id || profile?.id;
  const theme = resolvedProfile?.profile_theme || {};
  const [relationshipCounts, setRelationshipCounts] = React.useState(() => ({
    followers: profile?.followers ?? 0,
    following: profile?.following ?? 0,
  }));
  const relationshipVersion = React.useRef(0);
  const avatarSource = resolvedProfile?.avatar_url || resolvedProfile?.username || resolvedProfile?.display_name || "?";
  const sectionStyles = theme.sectionStyles || {};
  const buttonStyle = theme.buttonStyle || {};
  const avatarLabel = avatarSource[0]?.toUpperCase() || "?";

  React.useEffect(() => {
    setResolvedProfile(profile || null);
    if (!profile?.id) return undefined;
    let active = true;
    getPublicProfile(profile.id)
      .then((nextProfile) => {
        if (active && nextProfile) {
          setResolvedProfile(nextProfile);
          if (nextProfile.profile_music_track_id) {
            getMusicTrack(nextProfile.profile_music_track_id).then((track) => {
              if (active) setMusicTrack(track);
            }).catch(() => {});
          } else {
            setMusicTrack(null);
          }
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [profile?.id]);

  React.useEffect(() => {
    if (!relationshipSource) return undefined;
    let active = true;
    const requestVersion = relationshipVersion.current;
    getRelationshipCounts(relationshipSource)
      .then((counts) => {
        if (active && relationshipVersion.current === requestVersion) setRelationshipCounts(counts);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [relationshipSource]);

  const handleFollowChange = (nextStatus, previousStatus) => {
    relationshipVersion.current += 1;
    setRelationshipCounts((current) => {
      if (nextStatus === "accepted" && previousStatus !== "accepted") {
        return { ...current, followers: current.followers + 1 };
      }
      if (nextStatus === null && previousStatus === "accepted") {
        return { ...current, followers: Math.max(0, current.followers - 1) };
      }
      return current;
    });
  };

  return (
    <>
      <div
        className="screen profile-screen"
        style={{
          background: theme.background || undefined,
          "--profile-button-bg": buttonStyle.filled ? buttonStyle.accent : buttonStyle.background,
          "--profile-button-border": buttonStyle.border,
          "--profile-button-text": buttonStyle.text,
          "--profile-button-accent": buttonStyle.accent,
          "--profile-button-radius": String(buttonStyle.radius || 14) + "px",
        }}
      >
        {theme.backgroundMedia?.url && (
          <div className="profile-background-media" aria-hidden="true">
            {theme.backgroundMedia.type === "video"
              ? <video src={theme.backgroundMedia.url} autoPlay loop muted playsInline />
              : <img src={theme.backgroundMedia.url} alt="" />
            }
          </div>
        )}
        <div className="profile-content-layer">
          <div className="topbar">
            <button type="button" className="btn icon-btn" onClick={onBack} aria-label="Back">
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="eyebrow">Public profile</div>
              <h1 className="title">@{resolvedProfile?.username || "unknown"}</h1>
            </div>
          </div>

          <div
            className="profile-hero profile-section-card"
            style={{
              background: sectionStyles.hero?.background,
              borderColor: sectionStyles.hero?.border,
              borderRadius: String(sectionStyles.hero?.radius || 20) + "px",
            }}
          >
            <div className="row" style={{ alignItems: "flex-start" }}>
              <div className="avatar lg">
                {resolvedProfile?.avatar_url
                  ? <img src={resolvedProfile.avatar_url} alt={"@" + (resolvedProfile.username || "unknown") + " profile"} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit", display: "block" }} />
                  : avatarLabel}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <h2 style={{ marginTop: 0 }}>@{resolvedProfile?.username || "unknown"}</h2>
                    {resolvedProfile?.display_name && <p className="subtitle" style={{ marginTop: 3 }}>{resolvedProfile.display_name}</p>}
                  </div>
                  <FollowButton userId={resolvedProfile?.id} compact onChange={handleFollowChange} />
                </div>
                {resolvedProfile?.bio && <p className="subtitle" style={{ marginTop: 8 }}>{resolvedProfile.bio}</p>}
                {theme.status && <p style={{ marginTop: 8, color: sectionStyles.hero?.accent || theme.accent || undefined, fontSize: 12 }}>{theme.statusEmoji || "✦"} {theme.status}</p>}
              </div>
            </div>
          </div>

          {theme.showMusic !== false && (
            <div style={{ marginTop: 14 }}>
              <OnRepeat
                track={musicTrack}
                editable={false}
                className="profile-section-card"
                style={{
                  background: sectionStyles.onRepeat?.background,
                  borderColor: sectionStyles.onRepeat?.border,
                  borderRadius: String(sectionStyles.onRepeat?.radius || 20) + "px",
                }}
              />
            </div>
          )}

          <div className="row" style={{ gap: 10, marginTop: 22, flexWrap: "wrap" }}>
            <button type="button" className="profile-stat" onClick={() => setRelationshipList("followers")} aria-label="View followers">
              <strong>{relationshipCounts.followers}</strong>
              <span className="subtitle">followers</span>
            </button>
            <button type="button" className="profile-stat" onClick={() => setRelationshipList("following")} aria-label="View following">
              <strong>{relationshipCounts.following}</strong>
              <span className="subtitle">following</span>
            </button>
          </div>
        </div>
      </div>
      {relationshipList && <RelationshipList profileId={relationshipSource} type={relationshipList} onClose={() => setRelationshipList(null)} onUserSelect={onUserSelect} />}
    </>
  );
}
