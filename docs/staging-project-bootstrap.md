# Separate Free Supabase project — schema-only staging bootstrap

This file is a checklist, **not** a command that has been run.

## Why a fresh project needs initialization

Supabase preview branches are unavailable on the current Free plan. A separate Free project may be a valid non-production test environment. However, this repository's oldest migration,
`20260916153409_persistent_social_interactions.sql`, already references
`public.dumps`, `public.profiles`, and `public.follows`. The repository
therefore does **not** contain the complete initial database schema.
Running the tracked migrations alone against an empty project will fail.

## Safe staging initialization

1. Create a **separate test project in the chosen flic'd organization**, with a distinct project ref. Confirm its quoted price and project state first. Never use the existing live ref `xbmfphdetgmjzqnxhmgp`.
2. Recover a **schema-only** baseline from the live project (SQL DDL; **no data**), using the current Supabase CLI's documented `supabase db pull` or schema dump workflow. Verify command help in the installed version rather than copy/pasting commands without checking. Review the dump for security-definer functions, policies, grants, triggers, and Storage policies. Protect any connection strings or secret keys.
3. Initialize only the new staging project from the reviewed schema. Do not import real users, posts, conversations, messages, images, files, email addresses, or secrets. Create a separate storage configuration and the required buckets.
4. Apply `20261018050000_stage_private_dump_media_and_membership.sql` **only** to the staging project. Check for schema drift, missing dependencies or circular policies.
5. Create **synthetic** test users via the staging Auth API (not copied credentials or user IDs). Seed dummy public and private profiles, follow relationships, 24h/once Dumps, dump_items, message requests, conversations, Board snapshots and storage objects.
6. Validate the permission matrix in `docs/privacy-staging-rollout.md` using genuinely separate staging user sessions. Read-only catalog assertions alone are not sufficient.
7. Rehearse copying legacy **dummy** media with `node scripts/migrate-legacy-media-staging.mjs --plan`, then `--copy`, then `--verify`. All three require explicit staging-only environment variables. The script copies and updates references but **never deletes original public objects**.
8. Verify that the legacy public object URLs still work until a separate, reviewed deletion step. Rehearse that destructive cleanup separately; a copied file is **not** private while its public original survives.
9. After staging acceptance, prepare a production migration with backups, object inventories, checksums, rollout and rollback criteria and human approval. Do not promote the staging database to production or copy real data into it.

## Current facts

- At the time of the read-only inspection, the existing project had 18 Dump media references and 0 saved Board snapshot references. The public `flicd-media` bucket contained 39 storage objects, which also support other app features. These numbers can change.
- `flicd-media` must **not** be made entirely private without a coordinated redesign of avatars, profile backgrounds, comments and any other intentional public media.
- This is a **new-project** workflow, not Supabase preview branching; creating a Git branch is not a database environment.
