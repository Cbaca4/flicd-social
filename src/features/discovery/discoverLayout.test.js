import { describe, expect, it } from "vitest";
import { buildExploreLayout } from "./discoverLayout.js";

describe("Discover mosaic layout", () => {
  it("gives Rolls an anchor span while preserving standard tiles", () => {
    const items = [
      { id: "p1", type: "dump", recommendationScore: 0.9 },
      { id: "r1", type: "roll", recommendationScore: 0.8 },
      { id: "p2", type: "dump", recommendationScore: 0.7 },
      { id: "p3", type: "dump", recommendationScore: 0.6 },
    ];

    const layout = buildExploreLayout(items);

    expect(layout.some((item) => item.id === "r1" && item.layout === "tall" && item.spanRows === 2)).toBe(true);
    expect(layout.filter((item) => item.layout === "standard").length).toBeGreaterThan(0);
  });
});
