# Flic'd Companion v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-ready v1 floating capybara Companion with autonomous bounded movement, idle/interaction reactions, dragging, Companion/Quiet modes, local persistence, and data-driven seasonal behavior.

**Architecture:** The Companion is an independent feature mounted at the app-shell level, not inside Boards. A small state/utility layer owns position, mode, movement boundaries, and persistence; the React component owns pointer interaction and visual animation. Existing `seasonalEvents.js` remains the single source of truth for holiday metadata, and Companion behavior reads its active event data without creating a second seasonal system.

**Tech Stack:** React 19, JavaScript, Vite, CSS, Vitest, Testing Library, existing `lucide-react` icons where useful.

**Spec:** `docs/superpowers/specs/2026-09-16-flicd-companion-v1-design.md`

## Global Constraints

- Companion must remain independent from Boards.
- Companion character is a capybara.
- v1 includes overlay, bounded autonomous movement, idle animations, click/tap reactions, dragging, Companion mode, and Quiet mode.
- Position and mode persist locally in the browser; no new Supabase table is required for v1 movement state.
- Existing seasonal event data is the source of truth for seasonal Companion appearance/reactions.
- Companion must respect the existing responsive app shell and avoid blocking primary navigation/actions.
- Reduced-motion preferences must disable autonomous animation while preserving interaction and accessibility.
- Existing tests and production build must remain passing.

---

### Task 1: Define Companion state and movement utilities

**Files:**
- Create: `src/features/companion/companionState.js`
- Test: `src/features/companion/companionState.test.js`

**Interfaces:**
- Produces `COMPANION_MODES = { ACTIVE: "active", QUIET: "quiet" }`.
- Produces `DEFAULT_COMPANION_STATE` with normalized x/y percentages and active mode.
- Produces `clampCompanionPosition(position)` returning `{ x, y }` constrained to `0..100`.
- Produces `getRandomCompanionTarget(current, random = Math.random)` returning a bounded `{ x, y }` with a minimum movement distance when possible.
- Produces `moveCompanionToward(current, target, step)` returning a bounded position.
- Produces `getCompanionStorageKey(userId)`.

- [ ] **Step 1: Write the failing tests**

```js
import { describe, expect, it } from "vitest";
import {
  COMPANION_MODES,
  DEFAULT_COMPANION_STATE,
  clampCompanionPosition,
  getCompanionStorageKey,
  getRandomCompanionTarget,
  moveCompanionToward,
} from "./companionState.js";

describe("companion state", () => {
  it("clamps positions to the playable bounds", () => {
    expect(clampCompanionPosition({ x: -10, y: 130 })).toEqual({ x: 0, y: 100 });
  });

  it("moves toward a target without leaving bounds", () => {
    expect(moveCompanionToward({ x: 10, y: 10 }, { x: 50, y: 30 }, 20)).toEqual({ x: 30, y: 20 });
  });

  it("generates a bounded target", () => {
    const target = getRandomCompanionTarget({ x: 50, y: 50 }, () => 0.9);
    expect(target.x).toBeGreaterThanOrEqual(8);
    expect(target.x).toBeLessThanOrEqual(92);
    expect(target.y).toBeGreaterThanOrEqual(18);
    expect(target.y).toBeLessThanOrEqual(82);
  });

  it("uses a user-scoped storage key", () => {
    expect(getCompanionStorageKey("user-123")).toBe("flicd:companion:user-123");
  });

  it("defines active and quiet modes", () => {
    expect(COMPANION_MODES).toEqual({ ACTIVE: "active", QUIET: "quiet" });
    expect(DEFAULT_COMPANION_STATE.mode).toBe("active");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/companion/companionState.test.js`
Expected: FAIL because `companionState.js` does not yet exist.

- [ ] **Step 3: Implement the minimal utilities**

