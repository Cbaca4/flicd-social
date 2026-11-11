// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { getPrototypePose, renderPrototypeSprite } from "./costumePrototype.js";

const sheet = readFileSync("public/companion/companion-sprite.svg", "utf8");
const definitions = sheet.match(/<defs>([\s\S]*?)<\/defs>/)[1];

function sprite(costume, frame) {
  const source = renderPrototypeSprite({ costume, frame, definitions, id: `test-${costume}-${frame}` });
  return new DOMParser().parseFromString(source, "image/svg+xml");
}

describe("Companion costume fit prototype", () => {
  it("preserves the approved comparison's archived stylesheet order", () => {
    const html = readFileSync("src/features/companion/prototype/index.html", "utf8");
    expect(html.indexOf('href="./legacy/CompanionCostume.css"')).toBeLessThan(html.indexOf('href="./legacy/Companion.css"'));
  });

  it("tracks the existing walking body bob and both distinct seated head positions", () => {
    expect(Array.from({ length: 10 }, (_, frame) => getPrototypePose(frame).head))
      .toEqual([[0, 0], [0, -1], [0, 0], [0, 1], [0, 0], [0, -1], [0, 0], [0, 1], [0, 0], [0, -1]]);
    expect(getPrototypePose(10).head).toEqual([2, 4]);
    expect(getPrototypePose(11).head).toEqual([3, 5]);
    expect(getPrototypePose(10).torso).not.toEqual(getPrototypePose(0).torso);
    expect(getPrototypePose(11).torso).not.toEqual(getPrototypePose(10).torso);
  });

  it.each(["hero", "santa", "witch"])("fits %s to all twelve frames with explicit occlusion", (costume) => {
    for (let frame = 0; frame < 12; frame += 1) {
      const doc = sprite(costume, frame);
      const pose = getPrototypePose(frame);
      expect(doc.querySelector("parsererror")).toBeNull();
      expect(doc.querySelector('[data-layer="base"]').getAttribute("href")).toBe(`#${pose.base}`);
      expect(doc.querySelector('[data-layer="headwear"]').getAttribute("transform"))
        .toBe(`translate(${pose.head.join(" ")})`);
      expect(doc.querySelector('[data-layer="clothing"]').getAttribute("clip-path"))
        .toBe(`url(#test-${costume}-${frame}-torso)`);
      expect(doc.querySelector('[data-layer="ear"]')).not.toBeNull();
      const layers = Array.from(doc.documentElement.children).map((node) => node.getAttribute("data-layer")).filter(Boolean);
      expect(layers.indexOf("rear")).toBeLessThan(layers.indexOf("base"));
      expect(layers.indexOf("ear")).toBeGreaterThan(layers.indexOf("headwear"));
      expect(doc.querySelector("linearGradient, filter")).toBeNull();
    }
  });

  it("keeps the second seated shoulder inside the original silhouette", () => {
    const doc = sprite("santa", 11);
    const shoulder = doc.querySelector("clipPath polygon").getAttribute("points");
    expect(shoulder).toContain("27,35");
    expect(shoulder).not.toContain("26,35");
  });

  it("rejects unsupported frames, costumes, and unsafe generated identifiers", () => {
    for (const frame of [-1, 12, 0.5, NaN]) expect(() => getPrototypePose(frame)).toThrow(RangeError);
    expect(() => renderPrototypeSprite({ costume: "ghost", frame: 0, definitions, id: "safe" })).toThrow(RangeError);
    expect(() => renderPrototypeSprite({ costume: "hero", frame: 0, definitions, id: '" onload="bad' })).toThrow(TypeError);
  });
});
