#!/usr/bin/env node
// Hosted integration: synthetic staging fixtures only. No production endpoint is accepted.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as wait } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";
import { copyAndVerify, verifyAfterCopy } from "./migrate-legacy-media-staging.mjs";
import { STAGING_REF, STAGING_URL, assertIntegrationEnvironment, requireDenied, requireHttpDenied, waitForPublicRetirement, purgeDummySource, sha256 } from "./privacy-staging-support.mjs";

const PRIVATE = "flicd-dump-private";
const ARCHIVE = "flicd-archive";
// Generated test image, not production media or a licensed music asset.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=", "base64");
const names = [
  "staging marker and private bucket configuration", "four real Auth users and independent password sessions",
  "client schema and embedded relationship queries", "owner private Storage uploads and real byte readback",
  "cross-owner upload rejection", "anonymous and unrelated signing/download rejection",
  "public endpoint cannot serve private bytes", "approved follower signed URL and checksum",
  "expired media blocks follower but remains available to owner", "view-once signing before consumption",
  "view-once trigger and global fresh-signature revocation", "existing signed capability lifetime is bounded",
  "recipient accepts a genuine DM request", "only intended DM participants can read and send",
  "conversation self-enrollment and forged request identities rejected", "owner archive copy/upsert and byte verification",
  "archive metadata and object denial for other identities", "private Board snapshot upload/upsert and checksum",
  "private Board metadata and snapshot denied to others", "revoked follower cannot obtain a fresh signature",
  "dummy legacy public source positive controls", "dummy copy, SHA-256 verification and reference cutover",
  "dummy source purge refuses active public references", "dummy public originals removed and private copies retained",
];

