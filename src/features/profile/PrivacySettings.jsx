import React from "react";
import { Lock, Unlock } from "lucide-react";
import { getCurrentProfile, setPrivateAccount } from "../social/socialApi.js";

export default function PrivacySettings({ onBack }) {
  const [isPrivate, setIsPrivate] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => { let cancelled = false; getCurrentProfile().then((profile) => { if (!cancelled) setIsPrivate(Boolean(profile?.is_private)); }).catch((error) => console.error("Failed to load privacy setting:", error)).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, []);
  const toggle = async () => { if (saving || loading) return; try { setSaving(true); const next = await setPrivateAccount(!isPrivate); setIsPrivate(next); } catch (error) { console.error("Failed to update privacy:", error); } finally { setSaving(false); } };
  return <div className="screen"><div className="topbar"><div><div className="eyebrow">Privacy & Safety</div><h1 className="title">Who can see your Flics?</h1><p className="subtitle">Your profile can stay discoverable while your Flics remain visible only to approved followers when your account is private.</p></div><button className="btn" type="button" onClick={onBack}>Done</button></div><div className="stack" style={{ maxWidth: 720 }}><div className="card"><div className="row"><div style={{ width: 44, height: 44, borderRadius: 14, display: "grid", placeItems: "center", background: "rgba(255,255,255,.06)" }}>{isPrivate ? <Lock size={20} /> : <Unlock size={20} />}</div><div style={{ flex: 1 }}><strong>Private account</strong><p className="subtitle" style={{ marginTop: 3 }}>{isPrivate ? "Only followers can see your Flic content." : "Anyone can see your public Flic content."}</p></div><button className={`btn ${isPrivate ? "btn-primary" : ""}`} type="button" onClick={toggle} disabled={loading || saving}>{saving ? "Saving…" : isPrivate ? "Private" : "Public"}</button></div></div><div className="card"><div className="eyebrow">Follow requests</div><p className="subtitle" style={{ marginTop: 4 }}>Private accounts use follow requests. Requested followers must be accepted before they can see protected Flic content.</p></div></div></div>;
}
