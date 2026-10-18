# Privacy hardening — isolated Supabase staging verification (2026-10-18)

**Repository branch:** `security/privacy-hardening-staging` (draft PR #11).  
**Test environment:** separate Free-plan Supabase project named `flicd-privacy-staging`, US East. The production project was not altered.

## Scope and limitations

Staging was initialized with a **schema-only, intentionally limited set of flic'd tables** related to Dumps, Storage authorization, Boards, conversations and message requests. It is not a full production-schema clone and contains **no real users, private messages, images or uploaded files**. Three synthetic database identities were created, without email addresses or passwords.

Migrations applied **to staging only**:
1. `20261018050000_stage_private_dump_media_and_membership.sql`
2. Existing archive/expiration migration (required to verify the real view-once trigger).
3. `20261018163000_restrict_message_request_updates.sql`
4. `20261018170000_move_member_rls_helper_private.sql`

## Database-level verification results

- Owner: 3/3 synthetic Dump image references visible, including expired material needed for archiving.
- Approved follower: 2/3 visible while active; synthetic DM message visible.
- Unrelated authenticated identity: 0 Dump item rows, 0 synthetic private Storage metadata rows, 0 messages and 0 conversation membership rows visible.
- After an approved follower inserts a valid view event, the real archive trigger marks the view-once Dump consumed and the follower's available image count falls from 2 to 1.
- Direct conversation self-enrollment is not available to authenticated clients; authorized acceptance still creates exactly the expected participants.
- The request recipient cannot update the sender or recipient identity fields, while normal acceptance remains functional.
- Conversation membership logic is kept in the non-exposed `private` schema. Authenticated users cannot call the old public definer helper.
- Saved Board snapshot metadata and private archive Storage objects are visible to the synthetic owner but not to an unrelated user.
- `flicd-dump-private` and `flicd-archive` buckets are marked `public = false`; legacy `flicd-media` remains public for compatibility.

These were tested using actual staging PostgreSQL RLS with transactions and synthetic identities. **Storage object rows created for individual tests were rolled back; no actual Storage file bytes were uploaded or signed.** Therefore, the tests do not prove signed-URL behavior over the HTTP Storage API.

## Automated CI

`.github/workflows/security-integration.yml` independently starts a disposable PostgreSQL instance, applies the migrations, and exercises positive/negative RLS assertions with synthetic identities. The normal GitHub Actions lint/test/build workflow also runs.

## Remaining release gates

1. Test a private image upload, unauthorized direct Storage download and signed-URL creation through Supabase's **actual Storage API** using separate authenticated nonproduction accounts.
2. Exercise media playback/view-once, 24h expiration, profile/Board interactions and archive copy/retrieval in an authenticated preview app. This will require a more complete staging schema.
3. Rehearse copying legacy **dummy** media from the public bucket into the proper private buckets with the guarded `migrate-legacy-media-staging.mjs` utility; verify byte hashes. Then rehearse the independent public-source cleanup.
4. Before production, inventory all public bucket objects and cross-references, back up user data, rehearse rollback, and explicitly approve a coordinated deployment and real-media cutover. Legacy public URLs remain accessible in production until their original objects are retired.
5. Resolve separate Auth security settings, including leaked-password protection. Review Supabase security advisors again before launch.
6. Staging includes a marker table `public.__flicd_staging_marker` with RLS disabled. SELECT permissions for both `anon` and `authenticated` are revoked, but Supabase's table listing flags it. Enabling RLS or removing/moving the marker should be explicitly reviewed before declaring a fully clean staging configuration.

**Do not merge draft PR #11 or apply production migrations based only on these database unit tests.**
