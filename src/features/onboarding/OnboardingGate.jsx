import React from "react";
import { ensureCurrentProfile } from "../social/socialApi.js";
import { InterestsStep, SuggestedFollowersStep } from "./Onboarding.jsx";

export default function OnboardingGate({ children }) {
  const [profile, setProfile] = React.useState(null);
  const [step, setStep] = React.useState("loading");

  React.useEffect(() => {
    let cancelled = false;
    ensureCurrentProfile().then((data) => {
      if (cancelled) return;
      setProfile(data);
      setStep(data.onboarding_completed ? "complete" : "interests");
    }).catch((error) => {
      console.error("Failed to load onboarding profile:", error);
      if (!cancelled) setStep("complete");
    });
    return () => { cancelled = true; };
  }, []);

  if (step === "loading") return <div className="onboarding-shell"><div className="onboarding-card"><div className="eyebrow">Flic'd</div><h1 className="title" style={{ marginTop: 8 }}>Getting things ready…</h1></div></div>;
  if (step === "interests") return <InterestsStep initialInterests={profile?.interests || []} onContinue={() => setStep("suggested")} />;
  if (step === "suggested") return <SuggestedFollowersStep onComplete={() => setStep("complete")} />;
  return children;
}
