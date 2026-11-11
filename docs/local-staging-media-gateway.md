# Local staging media gateway preview — NOT a hosted deployment

This is a loopback-only **development test harness** built on the existing reviewed
media gateway library. It is scoped to the non-production Supabase project
`flicd-privacy-staging` (`ljcfoanzmowgkjtrdcgg`) and binds only
`127.0.0.1:8787`.

**Never deploy, reverse-proxy, port-forward, tunnel, or bind this script to a LAN or
Internet interface.** It does not implement the independent hostile-transport
controls required by [media-gateway-deployment-contract.md](./media-gateway-deployment-contract.md).

## Windows PowerShell setup

Open a **new** PowerShell window while leaving your Vite frontend window available.

1. From your local flic'd checkout, fetch the isolated development branch:
   ```powershell
   cd "C:\Users\Baco\Downloads\flicd\flicd-live-test"
   git fetch origin dev/local-staging-media-gateway-20261111
   git switch -c local-staging-media-gateway FETCH_HEAD
   ```
   Only do this if you have no unsaved tracked local edits. The branch is based
   on the reviewed Companion+Security candidate; it does not merge either
   review PR.

2. In Supabase Dashboard for **flicd-privacy-staging only**, go to
   **Project Settings → API Keys** and find the **secret / service_role** key
   for this staging project. **Do not put it into chat, a screenshot,
   `.env` with `VITE_*` settings, or GitHub.** The backend must use its own
   private key, not the public `sb_publishable_...` key.

3. Create the ignored local secret file:
   ```powershell
   notepad .env.gateway
   ```
   Enter one line, replacing the placeholder **inside Notepad only**:
   ```dotenv
   FLICD_STAGING_SERVICE_ROLE_KEY=PASTE_YOUR_STAGING_SECRET_HERE
   ```
   Save it. Repository `.gitignore` already excludes `.env.*`.

4. Start the private gateway:
   ```powershell
   node --env-file=.env.gateway scripts/run-local-staging-media-gateway.mjs
   ```
   Keep this PowerShell window open. Requires Node.js with `--env-file` support.

5. In the separate browser frontend `.env`, retain the public Supabase URL
   and publishable key and add this **non-secret** setting:
   ```dotenv
   VITE_MEDIA_GATEWAY_URL=http://127.0.0.1:8787
   ```
   Stop and restart Vite:
   ```powershell
   npm.cmd run dev -- --host 127.0.0.1
   ```
   Open `http://127.0.0.1:5173/` on the same computer.

## Safety and troubleshooting

- This preview accepts only loopback requests from the local frontend origin,
  checks Host and Origin, limits JSON request sizes and basic concurrency, and
  still delegates media authorization to the reviewed SQL and gateway library.
  These are **not** sufficient public deployment controls.
- No remote phone can reach `127.0.0.1` on your PC. For mobile layout tests,
  use Chrome's responsive device emulator. Do not change the binding to
  `0.0.0.0`.
- The secret is a high-privilege backend credential. Keep the test checkout
  and secret file private and rotate that key if accidentally exposed.
- `Media gateway is not configured` in the browser means Vite did not load
  `VITE_MEDIA_GATEWAY_URL`; check the frontend `.env` and restart Vite.
- Browser `TypeError: Failed to fetch` usually means the local gateway
  process is not running or the Origin/Host differs.
- Test with synthetic staging accounts/media first. This runner has not passed
  independent hosted-ingress security approval and must not be treated as
  production-ready.

## Staging migration history note

The five reviewed SQL files from October 19–21 were installed through Supabase's
migration API on November 11, 2026. That API generated new November 11 migration
version IDs. The historical migration IDs in staging therefore **do not match
the source filenames in `supabase/migrations`**, even though the reviewed SQL
content was applied. Reconcile the migration history before attempting a future
automated `supabase db push`; otherwise those files may attempt to run again.
No production project was modified.
