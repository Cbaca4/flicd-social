# flic'd backend privacy hardening — STAGING ONLY

> **DO NOT MERGE OR DEPLOY without isolated Supabase integration testing and a legacy-media migration plan.** This branch is a draft security change set, not a completed rollout.

Isolated staging API testing is now recorded in [the HTTP integration results](privacy-staging-results-20261018-http.md): 24/24 hosted checks pass, including real Auth sessions, Storage bytes, DM/archive/Board authorization, and dummy public-source retirement. This does not authorize production changes or replace browser/device validation.

## Why this is necessary

The existing `flicd-media` Storage bucket is public, the old Dump image helper calls `getPublicUrl`, and the `dump_items` SELECT policy formerly granted all authenticated users direct access to item rows. A separate policy allowed an authenticated user to insert themselves into an arbitrary known conversation UUID.

## Proposed coordinated change

- New Uploads: new Dump/Roll images are uploaded to `flicd-dump-private`, not the legacy public bucket. `dump_items.media_bucket` records the actual object location.
- Reading: the frontend calls Storage `createSignedUrl` with a 45-second lifetime for private objects; Storage SELECT policy allows the uploader or viewers permitted by parent Dump access, nonexpiration and unconsumed-view rules. The feed does not request images for view-once cards. The viewer signs media *only after* a reveal click, then records the view. Existing signed URLs may still be reused until they expire.
- DM: only the accepted-message-request server trigger can add conversation participants or create conversations. Direct API inserts are blocked; the RLS helper no longer accepts a forged user identity.
- Archive: owner archiving uses each item's `media_bucket` to copy and clean up objects.
- Boards: new saved-frame snapshots use the existing private owner-scoped `flicd-archive` bucket and are displayed via owner-only signed URLs. The `board_items.snapshot_bucket` discriminator preserves legacy snapshots until a trusted copy/cutover. Profile/avatar and comment media still use the public legacy bucket, so those independent privacy implications must be reviewed.

## Deployment sequence (production not executed)

1. The separate Free project `flicd-privacy-staging` has been verified and used for synthetic integration tests. Do not create paid branches or change billing without separate approval.
2. Check branch project ref; confirm it is not `xbmfphdetgmjzqnxhmgp`. Apply migration `20261018050000_stage_private_dump_media_and_membership.sql` to staging **only**.
3. Run `docs/security_staging_verify.sql` and user-level API/storage integration tests with three dedicated synthetic accounts: owner, approved follower, and unrelated user.
4. Deploy a frontend preview pointing **only** to the staging project's public URL and publishable key. Confirm posting, archiving, normal image loads, views, comments, follow revocations, DM request acceptance and unauthorized direct calls.
5. Transfer every legacy `dump_items` object from public `flicd-media` to private `flicd-dump-private`, plus existing `board_items` snapshots to private `flicd-archive` using trusted server-side copy (not normal user upload permissions). Verify content hashes, ownership, references, archive and Board behavior. Atomically update the matching `media_bucket` rows. Remove old public objects only after validation and rollback rehearsal.
6. Re-run the negative tests and real-device tests. Confirm no dump items still reference public media. Only after user approval should changes be applied to production in coordinated stages.

## Negative security test matrix (on staging)

- Unrelated authenticated user cannot SELECT another user's private `dump_items` metadata (even if they know a valid Dump/item UUID).
- Anonymous client cannot fetch private Storage object or create a signed URL.
- Unrelated authenticated user cannot download/sign a known private image path.
- Accepted follower can fetch an active 24h image; revoked follower cannot fetch/sign a **new** URL.
- Private signing requests use a 45-second lifetime. The staging timed probe observed expiry at 47,012 ms; CDN cache lifetimes are independent and may outlive a token on other plans/configurations. Cached/previously downloaded bytes are beyond technical one-view guarantees. See the HTTP results before promising any revocation deadline.
- Saved Board images are private owner-only signed URLs; another user cannot sign a known snapshot path.
- Before tap to reveal, view-once feed/viewer sends no private image request; on tap it can issue signatures, then records the view once. On reopen, it cannot sign again; another viewer cannot sign a new URL after a global once-view.
- Expired 24h media refuses new signatures, while the owner retains access needed to archive.
- A user knowing a conversation UUID cannot INSERT themselves into `conversation_participants`, cannot create an arbitrary conversation, read participants/messages, or send messages.
- Legitimate sender can send a message request; recipient can accept; the database trigger creates exactly two intended members, both can exchange messages; other account denied.
- Database security advisors are reviewed again after staging migration.

## Constraints and rollback

This stage intentionally **retains** the old `flicd-media` public bucket so current legacy users/avatars remain functional. That means *legacy Dump object URLs remain exposed until the trusted migration and deletion are completed*. Do not call the overall privacy problem fixed just because this PR's CI passes.

Do not run migrations on the existing live project, do not copy user data into staging, do not expose authorization findings in public issue bodies, and do not merge this PR until a person approves the validated rollout.
