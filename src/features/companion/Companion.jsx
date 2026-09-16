import React from "react";
import "./Companion.css";
import "./Companion.motion.css";
import { COMPANION_COSTUMES } from "./CompanionSettings.jsx";
import { loadCompanionSettings } from "./companionStorage.js";

const TALK_LINES = [
  "just vibin' 🦫",
  "hey, what's up?",
  "tiny break?",
  "look at us go",
];

const COSTUME_ICONS = Object.fromEntries(COMPANION_COSTUMES.map((item) => [item.value, item.emoji]));
const REACTION_ICONS = { snow: "❄️", candy: "🍬", heart: "💗" };

function getSeasonalReaction(seasonalEvent) {
  return REACTION_ICONS[seasonalEvent?.interaction?.target] || "✨";
}

function Capybara({ costume }) {
  const costumeIcon = COSTUME_ICONS[costume] || "🦫";
  return (
    <span className="capybara-body" aria-hidden="true">
      {costume !== "none" && <span className="capybara-costume" aria-hidden="true">{costumeIcon}</span>}
      <span className="capybara-ear capybara-ear-left" />
      <span className="capybara-ear capybara-ear-right" />
      <span className="capybara-eye capybara-eye-left" />
      <span className="capybara-eye capybara-eye-right" />
      <span className="capybara-snout"><span className="capybara-nose" /></span>
      <span className="capybara-foot capybara-foot-left" />
      <span className="capybara-foot capybara-foot-right" />
    </span>
  );
}

export default function Companion({ userId, seasonalEvent = null }) {
  const [settings, setSettings] = React.useState(() => loadCompanionSettings(userId));
  const [reaction, setReaction] = React.useState("");
  const [talkLineIndex, setTalkLineIndex] = React.useState(0);

  React.useEffect(() => {
    setSettings(loadCompanionSettings(userId));
  }, [userId]);

  React.useEffect(() => {
    const handleSettingsChange = (event) => {
      if (event?.detail) setSettings(event.detail);
      else setSettings(loadCompanionSettings(userId));
    };
    window.addEventListener("flicd:companion-settings", handleSettingsChange);
    return () => window.removeEventListener("flicd:companion-settings", handleSettingsChange);
  }, [userId]);

  React.useEffect(() => {
    if (!settings.enabled || settings.animation !== "talk" || !settings.bubbles) return undefined;
    const timer = window.setInterval(() => setTalkLineIndex((current) => (current + 1) % TALK_LINES.length), 4200);
    return () => window.clearInterval(timer);
  }, [settings.enabled, settings.animation, settings.bubbles]);

  React.useEffect(() => {
    if (!reaction) return undefined;
    const timer = window.setTimeout(() => setReaction(""), 1200);
    return () => window.clearTimeout(timer);
  }, [reaction]);

  if (!settings.enabled) return null;

  const isWalking = settings.animation === "walk";
  const isSitting = settings.animation === "sit";
  const isTalking = settings.animation === "talk";
  const seasonalReaction = getSeasonalReaction(seasonalEvent);

  return (
    <div className="companion-zone" data-testid="companion-zone" aria-label="Companion area">
      <div className={`companion-walker companion-${settings.animation}`}>
        {isTalking && settings.bubbles && (
          <span className="companion-talk" aria-live="polite">{TALK_LINES[talkLineIndex]}</span>
        )}
        {reaction && settings.reactions && <span className="companion-reaction" aria-live="polite">{reaction}</span>}
        <button
          type="button"
          className="companion-character"
          aria-label={`${settings.name} the capybara companion`}
          onClick={() => {
            if (settings.reactions) setReaction(seasonalEvent ? seasonalReaction : "✨");
          }}
        >
          <Capybara costume={settings.costume} />
        </button>
      </div>
      {isWalking && <span className="companion-path" aria-hidden="true" />}
      {!isSitting && !isTalking && <span className="companion-nameplate" aria-hidden="true">{settings.name}</span>}
    </div>
  );
}
