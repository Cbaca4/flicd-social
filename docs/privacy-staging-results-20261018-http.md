# Privacy staging: real Auth, Storage, and legacy-cutover integration

Date: 2026-10-18. Branch: `security/privacy-hardening-staging`, based on draft PR #11 at `af055035424f45474b9635422e604d324f65d3fd`.

## Scope and safety

- Verified project: `flicd-privacy-staging`, ref `ljcfoanzmowgkjtrdcgg`, `ACTIVE_HEALTHY`, US East. The staging marker was checked before fixture writes.
- Separate worktree: `C:/Users/Baco/Downloads/flicd/flicd-privacy-staging`. The original development worktree and its uncommitted `AppShell.jsx` were not edited.
- No production connection, production DDL export, data copy, real-media migration, frontend deployment, or PR merge occurred. Dependencies were recovered from tracked SQL and the client interfaces, not copied from live data.
- Management/API keys were entered through local masked dialogs into backend memory. They were not written into the repository, frontend variables, reports, or GitHub. No credentials or signed URLs are included in this document.
- Real dedicated Auth users are synthetic `example.invalid` identities with confirmed emails and randomly generated passwords held only by the runner. The final run used owner, approved follower, second approved follower, and unrelated roles. Earlier rehearsal identities and private synthetic fixtures are retained; no broad Auth/data cleanup was attempted.

## Exact results

Final hosted run: `dd0ee658-91fc-4851-aea3-011b0b90acf7`.

- Real hosted integration: **24 PASS, 0 FAIL, 0 NOT_RUN**.
- Local Vitest: **229 PASS across 62 files**, no skipped tests.
- `npm run lint`: PASS.
- `npm run build`: PASS; existing large-JavaScript-chunk warning remains (696.52 kB minified; 192.02 kB gzip).
- Node syntax checks for the three staging `.mjs` utilities: PASS.
- Hosted transactional schema/role rehearsal: PASS; rollback verified before schema application.
- Corrected initial-bootstrap SQL was executed in a temporary staging schema inside a transaction and rolled back: PASS; temporary schema removal verified.

Publication review follow-up: see [the security review packet](privacy-security-review.md) for new fail-closed tool guards and the PostgreSQL RPC authorization regression matrix. Publication-time local verification is 232 tests across 62 files. The 24/24 hosted evidence and its recorded 229-test local baseline above describe the earlier integration run; they are not a new hosted run of the review-time guard changes.

### Real hosted test matrix

| Check | Result |
| --- | --- |
| Synthetic staging marker; private Dump/archive bucket flags | PASS |
| Four real Auth users, independent password sessions, `getUser` readback | PASS |
| Client profile/feed/DM embedded relationship schema; private follower-list RPC checks | PASS |
| Owner uploads actual PNG bytes through Storage API; download checksum matches | PASS |
| Another user cannot upload under the owner's path | PASS |
| Anonymous/unrelated users cannot sign or directly download private Dump objects | PASS |
| Public-object endpoint cannot serve a private-bucket image | PASS |
| Approved follower obtains signed URL and identical bytes | PASS |
| Expired 24h image refuses follower signing; owner can still read for archiving | PASS |
| Two approved viewers can sign unconsumed once media | PASS |
| Real view event fires archive/consumption trigger; both viewers lose fresh-signature access | PASS |
| Previously fetched 45-second signed URL rejected in scheduled expiry probe | PASS |
| Genuine request accepted by recipient creates exactly two intended DM members | PASS |
| Both members can exchange messages; unrelated identity cannot read/send | PASS |
| Conversation self-enrollment, direct creation, and forged request identities fail | PASS |
| Owner copies expired media to archive, repeats UPSERTs, verifies signed bytes | PASS |
| Other identities cannot read archive metadata, sign, or download archive object | PASS |
| Authorized private Board snapshot upload/UPSERT and checksum | PASS |
| Other identities cannot read Board snapshot metadata, sign, or download bytes | PASS |
| Revoked follower loses fresh-signature access to active media | PASS |
| Dummy legacy public Dump/Board sources are initially genuinely downloadable | PASS |
| Copy, SHA-256 comparison, reference update, and exact reference readback | PASS |
| Purge refuses to delete while public references remain | PASS |
| Public originals removed; original public URLs retire; private copies still hash correctly | PASS |

