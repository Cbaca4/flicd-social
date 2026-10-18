import { createHash } from "node:crypto";
import { setTimeout as wait } from "node:timers/promises";
import { verifyAfterCopy } from "./migrate-legacy-media-staging.mjs";

export const STAGING_REF = "ljcfoanzmowgkjtrdcgg";
export const STAGING_URL = `https://${STAGING_REF}.supabase.co`;
export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

export function assertIntegrationEnvironment(env) {
  if (env.FLICD_STAGING_PROJECT_REF !== STAGING_REF || env.FLICD_STAGING_CONFIRM !== "SYNTHETIC_ONLY") {
    throw new Error("Explicit isolated staging ref and SYNTHETIC_ONLY confirmation required.");
  }
  if (!env.FLICD_STAGING_PUBLIC_KEY || !env.FLICD_STAGING_SECRET_KEY) {
    throw new Error("Backend-only staging public and secret keys required.");
  }
  // Never accept an arbitrary URL override or a frontend secret variable.
  if (env.SUPABASE_URL && env.SUPABASE_URL !== STAGING_URL) {
    throw new Error("Staging URL override mismatch.");
  }
  for (const [name, value] of Object.entries(env)) {
    if (name.startsWith("VITE_") && value === env.FLICD_STAGING_SECRET_KEY) {
      throw new Error("A privileged key must never be configured as a frontend variable.");
    }
  }
  return STAGING_URL;
}

export function requireDenied(result) {
  if (!result?.error) throw new Error("Unauthorized operation unexpectedly succeeded.");
  const status = Number(result.error.status || result.error.statusCode);
  const code = result.error.code;
  const message = result.error.message || "";
  if (status >= 500 || (!([400, 401, 403, 404].includes(status)) && code !== "42501")) {
    throw new Error("Not a verified authorization denial (possibly a service/transport failure).");
  }
  if (status === 400 && !/not found|row.level security|unauthori[sz]ed|permission|not allowed/i.test(message)) {
    throw new Error("Bad request is not evidence of authorization enforcement.");
  }
}

export async function requireHttpDenied(response) {
  if ([401, 403, 404].includes(response.status)) return;
  if (response.status === 400) {
    const data = await response.json();
    if ([401, 403, 404].includes(Number(data.statusCode))) return;
    if (data.error === "InvalidJWT" && /\bexp\b.*claim.*(?:failed|expired)/i.test(data.message || "")) return;
  }
  throw new Error(`Expected an authorization/not-found response, received HTTP ${response.status}.`);
}

export async function waitForPublicRetirement(url, { fetchImpl = fetch, waitImpl = wait, deadlineMs = 90000, pollMs = 2000 } = {}) {
  if (!Number.isFinite(deadlineMs) || !Number.isFinite(pollMs) || deadlineMs <= 0 || pollMs <= 0) {
    throw new Error("Positive finite retirement deadline and poll interval required.");
  }
  const startedAt = Date.now();
  const deadlineAt = startedAt + deadlineMs;
  let initiallyReadable = false;
  const attempts = Math.ceil(deadlineMs / pollMs) + 1;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const remainingMs = deadlineAt - Date.now();
    if (remainingMs <= 0) break;
    const response = await fetchImpl(url, { headers: { "Cache-Control": "no-cache" }, signal: AbortSignal.timeout(Math.ceil(Math.min(20000, remainingMs))) });
    if (response.status !== 200) {
      await requireHttpDenied(response);
      return { initiallyReadable, attempts: attempt, elapsedMs: Date.now() - startedAt };
    }
    await response.arrayBuffer();
    initiallyReadable = true;
    const budgetAfterResponse = deadlineAt - Date.now();
    if (budgetAfterResponse <= 0) break;
    if (attempt < attempts) await waitImpl(Math.min(pollMs, budgetAfterResponse));
  }
  throw new Error("Public dummy source remains readable after the bounded cache invalidation window.");
}

export function assertDummyManifest(record, runId) {
  const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
  if (!uuid.test(runId) || !uuid.test(record.ownerId || "")) {
    throw new Error("Invalid synthetic run/owner identity.");
  }
  const prefix = `${record.ownerId}/privacy-staging/${runId}/legacy-`;
  if (![`${prefix}dump.png`, `${prefix}board.png`].includes(record.path)) {
    throw new Error("Refusing deletion outside this run's generated dummy-media namespace.");
  }
  if (!/^[a-f0-9]{64}$/.test(record.sha256 || "") || !["flicd-dump-private", "flicd-archive"].includes(record.destination)) {
    throw new Error("Verified dummy checksum and allowed private destination required.");
  }
}

// Separate from the legacy migration utility, which remains non-deleting.
// This function cannot purge arbitrary legacy objects or operate on production.
export async function purgeDummySource(client, record, { projectRef, runId, approved }) {
  if (projectRef !== STAGING_REF || approved !== true) throw new Error("Dummy staging source deletion not approved.");
  if (typeof client?.supabaseUrl !== "string" || client.supabaseUrl.replace(/\/$/, "") !== STAGING_URL) {
    throw new Error("Actual client endpoint does not match isolated staging.");
  }
  assertDummyManifest(record, runId);
  await verifyAfterCopy(client, record);
  const { data: original, error } = await client.storage.from("flicd-media").download(record.path);
  if (error || !original || sha256(Buffer.from(await original.arrayBuffer())) !== record.sha256) {
    throw new Error("Original dummy source checksum changed; refusing deletion.");
  }
  for (const [table, pathColumn, bucketColumn] of [
    ["dump_items", "image_path", "media_bucket"],
    ["board_items", "saved_image_path", "snapshot_bucket"],
  ]) {
    const result = await client.from(table).select("id").eq(pathColumn, record.path).eq(bucketColumn, "flicd-media");
    if (result.error || !Array.isArray(result.data) || result.data.length) {
      throw new Error("Public references remain or could not be inspected; refusing deletion.");
    }
  }
  const deletion = await client.storage.from("flicd-media").remove([record.path]);
  if (deletion.error) throw new Error("Dummy source removal failed.");
  // Read back both exact targets; a successful remove call alone is insufficient.
  requireDenied(await client.storage.from("flicd-media").download(record.path));
  await verifyAfterCopy(client, record);
}
