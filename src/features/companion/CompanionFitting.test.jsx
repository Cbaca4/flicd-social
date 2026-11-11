// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import Companion from "./Companion.jsx";
import CompanionSettings from "./CompanionSettings.jsx";

afterEach(() => { cleanup(); localStorage.clear(); vi.useRealTimers(); vi.restoreAllMocks(); });

it("uses the same fitted Superhero sprite for the equipped character and Settings", () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 5, 15, 12));
  const value = { enabled: true, name: "Buddy", costume: "hero", animation: "sit", reactions: true };
  localStorage.setItem("flicd:companion:fit:settings", JSON.stringify(value));
  render(<><Companion userId="fit" /><CompanionSettings value={value} /></>);
  const live = screen.getByTestId("capybara-pixel-sprite");
  const preview = screen.getByTestId("companion-preview-sprite");
  expect(preview).toHaveClass("capybara-pixel-sprite");
  expect(live.style.getPropertyValue("--sprite-row")).toBe("5");
  expect(preview.style.getPropertyValue("--sprite-row")).toBe("5");
  expect(preview).toHaveAttribute("data-pose", "sit");
  expect(live).toHaveAttribute("data-pose", "sit");
  expect(live).toHaveAttribute("data-sprite-sheet", "1152x1584");
});
