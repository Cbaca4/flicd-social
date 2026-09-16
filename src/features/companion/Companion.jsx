import React from "react";

import "./Companion.css";

import { getActiveSeasonalEvent } from "../seasonal/seasonalEvents.js";
import { loadCompanionSettings } from "./companionStorage.js";
import { COMPANION_COSTUMES } from "./companionSettingsConfig.js";
import { getCompanionReactions } from "./companionCostumes.js";

const SPRITE_ROWS = {
  none: 0,
  santa: 1,
  ghost: 2,
  witch: 3,
  valentine: 4,
};

const PATROL_MIN_POSITION = 10;
const PATROL_MAX_POSITION = 73;
const PATROL_START_DELAY = 4500;
const PATROL_MIN_PAUSE = 4000;
const PATROL_MAX_PAUSE = 7000;
const PATROL_MIN_TRAVEL = 16000;
const PATROL_MAX_TRAVEL = 32000;
const PATROL_MS_PER_PERCENT = 400;
const INITIAL_POSITION = 18;

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomItem(items) {
  return items[getRandomInt(0, items.length - 1)] || "✨";
}

function getNextPatrolPosition(currentPosition) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = getRandomInt(PATROL_MIN_POSITION, PATROL_MAX_POSITION);

    if (Math.abs(candidate - currentPosition) >= 18) {
      return candidate;
    }
  }

  return currentPosition < (PATROL_MIN_POSITION + PATROL_MAX_POSITION) / 2
    ? PATROL_MAX_POSITION
    : PATROL_MIN_POSITION;
}

function getPatrolTravelDuration(distance) {
  return Math.min(
    PATROL_MAX_TRAVEL,
    Math.max(
      PATROL_MIN_TRAVEL,
      Math.round(distance * PATROL_MS_PER_PERCENT),
    ),
  );
}

function PixelCapybara({ costume, seasonalEventId }) {
  const spriteRow = SPRITE_ROWS[costume] ?? SPRITE_ROWS.none;

  return (
    <span
      className={`capybara-pixel-sprite companion-costume-${costume}`}
      data-testid="capybara-pixel-sprite"
      data-sprite-style="retro-16bit"
      data-leg-detail="visible"
      data-walk-frames="10"
      data-sprite-sheet="1152x360"
      data-costume={costume}
      data-seasonal-event={seasonalEventId || "none"}
      style={{ "--sprite-row": spriteRow }}
      aria-hidden="true"
    />
  );
}

export default function Companion({ userId, seasonalEvent = null }) {
  const [settings, setSettings] = React.useState(() =>
    loadCompanionSettings(userId),
  );
  const [reaction, setReaction] = React.useState("");
  const [patrol, setPatrol] = React.useState({
    position: INITIAL_POSITION,
    direction: 1,
    motion: "idle",
    travelDuration: 0,
  });

  const patrolPositionRef = React.useRef(INITIAL_POSITION);
  const activeSeasonalEvent = seasonalEvent || getActiveSeasonalEvent();
  const seasonalEventId = activeSeasonalEvent?.id || null;
  const isWalking = settings.animation === "walk";
  const isSitting = settings.animation === "sit";

  React.useEffect(() => {
    setSettings(loadCompanionSettings(userId));
    patrolPositionRef.current = INITIAL_POSITION;
    setPatrol({
      position: INITIAL_POSITION,
      direction: 1,
      motion: "idle",
      travelDuration: 0,
    });
  }, [userId]);

  React.useEffect(() => {
    const handleSettingsChange = (event) => {
      const nextSettings = event?.detail
        ? event.detail
        : loadCompanionSettings(userId);

      if (nextSettings.animation === "sit") {
        setPatrol((current) => ({
          ...current,
          motion: "idle",
          travelDuration: 0,
        }));
      }

      setSettings(nextSettings);
    };

    window.addEventListener("flicd:companion-settings", handleSettingsChange);

    return () =>
      window.removeEventListener(
        "flicd:companion-settings",
        handleSettingsChange,
      );
  }, [userId]);

  React.useEffect(() => {
    if (!settings.enabled || !isWalking) {
      setPatrol((current) => ({
        ...current,
        motion: "idle",
        travelDuration: 0,
      }));
      return undefined;
    }

    let cancelled = false;
    let pauseTimer;
    let travelTimer;

    const clearTimers = () => {
      if (pauseTimer) window.clearTimeout(pauseTimer);
      if (travelTimer) window.clearTimeout(travelTimer);
    };

    const scheduleNextLeg = (delay) => {
      pauseTimer = window.setTimeout(() => {
        if (cancelled) return;

        const currentPosition = patrolPositionRef.current;
        const nextPosition = getNextPatrolPosition(currentPosition);
        const distance = Math.abs(nextPosition - currentPosition);
        const travelDuration = getPatrolTravelDuration(distance);

        patrolPositionRef.current = nextPosition;
        setPatrol({
          position: nextPosition,
          direction: nextPosition >= currentPosition ? 1 : -1,
          motion: "walking",
          travelDuration,
        });

        travelTimer = window.setTimeout(() => {
          if (cancelled) return;

          setPatrol((current) => ({
            ...current,
            motion: "idle",
            travelDuration: 0,
          }));

          scheduleNextLeg(getRandomInt(PATROL_MIN_PAUSE, PATROL_MAX_PAUSE));
        }, travelDuration);
      }, delay);
    };

    scheduleNextLeg(PATROL_START_DELAY);

    return () => {
      cancelled = true;
      clearTimers();
    };
  }, [isWalking, settings.enabled]);

  React.useEffect(() => {
    if (!reaction) return undefined;

    const timer = window.setTimeout(() => setReaction(""), 1600);
    return () => window.clearTimeout(timer);
  }, [reaction]);

  if (!settings.enabled) return null;

  const walkerClassName = [
    "companion-walker",
    `companion-${settings.animation}`,
    `companion-season-${seasonalEventId || "none"}`,
    isWalking ? `companion-motion-${patrol.motion}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const triggerReaction = () => {
    if (!settings.reactions) return;
    setReaction(getRandomItem(getCompanionReactions(seasonalEventId)));
  };

  return (
    <div
      className="companion-zone"
      data-testid="companion-zone"
      data-seasonal-event={seasonalEventId || "none"}
      aria-label="Companion area"
    >
      <div
        className={walkerClassName}
        data-motion-state={isWalking ? patrol.motion : undefined}
        data-movement="continuous"
        data-walk-speed={isWalking ? "slow" : undefined}
        style={{
          "--companion-position": `${patrol.position}%`,
          "--companion-travel-duration": isWalking
            ? `${patrol.travelDuration}ms`
            : "0ms",
          "--capy-facing": patrol.direction,
        }}
      >
        <button
          type="button"
          className="companion-character"
          aria-label={`${settings.name || "Unnamed"} the capybara companion`}
          onClick={triggerReaction}
        >
          <PixelCapybara
            costume={settings.costume}
            seasonalEventId={seasonalEventId}
          />
        </button>
      </div>

      {reaction && settings.reactions && (
        <span
          className="companion-reaction"
          role="status"
          aria-live="polite"
          aria-label={`Companion reaction: ${reaction}`}
          style={{
            "--companion-bubble-position": `${patrol.position}%`,
          }}
        >
          {reaction}
        </span>
      )}

      {isWalking && (
        <span className="companion-path" aria-hidden="true" />
      )}

      {isSitting && (
        <span className="companion-rest-marker" aria-hidden="true" />
      )}
    </div>
  );
}

export { COMPANION_COSTUMES };
