import React from "react";
import { ArrowLeft, Archive as ArchiveIcon, Bookmark } from "lucide-react";
import { getArchiveDumps } from "./archiveApi.js";

function formatArchiveDate(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
  } catch {
    return "";
  }
}

export default function Archive({ onBack, onKeep }) {
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try { setItems(await getArchiveDumps()); }
    catch (loadError) { setError(loadError?.message || "Could not load your archive."); }
    finally { setLoading(false); }
  }, []);
  React.useEffect(() => { load(); }, [load]);

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
        <div className="card archive-empty"><ArchiveIcon size={24} /><strong style={{ marginTop: 8 }}>Nothing in your archive yet.</strong><p className="subtitle" style={{ marginTop: 5 }}>Expired 24-hour and view-once Flic&apos;ds will land here.</p></div>
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
                  <div style={{ minWidth: 0 }}><strong>{dump.context || dump.mood || "Archived Flic'd"}</strong><p className="subtitle" style={{ marginTop: 3 }}>{dump.archive?.reason === "view_once" ? "Viewed once" : "24-hour expiry"} · {formatArchiveDate(dump.archive?.archived_at || dump.created_at)}</p></div>
                  <span className="tag">Private</span>
                </div>
                <div className="archive-item-actions">
                  {dump.dump_items.map((item, index) => (
                    <button key={item.id} type="button" className="btn" onClick={() => onKeep?.({ id: dump.id, authorId: dump.user_id, author: dump.user_id, mood: dump.mood || "", mode: dump.expiry, allowOthersToKeep: true, items: dump.dump_items.map((entry) => ({ id: entry.id, note: entry.note || "", imagePath: entry.image_path || null, archivePath: entry.archive_path || null, archiveUrl: entry.archiveUrl || null })) }, index)}><Bookmark size={14} /> Save frame {index + 1} to Board</button>
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