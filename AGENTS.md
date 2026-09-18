# AGENTS.md

## Project Overview

Flic'd is a React social app prototype (photo dumps, rolls, boards, messaging) built with Vite, using Supabase for auth and data persistence.

## Running in Base44

```bash
docker compose -f docker-compose.base44.yml up -d
```

- **web** service: `node:22-slim`, source bind-mounted at `/app`, runs `npm install && npm run dev` (Vite dev server on port 3000, host `0.0.0.0`).
- No database service needed — Supabase is external (hosted).
- `node_modules` is an anonymous volume; npm install runs on container start (~7s).

## Environment variables

| Variable | Source | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | `/run/base44/app.env` | Supabase project URL; placeholder fallback in `.env.base44-defaults` |
| `VITE_SUPABASE_ANON_KEY` | `/run/base44/app.env` | Supabase anon public key; placeholder fallback in `.env.base44-defaults` |

Without real Supabase credentials the app still boots and renders the Auth screen; `supabase.auth.*` calls return errors but do not crash the app (session stays null, guarded data-loading effects return early).

## Architecture notes

- Entry: `src/main.jsx` → `src/app/FlicdApp.jsx` (top-level state + screen routing).
- Supabase client: `src/lib/supabase.js` — uses `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
- Features are organized under `src/features/<name>/` (home, capture, messages, profile, discovery, social, companion, onboarding, seasonal, spaces, competition).
- API wrappers: `src/features/capture/dumpApi.js`, `mediaUpload.js`, `src/features/profile/boardApi.js`, `src/features/social/interactionsApi.js`, `src/features/social/socialApi.js`.
- Supabase schema migrations live in `supabase/migrations/` (only likes/comments tables; profiles/dumps/follows/boards tables are expected to exist in the Supabase project already).
- Onboarding + capybara companion render above the bottom dock via `AppShell.jsx`.

## Verification

- `curl http://localhost:3000` returns the Vite dev HTML (HTTP 200).
- The app's own tests: `npm test` (vitest). Lint: `npm run lint`.
- Frontend edits hot-reload via Vite; no service restart needed for source changes. Restart (`docker compose -f docker-compose.base44.yml restart web`) only after compose/env changes.
