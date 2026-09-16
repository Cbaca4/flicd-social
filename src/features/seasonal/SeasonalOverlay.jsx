import React from "react";
import { getActiveSeasonalEvent } from "./seasonalEvents.js";

const SNOW = Array.from({ length: 34 }, (_, index) => ({
  left: `${(index * 29) % 100}%`,
  delay: `${(index % 9) * 0.55}s`,
  duration: `${5 + (index % 5)}s`,
  size: `${4 + (index % 4)}px`,
}));

export default function SeasonalOverlay() {
  const event = getActiveSeasonalEvent();
  const [reaction, setReaction] = React.useState(false);
  if (!event) return null;

  const christmas = event.id === "christmas";
  const effect = event.environment.effect;

  return (
    <div className={`seasonal-overlay seasonal-${event.id}`} aria-label={`${event.label} seasonal decoration`}>
      {effect === "snow" && (
        <div className="seasonal-snow" aria-hidden="true">
          {SNOW.map((flake, index) => <i key={index} style={flake} />)}
        </div>
      )}
      <div className="seasonal-shelf" aria-hidden="true" />
      <button type="button" className={`seasonal-character ${reaction ? "is-reacting" : ""}`} onClick={() => setReaction((value) => !value)} aria-label={`Seasonal character: ${reaction ? "celebrating" : "interact"}`}>
        <span className="seasonal-character-body">●</span>
        {christmas && <span className="seasonal-hat">🎅</span>}
        <span className="seasonal-character-bubble">{reaction ? "✨" : event.interaction.target === "snow" ? "❄️" : "🎁"}</span>
      </button>
    </div>
  );
}
