import { describe, expect, it } from "vitest";
import { assertStagingEnvironment, validateOwnerPath, verifyAfterCopy } from "../../../scripts/migrate-legacy-media-staging.mjs";
import { createHash } from "node:crypto";

const environment = {
  SUPABASE_URL: "https://staging-abcdef.supabase.co",
  FLICD_STAGING_PROJECT_REF: "staging-abcdef",
  SUPABASE_SERVICE_ROLE_KEY: "test-placeholder-not-a-credential",
};

describe("legacy private-media staging safeguards", () => {
  const record = { path: "owner/photo.png", destination: "flicd-dump-private" };
  function storageWith(source, destination) {
    return { storage: { from: (bucket) => ({ download: async () => ({
      data: new Blob([bucket === "flicd-media" ? source : destination]), error: null,
    }) }) } };
  }

  it("rejects a corrupted destination even when it is a downloadable object", async () => {
    await expect(verifyAfterCopy(storageWith("original", "corrupted"), record)).rejects.toThrow(/hash mismatch/i);
  });

  it("verifies identical source and destination bytes", async () => {
    await expect(verifyAfterCopy(storageWith("original", "original"), record)).resolves.toBeDefined();
  });

  it("uses the recorded source checksum after public-source retirement", async () => {
    const sha256 = createHash("sha256").update("original").digest("hex");
    await expect(verifyAfterCopy(storageWith("removed", "original"), { ...record, sha256 })).resolves.toBe(sha256);
    await expect(verifyAfterCopy(storageWith("removed", "corrupted"), { ...record, sha256 })).rejects.toThrow(/hash mismatch/i);
  });

  it("allows only the exact explicitly selected staging project", () => {
    expect(assertStagingEnvironment(environment).endpoint).toBe(environment.SUPABASE_URL);
  });

  it("rejects the existing production project even if listed as staging", () => {
    const liveRef = "xbmfphdetgmjzqnxhmgp";
    expect(() => assertStagingEnvironment({
      ...environment,
      SUPABASE_URL: `https://${liveRef}.supabase.co`,
      FLICD_STAGING_PROJECT_REF: liveRef,
    })).toThrow(/refusing/i);
  });

  it("rejects a mismatched, spoofed or non-HTTPS staging endpoint", () => {
    expect(() => assertStagingEnvironment({
      ...environment,
      FLICD_STAGING_PROJECT_REF: "another-ref",
    })).toThrow(/refusing/i);
    expect(() => assertStagingEnvironment({
      ...environment,
      SUPABASE_URL: "https://staging-abcdef.supabase.co.evil.test",
    })).toThrow(/only hosted staging/i);
    expect(() => assertStagingEnvironment({
      ...environment,
      SUPABASE_URL: "http://staging-abcdef.supabase.co",
    })).toThrow(/only hosted staging/i);
  });

  it("rejects mismatched ownership and path traversal", () => {
    expect(() => validateOwnerPath("other-user/photo.jpg", "owner-user")).toThrow();
    expect(() => validateOwnerPath("owner-user/../../secret", "owner-user")).toThrow();
    expect(() => validateOwnerPath("/owner-user/file.jpg", "owner-user")).toThrow();
    expect(() => validateOwnerPath("owner-user/photo.jpg", "owner-user")).not.toThrow();
  });
});
