import { describe, expect, it, vi } from "vitest";
import { assertIntegrationEnvironment, assertDummyManifest, purgeDummySource, requireDenied, requireHttpDenied, waitForPublicRetirement, sha256, STAGING_REF, STAGING_URL } from "../../scripts/privacy-staging-support.mjs";

const env = { FLICD_STAGING_PROJECT_REF: STAGING_REF, FLICD_STAGING_CONFIRM: "SYNTHETIC_ONLY", FLICD_STAGING_PUBLIC_KEY: "public-placeholder", FLICD_STAGING_SECRET_KEY: "backend-placeholder" };
const ownerId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const runId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const record = { ownerId, path: `${ownerId}/privacy-staging/${runId}/legacy-dump.png`, destination: "flicd-dump-private", sha256: sha256(Buffer.from("dummy")) };

function fakeStorage({ references = [], destination = "dummy", original = "dummy", removalWorks = true } = {}) {
  let removed = false;
  const remove = vi.fn(async () => { if (removalWorks) removed = true; return { error: null }; });
  const client = {
    supabaseUrl: STAGING_URL,
    from: () => ({ select: () => ({ eq: () => ({ eq: async () => ({ data: references, error: null }) }) }) }),
    storage: { from: (bucket) => ({
      remove,
      download: async () => bucket === "flicd-media" && removed
        ? { data: null, error: { status: 400, message: "Object not found" } }
        : { data: new Blob([bucket === "flicd-media" ? original : destination]), error: null },
    }) },
  };
  return { client, remove };
}

describe("hosted staging integration safeguards", () => {
  it("requires the exact reviewed staging ref and explicit synthetic confirmation", () => {
    expect(assertIntegrationEnvironment(env)).toBe(STAGING_URL);
    for (const patch of [{ FLICD_STAGING_PROJECT_REF: "xbmfphdetgmjzqnxhmgp" }, { FLICD_STAGING_PROJECT_REF: "another-project" }, { FLICD_STAGING_CONFIRM: "" }, { FLICD_STAGING_SECRET_KEY: "" }, { SUPABASE_URL: "https://other.supabase.co" }]) {
      expect(() => assertIntegrationEnvironment({ ...env, ...patch })).toThrow();
    }
  });
  it("rejects any frontend variable containing the privileged key", () => {
    expect(() => assertIntegrationEnvironment({ ...env, VITE_UNSAFE: env.FLICD_STAGING_SECRET_KEY })).toThrow(/frontend/i);
  });
  it("does not count successful requests, service errors, or transport failures as authorization denials", () => {
    for (const result of [{ error: null }, { error: { status: 500 } }, { error: { message: "fetch failed" } }, { error: { status: 400, message: "malformed payload" } }]) {
      expect(() => requireDenied(result)).toThrow();
    }
    expect(() => requireDenied({ error: { code: "42501", message: "permission denied" } })).not.toThrow();
    expect(() => requireDenied({ error: { status: 400, message: "Object not found" } })).not.toThrow();
  });
  it("accepts Supabase's explicit expired-signature error without accepting arbitrary HTTP 400", async () => {
    await expect(requireHttpDenied(new Response(JSON.stringify({ statusCode: "400", error: "InvalidJWT", message: '"exp" claim timestamp check failed' }), { status: 400 }))).resolves.toBeUndefined();
    for (const payload of [{ statusCode: "400", error: "BadRequest" }, { statusCode: "400", error: "InvalidJWT", message: "invalid signature" }]) {
      await expect(requireHttpDenied(new Response(JSON.stringify(payload), { status: 400 }))).rejects.toThrow();
    }
    await expect(requireHttpDenied(new Response(JSON.stringify({ statusCode: "404" }), { status: 400 }))).resolves.toBeUndefined();
    await expect(requireHttpDenied(new Response("unavailable", { status: 503 }))).rejects.toThrow();
    await expect(requireHttpDenied(new Response("bytes", { status: 200 }))).rejects.toThrow();
  });
});

