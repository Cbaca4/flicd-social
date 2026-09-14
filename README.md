# Flic'd

Flic'd is a social app prototype focused on temporary photo dumps, rolls, spaces, discovery, messaging, profile boards, and customizable identity.

## Development

```bash
npm install
npm run dev
npm run build
npm test
```

The source prototype supplied with this workspace is preserved in `src/FlicdLegacy.jsx` and the original blueprint in `blueprint.md`.

## Verification baseline

This repository was initialized from the supplied prototype and blueprint because the uploads did not include a package manifest or Git metadata. Baseline verification begins with the first Vite build and test run.

## Repository layout

- `src/app/` — application shell and top-level state
- `src/components/` — shared UI primitives and navigation
- `src/features/home/` — home feed and viewer
- `src/features/capture/` — dump/roll creation
- `src/features/messages/` — requests and conversations
- `src/features/profile/` — profile, boards, and Profile Studio
- `src/features/discovery/` — Explore and Global discovery
- `src/features/competition/` — photo competition ranking
- `docs/superpowers/specs/` — approved product design
- `docs/superpowers/plans/` — implementation plan
- `docs/superpowers/prd-checklist.md` — verification ledger

## Verification note

The environment could not complete `npm install` because access to the npm registry timed out. Therefore package-backed test/build verification is explicitly marked BLOCKED rather than being claimed as passing. Source-level checks and requirement mapping were still completed.
