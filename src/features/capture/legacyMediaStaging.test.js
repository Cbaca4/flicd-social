import { describe, expect, it } from "vitest";
import { assertStagingEnvironment, validateOwnerPath } from "../../../scripts/migrate-legacy-media-staging.mjs";

const environment = {
  SUPABASE_URL: "https://staging-abcdef.supabase.co",
  FLICD_STAGING_PROJECT_REF: "staging-abcdef",
  SUPABASE_SERVICE_ROLE_KEY: "test-placeholder-not-a-credential",
};

describe("legacy private-media staging safeguards", () => {
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
