import { COMPANION_PRESET_COSTUMES, COMPANION_SEASONAL_COSTUMES } from "./companionCostumes.js";

// Keep the original five row identifiers stable; every other outfit now has art.
export const COMPANION_SPRITE_ROWS = Object.freeze([
  ...COMPANION_PRESET_COSTUMES,
  ...Object.values(COMPANION_SEASONAL_COSTUMES).flat(),
].map(({ value }) => Object.freeze({ costume: value, season: "none" })).concat([
  { costume: "none", season: "halloween" },
  { costume: "hero", season: "halloween" },
  { costume: "speedster", season: "halloween" },
  { costume: "cosmic", season: "halloween" },
  { costume: "none", season: "christmas" },
  { costume: "none", season: "valentines" },
].map(Object.freeze)));

export const COMPANION_SPRITE = Object.freeze({
  url: "/companion/companion-fitted-sprite.svg",
  frameWidth: 96,
  frameHeight: 72,
  frames: 12,
  walkFrames: 10,
  width: 1152,
  height: COMPANION_SPRITE_ROWS.length * 72,
});

export function getCompanionSpriteRow(costume, season = "none") {
  const seasonalRow = COMPANION_SPRITE_ROWS.findIndex((row) => row.costume === costume && row.season === season);
  if (seasonalRow >= 0) return seasonalRow;
  const row = COMPANION_SPRITE_ROWS.findIndex((row) => row.costume === costume && row.season === "none");
  return row >= 0 ? row : 0;
}
