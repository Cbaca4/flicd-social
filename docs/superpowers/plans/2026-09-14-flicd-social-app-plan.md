# Flic'd Social App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the current Flic'd prototype into a responsive, production-oriented social app while preserving its existing dump/roll/space behavior and adding Messages, Profile Boards, Global Photo Competition, and Profile Studio.

**Architecture:** Split the current monolithic React prototype into focused feature components and shared UI primitives. Keep UI state in feature hooks/components, route application state through a small app shell, and keep persistence/business rules behind data/API boundaries so privacy remains enforced by the existing backend/RLS model.

**Tech Stack:** React, existing JavaScript/JSX stack, lucide-react, existing styling approach, Supabase/backend structures already described by the blueprint. Preserve the project's existing build tooling and dependency choices unless verification shows they are broken or insufficient.

**Spec:** `docs/superpowers/specs/2026-09-14-flicd-social-app-design.md`

## Global Constraints

- Preserve the existing Flic'd product concepts: Spaces, Dumps, Rolls, temporary content, context notes, Kept/Boards, and privacy-first behavior.
- Primary navigation is Home, Discovery, Capture, Messages, Profile.
- Boards move into Profile and are not removed from the product.
- Discovery gains Explore and Global competition sections.
- Messages has Pending and Chats sections.
- Profile Studio customizes presentation only and never bypasses content privacy rules.
- The app must be responsive across mobile, tablet, laptop, desktop, and large displays.
- A PRD item is checked only after implementation and verification.
- Do not hide errors, suppress warnings, or leave dead primary interactions.
- Existing backend/RLS privacy enforcement remains authoritative.

---

### Task 1: Establish a runnable Git-backed project and baseline verification

**Files:**
- Create: `.gitignore` if missing
- Create: `README.md` if missing
- Modify: existing project manifest/config only when verification requires it

**Interfaces:**
- Produces a reproducible project root that can be initialized as a Git repository and run with the existing development command.

- [ ] **Step 1: Inspect the project directory and identify the real application entry point.**

Run:
```bash
pwd
find . -maxdepth 2 -type f | sort | head -200
```
Expected: identify `package.json`, source entry points, and any existing config.

- [ ] **Step 2: Verify the current app can install/build/run before refactoring.**

Run the repository's existing commands from `package.json`; if no test command exists, run the build command and start the dev server long enough to verify compilation.
Expected: record the first baseline failures rather than modifying code to hide them.

- [ ] **Step 3: Initialize Git in the project root if `.git` is absent.**

Run:
```bash
git init
git branch -M main
git status
```
Expected: Git reports the project files as untracked/modified and the branch is `main`.

- [ ] **Step 4: Add repository hygiene files without changing application behavior.**

Ensure `.gitignore` excludes at least build output, dependency folders, local environment files, and editor/system artifacts appropriate to the existing stack.

- [ ] **Step 5: Create the baseline commit.**

Run:
```bash
git add .
git commit -m "chore: initialize Flic'd project"
```
Expected: a clean baseline commit containing the starting project.

- [ ] **Step 6: Tag the baseline verification in the implementation notes.**

Record the exact commands used and any pre-existing failures in `README.md` under a short "Development verification" section.

---

### Task 2: Extract shared visual primitives and application shell

**Files:**
- Create: `src/components/shared/Surface.jsx`
- Create: `src/components/shared/Pill.jsx`
- Create: `src/components/shared/EmptyState.jsx`
- Create: `src/components/shared/LoadingState.jsx`
- Create: `src/components/shared/ErrorState.jsx`
- Create: `src/components/navigation/BottomNav.jsx`
- Create: `src/app/AppShell.jsx`
- Modify: current `flicd-prototype-v2.jsx` or actual app entry after inspecting project structure

**Interfaces:**
- `BottomNav({ screen, onNavigate, onCapture })`
- `AppShell({ screen, onNavigate, onCapture, children })`
- Shared state/presentation primitives use the existing Flic'd palette and typography.

- [ ] **Step 1: Write failing component-level tests for navigation labels and active state.**

Use the project's available React test tooling. Assert that Home, Discovery, Messages, and Profile render and Capture invokes its callback.

- [ ] **Step 2: Run the new tests and verify they fail because the extracted shell does not yet exist.**

Expected: failures reference missing components or behavior.

- [ ] **Step 3: Extract the palette/font tokens from the monolith into shared style constants or existing style files without changing their values.**

Preserve the established palette and Space Grotesk/IBM Plex Mono pairing from the prototype.

- [ ] **Step 4: Implement shared primitives and the responsive app shell.**

The shell must replace the fixed 360x700 outer canvas with a fluid viewport layout, while retaining an optional constrained content width on large displays.

