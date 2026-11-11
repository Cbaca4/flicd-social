import React from "react";
import { useAccountScope } from "../../app/AuthScopeContext.js";
import KeepPhoto from "./KeepPhoto.jsx";
import { linkBoardItem, removeKeep } from "./boardApi";

function PhotoCard({ item, boards, onRefresh, version }) {
  const account = useAccountScope();
  const [target, setTarget] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const available = boards.filter(board => !item.board_ids.includes(board.id));
  async function mutate(action) {
    setBusy(true); setError("");
    let scope;
    try { scope = account.capture(); await action(scope); scope.assertCurrent(); await onRefresh(); }
    catch (failure) { if (scope?.isCurrent()) setError(failure.message || "Could not update this Keep."); }
    finally { if (scope?.isCurrent()) setBusy(false); }
  }
  return <article className="card" style={{ breakInside: "avoid", marginBottom: 16 }}>
    <div style={{ aspectRatio: "4 / 5" }}><KeepPhoto item={item} version={version} /></div>
    <p>{item.note || item.saved_note || "Saved photo"}</p>
    <p className="subtitle">{item.board_ids.length} Board memberships</p>
    {!item.legacy_status && <>
      <label className="stack">Add to a Board
        <select className="input" value={target} onChange={event => setTarget(event.target.value)} disabled={busy}>
          <option value="">Choose Board</option>{available.map(board => <option key={board.id} value={board.id}>{board.name}</option>)}
        </select>
      </label>
      <button className="btn" type="button" disabled={busy || !target} onClick={() => mutate(scope => linkBoardItem(item.id, target, scope))}>Add to Board</button>
      <button className="btn" type="button" disabled={busy || item.board_ids.length > 0} title={item.board_ids.length ? "Remove Board memberships first" : "Remove this unorganized Keep"} onClick={() => mutate(scope => removeKeep(item.id, scope))}>Remove Keep</button>
    </>}
    {error && <p role="alert">{error}</p>}
  </article>;
}

export default function KeepLibrary({ items, mode, boards, onRefresh, version }) {
  const groups = new Map();
  for (const item of items) {
    if (mode === "Legacy Saves" ? !item.legacy_status : item.legacy_status || (mode === "My Photos" ? !item.is_own_photo : item.is_own_photo)) continue;
    const key = mode === "Kept from Others" ? item.source_author_id : mode;
    if (!groups.has(key)) groups.set(key, { label: mode === "Kept from Others" ? "@" + (item.source_username || "Former account") : mode, items: [] });
    groups.get(key).items.push(item);
  }
  if (!groups.size) return <div className="card">Nothing saved here yet.</div>;
  return <div className="stack">{Array.from(groups, ([id, group]) => <section key={id} data-creator-id={id}>
    <h2>{group.label}</h2>
    <div style={{ columns: "240px", columnGap: 16, marginTop: 16 }}>{group.items.map(item => <PhotoCard key={item.id} item={item} boards={boards} onRefresh={onRefresh} version={version} />)}</div>
  </section>)}</div>;
}
