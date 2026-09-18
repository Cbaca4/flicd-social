import React from "react";
import { ArrowLeft, UserRound } from "lucide-react";
import FollowButton from "./FollowButton.jsx";
import { getProfileFollowers, getProfileFollowing } from "./socialApi.js";

export default function RelationshipList({ profileId, type = "followers", onClose, onUserSelect }) {
  const [users, setUsers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const load = type === "following" ? getProfileFollowing : getProfileFollowers;

    load(profileId)
      .then((nextUsers) => {
        if (active) setUsers(nextUsers || []);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || "Could not load this list.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [profileId, type]);

  const title = type === "following" ? "Following" : "Followers";

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose?.();
    }}>
      <div className="modal" style={{ maxWidth: 620 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="eyebrow">Connections</div>
            <h2 style={{ marginTop: 4 }}>{title}</h2>
          </div>
          <button type="button" className="btn icon-btn" onClick={onClose} aria-label="Close">
            <ArrowLeft size={18} />
          </button>
        </div>

        <div className="stack" style={{ marginTop: 16 }}>
          {loading && <div className="card subtitle">Loading {title.toLowerCase()}…</div>}
          {!loading && error && <div className="card subtitle" role="alert">{error}</div>}
          {!loading && !error && !users.length && <div className="card"><UserRound size={18} /><p className="subtitle" style={{ marginTop: 7 }}>No {title.toLowerCase()} yet.</p></div>}

          {!loading && !error && users.map((user) => (
            <div className="card" key={user.id}>
              <div className="row">
                <button
                  type="button"
                  onClick={() => onUserSelect?.(user)}
                  style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12, border: 0, background: "transparent", color: "inherit", padding: 0, textAlign: "left", cursor: "pointer" }}
                  aria-label={`Open profile @${user.username || "unknown"}`}
                >
                  <div className="avatar">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }} />
                    ) : (
                      (user.username || user.display_name || "?")[0].toUpperCase()
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <strong>@{user.username || "unknown"}</strong>
                    <p className="subtitle">{user.display_name || ""}</p>
                  </div>
                </button>
                <FollowButton userId={user.id} compact />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
