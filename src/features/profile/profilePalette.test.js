import { describe, expect, it } from "vitest";
import { getProfileImageAccent } from "./profilePalette.js";

describe("profile background accent sampling", () => {
  it("uses a bright muted hue from a colorful photo", () => {
    const accent = getProfileImageAccent(
      new Uint8ClampedArray([255, 70, 40, 255, 255, 80, 45, 255]),
    );
    expect(accent).toMatch(/^hsl\(\d+ 61% 72%\)$/);
  });

  it("falls back to the brand when no colorful opaque pixels are available", () => {
    expect(getProfileImageAccent(null)).toBeNull();
    expect(getProfileImageAccent(new Uint8ClampedArray([100, 100, 100, 255]))).toBeNull();
    expect(getProfileImageAccent(new Uint8ClampedArray([0, 90, 255, 0]))).toBeNull();
  });

  it("stays in a safe visible lightness band for blue scenery", () => {
    expect(getProfileImageAccent(new Uint8ClampedArray([35, 90, 220, 255]))).toMatch(/^hsl\(\d+ 61% 72%\)$/);
  });
});