### Timing and checksum evidence

The 45-second signature was checked on schedule, not after the longer cleanup tests. At **47,012 ms** after the signing request, the previously fetched bearer URL returned HTTP 400 with the explicit Supabase `InvalidJWT` expiry error. Private uploads used the application's actual `cacheControl: "60"` setting.

Both dummy PNG manifests recorded SHA-256:
`a38a4ff7320a3d8764ac959b264f15e335360d7c1e23a0627dee7f366c95c58f`.

After Storage removal/readback, the original public URLs initially remained readable through cache. Repeated checks of the **same original URL**, not just cache-busted aliases, established eventual denial:

- Dummy Dump source: 25 checks; 50,998 ms cache-retirement observation.
- Dummy Board source: 25 checks; 52,239 ms cache-retirement observation.

The helper fails if the original remains readable beyond its bounded polling budget. It does not count HTTP 200, arbitrary HTTP 400, transport failures, or 5xx responses as successful denial. The private destination and original checksums are verified before deletion, no public `dump_items`/`board_items` references may remain, and destination bytes are read again afterward.

These observations apply to this isolated project and the observed edge. They do not prove global CDN eviction or deletion of browser/downloaded copies.

## Missing schema and applied completion

The initial schema lacked client columns on profiles/Dumps/Boards, music/social/tag tables, named DM-to-profile foreign keys, Board write policies, and UPDATE permissions used by archive UPSERTs. Owner Board insertion reproduced a real RLS failure before the fix.

Human approval was obtained before schema writes. The schema completion and role assertions were first run in one `BEGIN/ROLLBACK` transaction; Auth identity count and schema rollback were checked. The completion was then committed to staging only and read back.

- New reviewed SQL: `tests/security/staging-integration-dependencies.sql`.
- Role tests: `tests/security/staging-dependencies.assertions.sql`.
- Exact historical dependency list and exclusions: `tests/security/staging-schema-manifest.json`.
- Aggregate normalized SQL SHA-256: `108a8adf2ebdaebfbb76861ad11c897642c1815f7158f46a48325359982e8e3a`.
- Music catalog seeding was excluded. Only the two provenance ALTER statements were used; their data UPDATEs were excluded. Bucket configuration and derived follower-count recalculation concerned staging configuration/synthetic rows only.
- Music tracks/licenses were confirmed empty after schema application. All exposed application tables, including the marker, were confirmed RLS-enabled.
- The existing three-post limit migration was applied without changing its rule.

This remains a repository-derived staging baseline, not independently proven full production-schema parity. In particular, a full browser smoke test must review original baseline policies not reconstructed by these security fixtures (for example follow writes and intentional public avatar/comment uploads).

## Failures observed and fixes

1. Initial local tests without the CI public placeholders: 15 failing files (12 initialization failures plus 3 failing tests) because `supabaseUrl` was missing. Rerunning with explicit nonproduction placeholders gave the baseline 214/214. No `.env` or live configuration was copied to make tests pass.
2. The management token could read schema and execute the reviewed SQL, but API-key retrieval returned HTTP 403. No permissions were bypassed. Separate staging public/backend keys were provided through masked dialogs.
3. Missing Board write RLS caused an owner insert to fail. Owner-scoped Board policies, ownership checks, DM relationship dependencies, archive UPSERT permissions, and marker RLS were added only to staging after review and rollback-first role tests.
4. The initial hosted run was **22 PASS / 2 FAIL**. An expired signed URL correctly returned Supabase's HTTP 400 `InvalidJWT` expiry payload; the first harness did not recognize it. A focused failing regression preceded the exact-error classifier fix. Arbitrary 400/5xx failures still fail the tests.
5. Dummy-source removal initially encountered cached HTTP 200 responses after the origin object was gone. Added bounded original-URL retirement checks and regression tests for eventual denial, persistent exposure, and server errors. The final test confirms actual denial instead of hiding cached exposure.
6. `migrate-legacy-media-staging.mjs --verify` previously accepted any downloadable destination without comparing bytes. Three regressions demonstrated the failure. Verification now compares source/destination SHA-256, or checks a recorded source checksum after removal. The migration utility still does **not** delete sources; deletion is isolated in the dummy-only helper.
7. The checked-in initial Supabase bootstrap used an invalid `DO $` delimiter. PostgreSQL reproduced its syntax error. Corrected to `DO $$`, then validated the full bootstrap in a temporary staging schema and rolled it back.

