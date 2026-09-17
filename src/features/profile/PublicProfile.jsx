import React from "react";
import { ArrowLeft } from "lucide-react";
import FollowButton from "../social/FollowButton.jsx";
import { getPublicProfile, getRelationshipCounts } from "../social/socialApi.js";

export default function PublicProfile({ profile, onBack }) {
  const [resolvedProfile, setResolvedProfile] = React.useState(profile || null);
  const relationshipSource = resolvedProfile?.id || profile?.id;
  const theme = resolvedProfile?.profile_theme || {};
  const [relationshipCounts, setRelationshipCounts] = React.useState(() => ({
    followers: profile?.followers ?? 0,
    following: profile?.following ?? 0,
  }));
  const relationshipVersion = React.useRef(0);
  const avatarSource = resolvedProfile?.avatar_url || resolvedProfile?.username || resolvedProfile?.display_name || "?";
  const avatarLabel = avatarSource[0]?.toUpperCase() || "?";

  React.useEffect(() => {
    setResolvedProfile(profile || null);
    if (!profile?.id) return undefined;
    let active = true;
    getPublicProfile(profile.id)
      .then((nextProfile) => {
        if (active && nextProfile) setResolvedProfile(nextProfile);
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

  return <div className="screen" style={{ background: theme.background || undefined }}><div className="topbar"><button type="button" className="btn icon-btn" onClick={onBack} aria-label="Back"><ArrowLeft size={18} /></button><div><div className="eyebrow">Public profile</div><h1 className="title">@{resolvedProfile?.username || "unknown"}</h1></div></div><div className="profile-hero"><div className="row" style={{ alignItems: "flex-start" }}><div className="avatar lg">{resolvedProfile?.avatar_url ? <img src={resolvedProfile.avatar_url} alt={`@${resolvedProfile.username || "unknown"} profile`} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit", display: "block" }} /> : avatarLabel}</div><div style={{ flex: 1, minWidth: 0 }}><div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}><div style={{ minWidth: 0 }}><h2 style={{ marginTop: 0 }}>@{resolvedProfile?.username || "unknown"}</h2>{resolvedProfile?.display_name && <p className="subtitle" style={{ marginTop: 3 }}>{resolvedProfile.display_name}</p>}</div><FollowButton userId={resolvedProfile?.id} compact onChange={handleFollowChange} /></div>{resolvedProfile?.bio && <p className="subtitle" style={{ marginTop: 8 }}>{resolvedProfile.bio}</p>}{theme.status && <p style={{ marginTop: 8, color: theme.accent || undefined, fontSize: 12 }}>{theme.statusEmoji || "✦"} {theme.status}</p>}</div></div><div className="row" style={{ gap: 28, marginTop: 22 }}><div><strong>{relationshipCounts.followers}</strong><div className="subtitle">followers</div></div><div><strong>{relationshipCounts.following}</strong><div className="subtitle">following</div></div></div></div></div>;
}
