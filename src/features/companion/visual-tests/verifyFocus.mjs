import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { withCompanionBrowser } from "./browserHarness.mjs";

const directory = "src/features/companion/visual-tests/runs";
await mkdir(directory, { recursive: true });
const output = await mkdtemp(join(directory, "focus-browser-"));
console.log(`Focus evidence: ${output}`);
const report = { mode: process.env.COMPANION_BUILT_CSS ? "production CSS" : "source CSS", cases: [] };
await withCompanionBrowser(async ({ cdp, evaluate, screenshot }) => {
  await evaluate("window.companionQA.setTab('settings')");
  const settle = () => evaluate("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
  await settle();
  for (const [width, preference, direction] of [[1440, "no-preference", 1], [390, "no-preference", -1], [390, "reduce", 1], [1440, "reduce", -1]]) {
    await cdp("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: width < 620 });
    await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: preference }] });
    await evaluate(`document.querySelector('.companion-character').style.setProperty('--capy-facing','${direction}');document.querySelector('#qa-season').focus()`);
    await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    await settle();
    const state = await evaluate(`(() => {
      const button=document.querySelector('.companion-character');const css=getComputedStyle(button);
      const rect=node=>{const r=node.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
      const ancestors=[];for(let node=button.parentElement;node;node=node.parentElement){const s=getComputedStyle(node);ancestors.push({tag:node.tagName,className:node.className,rect:rect(node),overflowX:s.overflowX,overflowY:s.overflowY,contain:s.contain,clipPath:s.clipPath});}
      const matches=[];
      const visit=(rules,source,active=true)=>{for(const rule of rules){if(rule.selectorText){try{if(button.matches(rule.selectorText)&&(rule.style.outline||rule.style.boxShadow||rule.style.outlineStyle)){matches.push({source,selector:rule.selectorText,active,css:rule.style.cssText});}}catch{}}if(rule.cssRules){visit(rule.cssRules,source,active&&(!rule.conditionText||matchMedia(rule.conditionText).matches));}}};
      for(const sheet of document.styleSheets){try{visit(sheet.cssRules,sheet.ownerNode?.getAttribute('data-vite-dev-id')||sheet.href||'inline');}catch{}}
      const root=getComputedStyle(document.documentElement);
      return {focused:document.activeElement===button,focusVisible:button.matches(':focus-visible'),outline:css.outline,outlineStyle:css.outlineStyle,outlineWidth:css.outlineWidth,outlineColor:css.outlineColor,outlineOffset:css.outlineOffset,boxShadow:css.boxShadow,transform:css.transform,cyan:root.getPropertyValue('--cyan').trim(),rect:rect(button),ancestors,matchingRules:matches,stylesPrefix:Array.from(document.querySelectorAll('style[data-vite-dev-id]')).filter(n=>n.dataset.viteDevId.replaceAll('\\\\','/').endsWith('/src/styles.css')).map(n=>n.textContent.slice(0,400))};
    })()`);
    const name = `keyboard-${width}-${preference}-${direction}`;
    await screenshot(join(output, `${name}.png`));
    report.cases.push({ width, preference, direction, ...state, screenshot: `${name}.png` });
  }
  if (process.argv.includes("--probe-token")) {
    // One-variable diagnostic only: never injected in normal verification.
    await evaluate("document.documentElement.style.setProperty('--cyan','#46dac8')");
    await settle();
    report.tokenProbe = await evaluate("(() => {const node=document.querySelector('.companion-character');const css=getComputedStyle(node);return {focused:document.activeElement===node,focusVisible:node.matches(':focus-visible'),outline:css.outline,outlineStyle:css.outlineStyle,boxShadow:css.boxShadow};})()");
    await screenshot(join(output, "diagnostic-token-restored.png"));
    await evaluate("document.documentElement.style.removeProperty('--cyan')");
  }
});
await writeFile(join(output, "focus-results.json"), JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify(report, null, 2));
for (const item of report.cases) {
  assert(item.focused && item.focusVisible, "Native Tab must focus the Companion with :focus-visible");
  assert.notEqual(item.outlineStyle, "none", "Keyboard focus outline is missing");
  assert(parseFloat(item.outlineWidth) >= 2, "Keyboard focus outline must remain clearly visible");
  assert.notEqual(item.outlineColor, "rgba(0, 0, 0, 0)");
  const margin = parseFloat(item.outlineWidth) + parseFloat(item.outlineOffset);
  for (const ancestor of item.ancestors) {
    if ([ancestor.overflowX, ancestor.overflowY].some(value => ["hidden", "clip", "scroll", "auto"].includes(value)) || ancestor.contain.includes("paint")) {
      assert(item.rect.left-margin>=ancestor.rect.left && item.rect.right+margin<=ancestor.rect.right && item.rect.top-margin>=ancestor.rect.top && item.rect.bottom+margin<=ancestor.rect.bottom, `Focus outline clipped by ${ancestor.className}`);
    }
  }
}
console.log(`PASS: ${report.cases.length} native-keyboard focus cases; no application CSS injected`);