- [ ] **Step 5: Implement the floating translucent rounded bottom dock.**

Use `Home`, `Compass`, Capture button, `MessageCircle`, and `User` icons. Remove Boards from primary navigation.

- [ ] **Step 6: Run tests and build.**

Expected: navigation tests pass; build succeeds without new warnings/errors.

- [ ] **Step 7: Commit.**

```bash
git add src
git commit -m "refactor: add responsive app shell and navigation"
```

---

### Task 3: Refactor Home, viewer, Spaces, Dump, and Roll into feature modules

**Files:**
- Create: `src/features/home/Home.jsx`
- Create: `src/features/home/DumpCard.jsx`
- Create: `src/features/home/Viewer.jsx`
- Create: `src/features/spaces/SpaceSwitcher.jsx`
- Create: `src/features/capture/CreateChoose.jsx`
- Create: `src/features/capture/DumpBuilder.jsx`
- Create: `src/features/capture/RollBuilder.jsx`
- Create: `src/features/home/homeState.js`
- Create: `src/features/capture/captureState.js`
- Modify: `src/app/FlicdApp.jsx` or actual entry point

**Interfaces:**
- Preserve the current props/contracts for post opening, liking, commenting, viewing, and keeping content.
- Capture builders emit normalized payloads for dump/roll creation.

- [ ] **Step 1: Add regression tests for existing dump/roll behavior.**

Cover: expiration label calculation, once-mode viewed behavior, liking, commenting, keep action, dump creation, and roll frame counts.

- [ ] **Step 2: Run tests and confirm at least one test fails against the current monolith for the new extracted boundaries.**

Expected: test failures identify the refactor boundaries rather than hidden behavior changes.

- [ ] **Step 3: Extract Home and Viewer first without changing visible behavior.**

Keep existing mood labels, expiration labels, comments, likes, context-card behavior, and keep interactions.

- [ ] **Step 4: Extract SpaceSwitcher and preserve active-space behavior.**

Ensure switching returns to Profile when appropriate and does not mutate unrelated feed state.

- [ ] **Step 5: Extract DumpBuilder and RollBuilder.**

Preserve 20-item dump limit, mood selection, expiration selection, posting-space selection, roll frame counts, sequential capture behavior, and reveal step.

- [ ] **Step 6: Move seed data/state helpers out of the monolithic component.**

Do not duplicate the same state in multiple features.

- [ ] **Step 7: Run regression tests and build.**

Expected: all prior behavior remains functional.

- [ ] **Step 8: Commit.**

```bash
git add src
 git commit -m "refactor: split core Flic'd features into modules"
```

---

### Task 4: Build Messages with Pending and Chats

**Files:**
- Create: `src/features/messages/Messages.jsx`
- Create: `src/features/messages/PendingRequests.jsx`
- Create: `src/features/messages/ChatList.jsx`
- Create: `src/features/messages/Conversation.jsx`
- Create: `src/features/messages/messageState.js`
- Create: `src/features/messages/messageApi.js` if the existing project has an API layer

**Interfaces:**
- `acceptRequest(requestId)`
- `declineRequest(requestId)`
- `sendMessage(conversationId, text)`
- `openConversation(conversationId)`
- `Messages` consumes pending and accepted message collections.

- [ ] **Step 1: Write failing tests for request acceptance, decline, chat filtering, and send validation.**

Assert that pending requests stay out of Chats until accepted, declined requests disappear from Pending, empty states render, and blank messages are rejected.

- [ ] **Step 2: Run tests to verify the new message behavior fails before implementation.**

- [ ] **Step 3: Implement PendingRequests against the existing pending/accepted/declined message model.**

Do not invent a separate client-only permission model.

- [ ] **Step 4: Implement ChatList using only accepted conversations.**

Render profile image/name, latest message, timestamp, and unread state where data exists.

- [ ] **Step 5: Implement Conversation with send flow and loading/error states.**

Use the existing backend if available; otherwise keep the data adapter boundary explicit so persistence can be wired without rewriting UI components.

- [ ] **Step 6: Enforce blocking behavior at the data boundary.**

Do not attempt to bypass the existing backend block rules from the UI.

- [ ] **Step 7: Run tests and build.**

Expected: all message acceptance tests pass and navigation reaches Messages.

- [ ] **Step 8: Commit.**

```bash
git add src
 git commit -m "feat: add pending requests and accepted chats"
```

---

### Task 5: Move Boards into Profile

**Files:**
- Create: `src/features/profile/Profile.jsx`
- Create: `src/features/profile/BoardsSection.jsx`
- Create: `src/features/profile/BoardGrid.jsx`
- Create: `src/features/profile/boardState.js`
- Modify: existing profile/boards code

