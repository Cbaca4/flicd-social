/** @vitest-environment jsdom */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AppShell from "../../app/AppShell.jsx";
import { appColorCssVars } from "./appColor.js";
vi.mock("../onboarding/OnboardingGate.jsx", () => ({ default: ({ children }) => <>{children}</> }));
vi.mock("../companion/Companion.jsx", () => ({ default: () => null }));
vi.mock("../../components/navigation/BottomNav.jsx", () => ({ default: () => <nav aria-label="Primary navigation"/> }));
describe("app-wide theme", () => {
  it("applies saved hue to the shell across screens", () => {
    const appColor = { enabled: true, hue: 180, intensity: 75, mode: "dark" };
    const { rerender } = render(<AppShell userId="a" screen="profile" appColor={appColor}><div>Profile</div></AppShell>);
    expect(document.querySelector(".flicd-app").style.getPropertyValue("--flicd-hue")).toBe("180");
    rerender(<AppShell userId="a" screen="home" appColor={appColor}><div>Feed</div></AppShell>);
    expect(screen.getByText("Feed")).toBeTruthy();
    expect(document.querySelector(".flicd-app").style.getPropertyValue("--flicd-hue")).toBe("180");
    expect(appColorCssVars(appColor)["--flicd-global-accent"]).toContain("180");
  });
});
