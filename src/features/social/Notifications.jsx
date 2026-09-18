import React from "react";
import { Bell, Check, Image as ImageIcon } from "lucide-react";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "./notificationsApi.js";

export default function Notifications({ onBack, onOpenDump, onChanged }) {
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await getNotifications());
    } catch (loadError) {
      setError(loadError.message || "Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const markAllRead = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await markAllNotificationsRead();
      setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() })));
      onChanged?.();
    } catch (markError) {
      setError(markError.message || "Could not update notifications.");
    } finally {
      setSaving(false);
    }
  };

  const openItem = async (item) => {
    if (!item.read_at) {
      try {
        await markNotificationRead(item.id);
      } catch {
        // The notification can still open even when the read update fails.
      }
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read_at: new Date().toISOString() } : entry));
      onChanged?.();
    }

    if (item.dump_id) onOpenDump?.(item.dump_id);
  };

  return (
    <div className="screen">
      <div className="topbar">
        <div>
          <div className="eyebrow">Inbox</div>
          <h1 className="title">Notifications</h1>
        </div>
        <div className="row">
          <button type="button" className="btn" onClick={markAllRead} disabled={saving}>
            <Check size={15} />
            Read all
          </button>
          <button type="button" className="btn icon-btn" onClick={onBack} aria-label="Back">
            ×
          </button>
        </div>
      </div>

      <div className="stack">
        {loading && <div className="card subtitle">Loading notifications…</div>}
        {!loading && error && <div className="card subtitle" role="alert">{error}</div>}
        {!loading && !error && !items.length && (
          <div className="card" style={{ textAlign: "center", padding: 30 }}>
            <Bell size={22} />
            <h3 style={{ marginTop: 10 }}>You're all caught up</h3>
            <p className="subtitle" style={{ marginTop: 5 }}>Tags and other activity will show up here.</p>
          </div>
        )}

        {!loading && !error && items.map((item) => (
          <button
            type="button"
            key={item.id}
            className="card"
            onClick={() => openItem(item)}
            style={{ width: "100%", textAlign: "left", opacity: item.read_at ? 0.72 : 1 }}
          >
            <div className="row">
              <div className="avatar">
                {item.actor?.avatar_url ? (
                  <img src={item.actor.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }} />
                ) : (
                  (item.actor?.username || "F")[0].toUpperCase()
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong>{item.body || "New activity on Flic'd"}</strong>
                <p className="subtitle" style={{ marginTop: 4 }}>{new Date(item.created_at).toLocaleString()}</p>
              </div>
              <ImageIcon size={16} className="muted" />
              {!item.read_at && <span className="status-dot" aria-label="Unread notification" />}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
