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
    const next = moveCompanionToward({ x: 10, y: 20 }, { x: 50, y: 40 }, 20);
    expect(next.x).toBeCloseTo(27.8885, 3);
    expect(next.y).toBeCloseTo(28.9443, 3);
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
