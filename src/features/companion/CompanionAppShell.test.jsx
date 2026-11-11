// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import AppShell from "../../app/AppShell.jsx";
import Companion from "./Companion.jsx";
import CompanionSettings from "./CompanionSettings.jsx";

// Only readiness is seamed. The actual AppShell, dock, Settings and calendar run.
vi.mock("../onboarding/OnboardingGate.jsx", () => ({ default: function ReadyGate({ children, onReady }) {
  React.useEffect(() => onReady(), [onReady]);
  return children;
} }));

afterEach(() => { cleanup(); localStorage.clear(); vi.useRealTimers(); vi.restoreAllMocks(); });
const value = { enabled: true, name: "Review Buddy", costume: "hero", animation: "sit", reactions: true };
function mountShell(settings = value) {
  localStorage.setItem("flicd:companion:shell-regression:settings", JSON.stringify(settings));
  return render(<AppShell userId="shell-regression" screen="profile" onNavigate={() => {}} onCapture={() => {}}>
    <CompanionSettings value={settings} />
  </AppShell>);
}

it.each([
  ["halloween", 10, 2], ["christmas", 11, 26], ["valentines", 1, 15],
])("real AppShell keeps dock and Settings synchronized at %s midnight expiry", async (season, month, day) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, month, day, 23, 59, 59));
  mountShell();
  const live = screen.getByTestId("capybara-pixel-sprite");
  const preview = screen.getByTestId("companion-preview-sprite");
  expect(live).toHaveAttribute("data-seasonal-event", season);
  expect(preview).toHaveAttribute("data-seasonal-event", season);
  await act(async () => { vi.advanceTimersByTime(1001); });
  expect(preview).toHaveAttribute("data-seasonal-event", "none");
  expect(live).toHaveAttribute("data-seasonal-event", "none");
  expect(live).toHaveStyle({ "--sprite-row": "5" });
  expect(live).toHaveAttribute("data-costume", "hero");
  expect(live).toHaveAttribute("data-pose", "sit");
  expect(screen.getByTestId("capybara-pixel-sprite")).toBe(live);
});

it("real AppShell refreshes a suspended Halloween snapshot to Christmas on focus", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 20, 12));
  mountShell({ ...value, costume: "none" });
  const live = screen.getByTestId("capybara-pixel-sprite");
  expect(live).toHaveStyle({ "--sprite-row": "16" });
  vi.setSystemTime(new Date(2026, 11, 20, 12));
  await act(async () => { window.dispatchEvent(new Event("focus")); });
  const preview = screen.getByTestId("companion-preview-sprite");
  expect(preview).toHaveAttribute("data-seasonal-event", "christmas");
  expect(live).toHaveAttribute("data-seasonal-event", "christmas");
  expect(live).toHaveStyle({ "--sprite-row": "20" });
  expect(preview).toHaveStyle({ "--sprite-row": "20" });
  expect(screen.getByTestId("capybara-pixel-sprite")).toBe(live);
});

it("direct Companion remains a passing control without a parent calendar snapshot", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 2, 23, 59, 59));
  localStorage.setItem("flicd:companion:direct-control:settings", JSON.stringify(value));
  render(<Companion userId="direct-control" />);
  const live = screen.getByTestId("capybara-pixel-sprite");
  expect(live).toHaveAttribute("data-seasonal-event", "halloween");
  await act(async () => { vi.advanceTimersByTime(1001); });
  expect(live).toHaveAttribute("data-seasonal-event", "none");
});

it("real AppShell recovers the current season on visibility restoration", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 20, 12));
  mountShell({ ...value, costume: "none" });
  const live = screen.getByTestId("capybara-pixel-sprite");
  vi.setSystemTime(new Date(2026, 11, 20, 12));
  await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
  for (const sprite of [live, screen.getByTestId("companion-preview-sprite")]) {
    expect(sprite).toHaveAttribute("data-seasonal-event", "christmas");
    expect(sprite).toHaveStyle({ "--sprite-row": "20" });
  }
});

it("calendar recovery preserves the selected preset and an active patrol leg", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 20, 12));
  mountShell({ ...value, animation: "walk" });
  await act(async () => { vi.advanceTimersByTime(4500); });
  const live = screen.getByTestId("capybara-pixel-sprite");
  const walker = screen.getByTestId("companion-zone").querySelector(".companion-walker");
  const position = walker.style.getPropertyValue("--companion-position");
  const duration = walker.style.getPropertyValue("--companion-travel-duration");
  vi.setSystemTime(new Date(2026, 11, 20, 12));
  await act(async () => { window.dispatchEvent(new Event("focus")); });
  expect(live).toHaveAttribute("data-seasonal-event", "christmas");
  expect(live).toHaveAttribute("data-costume", "hero");
  expect(live).toHaveAttribute("data-pose", "walk");
  expect(walker).toHaveAttribute("data-motion-state", "walking");
  expect(walker.style.getPropertyValue("--companion-position")).toBe(position);
  expect(walker.style.getPropertyValue("--companion-travel-duration")).toBe(duration);
});

it("retains deliberate custom seasonal-event overrides across refreshes", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 11, 20, 12));
  const customEvent = { id: "halloween", label: "Explicit seasonal preview" };
  render(<Companion userId="explicit-override" seasonalEvent={customEvent} />);
  const live = screen.getByTestId("capybara-pixel-sprite");
  expect(live).toHaveAttribute("data-seasonal-event", "halloween");
  await act(async () => { window.dispatchEvent(new Event("focus")); });
  expect(live).toHaveAttribute("data-seasonal-event", "halloween");
});
