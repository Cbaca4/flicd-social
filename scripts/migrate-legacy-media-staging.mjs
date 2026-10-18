#!/usr/bin/env node
/**
 * Copy/verify legacy public Dump and Board media into private Storage.
 * STAGING ONLY. This tool deliberately refuses the known live project and does
 * not delete any source objects. A separately reviewed deletion/cutover step
 * must follow after all application references have been migrated.
 *
 * Environment (never commit these values):
 *   SUPABASE_URL=https://<staging-ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=<staging-only secret>
 *   FLICD_STAGING_PROJECT_REF=<staging-ref>
 *
 * Commands:
 *   node scripts/migrate-legacy-media-staging.mjs --plan
 *   node scripts/migrate-legacy-media-staging.mjs --copy
 *   node scripts/migrate-legacy-media-staging.mjs --verify
 */
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const LIVE_REF = "xbmfphdetgmjzqnxhmgp";
const LEGACY = "flicd-media";
const PRIVATE_DUMPS = "flicd-dump-private";
const PRIVATE_BOARDS = "flicd-archive";
const PAGE_SIZE = 100;

function assertStagingEnvironment(env) {
  const { SUPABASE_URL: rawUrl, SUPABASE_SERVICE_ROLE_KEY: secret, FLICD_STAGING_PROJECT_REF: stagingRef } = env;
  if (!rawUrl || !secret || !stagingRef) {
    throw new Error("Staging URL, staging service-role key, and FLICD_STAGING_PROJECT_REF are required.");
  }
  const endpoint = new URL(rawUrl);
  const actualRef = endpoint.hostname.split(".")[0];
  if (endpoint.protocol !== "https:" || !endpoint.hostname.endsWith(".supabase.co")) {
    throw new Error("Only hosted staging project URLs are supported.");
  }
  if (actualRef !== stagingRef || actualRef === LIVE_REF) {
    throw new Error("Refusing to access a project other than the explicitly selected staging project.");
  }
  return { endpoint: endpoint.origin, secret };
}

function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

async function listRows(client, table, columns) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    // Do NOT filter on the migrated bucket: updates would change pagination.
    const { data, error } = await client.from(table).select(columns)
      .order("id", { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

function validateOwnerPath(path, owner) {
  if (!path || !owner || typeof path !== "string") throw new Error("Invalid media reference.");
  if (!path.startsWith(owner + "/") || path.includes("..") || path.startsWith("/")) {
    throw new Error("Object path does not match verified owner; aborting.");
  }
}

async function readObject(client, bucket, path) {
  const { data, error } = await client.storage.from(bucket).download(path);
  if (error) throw error;
  if (!data) throw new Error("Object download returned no data.");
  const content = Buffer.from(await data.arrayBuffer());
  return { content, type: data.type || "application/octet-stream", hash: sha256(content) };
}

async function copyAndVerify(client, record) {
  const source = await readObject(client, LEGACY, record.path);
  const { error } = await client.storage.from(record.destination).upload(
    record.path, source.content,
    { upsert: false, contentType: source.type, cacheControl: "60" },
  );
  if (error && !/already exists|duplicate|409/i.test(error.message || "")) {
    throw error;
  }
  const destination = await readObject(client, record.destination, record.path);
  if (destination.hash !== source.hash) throw new Error("Content hash mismatch; refusing database update.");
  return source.hash;
}

async function verifyAfterCopy(client, record) {
  const destination = await readObject(client, record.destination, record.path);
  if (!destination.hash) throw new Error("Copied media verification failed.");
}

async function main() {
  const mode = process.argv[2] || "--plan";
  if (!["--plan", "--copy", "--verify"].includes(mode)) {
    throw new Error("Usage: --plan | --copy | --verify");
  }
  const { endpoint, secret } = assertStagingEnvironment(process.env);
  const client = createClient(endpoint, secret, { auth: { persistSession: false, autoRefreshToken: false } });

  const [dumpItems, boardItems] = await Promise.all([
    listRows(client, "dump_items", "id,dump_id,image_path,media_bucket"),
    listRows(client, "board_items", "id,user_id,saved_image_path,snapshot_bucket"),
  ]);
  const parentOwners = new Map();
  const candidates = [];

  for (const item of dumpItems) {
    if (!item.image_path) continue;
    if (!parentOwners.has(item.dump_id)) {
      const { data, error } = await client.from("dumps").select("user_id")
        .eq("id", item.dump_id).single();
      if (error || !data) throw error || new Error("Missing parent Dump.");
      parentOwners.set(item.dump_id, data.user_id);
    }
    validateOwnerPath(item.image_path, parentOwners.get(item.dump_id));
    candidates.push({ kind: "dump", id: item.id, path: item.image_path,
      oldBucket: item.media_bucket, destination: PRIVATE_DUMPS,
      column: "media_bucket", table: "dump_items" });
  }

  for (const item of boardItems) {
    if (!item.saved_image_path) continue;
    validateOwnerPath(item.saved_image_path, item.user_id);
    candidates.push({ kind: "board", id: item.id, path: item.saved_image_path,
      oldBucket: item.snapshot_bucket, destination: PRIVATE_BOARDS,
      column: "snapshot_bucket", table: "board_items" });
  }

  const pending = candidates.filter((item) => item.oldBucket === LEGACY);
  if (mode === "--plan") {
    console.log(JSON.stringify({
      mode: "plan", stagingRef: process.env.FLICD_STAGING_PROJECT_REF,
      totalReferences: candidates.length, legacyDumpReferences: pending.filter(x => x.kind === "dump").length,
      legacyBoardReferences: pending.filter(x => x.kind === "board").length,
      requiresCopyAndReferenceCutover: pending.length,
      sourceDeletionSupported: false,
    }, null, 2));
    return;
  }

  if (mode === "--verify") {
    const migrated = candidates.filter(x => x.oldBucket === x.destination);
    for (const record of migrated) await verifyAfterCopy(client, record);
    console.log(JSON.stringify({
      mode: "verify", verifiedPrivateObjects: migrated.length,
      remainingLegacyReferences: pending.length,
      passed: pending.length === 0,
    }));
    if (pending.length) process.exitCode = 1;
    return;
  }

  let migrated = 0;
  for (const record of pending) {
    await copyAndVerify(client, record);
    const { data, error } = await client.from(record.table)
      .update({ [record.column]: record.destination })
      .eq("id", record.id).eq(record.column, LEGACY)
      .select("id");
    if (error) throw error;
    if (data?.length !== 1) throw new Error("Reference changed concurrently; stop and inspect.");
    migrated += 1;
  }
  console.log(JSON.stringify({
    mode: "copy", migratedReferences: migrated,
    notice: "Original public objects have NOT been deleted. Run --verify, then obtain approval for a separate purge plan.",
  }));
}

main().catch((error) => {
  console.error("Staging migration failed:", error.message);
  process.exitCode = 1;
});
