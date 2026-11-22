# flic’d — release acceptance ledger

**Baseline:** November 21, 2026 audit, commit `13f983d`. **Remediation:** November 22, 2026, draft PR #27 based on Profile 2.0 PR #26. Do not confuse committed code with production rollout or store approval.

## How to use this ledger

- **Implemented / test pending** means a fix is committed to PR #27 and needs a green latest-sha CI run and live staging QA.
- **Prior green scoped evidence** records previously successful synthetic tests at their specific commits, not a release approval.
- **Blocking** means a technical feature, external dependency, or signed-off release process is still incomplete.
- Never enable/deploy `scripts/run-local-staging-media-gateway.mjs` on the public Internet; this is localhost-only.

| # | Requirement | Status / next evidence |
|---|---|---|
| 1 | Private accounts and media access | Partial: private dump storage/RLS code and synthetic tests exist. Independently verify staging and production parity and two-account negative tests. |
| 2 | 24-hour expiry | Partial: Home, direct lookup, Profile, and Explore now filter 24h/once cards. Backend authorization/retention and expired media must be tested separately. |
| 3 | View Once replay prevention | Partial: trusted per-account SQL claims and owner generation fix ported into PR #27; live two-account creator/recipient test remains. |
| 4 | Protected DMs and private Boards | Partial: reviewed security implementations; live membership, account switching and keep/Board tests required. |
| 5 | Auth and credential dispatch | Partial: scoped auth tests, corrected onboarding username preserve, email confirmation and recovery handling in PR #27; provider configuration/redirect testing required. |
| 6 | Report posts, people, comments, messages | Blocking: comment reporting exists; complete reporting across UGC surfaces and a working review queue are not verified. |
| 7 | Block users | Partial: feature implemented; cross-account live behavior across all surfaces still unverified. |
| 8 | Moderation operations | Blocking: report triage, escalation, takedowns, repeat offenders, response/appeals and staff access policy require an operational implementation. |
| 9 | Community Guidelines and Terms | Blocking: publish reviewed and approved terms and guidelines with working in-app and web links. |
| 10 | Child-safety standards | Blocking: child-safety policy, dedicated contact and response procedures, abuse escalation and correct store declarations. |
| 11 | Privacy policy | Blocking: written and reviewed public privacy policy and working public URL. |
| 12 | Account and data deletion | Blocking: authenticated deletion workflow, managed-storage/backups behavior, operator tests, and public web-deletion entry point. Never delete real accounts during synthetic tests. |
| 13 | Permissions | Unknown: native iOS/Android camera/photos/microphone/notifications disclosures and device tests. |
| 14 | Privacy/Data safety forms | Unknown: final data-inventory and store-console declarations after all integrations are frozen. |
| 15 | Age ratings | Unknown: finalize UGC age/safety model and complete store questionnaires. |
| 16 | Feed and Explore | Implemented / test pending: `savedDumps` source regression fixed; Explore View Once TTL corrected. Need CI and real authenticated browser verification. |
| 17 | Uploads/messages/notifications | Partial: code exists; real-device and multi-account regression required. |
| 18 | Native mobile compatibility | Blocking: create reviewed native packaging and validate iOS Safari/Android Chrome plus native shells. |
| 19 | No release-blocking bugs/accessibility | Blocking: full current-sha CI, manual keyboard/reader/touch review and critical bug triage. |
| 20 | Store demo accounts | Unknown: nonproduction seeded review users and reproducible reviewer guidance, no private user data. |
| 21 | Music commercial rights | Partial: beta metadata/licenses exist. Confirm originals, permitted commercial use, credits and replay against actual source files. |
| 22 | GIF third-party terms | Unknown: GIPHY entitlement/production use, attribution and terms compliance. |
| 23 | App icon/listing/support | Blocking: support contact, public help/legal pages, store icon/screenshots/descriptions. |
| 24 | Signed native binaries | Blocking: signed Xcode archive and Android App Bundle with release credentials and device tests. |
| 25 | Store submissions/approval | Unknown: Apple/Google developer access, compliance responses, review outcomes, and gradual rollout plan. |

## Current engineering work in PR #27

- Fix escaped-comment regression hiding the `getFeedDumps()` call.
- Update obsolete Profile Studio tests to reflect removed Sections/roundness controls while retaining background and custom header photo controls.
- Preserve edited usernames through onboarding (`ON CONFLICT DO NOTHING` strategy).
- Remove user-controlled PostgREST `.or()` search-expression interpolation and escape SQL LIKE wildcards.
- Expire View Once cards in Explore as well as main feed/profile.
- Integrate PR #25's authenticated creator media generation into Profile 2.0 and add isolation/StrictMode regressions.
- Add session-aware signup confirmation, a password reset request UI, and `PASSWORD_RECOVERY` update form with tests.

**Next gate:** Latest-sha CI lint, all tests, build, SQL policy tests; inspect failures. Then independent two-account private/view-once/media/messaging tests and a separate security review. No production migrations or hosting activation in this branch.

## Relevant evidence

- [Initial readiness audit](https://github.com/Cbaca4/flicd-social/commit/13f983d0777a9d5f41c5652c03cb170c4c46eec9) — snapshot, not a release artifact
- [Profile 2.0 draft](https://github.com/Cbaca4/flicd-social/pull/26)
- [Release remediation draft](https://github.com/Cbaca4/flicd-social/pull/27)
- [Creator-generation fix](https://github.com/Cbaca4/flicd-social/pull/25)
- [Security/privacy foundation](https://github.com/Cbaca4/flicd-social/pull/12)
- [Production media deployment contract](https://github.com/Cbaca4/flicd-social/blob/feature/immersive-hybrid-profile/docs/media-gateway-deployment-contract.md)

Update this ledger only with dated, linkable evidence for each status; do not mark complete based solely on UI presence or tests of a different SHA.
