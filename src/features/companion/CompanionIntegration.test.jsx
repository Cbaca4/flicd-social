// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import Companion from "./Companion.jsx";
import CompanionSettings from "./CompanionSettings.jsx";

const settings = (costume, animation = "sit") => ({ enabled: true, name: "Buddy", costume, animation, reactions: true });
const calendar = { none: [5, 15], halloween: [9, 20], christmas: [11, 20], valentines: [1, 10] };
// Independent expected rows, including seasonal exclusives in their active season.
const outfits = [
  ["none", "none", 0], ["santa", "none", 1], ["ghost", "none", 2], ["witch", "none", 3],
  ["valentine", "none", 4], ["hero", "none", 5], ["speedster", "none", 6], ["cosmic", "none", 7],
  ["pumpkin-king", "halloween", 8], ["vampire", "halloween", 9], ["reaper", "halloween", 10],
  ["elf", "christmas", 11], ["gingerbread", "christmas", 12], ["reindeer", "christmas", 13],
  ["cupid", "valentines", 14], ["love-letter", "valentines", 15],
  ["none", "halloween", 16], ["hero", "halloween", 17], ["speedster", "halloween", 18],
  ["cosmic", "halloween", 19], ["none", "christmas", 20], ["none", "valentines", 21],
];
afterEach(() => { cleanup(); localStorage.clear(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it.each(outfits)("matches equipped and preview art for %s / %s", async (costume, season, row) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, ...calendar[season], 12));
  for (const animation of ["sit", "walk"]) {
    cleanup();
    const value = settings(costume, animation);
    localStorage.setItem("flicd:companion:matrix:settings", JSON.stringify(value));
    render(<><Companion userId="matrix" /><CompanionSettings value={value} /></>);
    const live = screen.getByTestId("capybara-pixel-sprite");
    const preview = screen.getByTestId("companion-preview-sprite");
    if (animation === "walk") {
      expect(live).toHaveAttribute("data-pose", "idle");
      await act(async () => { vi.advanceTimersByTime(4500); });
    }
    for (const sprite of [live, preview]) {
      expect(sprite).toHaveAttribute("data-costume", costume);
      expect(sprite).toHaveAttribute("data-pose", animation);
      expect(sprite).toHaveStyle({ "--sprite-row": String(row) });
      expect(sprite).toHaveAttribute("aria-hidden", "true");
    }
    expect(screen.getByRole("button", { name: "Buddy the capybara companion" })).toBeEnabled();
  }
});

function mockMotion(matches) {
  let listener;
  const media = { matches, addEventListener: vi.fn((_event, callback) => { listener = callback; }), removeEventListener: vi.fn() };
  vi.stubGlobal("matchMedia", vi.fn(() => media));
  return { media, change: async (next) => { expect(listener).toBeTypeOf("function"); media.matches = next; await act(async () => { listener({ matches: next }); }); } };
}

it("does not patrol when reduced motion is enabled at mount", async () => {
  vi.useFakeTimers();
  mockMotion(true);
  render(<Companion userId="motion" />);
  const walker = screen.getByTestId("companion-zone").querySelector(".companion-walker");
  await act(async () => { vi.advanceTimersByTime(60000); });
  expect(walker).toHaveAttribute("data-motion-state", "idle");
  expect(walker).toHaveStyle({ "--companion-position": "18%", "--companion-travel-duration": "0ms" });
});

