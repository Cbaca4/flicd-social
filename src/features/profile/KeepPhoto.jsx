import React from "react";
import { useAccountScope } from "../../app/AuthScopeContext.js";
import { captureAuthScope } from "../../app/authScope.js";
import { mediaApi } from "../home/mediaSessionApi.js";

// Every mounted image owns its URLs. A late result never crosses a page/account.
export default function KeepPhoto({ item, version = 0 }) {
  const account = useAccountScope();
  const [media, setMedia] = React.useState(null);
  React.useEffect(() => {
    let live = true, owned = null;
    if (item.legacy_status) return undefined;
    void (async () => {
      let scope;
      try {
        scope = captureAuthScope(account.capture(), () => live);
        const blob = await mediaApi.blob("keeps/frame", { keepId: item.id }, { authScope: scope });
        if (!scope.isCurrent()) return;
        owned = URL.createObjectURL(blob); setMedia({ id: item.id, version, url: owned });
      } catch { if (live && (!scope || scope.isCurrent())) setMedia({ id: item.id, version, error: true }); }
    })();
    return () => { live = false; if (owned) URL.revokeObjectURL(owned); };
  }, [item.id, item.legacy_status, version, account]);
  if (item.legacy_status) return <p className="subtitle">Saved record preserved; media awaiting provenance review.</p>;
  if (media?.id !== item.id || media.version !== version) return <p role="status">Loading saved photo…</p>;
  if (media.error) return <p role="status">Photo unavailable. It may be deleted or access suspended.</p>;
  return <img src={media.url} alt={item.note || item.saved_note || "Saved photo"} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12 }} />;
}
