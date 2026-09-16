import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AppShell from "./AppShell.jsx";

vi.mock("../features/onboarding/OnboardingGate.jsx", () => ({
  default: function MockOnboardingGate({ children, onReady }) {
    React.useEffect(() => onReady(), [onReady]);
    return children;
  },
}));

beforeEach(() => localStorage.clear());

describe("AppShell Companion integration", () => {
  it("mounts the capybara companion after onboarding is ready", async () => {
    render(
      <AppShell userId="u1" screen="home" onNavigate={() => {}} onCapture={() => {}}>
        <div>content</div>
      </AppShell>,
    );

    expect(await screen.findByRole("button", { name: /capybara companion/i })).toBeTruthy();
  });
});
