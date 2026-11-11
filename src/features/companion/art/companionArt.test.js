// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { COMPANION_SPRITE_ROWS, COMPANION_SPRITE, getCompanionSpriteRow } from "../companionSprite.js";
import { renderFittedFrame, getFittedPose, buildFittedSheet } from "./companionArt.js";
import { renderPrototypeSprite } from "../prototype/costumePrototype.js";

const sheet = readFileSync("public/companion/companion-sprite.svg", "utf8");
const definitions = sheet.match(/<defs>([\s\S]*?)<\/defs>/)[1];
const parse = (svg) => new DOMParser().parseFromString(svg, "image/svg+xml");

describe("fitted Companion art", () => {
  it("preserves every approved reference and original base asset byte-for-byte", () => {
    const manifest = JSON.parse(readFileSync("src/features/companion/visual-tests/approved-manifest.json", "utf8"));
    for (const [path, hash] of Object.entries(manifest)) {
      expect(createHash("sha256").update(readFileSync(path)).digest("hex"), path).toBe(hash);
    }
  });

  it.each(["hero", "santa", "witch"])("retains the approved %s layers in every frame", (costume) => {
    for (let frame = 0; frame < 12; frame += 1) {
      const options = { costume, frame, definitions, id: "reference" };
      expect(parse(renderFittedFrame(options)).documentElement.outerHTML.replace(/>\s+</g, "><"))
        .toBe(parse(renderPrototypeSprite(options)).documentElement.outerHTML.replace(/>\s+</g, "><"));
    }
  });

  it.each(COMPANION_SPRITE_ROWS)("fits $costume / $season in all twelve frames", ({ costume, season }) => {
    for (let frame = 0; frame < 12; frame += 1) {
      const doc = parse(renderFittedFrame({ costume, season, frame, definitions, id: "case" }));
      expect(doc.querySelector("parsererror")).toBeNull();
      const layers = Array.from(doc.documentElement.children).map((node) => node.dataset.layer).filter(Boolean);
      expect(layers.indexOf("rear")).toBeLessThan(layers.indexOf("base"));
      expect(layers.indexOf("ear")).toBeGreaterThan(layers.indexOf("headwear"));
      expect(doc.querySelector('[data-layer="base"]').getAttribute("href")).toBe(`#${getFittedPose(frame).base}`);
      expect(doc.querySelector('[data-layer="headwear"]').getAttribute("transform"))
        .toBe(`translate(${getFittedPose(frame).head.join(" ")})`);
      expect(doc.querySelector("linearGradient, filter")).toBeNull();
    }
  });

  it("maps every costume to distinct art and limits seasonal substitutions to defined variations", () => {
    expect(COMPANION_SPRITE_ROWS).toHaveLength(22);
    expect(COMPANION_SPRITE.height).toBe(1584);
    for (let row = 0; row < COMPANION_SPRITE_ROWS.length; row += 1) {
      const { costume, season } = COMPANION_SPRITE_ROWS[row];
      expect(getCompanionSpriteRow(costume, season)).toBe(row);
    }
    expect(getCompanionSpriteRow("invalid", "christmas")).toBe(0);
    expect(getCompanionSpriteRow("santa", "halloween")).toBe(1);
  });

  it("builds a deterministic sheet with an individually clipped cell for every costume frame", () => {
    const built = buildFittedSheet(sheet);
    const doc = parse(built);
    expect(doc.querySelector("parsererror")).toBeNull();
    expect(doc.documentElement.getAttribute("viewBox")).toBe("0 0 1152 1584");
    expect(doc.querySelectorAll("svg[data-frame]")).toHaveLength(264);
    const ids = Array.from(doc.querySelectorAll("[id]")).map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(built).toBe(buildFittedSheet(sheet));
  });
});
