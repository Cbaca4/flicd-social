import { afterEach, describe, expect, it, vi } from "vitest";
import { searchGifs } from "./giphyApi.js";

describe("GIPHY API", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes GIPHY search results", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{
          id: "1",
          title: "wave",
          images: {
            fixed_width: {
              url: "https://giphy.test/preview.gif",
              width: "200",
              height: "150",
            },
            original: {
              url: "https://giphy.test/full.gif",
            },
          },
        }],
      }),
    }));

    await expect(searchGifs("hello", { apiKey: "test" })).resolves.toEqual([
      {
        id: "1",
        title: "wave",
        previewUrl: "https://giphy.test/preview.gif",
        fullUrl: "https://giphy.test/full.gif",
        width: 200,
        height: 150,
      },
    ]);
  });

  it("encodes the query and requests a general-audience rating", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    }));

    await searchGifs("cat & dog", { apiKey: "test", limit: 12 });

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("q=cat%20%26%20dog"));
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("rating=pg-13"));
  });

  it("fails clearly when no API key is configured", async () => {
    await expect(searchGifs("cats", { apiKey: "" })).rejects.toThrow(/GIPHY is not configured/i);
  });
});
