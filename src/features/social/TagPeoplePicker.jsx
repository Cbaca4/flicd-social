import React from "react";
import { Search, UserRound, X } from "lucide-react";
import { supabase } from "../../lib/supabase";

const MAX_TAGS = 10;

export default function TagPeoplePicker({ value = [], onChange, disabled = false }) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [currentUserId, setCurrentUserId] = React.useState(null);
  const selectedIds = React.useMemo(() => new Set(value.map((user) => user.id)), [value]);

  React.useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) setCurrentUserId(data?.user?.id || null);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  React.useEffect(() => {
    const clean = query.trim().replace(/^@+/, "");
    if (!open || !clean || value.length >= MAX_TAGS) {
      setResults([]);
      setLoading(false);
      setError("");
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      const { data, error: searchError } = await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url")
        .or(`username.ilike.%${clean}%,display_name.ilike.%${clean}%`)
        .limit(12);

      if (cancelled) return;
      setLoading(false);
      if (searchError) {
        setError("User search is unavailable right now.");
        return;
      }

      setResults((data || []).filter((user) => user.id !== currentUserId && !selectedIds.has(user.id)));
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [currentUserId, open, query, selectedIds, value.length]);

  const add = (user) => {
    if (!user?.id || selectedIds.has(user.id) || value.length >= MAX_TAGS) return;
    onChange?.([...value, user]);
    setQuery("");
    setResults([]);
  };

  const remove = (userId) => {
    onChange?.(value.filter((user) => user.id !== userId));
  };

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="eyebrow">Tag people</div>
          <h3 style={{ marginTop: 5 }}>{value.length ? `${value.length} tagged` : "Add people"}</h3>
          <p className="subtitle" style={{ marginTop: 4 }}>
            Tagged people will get a notification when you post.
          </p>
        </div>
        <UserRound size={18} className="muted" />
      </div>

      {value.length > 0 && (
        <div className="wrap" style={{ marginTop: 12 }}>
          {value.map((user) => (
            <span key={user.id} className="tag row" style={{ gap: 6 }}>
              @{user.username}
              <button
                type="button"
                onClick={() => remove(user.id)}
                disabled={disabled}
                aria-label={`Remove @${user.username}`}
                style={{ border: 0, background: "transparent", color: "inherit", padding: 0, display: "grid", placeItems: "center" }}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        className="btn"
        style={{ marginTop: 12 }}
        disabled={disabled || value.length >= MAX_TAGS}
        onClick={() => setOpen((current) => !current)}
      >
        <Search size={15} />
        {open ? "Close people" : value.length >= MAX_TAGS ? "10 people tagged" : "Tag someone"}
      </button>

      {open && value.length < MAX_TAGS && (
        <div className="stack" style={{ marginTop: 12 }}>
          <input
            className="input"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search username or display name"
            aria-label="Search people to tag"
          />
          {loading && <p className="subtitle">Searching…</p>}
          {error && <p className="subtitle" role="alert">{error}</p>}
          {!loading && !error && query.trim() && !results.length && <p className="subtitle">No users found.</p>}
          {results.map((user) => (
            <button
              type="button"
              key={user.id}
              className="card"
              onClick={() => add(user)}
              style={{ width: "100%", textAlign: "left", padding: 12 }}
            >
              <div className="row">
                <div className="avatar">{(user.username || user.display_name || "?")[0].toUpperCase()}</div>
                <div style={{ minWidth: 0 }}>
                  <strong>@{user.username || "unknown"}</strong>
                  <p className="subtitle">{user.display_name || ""}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
