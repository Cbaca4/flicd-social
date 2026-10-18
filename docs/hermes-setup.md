# Hermes Agent for flic'd — Windows setup

This is the **development assistant** setup, not an AI feature inside the flic'd application. Hermes runs on your computer; this repository provides the project-specific rules and GitHub automated checks.

## Why this shape
Start with one interactive, human-reviewed coding agent. Keep its work isolated in a Git worktree; keep CI independent from the agent; do not connect it to production Supabase or configure unattended deployment. More autonomous or scheduled work should follow only after the baseline checks are reliable.

**Repository:** https://github.com/Cbaca4/flicd-social

**Development base, verified 2026-10-17:** `feature/profile-studio-mobile-polish-latest`. The `main` branch is **diverged** and lacks much recent work. Do not merge or rebase these branches automatically. Re-evaluate the base after a human-led integration plan.

## 1. Install Hermes on Windows

Use the official [Hermes Desktop installer](https://hermes-agent.nousresearch.com/desktop) or open a **PowerShell** terminal and run the official native installer:

```powershell
iex (irm https://hermes-agent.nousresearch.com/install.ps1)
```

Read the official [quickstart](https://hermes-agent.nousresearch.com/docs/getting-started/quickstart) and [Windows notes](https://hermes-agent.nousresearch.com/docs/user-guide/windows-native). Review any downloaded script before executing if desired. Close and reopen PowerShell when the installer finishes.

Choose and authenticate a model/provider:

```powershell
hermes model
# Or, if you have a Nous Portal subscription:
# hermes setup --portal
hermes doctor
```

Hermes Agent is open source, but model inference/provider usage can cost money. Keep the setup single-agent initially.

## 2. Configure approvals (PowerShell)

```powershell
hermes config set approvals.mode manual
hermes config set approvals.cron_mode deny
hermes config set approvals.single_query_mode deny
hermes config set approvals.unattended_mode deny
hermes config get approvals.mode
```

These are cautious interactive defaults. Do not use `--yolo`, set approval mode to `off`, or configure a remote messaging gateway / unattended jobs for the first audit. Approval prompts are one defense, **not** an OS-level filesystem sandbox; use a separate worktree and no production credentials. If available and configured correctly, a container or separate OS account provides stronger isolation. Check [Hermes security](https://hermes-agent.nousresearch.com/docs/user-guide/security).

## 3. Create a dedicated code checkout

In **PowerShell**, navigate to the *existing flic'd repository root on your computer*. Before doing anything:

```powershell
git status
git fetch origin
```

Do not discard or overwrite existing local edits.

**After the Hermes foundation PR has been reviewed and merged into the development base**, create an isolated working directory without touching your current checkout:

```powershell
git worktree add -b agent/flicd-first-audit ..\flicd-hermes origin/feature/profile-studio-mobile-polish-latest
cd ..\flicd-hermes
git branch --show-current
```

If that branch or worktree name already exists, choose another name such as `agent/flicd-audit-2` and a different directory.

**To evaluate before the foundation PR is merged**, use the same worktree command with `origin/chore/hermes-agent-foundation` as the final argument. Do not assume an unmerged setup branch is the new default development base.

## 4. Verify the app without live credentials

```powershell
npm ci
$env:VITE_SUPABASE_URL = "https://example.supabase.co"
$env:VITE_SUPABASE_ANON_KEY = "ci-nonproduction-placeholder"
npm run lint
npm test
npm run build
```

The placeholders are for tests/build **only**; they are not a running Supabase backend. Never give Hermes a production service-role key. If verification fails, preserve and report the output instead of hiding it.

For normal interactive development, the sample file `.env.example` documents the frontend variables needed. Place actual public development project configuration in a local ignored `.env` **only when you specifically need connected manual testing**. Never commit or print that file. Supabase RLS and role-based tests are required before beta launch.

## 5. Start Hermes in the worktree

From `..\flicd-hermes`:

```powershell
hermes
```

Hermes loads this repository's `AGENTS.md` at session start. If the file changes, restart the session to load updated project guidance.

**Paste this as the first prompt:**

> You are the flic'd engineering agent. Read AGENTS.md, package.json, the current directory layout, Supabase migrations, and tests. Perform a read-only engineering audit. Do not modify files, run migrations, deploy, or contact production services. Establish the actual lint/test/build baseline, identify the five highest-priority blockers to a private beta, and write a proposed sequence of small pull requests. Identify which parts are verified vs unverified. Before any code change, request my approval.

For the first real coding task, specify one concrete issue and ask Hermes to work on a separate branch, run checks, and prepare a PR for your review. Confirm the PR's **base** is the active development branch, not `main`.

## CI and review flow

- `.github/workflows/verify.yml` runs locked dependency install, ESLint, Vitest, and a Vite build for pull requests and pushes to the specified integration branches.
- CI uses non-production placeholder environment values. It does not connect to or apply migrations to production.
- A failing check is a reported blocker, not evidence the setup has succeeded. Fix baseline failures before setting required status checks.
- Human approval is required for merges, database schema/RLS changes, deployments, licensing-sensitive changes, and production access.
- After checks are reliable, consider protecting the development branch with required reviews and CI status checks in GitHub repository settings.

## What to add later (not in v1)

Once testing and the PR workflow are stable: scheduled read-only health summaries, issue triage, targeted test generation, specialized audit skills, and staging-only environment verification. Avoid autonomous deployment, production writes, or personal-data access.

### References
- [Hermes project context files](https://hermes-agent.nousresearch.com/docs/user-guide/features/context-files)
- [Hermes Git worktrees](https://hermes-agent.nousresearch.com/docs/user-guide/git-worktrees)
- [Hermes Windows quickstart](https://hermes-agent.nousresearch.com/docs/user-guide/windows-native)
- [GitHub Actions documentation](https://docs.github.com/en/actions)