```js
export const COMPANION_MODES = Object.freeze({ ACTIVE: "active", QUIET: "quiet" });
export const DEFAULT_COMPANION_STATE = Object.freeze({ x: 82, y: 76, mode: COMPANION_MODES.ACTIVE });

export function clampCompanionPosition({ x, y }) {
  return { x: Math.min(92, Math.max(8, x)), y: Math.min(82, Math.max(18, y)) };
}

export function getRandomCompanionTarget(current, random = Math.random) {
  const target = clampCompanionPosition({ x: random() * 100, y: random() * 100 });
  const movedEnough = Math.abs(target.x - current.x) + Math.abs(target.y - current.y) >= 12;
  return movedEnough ? target : clampCompanionPosition({ x: current.x + 16, y: current.y - 10 });
}

export function moveCompanionToward(current, target, step) {
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  const distance = Math.hypot(dx, dy);
  if (!distance || distance <= step) return clampCompanionPosition(target);
  return clampCompanionPosition({ x: current.x + (dx / distance) * step, y: current.y + (dy / distance) * step });
}

export function getCompanionStorageKey(userId) {
  return `flicd:companion:${userId}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/companion/companionState.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/companion/companionState.js src/features/companion/companionState.test.js
git commit -m "feat: add companion state utilities"
```

---

### Task 2: Build the capybara Companion component

**Files:**
- Create: `src/features/companion/Companion.jsx`
- Test: `src/features/companion/Companion.test.jsx`

**Interfaces:**
- Consumes `userId`, `enabled`, `seasonalEvent`, `onModeChange`.
- Renders an accessible button representing the capybara.
- Exposes a compact controls button for Companion/Quiet mode.
- Uses native pointer events so drag works with mouse and touch without adding a dependency.
- Produces seasonal classes/labels from the supplied event rather than hardcoding holiday dates.

- [ ] **Step 1: Write the failing component tests**

```jsx
import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Companion from "./Companion.jsx";

const christmas = {
  id: "christmas",
  label: "Christmas",
  character: { hat: "santa", accessory: "scarf" },
  interaction: { target: "snow", reaction: "playful" },
};

