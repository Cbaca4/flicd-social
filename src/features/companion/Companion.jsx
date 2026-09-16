import React from "react";
import "./Companion.css";
import "./Companion.motion.css";
import { loadCompanionSettings } from "./companionStorage.js";
import { COMPANION_COSTUMES } from "./companionSettingsConfig.js";

const TALK_LINES = [
  "just vibin' 🦫",
  "hey, what's up?",
  "tiny break?",
  "look at us go",
];

const REACTION_ICONS = {
  snow: "❄️",
  candy: "🍬",
  heart: "💗",
};

const SPRITE_ROWS = {
  none: 0,
  santa: 1,
  ghost: 2,
  witch: 3,
  valentine: 4,
};

function getSeasonalReaction(seasonalEvent) {
  return REACTION_ICONS[seasonalEvent?.interaction?.target] || "✨";
}

function PixelCapybara({ costume }) {
  return (
    <span
      className="capybara-pixel-sprite"
      data-testid="capybara-pixel-sprite"
      style={{
        "--sprite-row": SPRITE_ROWS[costume] ?? SPRITE_ROWS.none,
      }}
      aria-hidden="true"
    />
  );
}

export default function Companion({ userId, seasonalEvent = null }) {
  const [settings, setSettings] = React.useState(() =>
    loadCompanionSettings(userId),
  );
  const [reaction, setReaction] = React.useState("");
  const [talkLineIndex, setTalkLineIndex] = React.useState(0);

  React.useEffect(() => {
    setSettings(loadCompanionSettings(userId));
  }, [userId]);

  React.useEffect(() => {
    const handleSettingsChange = (event) => {
      if (event?.detail) {
        setSettings(event.detail);
      } else {
        setSettings(loadCompanionSettings(userId));
      }
    };

    window.addEventListener(
      "flicd:companion-settings",
      handleSettingsChange,
    );

    return () =>
      window.removeEventListener(
        "flicd:companion-settings",
        handleSettingsChange,
      );
  }, [userId]);

  React.useEffect(() => {
    if (
      !settings.enabled ||
      settings.animation !== "talk" ||
      !settings.bubbles
    ) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setTalkLineIndex(
        (current) => (current + 1) % TALK_LINES.length,
      );
    }, 4200);

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
    <div
      className="companion-zone"
      data-testid="companion-zone"
      aria-label="Companion area"
    >
      <div
        className={`companion-walker companion-${settings.animation}`}
        data-walk-speed={isWalking ? "slow" : undefined}
      >
        {isTalking && settings.bubbles && (
          <span className="companion-talk" aria-live="polite">
            {TALK_LINES[talkLineIndex]}
          </span>
        )}

        {reaction && settings.reactions && (
          <span className="companion-reaction" aria-live="polite">
            {reaction}
          </span>
        )}

        <button
          type="button"
          className="companion-character"
          aria-label={`${settings.name} the capybara companion`}
          onClick={() => {
            if (settings.reactions) {
              setReaction(
                seasonalEvent ? seasonalReaction : "✨",
              );
            }
          }}
        >
          <PixelCapybara costume={settings.costume} />
        </button>
      </div>

      {isWalking && (
        <span className="companion-path" aria-hidden="true" />
      )}

      {!isSitting && !isTalking && (
        <span className="companion-nameplate" aria-hidden="true">
          {settings.name}
        </span>
      )}
    </div>
  );
}

export { COMPANION_COSTUMES };
