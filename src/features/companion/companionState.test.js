import { describe, expect, it } from "vitest";
import {
  COMPANION_MODES,
  DEFAULT_COMPANION_STATE,
  clampCompanionPosition,
  getCompanionStorageKey,
  getRandomCompanionTarget,
  moveCompanionToward,
} from "./companionState.js";

describe("companion state", () => {
  it("clamps positions to the playable bounds", () => {
    expect(clampCompanionPosition({ x: -10, y: 130 })).toEqual({ x: 8, y: 82 });
  });

  it("moves toward a target without leaving bounds", () => {
    expect(moveCompanionToward({ x: 10, y: 10 }, { x: 50, y: 30 }, 20)).toEqual({ x: 27.88854381999832, y: 18.94427190999916 });
  });

  it("generates a bounded target", () => {
    const target = getRandomCompanionTarget({ x: 50, y: 50 }, () => 0.9);
    expect(target.x).toBeGreaterThanOrEqual(8);
    expect(target.x).toBeLessThanOrEqual(92);
    expect(target.y).toBeGreaterThanOrEqual(18);
    expect(target.y).toBeLessThanOrEqual(82);
  });

  it("uses a user-scoped storage key", () => {
    expect(getCompanionStorageKey("user-123")).toBe("flicd:companion:user-123");
  });

  it("defines active and quiet modes", () => {
    expect(COMPANION_MODES).toEqual({ ACTIVE: "active", QUIET: "quiet" });
    expect(DEFAULT_COMPANION_STATE.mode).toBe("active");
  });
});
