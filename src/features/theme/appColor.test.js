import { describe, expect, it } from "vitest";
import { accessibleAccent, appColorCssVars, sanitizeAppColor } from "./appColor.js";

describe("per-account application colors", () => {
  it("clamps hostile or malformed saved color values", () => {
    expect(sanitizeAppColor({ enabled: true, hue: 9999, intensity: -5, mode: "unexpected" }))
      .toEqual({ enabled: true, hue: 360, intensity: 20, mode: "dark" });
  });
  it("keeps default brand tokens when disabled", () => {
    expect(appColorCssVars({ enabled: false, hue: 200 })).toEqual({});
  });
  it("uses distinct scoped colors and readable accents in dark and light modes", () => {
    for (const mode of ["dark", "light"]) {
      for (const hue of [0, 40, 110, 180, 245, 320, 360]) {
        const color = { enabled: true, hue, intensity: 90, mode };
        const vars = appColorCssVars(color);
        expect(vars["--amber"]).toContain("hsl(");
        expect(vars["--flicd-global-accent"]).toBe(vars["--amber"]);
        expect(accessibleAccent(hue, 90, mode).contrast).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
