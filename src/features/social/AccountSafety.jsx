import React from "react";
import { useAccountScope } from "../../app/AuthScopeContext.js";
import { captureAuthScope } from "../../app/authScope.js";
import { mediaApi } from "../home/mediaSessionApi.js";

export default function AccountSafety({ accountId }) {
  const account = useAccountScope();
  const [status, setStatus] = React.useState(null);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const generation = React.useRef(0);
  React.useEffect(() => {
    const version = ++generation.current;
    void (async () => {
      let scope;
      try {
        scope = captureAuthScope(account.capture(), () => version === generation.current);
        const result = await mediaApi.json("safety/status", { accountId }, { authScope: scope });
        if (scope.isCurrent()) { setStatus({ ...result, accountId }); setError(""); }
      } catch (failure) { if (scope?.isCurrent()) setError(failure.message || "Safety controls unavailable."); }
    })();
    return () => { generation.current += 1; };
  }, [accountId, account]);
  async function toggle() {
    const version = generation.current;
    setBusy(true); setError("");
    let scope;
    try {
      scope = captureAuthScope(account.capture(), () => version === generation.current);
      const result = await mediaApi.json("safety/block", { accountId, blocked: !status.blocked_by_me }, { authScope: scope });
      if (scope.isCurrent()) setStatus({ ...result, accountId });
    } catch (failure) { if (scope?.isCurrent()) setError(failure.message || "Could not update blocking."); }
    finally { if (scope?.isCurrent()) setBusy(false); }
  }
  return <div className="stack">
    {status?.accountId === accountId && !status.is_self && <>
      <button type="button" className="btn" disabled={busy} onClick={toggle}>{status.blocked_by_me ? "Unblock account" : "Block account"}</button>
      <p className="subtitle">Blocking suspends access to each other's media and Keeps. Unblocking does not restore a consumed View Once allowance.</p>
    </>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
