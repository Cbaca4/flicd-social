# Flic'd

Flic'd is a social app prototype focused on temporary photo dumps, rolls, spaces, discovery, messaging, profile boards, and customizable identity.

## Development

```bash
npm ci
npm run dev
npm run lint
npm test
npm run build
```

Copy `.env.example` to local `.env` and fill in **public/development client** variables only when connected testing is needed. Never put a Supabase service-role or secret key in a `VITE_` variable.

## AI-assisted development

- `AGENTS.md` — repository conventions, product invariants, safe agent workflow.
- `docs/hermes-setup.md` — Windows setup, isolated worktree instructions, first audit prompt.
- `.github/workflows/verify.yml` — lint, test, build verification on pull requests.

The active development branch as of 2026-10-17 is `feature/profile-studio-mobile-polish-latest`. `main` has diverged and is not the latest feature baseline. Reconcile branches carefully before changing the integration target.

## Repository layout

- `src/app/` — application shell and top-level state
- `src/components/` — shared UI primitives and navigation
- `src/features/home/` — home feed and viewer
- `src/features/capture/` — dump/roll creation
- `src/features/messages/` — requests and conversations
- `src/features/profile/` — profile, boards, Archive and Profile Studio
- `src/features/music/` — On Repeat, track picker, credits and audio control
- `src/features/social/` — follows, comments and notifications
- `src/features/discovery/` — Explore and Global discovery
- `src/features/competition/` — photo competition ranking
- `supabase/migrations/` — backend schema changes (require review before remote apply)
- `docs/superpowers/specs/` — prior approved product design
- `docs/superpowers/plans/` — prior implementation plans
- `docs/superpowers/prd-checklist.md` — verification ledger
- `blueprint.md` — early product blueprint

## Verification note

Early baseline documentation predates recent development. Checks added by the Hermes foundation PR are intended to establish a current CI baseline; do not interpret their presence as proof that every check is already passing.
