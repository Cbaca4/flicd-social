import { describe, expect, it } from "vitest";

describe("media id compatibility", () => {
  it("generates an id without crypto.randomUUID", async () => {
    const { createMediaId } = await import("./mediaUpload.js");
    expect(createMediaId({})).toMatch(/^[a-z0-9]+-[a-z0-9]+$/);
  });
});
