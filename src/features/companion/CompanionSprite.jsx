import React from "react";
import { COMPANION_SPRITE, getCompanionSpriteRow } from "./companionSprite.js";
import "./Companion.css";

// Settings and the equipped character use one unscaled frame and one mapping.
export default function CompanionSprite({ costume = "none", seasonalEventId, pose = "idle", preview = false }) {
  return (
    <span
      className={`capybara-pixel-sprite companion-costume-${costume}${preview ? " companion-preview-sprite" : ""}`}
      data-testid={preview ? "companion-preview-sprite" : "capybara-pixel-sprite"}
      data-sprite-style="retro-16bit"
      data-leg-detail="visible"
      data-walk-frames={COMPANION_SPRITE.walkFrames}
      data-sprite-sheet={`${COMPANION_SPRITE.width}x${COMPANION_SPRITE.height}`}
      data-costume={costume}
      data-pose={pose}
      data-seasonal-event={seasonalEventId || "none"}
      style={{ "--sprite-row": getCompanionSpriteRow(costume, seasonalEventId) }}
      aria-hidden="true"
    />
  );
}
