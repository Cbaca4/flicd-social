import React from "react";
import Pill from "../../components/shared/Pill.jsx";
import FollowButton from "../social/FollowButton.jsx";
import { completeOnboarding, getPeopleSuggestions, saveInterests, DEFAULT_INTERESTS } from "../social/socialApi.js";

function OnboardingShell({ eyebrow, title, subtitle, children }) {
  return <div className="onboarding-shell"><div className="onboarding-card"><div className="eyebrow">{eyebrow}</div><h1 className="title" style={{ marginTop: 6 }}>{title}</h1>{subtitle && <p className="subtitle" style={{ marginTop: 8 }}>{subtitle}</p>}{children}</div></div>;
}

export function InterestsStep({ initialInterests = [], onContinue }) {
  const [selected, setSelected] = React.useState(initialInterests);
  const [custom, setCustom] = React.useState("");
  const toggle = (value) => setSelected((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  const addCustom = (event) => {
    event.preventDefault();
    const value = custom.trim();
    if (!value) return;
    setSelected((current) => current.includes(value) ? current : [...current, value]);
    setCustom("");
  };
  const continueNext = async () => { await saveInterests(selected); onContinue(); };
  return <OnboardingShell eyebrow="Welcome to Flic'd" title="What are you into?" subtitle="Pick a few things you care about. We’ll use them to make your recommendations feel less random.">
    <div className="wrap" style={{ marginTop: 18, justifyContent: "flex-start" }}>{DEFAULT_INTERESTS.map((interest) => <Pill key={interest} active={selected.includes(interest)} onClick={() => toggle(interest)}>{interest}</Pill>)}</div>
    <form onSubmit={addCustom} className="row" style={{ marginTop: 18, alignItems: "stretch" }}><input className="input" value={custom} onChange={(event) => setCustom(event.target.value)} placeholder="Add your own interest" maxLength={40} /><button className="btn" type="submit" disabled={!custom.trim()}>Add</button></form>
    {selected.length > 0 && <p className="subtitle" style={{ marginTop: 12 }}>{selected.length} selected</p>}
    <div className="row" style={{ justifyContent: "space-between", marginTop: 24 }}><button type="button" className="btn" onClick={() => { setSelected([]); onContinue(); }}>Skip for now</button><button type="button" className="btn btn-primary" onClick={continueNext}>Continue</button></div>
  </OnboardingShell>;
}

export function SuggestedFollowersStep({ onComplete }) {
  const [people, setPeople] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => { let cancelled = false; getPeopleSuggestions({ limit: 12 }).then((data) => { if (!cancelled) setPeople(data); }).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, []);
  const finish = async () => { await completeOnboarding(); onComplete(); };
  return <OnboardingShell eyebrow="Make your feed yours" title="Suggested followers" subtitle="Follow a few people to start shaping your Flic’d feed. You can always change this later.">
    {loading ? <div className="card" style={{ marginTop: 16 }}>Finding people for you…</div> : <div className="stack" style={{ marginTop: 16 }}>{people.length ? people.map((person) => <div className="card" key={person.id}><div className="row" style={{ alignItems: "center" }}><div className="avatar">{(person.username || person.display_name || "?")[0].toUpperCase()}</div><div style={{ flex: 1, minWidth: 0 }}><strong>@{person.username || "unknown"}</strong><p className="subtitle" style={{ marginTop: 2 }}>{person.display_name || ""}</p>{person.sharedInterests?.length > 0 && <p className="subtitle" style={{ marginTop: 4 }}>You both like {person.sharedInterests.slice(0, 2).join(" · ")}</p>}</div><FollowButton userId={person.id} compact /></div></div>) : <div className="card subtitle">We’ll have more suggestions as more people join.</div>}</div>}
    <div className="row" style={{ justifyContent: "space-between", marginTop: 24 }}><button className="btn" type="button" onClick={finish}>Skip</button><button className="btn btn-primary" type="button" onClick={finish}>Done</button></div>
  </OnboardingShell>;
}
