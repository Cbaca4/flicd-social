# Privacy hardening: publication review packet

This is an implementation/self-review packet for independent security review, not an independent audit approval. Keep draft PR #11 unmerged. No production or hosted staging database changes are part of this publication task.

## Reviewed scope

The prior 15 local files contain the schema completion already approved/applied to isolated staging, the real HTTP runner, checksum and dummy-retirement safeguards, regressions, runbooks, and initial/final evidence. Publication additionally includes executable relationship-RPC authorization tests, the disposable CI fixture/SQL entrypoint updates needed to run them, and this review note. GitHub workflow configuration is unchanged.

Publication-time local verification: 232 Vitest tests pass across 62 files; ESLint, the production build, script syntax checks, and diff whitespace checks pass. The older hosted report's accompanying 229-test local baseline is retained as historical evidence rather than rewritten.

The original development worktree's uncommitted `AppShell.jsx` is excluded. Its Git content hash before review was `05e8e5a62746a30be72e6d9dc4a656051c68018c` and must match after publication. No package, frontend client configuration, or production migration is being added by this review.

## SECURITY DEFINER functions

Definitions reviewed: `supabase/migrations/20260918030000_add_post_locations_tags_notifications.sql`, `public.get_profile_followers(uuid)` and `public.get_profile_following(uuid)`.

- Both deliberately bypass narrower relationship-table RLS to return a complete authorized profile relationship list. They are read-only SELECT bodies with a single typed target UUID, no dynamic SQL, and no caller-supplied viewer identity.
- Both derive the caller from schema-qualified `auth.uid()`. Access is granted when the caller owns the target, the target is public, or the caller has an accepted follow of that target. Pending follows and the reverse relationship do not grant access.
- Returned relationships are limited to `status='accepted'`. Returned columns are basic profile fields, not posts, messages, email addresses, or Auth tokens.
- Tables are explicitly schema-qualified. Function configuration pins `search_path=public, pg_catalog`; authenticated callers must not have CREATE on that schema. EXECUTE is revoked from PUBLIC/anon and granted to authenticated.
- Target privacy is the policy boundary: a signed-in visitor to a public target can see that target's accepted relationships, including basic fields of private counterparties. This does not authorize reading the private counterparty's own lists. Independent review must confirm that this intentional product behavior is acceptable.
- No function definition or hosted RPC grant was changed to silence the advisors. The two advisor warnings remain review items, not automatically cleared findings.

### Executable PostgreSQL regression matrix

`tests/security/profile-relationship-rpc.assertions.sql` runs the actual tracked definitions, not test copies. CI applies the source migration to its disposable PostgreSQL 17 service and invokes the assertions with `ON_ERROR_STOP=1`.

The matrix verifies both RPCs under these cases:

1. Definer status, pinned search path, one-argument signature, authenticated EXECUTE, denied anonymous EXECUTE, and denied public-schema CREATE for callers.
2. Private target owner receives exact complete accepted-only lists.
3. An approved follower receives authorized lists while direct relationship-table RLS hides third-party rows.
4. A pending/unrelated viewer receives no private lists; a signed-in visitor can read a public target. Pending relationships do not appear.
5. NULL/nonexistent targets and an authenticated role without a subject cannot expose private lists.
6. Caller-created temporary `profiles`/`follows` tables cannot shadow the real tables.
7. Revocation denies both lists immediately, even when the target follows the viewer in the reverse direction.
8. Anonymous execution of both RPCs is denied even for a public target.

Fixture changes and temporary test helpers are enclosed in BEGIN/ROLLBACK. No hosted database access or Supabase secrets are needed for this job. Local Docker/psql are unavailable; the PostgreSQL execution result is established by the exact pushed commit's GitHub Actions run, not claimed from static inspection.

## Corrections made during local review

- A focused failing test showed that the separate dummy-purge helper trusted a caller-supplied staging ref without checking its client's actual endpoint. It now verifies the SDK client's endpoint before any Storage call. Unit tests use only fake Storage clients; the test production URL is never contacted.
- Tightened generated UUID structure and limited retirement paths to exactly `legacy-dump.png` or `legacy-board.png` under the selected synthetic run namespace.
- A focused failing regression showed that request latency did not count against the retirement deadline. Polling now uses an absolute deadline, validates its timing arguments, and caps each fetch timeout/wait to the remaining budget.

These are fail-closed backend-tool safeguards. The retained 24/24 hosted report predates these review-time guard refinements; it is not represented as a newly executed hosted run. The new guard behavior is verified by local automated regressions, while function authorization is covered by PostgreSQL CI.

## Credentials and destructive-operation review

- Evidence files contain generated staging fixture IDs/paths, hashes, timings and statuses only. There are no keys, passwords, user-session tokens, or signed URLs. Do not add staging credentials to GitHub to run the hosted script.
- The general legacy copy/verify utility remains non-deleting. The separate dummy-only purge requires explicit approval, the exact staging client endpoint/ref, exact run-owned paths, matching source/destination SHA-256, no surviving public references, Storage deletion readback, private-copy readback, and original-public-URL retirement.
- Staging schema completion is stored under `tests/security/`, not as an automatic production migration. It requires its staging marker and an explicitly reviewed transactional invocation. Its reviewed DROP statements replace named policies only; there is no DROP TABLE/SCHEMA or TRUNCATE. The new CI assertions delete only a named synthetic follow within a rolled-back transaction.
- Adding foreign keys with ON DELETE CASCADE describes future relationship behavior; publication does not delete any database rows. CI SQL executes only against its disposable localhost service.
- Historical schema dependencies are not all idempotent. The manifest's normalized SQL checksum must continue to match the recorded applied staging SQL; do not replay them blindly.

## Evidence and remaining production gates

- Hosted integration: [24 PASS, 0 FAIL, 0 NOT_RUN](evidence/privacy-staging-http-verified-20261018.json). The [initial report](evidence/privacy-staging-http-initial-20261018.json) retains the two original failures.
- Full staging scope, timings and known limitations: [HTTP integration report](privacy-staging-results-20261018-http.md).
- Independent human review is pending. Approval to commit/push is not approval to merge or deploy.
- Production schema/policy parity, authenticated preview/browser/device tests, role/block/Space semantics, backups, a trusted real-media manifest, rollback and CDN-aware cutover remain release gates. Production legacy public objects have not been changed.
- Issued bearer URLs and already downloaded bytes are not immediately revocable. The 45-second signing probe and roughly 51–52-second observed public-cache retirement are environment-specific observations, not a global caching guarantee.
- The leaked-password-protection warning and the two authenticated definer-RPC warnings remain. The marker's deny-all RLS configuration has an informational no-policy advisory. No Auth settings or billing features were changed.
- The existing Vite bundle-size warning remains outside this privacy review.
