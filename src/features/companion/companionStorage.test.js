import { beforeEach, describe, expect, it } from "vitest";
import { loadCompanionState, saveCompanionState } from "./companionStorage.js";
import { COMPANION_MODES } from "./companionState.js";

beforeEach(() => localStorage.clear());

describe("companion storage", () => {
  it("returns defaults when nothing is stored", () => {
    expect(loadCompanionState("u1").mode).toBe(COMPANION_MODES.ACTIVE);
  });

  it("round trips a valid state", () => {
    saveCompanionState("u1", { x: 42, y: 55, mode: COMPANION_MODES.QUIET });
    expect(loadCompanionState("u1")).toEqual({ x: 42, y: 55, mode: COMPANION_MODES.QUIET });
  });

  it("sanitizes malformed persisted values", () => {
    localStorage.setItem("flicd:companion:u1", JSON.stringify({ x: 500, y: -9, mode: "broken" }));
    expect(loadCompanionState("u1")).toMatchObject({ mode: COMPANION_MODES.ACTIVE });
    expect(loadCompanionState("u1").x).toBeLessThanOrEqual(92);
    expect(loadCompanionState("u1").y).toBeGreaterThanOrEqual(18);
  });
});
