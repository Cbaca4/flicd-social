import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { withCompanionBrowser } from "./browserHarness.mjs";

const output = await mkdtemp(join("src/features/companion/visual-tests/runs", "shell-calendar-"));
console.log(`Real AppShell evidence: ${output}`);
const report = { mode: process.env.COMPANION_BUILT_CSS ? "production CSS" : "source CSS", cases: [] };
const scenarios = [
  { name: "halloween-midnight", start: [2026, 10, 2, 23, 59, 59], initial: "halloween", final: "none", row: 0 },
  { name: "christmas-midnight", start: [2026, 11, 26, 23, 59, 59], initial: "christmas", final: "none", row: 0 },
  { name: "valentines-midnight", start: [2026, 1, 15, 23, 59, 59], initial: "valentines", final: "none", row: 0 },
  { name: "suspended-focus", start: [2026, 9, 20, 12], end: [2026, 11, 20, 12], event: "focus", initial: "halloween", final: "christmas", row: 20 },
  { name: "suspended-visibility", start: [2026, 9, 20, 12], end: [2026, 11, 20, 12], event: "visibilitychange", initial: "halloween", final: "christmas", row: 20 },
];
const seams = {
  name: "companion-real-shell-readiness-only", enforce: "pre",
  resolveId(id, importer) {
    if (id.endsWith("/features/onboarding/OnboardingGate.jsx")) return "\0companion-ready-gate";
    if (id === "./fixture.jsx" && importer?.replaceAll("\\", "/").endsWith("/visual-tests/bootstrap.jsx")) return fileURLToPath(new URL("./appShellFixture.jsx", import.meta.url));
  },
  load(id) {
    if (id === "\0companion-ready-gate") return "import React from 'react';export default function ReadyGate({children,onReady}){React.useEffect(()=>onReady(),[onReady]);return children;}";
  },
};
for (const scenario of scenarios) {
  await withCompanionBrowser(async ({ cdp, evaluate, screenshot }) => {
    const settle = () => evaluate("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
    await evaluate(`window.companionQA.reset(${JSON.stringify(scenario.start)})`);
    await settle();
    await evaluate("window.shellCalendarLiveNode=document.querySelector('.companion-character [data-pose]');true");
    const read = () => evaluate(`Array.from(document.querySelectorAll('.companion-character [data-pose],.companion-preview-sprite')).map(node=>({season:node.dataset.seasonalEvent,costume:node.dataset.costume,pose:node.dataset.pose,row:Number(node.style.getPropertyValue('--sprite-row')),y:parseFloat(getComputedStyle(node).backgroundPositionY),size:getComputedStyle(node).backgroundSize,source:getComputedStyle(node).backgroundImage}))`);
    const before = await read();
    assert.equal(before.length, 2);
    assert(before.every(surface => surface.season === scenario.initial));
    if (scenario.end) {
      await evaluate(`window.companionQA.recover(${JSON.stringify(scenario.end)},${JSON.stringify(scenario.event)})`);
      await settle();
    } else {
      // Advance real browser timers across local midnight without remount/navigation.
      await cdp("Emulation.setVirtualTimePolicy", { policy: "advance", budget: 1500, maxVirtualTimeTaskStarvationCount: 1000 });
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    const after = await read();
    const sameNode = await evaluate("window.shellCalendarLiveNode===document.querySelector('.companion-character [data-pose]')");
    const passed = sameNode && after.length === 2 && after.every(surface => surface.season === scenario.final && surface.row === scenario.row && surface.y === (scenario.row * -72 || 0) && surface.pose === "sit" && surface.costume === "none" && surface.size === "1152px 1584px" && surface.source.includes("companion-fitted-sprite.svg"));
    const file = `${scenario.name}.png`;
    await screenshot(join(output, file));
    report.cases.push({ name: scenario.name, before, after, sameNode, passed, screenshot: file });
  }, { plugins: [seams] });
}
await writeFile(join(output, "shell-calendar-results.json"), JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ output, ...report }, null, 2));
assert(report.cases.every(item => item.passed), "Real AppShell seasonal integration is out of sync; see recorded before/after cases");
