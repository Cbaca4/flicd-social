import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, sanitizeProfileTheme } from "./profileTheme.js";

describe("profile theme background framing", () => {
  it("adds safe framing defaults to legacy background media", () => {
    const theme = sanitizeProfileTheme({
      backgroundMedia: {
        url: "https://cdn.example/background.jpg",
        type: "image",
      },
    });

    expect(theme.backgroundMedia).toMatchObject({
      url: "https://cdn.example/background.jpg",
      type: "image",
      positionX: 50,
      positionY: 50,
      scale: 1,
    });
  });

  it("clamps background framing values", () => {
    const theme = sanitizeProfileTheme({
      ...DEFAULT_THEME,
      backgroundMedia: {
        url: "https://cdn.example/background.jpg",
        type: "image",
        positionX: 140,
        positionY: -20,
        scale: 2.5,
      },
    });

    expect(theme.backgroundMedia.positionX).toBe(100);
    expect(theme.backgroundMedia.positionY).toBe(0);
    expect(theme.backgroundMedia.scale).toBe(1.6);
  });
});


describe("profile presentation controls", () => {
  it("accepts a continuous global roundness value", () => {
    const theme = sanitizeProfileTheme({ ...DEFAULT_THEME, radius: 31 });
    expect(theme.radius).toBe(31);
    expect(theme.profileLinks).toEqual([]);
  });

  it("sanitizes clickable profile links", () => {
    const theme = sanitizeProfileTheme({
      profileLinks: [
        { label: "Site", url: "example.com" },
        { label: "Bad", url: "javascript:alert(1)" },
      ],
    });
    expect(theme.profileLinks).toEqual([{ label: "Site", url: "https://example.com" }]);
  });
});