**Interfaces:**
- `Profile` receives active-space/profile data and board data.
- Board actions remain compatible with existing keep behavior.

- [ ] **Step 1: Write failing tests for board rendering inside Profile and removal of Boards from primary navigation.**

- [ ] **Step 2: Implement the Profile hub with identity, spaces, follower/following stats, and boards.**

Preserve existing space-switcher and feed-preference functionality.

- [ ] **Step 3: Move the existing Kept grid into BoardsSection and preserve saved content behavior.**

- [ ] **Step 4: Add board creation/edit presentation only where supported by the existing data model.**

Do not create duplicate storage for board items.

- [ ] **Step 5: Verify Boards is unreachable from the main navigation but remains accessible from Profile.**

- [ ] **Step 6: Run tests and build.**

- [ ] **Step 7: Commit.**

```bash
git add src
 git commit -m "feat: integrate boards into profile"
```

---

### Task 6: Expand Discovery into Explore and Global Competition

**Files:**
- Create: `src/features/discovery/Discovery.jsx`
- Create: `src/features/discovery/Explore.jsx`
- Create: `src/features/competition/GlobalCompetition.jsx`
- Create: `src/features/competition/Podium.jsx`
- Create: `src/features/competition/RankedSubmission.jsx`
- Create: `src/features/competition/SubmissionForm.jsx`
- Create: `src/features/competition/competitionState.js`
- Create: `src/features/competition/competitionApi.js` if backend integration exists

**Interfaces:**
- Competition submission: `{ media, caption }`
- Ranked entry: `{ rank, user, submission, likes }`
- Competition API/data layer exposes current competition, submissions, and vote state.

- [ ] **Step 1: Write failing tests for Explore/Global switching, podium ordering, ranking ties, and submission validation.**

- [ ] **Step 2: Implement Discovery tabs while preserving the current interest-trail/randomize behavior in Explore.**

- [ ] **Step 3: Implement Global competition empty/loading/error states.**

- [ ] **Step 4: Implement photo submission with preview and validation.**

Reject unsupported/invalid media at the UI boundary and preserve a backend validation boundary.

- [ ] **Step 5: Implement deterministic ranking logic.**

Sort by eligible like/vote count and apply an explicit deterministic secondary ordering for ties so the UI never produces ambiguous positions.

- [ ] **Step 6: Implement the visual 1st/2nd/3rd podium and subsequent ranked entries.**

The podium must be visually distinct from normal ranked cards.

- [ ] **Step 7: Implement like/vote state with duplicate-vote protection through the data boundary.**

- [ ] **Step 8: Add reporting entry points and ensure blocked/removed submissions do not leak into the competition UI.**

Use existing report/block infrastructure.

- [ ] **Step 9: Run tests and build.**

- [ ] **Step 10: Commit.**

```bash
git add src
 git commit -m "feat: add global photo competition to discovery"
```

---

### Task 7: Implement Profile Studio and persisted profile_theme model

**Files:**
- Create: `src/features/profile/ProfileStudio.jsx`
- Create: `src/features/profile/ProfilePreview.jsx`
- Create: `src/features/profile/profileTheme.js`
- Create: `src/features/profile/profileThemeApi.js` if needed by the existing backend adapter
- Modify: `src/features/profile/Profile.jsx`
- Modify: schema/migration files only if the existing `profile_theme` field is not already available

**Interfaces:**
- `profileTheme` contains presentation-only settings such as background, accent, transparency, borders, radius, typography choice, section order/visibility, board presentation, header treatment, status/mood, interests, optional music/artist field, message, and badges.
- `sanitizeProfileTheme(input) -> profileTheme`
- `saveProfileTheme(profileId, profileTheme)`

- [ ] **Step 1: Write failing unit tests for theme sanitization and privacy boundaries.**

Test invalid colors, oversized strings, unsupported style values, invalid section names, and confirm theme data cannot change content visibility.

- [ ] **Step 2: Implement a strict theme schema/sanitizer.**

Normalize unsupported values instead of allowing arbitrary user-supplied style/configuration data to reach rendering.

- [ ] **Step 3: Implement Profile Studio appearance controls.**

Include background color/gradient/image where supported, accent, transparency, border style, corner radius, and approved typography choices.

- [ ] **Step 4: Implement layout controls.**

Allow supported sections to be reordered/shown/hidden and allow board presentation/pinned board configuration without duplicating board data.

- [ ] **Step 5: Implement profile personality controls.**

Support header treatment, status/mood, interests, optional favorite music/artist field, personal message, and optional badges.

- [ ] **Step 6: Implement live ProfilePreview.**

Every unsaved control change must update preview state immediately without persisting until Save.

