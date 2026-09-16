import { describe, expect, it } from "vitest";
import { getActiveSeasonalEvent } from "./seasonalEvents.js";

describe("seasonal events", () => {
  it("activates Christmas across the Christmas date window", () => {
    expect(getActiveSeasonalEvent(new Date(2026, 11, 25))?.id).toBe("christmas");
  });

  it("keeps seasonal behavior data-driven", () => {
    const event = getActiveSeasonalEvent(new Date(2026, 9, 31));
    expect(event?.environment.effect).toBe("leaves");
    expect(event?.interaction.target).toBe("candy");
  });
});
