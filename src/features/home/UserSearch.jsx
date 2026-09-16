import React from "react";
import { Search, X } from "lucide-react";
import { supabase } from "../../lib/supabase";

export default function UserSearch({ onClose, onUserSelect }) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    const value = query.trim().replace(/^@+/, "");
    if (!value) {
      setResults([]);
      setError("");
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      const { data, error: searchError } = await supabase
        .from("profiles")
        .select("id, username, display_name, bio, avatar_url, profile_theme")
        .or(`username.ilike.%${value}%,display_name.ilike.%${value}%`)
        .limit(12);

      if (cancelled) return;
      setLoading(false);
      if (searchError) {
        setError("Search is unavailable right now.");
        return;
      }
      setResults(data || []);
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <div className="modal" style={{ maxWidth: 620 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="eyebrow">Find people</div>
            <h2 style={{ marginTop: 4 }}>Search Flic'd</h2>
          </div>
          <button type="button" className="btn icon-btn" onClick={onClose} aria-label="Close search"><X size={18} /></button>
        </div>
        <div className="row" style={{ marginTop: 16 }}>
          <Search size={18} className="muted" />
          <input className="input" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search username or display name" aria-label="Search users" />
        </div>
        <div className="stack" style={{ marginTop: 14 }}>
          {loading && <div className="card subtitle">Searching…</div>}
          {!loading && error && <div className="card subtitle">{error}</div>}
          {!loading && !error && query.trim() && !results.length && <div className="card subtitle">No users found.</div>}
          {results.map((user) => (
            <button
              key={user.id}
              type="button"
              className="card"
              onClick={() => onUserSelect?.(user)}
              style={{ width: "100%", textAlign: "left", cursor: "pointer" }}
              aria-label={`Open profile @${user.username || "unknown"}`}
            >
              <div className="row">
                <div className="avatar">{(user.username || user.display_name || "?")[0].toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong>@{user.username || "unknown"}</strong>
                  <div className="subtitle">{user.display_name || ""}</div>
                  {user.bio && <div className="subtitle" style={{ marginTop: 4 }}>{user.bio}</div>}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