- [ ] **Step 7: Implement Save and Cancel semantics.**

Save persists the sanitized theme through the existing backend field. Cancel restores the last persisted theme.

- [ ] **Step 8: Re-render a public/profile view from persisted theme data while preserving all existing content permissions.**

- [ ] **Step 9: Run unit/component tests and build.**

- [ ] **Step 10: Commit.**

```bash
git add src
git commit -m "feat: add customizable Profile Studio"
```

---

### Task 8: Responsive design, accessibility, and interaction polish pass

**Files:**
- Modify: all feature components as needed
- Create/modify: global responsive style/token files

**Interfaces:**
- No public API changes; improve layout and accessibility behavior only.

- [ ] **Step 1: Write responsive tests or automated viewport checks for key screens.**

Cover mobile portrait, mobile landscape, tablet, desktop, and large display widths.

- [ ] **Step 2: Remove remaining hard-coded phone-shell dimensions from the application root.**

- [ ] **Step 3: Add safe-area handling to the bottom dock and full-height screens.**

- [ ] **Step 4: Tune grids, typography, modals, cards, messages, profile layouts, and podium presentation using fluid CSS rather than device-specific hacks.**

- [ ] **Step 5: Add keyboard focus states and semantic labels to interactive controls.**

The capture button, navigation items, like buttons, request actions, message send, board actions, and profile editor controls must all have usable labels/focus states.

- [ ] **Step 6: Verify no horizontal overflow exists at supported viewport widths.**

Use browser/device tooling available in the project and inspect `document.documentElement.scrollWidth` versus `clientWidth` where appropriate.

- [ ] **Step 7: Add subtle transitions without making primary actions dependent on animation.**

- [ ] **Step 8: Run full test suite and production build.**

- [ ] **Step 9: Commit.**

```bash
git add src
 git commit -m "polish: make Flic'd responsive and accessible"
```

---

### Task 9: End-to-end PRD verification and defect sweep

**Files:**
- Create: `docs/superpowers/prd-checklist.md`
- Modify: implementation files only for verified defects

**Interfaces:**
- `prd-checklist.md` maps every requirement in the approved spec to a verification result.

- [ ] **Step 1: Build a checklist containing every approved PRD acceptance criterion.**

Use explicit states: `NOT VERIFIED`, `PASS`, `FAIL`.

- [ ] **Step 2: Run the complete automated test/build suite.**

Expected: all automated tests pass and production build succeeds.

- [ ] **Step 3: Manually verify navigation and primary user flows.**

Verify Sign Up → Home → Discovery → Capture → Messages → Profile, including return paths and viewer flows.

- [ ] **Step 4: Verify Messages.**

Check Pending accept/decline, Chats filtering, conversation open/send, unread/empty/error states, and blocking behavior.

- [ ] **Step 5: Verify Discovery competition.**

Check submission, preview, validation, ranking, podium, voting, duplicate-vote handling, reporting, and empty/loading/error states.

- [ ] **Step 6: Verify Profile and Profile Studio.**

Check Boards placement, board access, Studio editing, live preview, Save, Cancel, persisted theme reload, responsive editor, and privacy preservation.

- [ ] **Step 7: Verify responsive layouts at representative viewport sizes.**

Inspect mobile portrait, mobile landscape, tablet, laptop, desktop, and large-display states.

- [ ] **Step 8: Inspect runtime/browser console output.**

Fix application-caused errors and avoidable warnings; do not silence them with blanket suppression.

- [ ] **Step 9: Mark a PRD item complete only when its verification evidence is recorded.**

- [ ] **Step 10: Fix every failed item and rerun its verification.**

- [ ] **Step 11: Create final verification commit.**

```bash
git add .
git commit -m "test: verify Flic'd PRD completion"
```

---

### Task 10: Final documentation and repository handoff

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/prd-checklist.md`
- Keep: `docs/superpowers/specs/2026-09-14-flicd-social-app-design.md`

**Interfaces:**
- README documents install/run/test/build commands and current project architecture.
- PRD checklist records final PASS/FAIL evidence and remaining limitations.

- [ ] **Step 1: Document how to install and run the app from a clean checkout.**

- [ ] **Step 2: Document test/build/lint commands that were actually verified.**

- [ ] **Step 3: Document the final feature architecture and key data boundaries.**

- [ ] **Step 4: Document any external configuration still required for Supabase/Auth/OAuth/storage and do not claim those are implemented unless verified.**

- [ ] **Step 5: Confirm the working tree is clean.**

Run:
```bash
git status --short
```
Expected: no unexpected uncommitted application changes.

- [ ] **Step 6: Record the final commit hash and verification summary in the handoff notes.**