describe("Companion", () => {
  it("renders a capybara companion", () => {
    render(<Companion userId="u1" enabled seasonalEvent={null} />);
    expect(screen.getByRole("button", { name: /capybara companion/i })).toBeInTheDocument();
  });

  it("reacts when tapped", async () => {
    render(<Companion userId="u1" enabled seasonalEvent={null} />);
    await userEvent.click(screen.getByRole("button", { name: /capybara companion/i }));
    expect(screen.getByText("✨")).toBeInTheDocument();
  });

  it("shows seasonal capybara treatment from event data", () => {
    render(<Companion userId="u1" enabled seasonalEvent={christmas} />);
    expect(screen.getByLabelText(/Christmas companion/i)).toBeInTheDocument();
    expect(screen.getByText("🎅")).toBeInTheDocument();
    expect(screen.getByText("🧣")).toBeInTheDocument();
  });

  it("switches to quiet mode", async () => {
    const onModeChange = vi.fn();
    render(<Companion userId="u1" enabled seasonalEvent={null} onModeChange={onModeChange} />);
    await userEvent.click(screen.getByRole("button", { name: /quiet mode/i }));
    expect(onModeChange).toHaveBeenCalledWith("quiet");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/companion/Companion.test.jsx`
Expected: FAIL because the component does not yet exist.

- [ ] **Step 3: Implement the component**

Implementation requirements:
- Use a fixed-position overlay inside the app frame.
- Store x/y as percentages and apply them with CSS transforms.
- Use pointer capture on `pointerdown` and update position on `pointermove`; clamp using `clampCompanionPosition`.
- Distinguish a click from a drag with a small movement threshold.
- On click, briefly enter a `reacting` visual state.
- In active mode, schedule slow movement and pauses using a timeout loop; never run that loop in quiet mode.
- Render a simple recognizable capybara using DOM/CSS shapes and emoji accents rather than adding image assets in v1.
- Seasonal mapping: `santa -> 🎅`, `witch -> 🧙`, `heart -> 💗`; `scarf -> 🧣`, `candy -> 🍬`, `envelope -> 💌`. Unknown values render no accessory.
- Quiet mode keeps the Companion controllable through its compact control, but disables autonomous motion and normal reactions.
- Add `aria-label`, `aria-pressed`, and a visible focus style.

- [ ] **Step 4: Run the component tests to verify they pass**

Run: `npx vitest run src/features/companion/Companion.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/companion/Companion.jsx src/features/companion/Companion.test.jsx
git commit -m "feat: add interactive capybara companion"
```

---

### Task 3: Add Companion controls, persistence, and app-shell mounting

**Files:**
- Modify: `src/app/AppShell.jsx`
- Modify: `src/app/FlicdApp.jsx`
- Create: `src/features/companion/companionStorage.js`
- Test: `src/features/companion/companionStorage.test.js`

**Interfaces:**
- `loadCompanionState(userId)` returns normalized persisted state or `DEFAULT_COMPANION_STATE`.
- `saveCompanionState(userId, state)` writes only validated x/y/mode values.
- `FlicdApp` supplies authenticated `session.user.id` to `AppShell`.
- `AppShell` renders `Companion` after onboarding is ready, independent of the selected screen and Boards state.

- [ ] **Step 1: Write failing storage tests**

```js
import { beforeEach, describe, expect, it } from "vitest";
import { loadCompanionState, saveCompanionState } from "./companionStorage.js";
import { COMPANION_MODES } from "./companionState.js";

beforeEach(() => localStorage.clear());

describe("companion storage", () => {
  it("returns defaults when nothing is stored", () => {
    expect(loadCompanionState("u1").mode).toBe(COMPANION_MODES.ACTIVE);
  });

  it("round trips a valid state", () => {
    saveCompanionState("u1", { x: 42, y: 55, mode: COMPANION_MODES.QUIET });
    expect(loadCompanionState("u1")).toEqual({ x: 42, y: 55, mode: COMPANION_MODES.QUIET });
  });

  it("rejects malformed persisted values", () => {
    localStorage.setItem("flicd:companion:u1", JSON.stringify({ x: 500, y: -9, mode: "broken" }));
    expect(loadCompanionState("u1")).toMatchObject({ mode: COMPANION_MODES.ACTIVE });
    expect(loadCompanionState("u1").x).toBeLessThanOrEqual(92);
    expect(loadCompanionState("u1").y).toBeGreaterThanOrEqual(18);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/companion/companionStorage.test.js`
Expected: FAIL because `companionStorage.js` does not yet exist.

- [ ] **Step 3: Implement storage**

```js
import { COMPANION_MODES, DEFAULT_COMPANION_STATE, clampCompanionPosition, getCompanionStorageKey } from "./companionState.js";

export function loadCompanionState(userId) {
  if (!userId) return { ...DEFAULT_COMPANION_STATE };
  try {
    const parsed = JSON.parse(localStorage.getItem(getCompanionStorageKey(userId)) || "null");
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_COMPANION_STATE };
    const position = clampCompanionPosition({ x: Number(parsed.x), y: Number(parsed.y) });
    const mode = parsed.mode === COMPANION_MODES.QUIET ? COMPANION_MODES.QUIET : COMPANION_MODES.ACTIVE;
    return { ...position, mode };
  } catch {
    return { ...DEFAULT_COMPANION_STATE };
  }
}

export function saveCompanionState(userId, state) {
  if (!userId) return;
  const position = clampCompanionPosition({ x: Number(state.x), y: Number(state.y) });
  const mode = state.mode === COMPANION_MODES.QUIET ? COMPANION_MODES.QUIET : COMPANION_MODES.ACTIVE;
  localStorage.setItem(getCompanionStorageKey(userId), JSON.stringify({ ...position, mode }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/companion/companionStorage.test.js`
Expected: PASS.

- [ ] **Step 5: Mount Companion from the app shell**

Modify `AppShell` to accept `userId` and render `<Companion userId={userId} enabled={ready} seasonalEvent={getActiveSeasonalEvent()} />` alongside `<BottomNav ... />`. Keep it outside all screen-specific content so Boards cannot own or unmount it. Modify `FlicdApp` to pass `session.user.id`.

- [ ] **Step 6: Add an app-shell integration test**

```jsx
it("keeps Companion mounted while navigating between screens", async () => {
  render(<AppShell userId="u1" screen="home" onNavigate={() => {}} onCapture={() => {}}><div>content</div></AppShell>);
  expect(await screen.findByRole("button", { name: /capybara companion/i })).toBeInTheDocument();
});
```

The test should use the existing onboarding test setup/mocks already used by AppShell tests; do not bypass onboarding behavior globally.

- [ ] **Step 7: Run Companion and app tests**

Run: `npx vitest run src/features/companion src/app`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/AppShell.jsx src/app/FlicdApp.jsx src/features/companion/companionStorage.js src/features/companion/companionStorage.test.js
# include the app-shell integration test in the same commit
git commit -m "feat: mount and persist companion"
```

---

### Task 4: Add responsive styling and seasonal behavior integration

**Files:**
- Modify: `src/styles.css`
- Modify: `src/features/seasonal/SeasonalOverlay.jsx`
- Test: `src/features/seasonal/seasonalEvents.test.js`
- Test: `src/features/companion/Companion.test.jsx`

**Interfaces:**
- Existing `getActiveSeasonalEvent()` remains unchanged as the event source of truth.
- Seasonal overlay continues to provide its environment effect independently.
- Companion reads the same event object and adds character/accessory/reaction behavior.

- [ ] **Step 1: Add failing seasonal expectations**

```js
it("provides Companion metadata for every supported holiday", () => {
  for (const date of [new Date(2026, 9, 31), new Date(2026, 11, 25), new Date(2026, 1, 14)]) {
    const event = getActiveSeasonalEvent(date);
    expect(event?.character?.hat).toBeTruthy();
    expect(event?.interaction?.reaction).toBeTruthy();
  }
});
```

- [ ] **Step 2: Run the seasonal test to verify it fails only if the existing data contract is incomplete**

Run: `npx vitest run src/features/seasonal/seasonalEvents.test.js`
Expected: PASS with the current data. This test documents the contract the Companion depends on; no new seasonal system should be introduced.

- [ ] **Step 3: Implement Companion CSS**

Add classes for:
- `.companion-layer`
- `.companion-shell`
- `.companion-capybara`
- `.companion-body`, `.companion-ear`, `.companion-eye`, `.companion-snout`, `.companion-paw`
- `.companion-reaction`
- `.companion-accessory`
- `.companion-controls`
- `.companion-quiet`
- `.companion-walking`
- `.companion-reduced-motion`

Requirements:
- layer `z-index` above feed content but below modals/toasts (`<100` and `<120` respectively).
- pointer events disabled on the layer except on Companion controls/character.
- bottom safe area accounted for by keeping the character at least 16% from the bottom of its play area and by responsive clamps.
- desktop and mobile size variants.
- animation durations intentionally slow and subtle.
- `@media (prefers-reduced-motion: reduce)` disables movement/idle keyframes.

- [ ] **Step 4: Verify seasonal interaction classes**

Extend Companion tests to render Christmas/Halloween/Valentine data and assert the matching icon is present. No date checks should be duplicated inside `Companion.jsx`.

- [ ] **Step 5: Run the feature tests**

Run: `npx vitest run src/features/companion src/features/seasonal`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/styles.css src/features/seasonal/SeasonalOverlay.jsx src/features/seasonal/seasonalEvents.test.js src/features/companion/Companion.test.jsx
git commit -m "feat: connect companion to seasonal events"
```

---

### Task 5: Full regression and verification gate

**Files:**
- No production files unless regression exposes an issue.
- Optional: `docs/roadmap.md` to record Companion v1 as complete after verification.

**Interfaces:**
- No new public API beyond the Companion feature interfaces above.

- [ ] **Step 1: Run the focused Companion suite**

Run: `npx vitest run src/features/companion`
Expected: all Companion tests PASS.

- [ ] **Step 2: Run the complete test suite**

Run: `npm run test`
Expected: all existing tests plus new Companion tests PASS with zero failures.

- [ ] **Step 3: Run the production build**

Run: `npm run build`
Expected: Vite build succeeds. Existing large-chunk warning may remain and should not be misrepresented as an error.

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: zero lint errors/warnings because the project script uses `--max-warnings=0`.

- [ ] **Step 5: Manually verify Companion flows**

Verify in the browser:
- Capybara appears after onboarding.
- Capybara remains while changing Home, Discovery, Messages, Profile, and Boards screens.
- Capybara wanders only within its allowed area.
- Capybara can be dragged with mouse and touch.
- Tap/click produces a reaction.
- Companion mode allows idle/movement behavior.
- Quiet mode stops autonomous movement/reactions.
- Reloading preserves position/mode for the same signed-in user.
- Companion does not cover the bottom navigation.
- Current holiday metadata changes accessory/reaction when the seasonal date source is active.
- Reduced-motion preference disables autonomous animation.

- [ ] **Step 6: Commit any verification-only documentation update**

```bash
git add docs/roadmap.md
git commit -m "docs: mark companion v1 verified"
```

Only update the roadmap after the checks above actually pass.
