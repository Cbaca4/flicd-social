import React from "react";
import { followUser, getFollowStatus, unfollowUser } from "./socialApi.js";

export default function FollowButton({ userId, onChange, compact = false }) {
  const [status, setStatus] = React.useState("loading");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    getFollowStatus(userId).then((value) => {
      if (!cancelled) setStatus(value);
    }).catch(() => {
      if (!cancelled) setStatus(null);
    });
    return () => { cancelled = true; };
  }, [userId]);

  if (status === "self") return null;

  const handleClick = async () => {
    if (saving || status === "loading") return;
    const previousStatus = status;
    try {
      setSaving(true);
      const next = status ? await unfollowUser(userId) : await followUser(userId);
      setStatus(next);
      onChange?.(next, previousStatus);
    } catch (error) {
      console.error("Follow action failed:", error);
    } finally {
      setSaving(false);
    }
  };

  const label = status === "pending" ? "Requested" : status === "accepted" ? "Following" : "Follow";
  return (
    <button type="button" className={`btn ${status ? "" : "btn-primary"}`} onClick={handleClick} disabled={saving || status === "loading"} aria-label={`${label} user`} style={{ minWidth: compact ? 88 : 108 }}>
      {saving ? "…" : label}
    </button>
  );
}
