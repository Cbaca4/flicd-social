import React from "react";
import { Check, UserRoundX, X } from "lucide-react";
import { approveFollowRequest, declineFollowRequest, getPendingFollowRequests } from "./socialApi.js";

export default function FollowRequests() {
  const [requests, setRequests] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState(null);

  const load = React.useCallback(async () => {
    try {
      const data = await getPendingFollowRequests();
      setRequests(data);
    } catch (error) {
      console.error("Failed to load follow requests:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const respond = async (followerId, approve) => {
    if (busyId) return;
    try {
      setBusyId(followerId);
      if (approve) await approveFollowRequest(followerId);
      else await declineFollowRequest(followerId);
      setRequests((current) => current.filter((request) => request.follower_id !== followerId));
    } catch (error) {
      console.error("Failed to respond to follow request:", error);
    } finally {
      setBusyId(null);
    }
  };

  return <div className="card" style={{ margin: 0 }}><div className="row" style={{ alignItems: "center" }}><div style={{ width: 42, height: 42, borderRadius: 14, display: "grid", placeItems: "center", background: "rgba(255,255,255,.06)" }}><UserRoundX size={19} /></div><div style={{ flex: 1 }}><strong>Follow requests</strong><p className="subtitle" style={{ marginTop: 3 }}>{loading ? "Checking…" : requests.length ? `${requests.length} pending request${requests.length === 1 ? "" : "s"}` : "No pending requests"}</p></div></div>{requests.length > 0 && <div className="stack" style={{ marginTop: 14 }}>{requests.map((request) => <div className="row" key={request.follower_id} style={{ alignItems: "center" }}><div className="avatar">{(request.profile?.username || "?")[0].toUpperCase()}</div><div style={{ flex: 1, minWidth: 0 }}><strong>@{request.profile?.username || "unknown"}</strong><p className="subtitle">{request.profile?.display_name || ""}</p></div><button type="button" className="btn btn-primary icon-btn" aria-label={`Accept @${request.profile?.username || "unknown"}`} disabled={busyId !== null} onClick={() => respond(request.follower_id, true)}><Check size={17} /></button><button type="button" className="btn icon-btn" aria-label={`Decline @${request.profile?.username || "unknown"}`} disabled={busyId !== null} onClick={() => respond(request.follower_id, false)}><X size={17} /></button></div>)}</div>}</div>;
}