function checked(result, label) {
  if (result.error) throw new Error(`${label} failed (${result.error.code || result.error.status || "API error"}).`);
  return result.data;
}
function client(key) {
  return createClient(STAGING_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (url, init = {}) => fetch(url, { ...init, signal: init.signal || AbortSignal.timeout(20000) }) },
  });
}
async function bytes(download) {
  const blob = checked(download, "Storage download");
  assert(blob, "Expected actual uploaded file bytes.");
  return Buffer.from(await blob.arrayBuffer());
}
async function signed(c, bucket, path, ttl = 45) {
  const data = checked(await c.storage.from(bucket).createSignedUrl(path, ttl), "Signing");
  assert(data?.signedUrl, "No signed URL returned.");
  const url = new URL(data.signedUrl);
  assert.equal(url.origin, STAGING_URL);
  return url.href;
}
async function fetchBytes(url) {
  const response = await fetch(url, { headers: { "Cache-Control": "no-cache" }, signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, 200, "Signed/public positive control must return HTTP 200.");
  return Buffer.from(await response.arrayBuffer());
}
const publicUrl = (bucket, path) => `${STAGING_URL}/storage/v1/object/public/${bucket}/${path}`;

export async function runStagingIntegration(env = process.env) {
  assertIntegrationEnvironment(env);
  const admin = client(env.FLICD_STAGING_SECRET_KEY);
  const anonymous = client(env.FLICD_STAGING_PUBLIC_KEY);
  const runId = randomUUID();
  const report = { projectRef: STAGING_REF, runId, startedAt: new Date().toISOString(), checks: names.map(name => ({ name, status: "NOT_RUN" })), users: {}, manifests: [] };
  let failures = 0;
  async function test(name, operation) {
    const record = report.checks.find(row => row.name === name);
    try {
      await operation(); record.status = "PASS";
    } catch (error) {
      failures += 1; record.status = "FAIL"; record.reason = error.message;
    }
    console.log(`${record.status}: ${name}${record.reason ? ` — ${record.reason}` : ""}`);
    return record.status === "PASS";
  }
  async function finish() {
    report.completedAt = new Date().toISOString();
    report.passed = report.checks.filter(row => row.status === "PASS").length;
    report.failed = report.checks.filter(row => row.status === "FAIL").length;
    report.notRun = report.checks.filter(row => row.status === "NOT_RUN").length;
    if (env.FLICD_STAGING_REPORT_PATH) await writeFile(env.FLICD_STAGING_REPORT_PATH, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ runId, passed: report.passed, failed: report.failed, notRun: report.notRun }));
    return report;
  }
  const users = {};
  if (!await test(names[0], async () => {
    const marker = checked(await admin.from("__flicd_staging_marker").select("label"), "Staging marker");
    assert.deepEqual(marker, [{ label: "SYNTHETIC_STAGING_ONLY" }]);
    const buckets = checked(await admin.storage.listBuckets(), "Bucket inventory");
    for (const bucket of [PRIVATE, ARCHIVE]) assert.equal(buckets.find(row => row.id === bucket)?.public, false);
  })) return finish();

  if (!await test(names[1], async () => {
    for (const role of ["owner", "follower", "secondFollower", "unrelated"]) {
      const email = `privacy-${runId}-${role.toLowerCase()}@example.invalid`;
      const password = randomBytes(32).toString("base64url");
      const created = checked(await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { synthetic_staging_only: true, run_id: runId, test_role: role } }), "Dedicated Auth user creation");
      assert(created.user?.id);
      const session = client(env.FLICD_STAGING_PUBLIC_KEY);
      const loggedIn = checked(await session.auth.signInWithPassword({ email, password }), "Dedicated Auth password sign-in");
      assert.equal(loggedIn.user.id, created.user.id);
      assert.equal(checked(await session.auth.getUser(), "Auth user readback").user.id, created.user.id);
      users[role] = { id: created.user.id, client: session };
      report.users[role] = created.user.id;
      checked(await admin.from("profiles").insert({ id: created.user.id, username: `stage_${role.toLowerCase()}_${runId.slice(0,8)}`, is_private: true }), "Synthetic profile creation");
    }
    checked(await admin.from("follows").insert(["follower", "secondFollower"].map(role => ({ follower_id: users[role].id, following_id: users.owner.id, status: "accepted" }))), "Synthetic accepted follows");
  })) return finish();
  const owner = users.owner.client, follower = users.follower.client, second = users.secondFollower.client, unrelated = users.unrelated.client;
  const prefix = `${users.owner.id}/privacy-staging/${runId}`;
  const paths = { active: `${prefix}/active.png`, once: `${prefix}/once.png`, expired: `${prefix}/expired.png` };
  const dumps = {};
  // Three recent-post limit is preserved: expired is old, active + once consume two slots.
  for (const kind of ["expired", "active", "once"]) {
    const dump = checked(await owner.from("dumps").insert({ user_id: users.owner.id, type: "dump", expiry: kind === "once" ? "once" : "24h", mood: "synthetic", context: "Synthetic staging only", frame_count: 1, created_at: kind === "expired" ? new Date(Date.now() - 25*60*60*1000).toISOString() : new Date().toISOString(), allow_others_to_keep: kind === "active" }).select().single(), "Synthetic Dump creation");
    dumps[kind] = dump.id;
    checked(await owner.from("dump_items").insert({ dump_id: dump.id, position: 0, note: "Synthetic staging image", image_path: paths[kind], media_bucket: PRIVATE }), "Synthetic media reference creation");
  }
  await test(names[2], async () => {
    checked(await follower.from("dumps").select("id,context,frame_count,music_tracks:music_track_id(id,title),dump_tags(tagged_user_id,tagged_user:tagged_user_id(id,username,display_name,avatar_url))").eq("id", dumps.active).single(), "Embedded feed schema query");
    checked(await owner.from("profiles").select("id,username,display_name,bio,avatar_url,profile_theme,interests,onboarding_completed,follower_count,following_count").eq("id", users.owner.id).single(), "Profile schema query");
    assert.equal(checked(await follower.rpc("get_profile_followers", { target_profile_id: users.owner.id }), "Authorized follower-list RPC").length, 2);
    assert.deepEqual(checked(await unrelated.rpc("get_profile_followers", { target_profile_id: users.owner.id }), "Private follower-list RPC denial"), []);
    assert.equal(checked(await follower.rpc("get_profile_following", { target_profile_id: users.follower.id }), "Owner following-list RPC").length, 1);
    assert.deepEqual(checked(await unrelated.rpc("get_profile_following", { target_profile_id: users.follower.id }), "Private following-list RPC denial"), []);
  });
  if (!await test(names[3], async () => {
    for (const path of Object.values(paths)) {
      checked(await owner.storage.from(PRIVATE).upload(path, PNG, { contentType: "image/png", cacheControl: "60", upsert: false }), "Owner image upload");
      assert.equal(sha256(await bytes(await owner.storage.from(PRIVATE).download(path))), sha256(PNG));
    }
  })) return finish();
  await test(names[4], async () => requireDenied(await unrelated.storage.from(PRIVATE).upload(`${prefix}/forged.png`, PNG, { contentType: "image/png" })));
  await test(names[5], async () => {
    for (const actor of [anonymous, unrelated]) {
      requireDenied(await actor.storage.from(PRIVATE).createSignedUrl(paths.active, 45));
      requireDenied(await actor.storage.from(PRIVATE).download(paths.active));
    }
    assert.deepEqual(checked(await unrelated.from("dump_items").select("id").eq("dump_id", dumps.active), "Unauthorized metadata query"), []);
  });
  await test(names[6], async () => requireHttpDenied(await fetch(publicUrl(PRIVATE, paths.active), { signal: AbortSignal.timeout(20000) })));
  await test(names[7], async () => assert.equal(sha256(await fetchBytes(await signed(follower, PRIVATE, paths.active))), sha256(PNG)));
  await test(names[8], async () => {
    requireDenied(await follower.storage.from(PRIVATE).createSignedUrl(paths.expired, 45));
    assert.equal(sha256(await bytes(await owner.storage.from(PRIVATE).download(paths.expired))), sha256(PNG));
  });
  let onceUrl, expiryUrl, expiryStarted, expiryVerification;
  await test(names[9], async () => {
    onceUrl = await signed(follower, PRIVATE, paths.once);
    assert.equal(sha256(await fetchBytes(onceUrl)), sha256(PNG));
    assert.equal(sha256(await fetchBytes(await signed(second, PRIVATE, paths.once))), sha256(PNG));
    expiryStarted = Date.now(); expiryUrl = await signed(follower, PRIVATE, paths.once, 45);
    assert.equal(sha256(await fetchBytes(expiryUrl)), sha256(PNG));
    // Check on schedule, not after potentially long CDN retirement checks.
    expiryVerification = test(names[11], async () => {
      await wait(Math.max(0,expiryStarted+47000-Date.now()));
      const elapsedMs=Date.now()-expiryStarted;
      const response=await fetch(expiryUrl,{headers:{"Cache-Control":"no-cache"},signal:AbortSignal.timeout(20000)});
      report.signedExpiry={requestedTtlSeconds:45,elapsedAtRequestMs:elapsedMs,httpStatus:response.status};
      assert(elapsedMs>=45000 && elapsedMs<=50000,"Expiry probe missed its bounded observation window.");
      await requireHttpDenied(response);
    });
  });
  await test(names[10], async () => {
    checked(await follower.from("dump_views").insert({ dump_id: dumps.once, user_id: users.follower.id }), "View event");
    assert(checked(await owner.from("dumps").select("once_viewed_at").eq("id", dumps.once).single(), "Once trigger readback").once_viewed_at);
    assert.equal(checked(await owner.from("flicd_archive").select("dump_id").eq("dump_id", dumps.once), "Archive trigger readback").length, 1);
    for (const actor of [follower, second]) requireDenied(await actor.storage.from(PRIVATE).createSignedUrl(paths.once, 45));
  });

  let conversationId;
  await test(names[12], async () => {
    const request = checked(await owner.from("message_requests").insert({ sender_id: users.owner.id, recipient_id: users.follower.id }).select().single(), "Genuine DM request");
    checked(await follower.from("message_requests").select("id,sender:profiles!message_requests_sender_profile_fkey(id,username,display_name,bio,avatar_url)").eq("id", request.id).single(), "DM sender relationship");
    checked(await follower.from("message_requests").update({ status: "accepted" }).eq("id", request.id).select().single(), "Recipient acceptance");
    const memberships = checked(await owner.from("conversation_participants").select("conversation_id").eq("user_id", users.owner.id), "Owner conversation readback");
    assert.equal(memberships.length, 1); conversationId = memberships[0].conversation_id;
    const participants = checked(await owner.from("conversation_participants").select("user_id").eq("conversation_id", conversationId), "Participant readback");
    assert.deepEqual(participants.map(p => p.user_id).sort(), [users.owner.id, users.follower.id].sort());
  });
  await test(names[13], async () => {
    assert(conversationId, "DM setup failed.");
    for (const actor of [users.owner, users.follower]) checked(await actor.client.from("messages").insert({ conversation_id: conversationId, sender_id: actor.id, body: "Synthetic staging message" }).select().single(), "Participant send");
    assert.equal(checked(await follower.from("messages").select("id").eq("conversation_id", conversationId), "Participant messages").length, 2);
    assert.deepEqual(checked(await unrelated.from("messages").select("id").eq("conversation_id", conversationId), "Unrelated DM query"), []);
    requireDenied(await unrelated.from("messages").insert({ conversation_id: conversationId, sender_id: users.unrelated.id, body: "Synthetic forbidden message" }));
  });
  await test(names[14], async () => {
    assert(conversationId, "DM setup failed.");
    requireDenied(await unrelated.from("conversation_participants").insert({ conversation_id: conversationId, user_id: users.unrelated.id }));
    requireDenied(await unrelated.from("conversations").insert({ created_by: users.unrelated.id }));
    requireDenied(await unrelated.from("message_requests").insert({ sender_id: users.owner.id, recipient_id: users.follower.id }));
    const request = checked(await owner.from("message_requests").insert({ sender_id: users.owner.id, recipient_id: users.secondFollower.id }).select().single(), "Integrity test request");
    requireDenied(await second.from("message_requests").update({ sender_id: users.unrelated.id, status: "accepted" }).eq("id", request.id));
    assert.equal(checked(await owner.from("message_requests").select("status,sender_id").eq("id", request.id).single(), "Unmodified request readback").status, "pending");
  });

  const archivePath = `${users.owner.id}/privacy-staging/${runId}/archive.png`;
  await test(names[15], async () => {
    const content = await bytes(await owner.storage.from(PRIVATE).download(paths.expired));
    for (let pass=0; pass<2; pass++) {
      checked(await owner.storage.from(ARCHIVE).upload(archivePath, content, { contentType: "image/png", upsert: true, cacheControl: "0" }), "Archive copy/upsert");
      checked(await owner.from("flicd_archive_items").upsert({ user_id: users.owner.id, dump_id: dumps.expired, item_position: 0, archive_path: archivePath }, { onConflict: "user_id,dump_id,item_position" }), "Archive item upsert");
      checked(await owner.from("flicd_archive").upsert({ user_id: users.owner.id, dump_id: dumps.expired, reason: "24h_expired" }, { onConflict: "user_id,dump_id" }), "Archive entry upsert");
    }
    assert.equal(sha256(await fetchBytes(await signed(owner, ARCHIVE, archivePath))), sha256(PNG));
  });
  await test(names[16], async () => {
    for (const actor of [follower, unrelated]) {
      assert.deepEqual(checked(await actor.from("flicd_archive_items").select("archive_path").eq("dump_id", dumps.expired), "Other user's archive metadata"), []);
      requireDenied(await actor.storage.from(ARCHIVE).createSignedUrl(archivePath, 45));
      requireDenied(await actor.storage.from(ARCHIVE).download(archivePath));
    }
    await requireHttpDenied(await fetch(publicUrl(ARCHIVE, archivePath), { signal: AbortSignal.timeout(20000) }));
  });
  let boardId;
  const snapshot = `${users.follower.id}/privacy-staging/${runId}/board.png`;
  await test(names[17], async () => {
    const board = checked(await follower.from("boards").insert({ user_id: users.follower.id, name: "Synthetic private Board", description: "Staging only", pinned: true, style_config: {} }).select().single(), "Board creation");
    boardId=board.id;
    const content=await bytes(await follower.storage.from(PRIVATE).download(paths.active));
    checked(await follower.storage.from(ARCHIVE).upload(snapshot, content, { contentType: "image/png", upsert: false, cacheControl: "0" }), "Private snapshot upload");
    for (let pass=0; pass<2; pass++) checked(await follower.from("board_items").upsert({ user_id: users.follower.id, board_id: board.id, dump_id: dumps.active, item_position: 0, saved_image_path: snapshot, snapshot_bucket: ARCHIVE, note: "Synthetic snapshot", mood: "synthetic", saved_author_username: "synthetic-owner" }, { onConflict: "user_id,board_id,dump_id,item_position" }).select().single(), "Board snapshot upsert");
    assert.equal(sha256(await fetchBytes(await signed(follower, ARCHIVE, snapshot))), sha256(PNG));
  });
  await test(names[18], async () => {
    assert(boardId, "Board setup failed.");
    for (const actor of [owner, unrelated]) {
      assert.deepEqual(checked(await actor.from("board_items").select("id").eq("board_id", boardId), "Unauthorized Board metadata"), []);
      requireDenied(await actor.storage.from(ARCHIVE).createSignedUrl(snapshot, 45));
      requireDenied(await actor.storage.from(ARCHIVE).download(snapshot));
    }
  });
  await test(names[19], async () => {
    checked(await admin.from("follows").delete().eq("follower_id", users.secondFollower.id).eq("following_id", users.owner.id), "Synthetic follow revocation");
    assert.deepEqual(checked(await admin.from("follows").select("follower_id").eq("follower_id", users.secondFollower.id).eq("following_id", users.owner.id), "Follow deletion readback"), []);
    requireDenied(await second.storage.from(PRIVATE).createSignedUrl(paths.active, 45));
  });

  const legacyRecords = [];
  await test(names[20], async () => {
    assert(boardId, "Board setup failed.");
    const legacyDump = checked(await owner.from("dumps").insert({ user_id: users.owner.id, expiry: "24h", mood: "synthetic" }).select().single(), "Legacy dummy Dump");
    for (const kind of ["dump", "board"]) {
      const ownerId = kind === "dump" ? users.owner.id : users.follower.id;
      const path = `${ownerId}/privacy-staging/${runId}/legacy-${kind}.png`;
      checked(await admin.storage.from("flicd-media").upload(path, PNG, { contentType: "image/png", cacheControl: "0", upsert: false }), "Dummy legacy upload");
      const record = { kind, ownerId, path, destination: kind === "dump" ? PRIVATE : ARCHIVE, sha256: sha256(PNG), table: kind === "dump" ? "dump_items" : "board_items", column: kind === "dump" ? "media_bucket" : "snapshot_bucket" };
      const payload = kind === "dump" ? { dump_id: legacyDump.id, position: 0, image_path: path, media_bucket: "flicd-media" } : { user_id: users.follower.id, board_id: boardId, dump_id: dumps.active, item_position: 1, saved_image_path: path, snapshot_bucket: "flicd-media" };
      record.id=checked(await admin.from(record.table).insert(payload).select("id").single(), "Legacy dummy reference").id;
      assert.equal(sha256(await fetchBytes(publicUrl("flicd-media",path))), record.sha256);
      legacyRecords.push(record);
    }
    report.manifests=legacyRecords;
  });
  await test(names[22], async () => {
    assert.equal(legacyRecords.length, 2);
    for (const record of legacyRecords) {
      await copyAndVerify(admin, record);
      await assert.rejects(purgeDummySource(admin, record, { projectRef: STAGING_REF, runId, approved: true }), /Public references remain/);
      assert.equal(sha256(await fetchBytes(publicUrl("flicd-media",record.path))),record.sha256);
    }
  });
  await test(names[21], async () => {
    assert.equal(legacyRecords.length, 2);
    for (const record of legacyRecords) {
      assert.equal(await copyAndVerify(admin,record),record.sha256);
      const changed=checked(await admin.from(record.table).update({ [record.column]: record.destination }).eq("id",record.id).eq(record.column,"flicd-media").select("id"),"Dummy reference cutover");
      assert.equal(changed.length,1);
      assert.equal(checked(await admin.from(record.table).select(record.column).eq("id",record.id).single(),"Cutover readback")[record.column],record.destination);
      assert.equal(await verifyAfterCopy(admin,record),record.sha256);
    }
  });
  await test(names[23], async () => {
    assert.equal(legacyRecords.length,2);
    assert.equal(env.FLICD_STAGING_ALLOW_DUMMY_PURGE,"YES","Dummy-only removal requires explicit opt-in.");
    for (const record of legacyRecords) {
      await purgeDummySource(admin,record,{projectRef:STAGING_REF,runId,approved:true});
      record.publicRetirement=await waitForPublicRetirement(publicUrl("flicd-media",record.path));
      assert.equal(await verifyAfterCopy(admin,record),record.sha256);
    }
  });
  if (expiryVerification) await expiryVerification;
  else await test(names[11], async () => { throw new Error("No valid pre-consumption signed URL was captured."); });
  assert.equal(failures,report.checks.filter(row=>row.status==="FAIL").length);
  return finish();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runStagingIntegration().then(report => { if (report.failed || report.notRun) process.exitCode=1; }).catch(() => {
    console.error("Staging integration stopped on a setup/transport error. No credentials or signed URLs are logged.");
    process.exitCode=1;
  });
}