## Reproducing the integration run

Use a backend-only process with these environment names; never commit their values:

- `FLICD_STAGING_PROJECT_REF` (the exact approved staging ref)
- `FLICD_STAGING_CONFIRM=SYNTHETIC_ONLY`
- `FLICD_STAGING_PUBLIC_KEY`
- `FLICD_STAGING_SECRET_KEY`
- `FLICD_STAGING_ALLOW_DUMMY_PURGE=YES` (only the current generated dummy namespace)
- Optional `FLICD_STAGING_REPORT_PATH` outside the repository

Run `node scripts/verify-privacy-staging.mjs` (`node.exe` in this Windows shell). It rejects a different project/URL and a privileged key placed in any frontend variable. The runner creates isolated run-labelled synthetic accounts/records, logs no credentials or signed URLs, and records each check explicitly as PASS/FAIL/NOT_RUN.

Historical migrations are not all idempotent: do not replay the manifest on completed staging. Inventory and review first. The HTTP runner never applies schema migrations automatically.

Secret-free durable evidence (synthetic fixture identifiers only; no passwords, keys, or signed URLs):

- [Initial 22-pass/2-fail report](evidence/privacy-staging-http-initial-20261018.json).
- [Final 24-pass timed proof and checksum manifests](evidence/privacy-staging-http-verified-20261018.json).

Original local runner outputs:

- Initial failure report: `C:/Users/Baco/AppData/Local/hermes/cache/scratch/flicd-staging-http-results.json`.
- Final timed proof: `C:/Users/Baco/AppData/Local/hermes/cache/scratch/flicd-staging-http-final-proof.json`.

## Remaining production release gates

1. Keep PR #11 a draft. Independent security review and explicit human approval are required before any production schema change, coordinated frontend release, or real-media cutover.
2. Inventory production legacy objects and **all** references, plan backups/rollback, persist trusted manifests/checksums, rehearse recovery and CDN invalidation on the intended production plan. No production inventory/data was read in this work. Existing production public originals remain untouched and exposed until a separately approved cutover.
3. Complete full authenticated preview/browser/device testing: upload/posting limits, no pre-reveal media requests, once navigation/reopen behavior, archive rendering, private Board UI, follows, avatars/backgrounds/comments, accessibility, mobile gestures, and browser autoplay. Backend/API checks and JSDOM are not a browser/device release sign-off.
4. Review CDN/browser caching independently from signed-token expiration. A consumed view prevents **new** signatures but cannot revoke bytes already delivered. Supabase documents that cached signed responses may outlive the token; use an authorization proxy or other separately reviewed design if immediate revocation is required. Do not promise absolute one-view enforcement.
5. Review outstanding staging security advisors: two WARNs for intentionally callable authenticated SECURITY DEFINER follower-list RPCs, one WARN for leaked-password protection disabled, and one INFO for the deny-all staging marker with RLS/no policies. The two RPCs have pinned search paths, deny anonymous execution, and passed authorized/unrelated HTTP checks; the warnings still require independent review. No Auth settings or paid features were changed.
6. Check production schema drift, grants, role/block/Space semantics, performance, storage quotas, current advisors, and authorization identities separately under an approved production plan. Do not infer production safety from this staging result.
7. The existing bundle warning remains; it is separate from privacy acceptance. No deployment or merge was performed.

References: Supabase [Smart CDN](https://supabase.com/docs/guides/storage/cdn/smart-cdn), [cache purge](https://supabase.com/docs/guides/storage/cdn/purge-cdn-cache), and [Management SQL API](https://supabase.com/docs/reference/api/v1-run-a-query).
