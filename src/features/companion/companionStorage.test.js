// @vitest-environment jsdom

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  loadCompanionSettings,
  loadCompanionState,
  saveCompanionSettings,
  saveCompanionState,
} from "./companionStorage.js";
import { COMPANION_MODES } from "./companionState.js";

beforeEach(() => localStorage.clear());
afterEach(() => vi.useRealTimers());

describe("companion storage", () => {
  it("returns defaults when nothing is stored", () => {
    expect(loadCompanionState("u1").mode).toBe(COMPANION_MODES.ACTIVE);
  });

  it("round trips a valid state", () => {
    saveCompanionState("u1", { x: 42, y: 55, mode: COMPANION_MODES.QUIET });
    expect(loadCompanionState("u1")).toEqual({
      x: 42,
      y: 55,
      mode: COMPANION_MODES.QUIET,
    });
  });

  it("sanitizes malformed persisted values", () => {
    localStorage.setItem(
      "flicd:companion:u1",
      JSON.stringify({ x: 500, y: -9, mode: "broken" }),
    );

    expect(loadCompanionState("u1")).toMatchObject({
      mode: COMPANION_MODES.ACTIVE,
    });
    expect(loadCompanionState("u1").x).toBeLessThanOrEqual(92);
    expect(loadCompanionState("u1").y).toBeGreaterThanOrEqual(18);
  });

  it("allows a seasonal exclusive while its holiday is active", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-20T12:00:00"));

    saveCompanionSettings("u1", {
      enabled: true,
      name: "Buddy",
      costume: "pumpkin-king",
      animation: "walk",
      reactions: true,
    });

    expect(loadCompanionSettings("u1").costume).toBe("pumpkin-king");
  });

  it("expires a seasonal exclusive after the holiday window and scrubs it", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-31T12:00:00"));

    localStorage.setItem(
      "flicd:companion:u1:settings",
      JSON.stringify({
        enabled: true,
        name: "Buddy",
        costume: "pumpkin-king",
        animation: "walk",
        reactions: true,
      }),
    );

    vi.setSystemTime(new Date("2026-11-03T12:00:00"));

    const settings = loadCompanionSettings("u1");

    expect(settings.costume).toBe("none");
    expect(JSON.parse(localStorage.getItem("flicd:companion:u1:settings"))).toMatchObject({
      costume: "none",
    });
  });
});
