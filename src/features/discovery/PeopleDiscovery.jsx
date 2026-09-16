import React from "react";
import FollowButton from "../social/FollowButton.jsx";
import { getPeopleSuggestions } from "../social/socialApi.js";

function PersonCard({ person }) {
  return <div className="card"><div className="row" style={{ alignItems: "center" }}><div className="avatar">{(person.username || person.display_name || "?")[0].toUpperCase()}</div><div style={{ flex: 1, minWidth: 0 }}><strong>@{person.username || "unknown"}</strong><div className="subtitle">{person.display_name || ""}</div>{person.bio && <div className="subtitle" style={{ marginTop: 4 }}>{person.bio}</div>}{person.sharedInterests?.length > 0 && <div className="subtitle" style={{ marginTop: 5 }}>You both like {person.sharedInterests.slice(0, 3).join(" · ")}</div>}</div><FollowButton userId={person.id} compact /></div></div>;
}

export default function PeopleDiscovery() {
  const [people, setPeople] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => { let cancelled = false; getPeopleSuggestions({ limit: 36 }).then((data) => { if (!cancelled) setPeople(data); }).catch((error) => console.error("Failed to load suggestions:", error)).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, []);
  if (loading) return <div className="card subtitle">Finding people you might like…</div>;
  const suggested = people.slice(0, 12);
  const mayKnow = people.slice(12, 24);
  const global = people.slice(24, 36);
  return <div className="stack">
    <section><div className="eyebrow">Suggested for you</div><h2 style={{ marginTop: 4 }}>People who fit your interests</h2><div className="stack" style={{ marginTop: 12 }}>{suggested.length ? suggested.map((person) => <PersonCard key={person.id} person={person} />) : <div className="card subtitle">More people will appear as Flic’d grows.</div>}</div></section>
    <section style={{ marginTop: 10 }}><div className="eyebrow">People you may know</div><h2 style={{ marginTop: 4 }}>Keep building your circle</h2><div className="stack" style={{ marginTop: 12 }}>{mayKnow.map((person) => <PersonCard key={person.id} person={person} />)}</div></section>
    <section style={{ marginTop: 10 }}><div className="eyebrow">Global</div><h2 style={{ marginTop: 4 }}>Meet the wider Flic’d community</h2><div className="stack" style={{ marginTop: 12 }}>{global.map((person) => <PersonCard key={person.id} person={person} />)}</div></section>
  </div>;
}
