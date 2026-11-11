import React from "react";
import "../../../styles.css";
import "../../../mobile.css";
import "../CompanionCostume.css";
import AppShell from "../../../app/AppShell.jsx";
import CompanionSettings from "../CompanionSettings.jsx";
import { saveCompanionSettings } from "../companionStorage.js";
import { setShellCalendar } from "./appShellClock.mjs";

const initial = { enabled: true, name: "Calendar Buddy", costume: "none", animation: "sit", reactions: true };
const userId = "companion-shell-calendar-fixture";
saveCompanionSettings(userId, initial);

export default function AppShellFixture() {
  const [scenario, setScenario] = React.useState({ key: 0, settings: initial });
  React.useEffect(() => {
    window.companionQA = {
      reset: (parts, settings = initial) => {
        setShellCalendar(parts);
        saveCompanionSettings(userId, settings);
        setScenario(current => ({ key: current.key + 1, settings }));
      },
      recover: (parts, event = "focus") => {
        setShellCalendar(parts);
        if (event === "visibilitychange") document.dispatchEvent(new Event(event));
        else window.dispatchEvent(new Event(event));
      },
    };
    return () => { delete window.companionQA; };
  }, []);
  const update = (settings) => {
    saveCompanionSettings(userId, settings);
    setScenario(current => ({ ...current, settings }));
  };
  return <AppShell key={scenario.key} userId={userId} screen="profile" onNavigate={() => {}} onCapture={() => {}}>
    <section className="screen qa-gallery">
      <h1>Real AppShell · Companion calendar regression</h1>
      <p>Real dock, Settings and navigation; synthetic calendar and onboarding readiness only.</p>
      <CompanionSettings value={scenario.settings} onChange={update} />
    </section>
  </AppShell>;
}
