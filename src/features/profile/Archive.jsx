import React from "react";
import { useAccountScope } from "../../app/AuthScopeContext.js";
import { ArrowLeft, Archive as ArchiveIcon, Bookmark } from "lucide-react";
import { getArchiveDumps, releaseArchiveMedia } from "./archiveApi.js";

function formatArchiveDate(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
  } catch {
    return "";
  }
}

export default function Archive({ onBack, onKeep, authScope }) {
  const account = useAccountScope(authScope);
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const mountedRef = React.useRef(false);
  const loadVersionRef = React.useRef(0);
  const ownedMediaRef = React.useRef([]);
  const load = React.useCallback(async () => {
    const version = ++loadVersionRef.current;
    setLoading(true);
    setError("");
    let scope;
    try {
      scope = account.capture();
      const rows = await getArchiveDumps(scope);
      if (!scope.isCurrent() || !mountedRef.current || version !== loadVersionRef.current) {
        if (rows !== ownedMediaRef.current) releaseArchiveMedia(rows);
        return;
      }
      const previous = ownedMediaRef.current;
      ownedMediaRef.current = rows;
      setItems(rows);
      if (previous.length && previous !== rows) releaseArchiveMedia(previous);
    } catch (loadError) {
      if (scope?.isCurrent() && mountedRef.current && version === loadVersionRef.current) {
        setError(loadError?.message || "Could not load your archive.");
      }
    } finally {
      if (scope?.isCurrent() && mountedRef.current && version === loadVersionRef.current) setLoading(false);
    }
  }, [account]);
  React.useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
      loadVersionRef.current += 1;
      if (ownedMediaRef.current.length) releaseArchiveMedia(ownedMediaRef.current);
      ownedMediaRef.current = [];
    };
  }, [load]);

  return (
    <div className="screen archive-screen">
      <div className="topbar">
        <button type="button" className="btn icon-btn" onClick={onBack} aria-label="Back to profile"><ArrowLeft size={18} /></button>
        <div style={{ minWidth: 0, flex: 1 }}><div className="eyebrow">Private</div><h1 className="title">Archive</h1></div>
        <ArchiveIcon size={19} className="muted" aria-hidden="true" />
      </div>
      {loading ? (
        <div className="stack">{[0,1,2].map((value) => <div className="card archive-skeleton" key={value} aria-hidden="true" />)}</div>
      ) : error ? (
        <div className="card"><strong>Could not load your archive</strong><p className="subtitle" style={{ marginTop: 5 }}>{error}</p><button type="button" className="btn" style={{ marginTop: 10 }} onClick={load}>Try again</button></div>
      ) : items.length === 0 ? (
        <div className="card archive-empty"><ArchiveIcon size={24} /><strong style={{ marginTop: 8 }}>Nothing in your archive yet.</strong><p className="subtitle" style={{ marginTop: 5 }}>Your expired 24-hour posts and privately managed View Once posts appear here.</p></div>
      ) : (
        <div className="archive-grid">
          {items.map((dump) => (
            <article className="card archive-card" key={dump.id}>
              <div className="archive-card-media">
                {dump.dump_items.map((item) => {
                  const source = item.archiveUrl;
                  return source ? <img key={item.id} src={source} alt={item.note || "Archived Flic'd"} /> : <span key={item.id} className="subtitle">Media unavailable</span>;
                })}
                {!dump.dump_items.some((item) => item.archiveUrl) && <span className="subtitle">No archived media available</span>}
              </div>
              <div className="archive-card-copy">
                <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
                  <div style={{ minWidth: 0 }}><strong>{dump.context || dump.mood || "Archived Flic'd"}</strong><p className="subtitle" style={{ marginTop: 3 }}>{dump.archive?.reason === "view_once" ? "View Once" : "24-hour expiry"} · {formatArchiveDate(dump.archive?.archived_at || dump.created_at)}</p></div>
                  <span className="tag">Private</span>
                </div>
                <div className="archive-item-actions">
                  {dump.expiry === "24h" && dump.dump_items.map((item, index) => (
                    <button key={item.id} type="button" className="btn" onClick={() => onKeep?.({ id: dump.id, authorId: dump.user_id, author: dump.user_id, mood: dump.mood || "", mode: dump.expiry, allowOthersToKeep: true, items: dump.dump_items.map((entry) => ({ id: entry.id, position: entry.position, note: entry.note || "", imagePath: entry.image_path || null, archivePath: entry.archive_path || null, archiveUrl: entry.archiveUrl || null })) }, index)}><Bookmark size={14} /> Save frame {index + 1} to Board</button>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}