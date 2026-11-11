import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { withCompanionBrowser } from "./browserHarness.mjs";

const output = await mkdtemp(join("src/features/companion/visual-tests/runs", "keyboard-settings-"));
const report = { mode: process.env.COMPANION_BUILT_CSS ? "production CSS" : "source CSS", selections: [] };
await withCompanionBrowser(async ({ cdp, evaluate, screenshot }) => {
  const settle = () => evaluate("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
  const key = async (name, code) => {
    await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: name, code: name, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code });
    await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: name, code: name, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code });
    await settle();
  };
  await evaluate("window.companionQA.setTab('settings')");
  await settle();
  await evaluate("document.querySelector('#qa-season').focus()");
  await key("Tab", 9);
  assert.equal(await evaluate("document.activeElement.getAttribute('aria-label')"), "Buddy the capybara companion");
  for (let index = 0; index < 3; index += 1) await key("Tab", 9);
  assert.equal(await evaluate("document.activeElement.getAttribute('aria-label')"), "Costume");
  for (const [name, code, costume, row] of [["End", 35, "cosmic", 7], ["Home", 36, "none", 0], ["ArrowDown", 40, "santa", 1]]) {
    await key(name, code);
    const selected = await evaluate(`({value:document.querySelector('[aria-label=Costume]').value,surfaces:Array.from(document.querySelectorAll('#actual-settings [data-pose]')).map(node=>({costume:node.dataset.costume,row:Number(node.style.getPropertyValue('--sprite-row')),source:getComputedStyle(node).backgroundImage}))})`);
    assert.equal(selected.value, costume);
    assert.equal(selected.surfaces.length, 2);
    for (const surface of selected.surfaces) { assert.equal(surface.costume, costume); assert.equal(surface.row, row); assert(surface.source.includes("companion-fitted-sprite.svg")); }
    report.selections.push({ key: name, ...selected, passed: true });
  }
  await key("Tab", 9);
  assert.equal(await evaluate("document.activeElement.getAttribute('aria-label')"), "Default animation");
  await key("Home", 36);
  await evaluate("new Promise(resolve=>setTimeout(resolve,4600))");
  assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('#actual-settings [data-pose]')).map(n=>n.dataset.pose)"), ["walk", "walk"]);
  await key("End", 35);
  assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('#actual-settings [data-pose]')).map(n=>n.dataset.pose)"), ["sit", "sit"]);
  report.animation = "Native Home/End switches actual live and preview between walk and sit";
  await screenshot(join(output, "keyboard-selected-santa-desktop.png"));
});
await writeFile(join(output, "keyboard-results.json"), JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ output, ...report }, null, 2));
