import { describe, expect, it } from "vitest";
import { getSeasonalProfileTheme } from "./seasonalProfileTheme.js";

describe("seasonal profile themes", () => {
  it("layers the active holiday accent and decoration onto a user theme", () => {
    const theme = getSeasonalProfileTheme({ accent: "#46dac8", message: "hello" }, new Date(2026, 11, 25));
    expect(theme.accent).toBe("#d94b5b");
    expect(theme.seasonalEvent).toBe("christmas");
    expect(theme.seasonalDecoration).toBe("evergreen");
  });
});