it("freezes the current patrol position on live reduced-motion changes and resumes safely", async () => {
  vi.useFakeTimers();
  const motion = mockMotion(false);
  render(<Companion userId="motion" />);
  await act(async () => { vi.advanceTimersByTime(4500); });
  const zone = screen.getByTestId("companion-zone");
  const walker = zone.querySelector(".companion-walker");
  vi.spyOn(zone, "getBoundingClientRect").mockReturnValue({ left: 100, width: 1000 });
  vi.spyOn(walker, "getBoundingClientRect").mockReturnValue({ left: 520, width: 96 });
  await motion.change(true);
  await act(async () => { vi.advanceTimersByTime(60000); });
  expect(walker).toHaveAttribute("data-motion-state", "idle");
  expect(walker).toHaveStyle({ "--companion-position": "42%", "--companion-travel-duration": "0ms" });
  await motion.change(false);
  await act(async () => { vi.advanceTimersByTime(4500); });
  expect(walker).toHaveAttribute("data-motion-state", "walking");
  cleanup();
  expect(motion.media.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
});

it("mirrors patrol direction on the return leg without changing costume or frame size", async () => {
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0);
  localStorage.setItem("flicd:companion:direction:settings", JSON.stringify(settings("hero", "walk")));
  render(<Companion userId="direction" />);
  const walker = screen.getByTestId("companion-zone").querySelector(".companion-walker");
  await act(async () => { vi.advanceTimersByTime(4500); });
  expect(walker).toHaveStyle({ "--capy-facing": "1" });
  await act(async () => { vi.advanceTimersByTime(41250 + 4000); });
  expect(walker).toHaveStyle({ "--capy-facing": "-1" });
  expect(screen.getByTestId("capybara-pixel-sprite")).toHaveStyle({ "--sprite-row": "5" });
});

it.each([
  ["halloween", "pumpkin-king", 10, 2], ["christmas", "elf", 11, 26], ["valentines", "cupid", 1, 15],
])("expires %s exclusives at local midnight while both surfaces remain mounted", async (_season, costume, month, day) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, month, day, 23, 59, 59));
  const value = settings(costume);
  localStorage.setItem("flicd:companion:expiry:settings", JSON.stringify(value));
  render(<><Companion userId="expiry" /><CompanionSettings value={value} /></>);
  expect(screen.getByTestId("capybara-pixel-sprite")).toHaveAttribute("data-costume", costume);
  await act(async () => { vi.advanceTimersByTime(1001); });
  for (const id of ["capybara-pixel-sprite", "companion-preview-sprite"]) {
    expect(screen.getByTestId(id)).toHaveAttribute("data-costume", "none");
    expect(screen.getByTestId(id)).toHaveStyle({ "--sprite-row": "0" });
  }
  expect(JSON.parse(localStorage.getItem("flicd:companion:expiry:settings")).costume).toBe("none");
});

it.each([
  ["none", 9, 14, 16], ["hero", 9, 14, 17], ["speedster", 9, 14, 18], ["cosmic", 9, 14, 19],
  ["none", 10, 24, 20], ["none", 0, 31, 21],
])("applies the seasonal treatment to %s at midnight after %s/%s", async (costume, month, day, row) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, month, day, 23, 59, 59));
  const value = settings(costume);
  localStorage.setItem("flicd:companion:entry:settings", JSON.stringify(value));
  render(<><Companion userId="entry" /><CompanionSettings value={value} /></>);
  await act(async () => { vi.advanceTimersByTime(1001); });
  for (const id of ["capybara-pixel-sprite", "companion-preview-sprite"]) {
    expect(screen.getByTestId(id)).toHaveStyle({ "--sprite-row": String(row) });
    expect(screen.getByTestId(id)).toHaveAttribute("data-costume", costume);
  }
});

it("refreshes the calendar when a suspended tab regains focus", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 20, 12));
  const value = settings("witch");
  localStorage.setItem("flicd:companion:focus:settings", JSON.stringify(value));
  render(<><Companion userId="focus" /><CompanionSettings value={value} /></>);
  vi.setSystemTime(new Date(2026, 11, 20, 12));
  await act(async () => { window.dispatchEvent(new Event("focus")); });
  expect(screen.getByTestId("capybara-pixel-sprite")).toHaveAttribute("data-seasonal-event", "christmas");
  expect(screen.getByTestId("companion-preview-sprite")).toHaveAttribute("data-seasonal-event", "christmas");
});