describe("separate dummy-source retirement", () => {
  it("waits for actual public URL denial after a stale cached success", async () => {
    const fetchImpl=vi.fn().mockResolvedValueOnce(new Response("cached bytes",{status:200}))
      .mockResolvedValueOnce(new Response(JSON.stringify({statusCode:"404"}),{status:400}));
    const waitImpl=vi.fn(async()=>{});
    const result=await waitForPublicRetirement("https://example.test/dummy",{fetchImpl,waitImpl,deadlineMs:1000,pollMs:1000});
    expect(result.initiallyReadable).toBe(true);
    expect(result.attempts).toBe(2);
    expect(waitImpl).toHaveBeenCalledTimes(1);
    expect(waitImpl.mock.calls[0][0]).toBeGreaterThan(0);
    expect(waitImpl.mock.calls[0][0]).toBeLessThanOrEqual(1000);
  });
  it("fails if the public URL remains readable or a server error occurs", async () => {
    const alwaysReadable=async()=>new Response("cached bytes",{status:200});
    await expect(waitForPublicRetirement("https://example.test/dummy",{fetchImpl:alwaysReadable,waitImpl:async()=>{},deadlineMs:1000,pollMs:1000})).rejects.toThrow(/remains readable/);
    await expect(waitForPublicRetirement("https://example.test/dummy",{fetchImpl:async()=>new Response("error",{status:503})})).rejects.toThrow(/503/);
  });
  it("counts network time against the retirement deadline instead of starting another request", async () => {
    const clock=vi.spyOn(Date,"now").mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValue(20);
    const fetchImpl=vi.fn(async()=>new Response("cached bytes",{status:200}));
    const waitImpl=vi.fn(async()=>{});
    try {
      await expect(waitForPublicRetirement("https://example.test/dummy",{fetchImpl,waitImpl,deadlineMs:10,pollMs:10})).rejects.toThrow(/remains readable/);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(waitImpl).not.toHaveBeenCalled();
    } finally {
      clock.mockRestore();
    }
  });
  it("rejects paths outside the exact generated run namespace", () => {
    expect(() => assertDummyManifest(record, runId)).not.toThrow();
    for (const patch of [{ path: `${ownerId}/real-image.png` }, { path: record.path.replace(runId, ownerId) }, { path: record.path.replace("legacy-dump", "../legacy-dump") }, { sha256: "unverified" }, { destination: "flicd-media" }]) {
      expect(() => assertDummyManifest({ ...record, ...patch }, runId)).toThrow();
    }
  });
  it("requires explicit approval and the exact staging project before touching storage", async () => {
    const { client, remove } = fakeStorage();
    await expect(purgeDummySource(client, record, { projectRef: "xbmfphdetgmjzqnxhmgp", runId, approved: true })).rejects.toThrow();
    await expect(purgeDummySource(client, record, { projectRef: STAGING_REF, runId, approved: false })).rejects.toThrow();
    expect(remove).not.toHaveBeenCalled();
  });
  it("refuses a mismatched actual client endpoint even when the caller claims staging", async () => {
    const { client, remove } = fakeStorage();
    client.supabaseUrl = "https://xbmfphdetgmjzqnxhmgp.supabase.co";
    await expect(purgeDummySource(client, record, { projectRef: STAGING_REF, runId, approved: true })).rejects.toThrow(/client|endpoint/i);
    expect(remove).not.toHaveBeenCalled();
  });
  it("rejects malformed UUIDs and non-fixture filenames inside the run prefix", () => {
    const invalidOwner = "-".repeat(36);
    expect(() => assertDummyManifest({ ...record, ownerId: invalidOwner, path: `${invalidOwner}/privacy-staging/${runId}/legacy-dump.png` }, runId)).toThrow();
    expect(() => assertDummyManifest({ ...record, path: record.path.replace("legacy-dump", "legacy-unreviewed") }, runId)).toThrow();
  });
  it("refuses deletion when public references still exist", async () => {
    const { client, remove } = fakeStorage({ references: [{ id: "still-public" }] });
    await expect(purgeDummySource(client, record, { projectRef: STAGING_REF, runId, approved: true })).rejects.toThrow(/Public references remain/);
    expect(remove).not.toHaveBeenCalled();
  });
  it("refuses deletion when either source or private checksum differs", async () => {
    for (const patch of [{ destination: "corrupt" }, { original: "changed" }]) {
      const { client, remove } = fakeStorage(patch);
      await expect(purgeDummySource(client, record, { projectRef: STAGING_REF, runId, approved: true })).rejects.toThrow();
      expect(remove).not.toHaveBeenCalled();
    }
  });
  it("requires readback to prove deletion rather than trusting a successful remove call", async () => {
    const { client } = fakeStorage({ removalWorks: false });
    await expect(purgeDummySource(client, record, { projectRef: STAGING_REF, runId, approved: true })).rejects.toThrow(/unexpectedly succeeded/);
  });
  it("removes only the exact proven dummy path and verifies the private copy survives", async () => {
    const { client, remove } = fakeStorage();
    await expect(purgeDummySource(client, record, { projectRef: STAGING_REF, runId, approved: true })).resolves.toBeUndefined();
    expect(remove).toHaveBeenCalledExactlyOnceWith([record.path]);
  });
});
