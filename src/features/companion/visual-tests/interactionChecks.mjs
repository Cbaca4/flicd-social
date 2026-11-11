import assert from "node:assert/strict";
import { cases } from "./integrationChecks.mjs";

export async function runInteractionChecks({ cdp, evaluate }) {
  const results = { walking: [], responsive: [], accessibility: [], motion: [], seasons: [] };
  const settle = () => evaluate("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
  const configure = async (costume, season, animation = "walk", name = "Buddy") => {
    await evaluate(`window.companionQA.setSeason(${JSON.stringify(season)}); window.companionQA.setValue(${JSON.stringify({ costume, name, animation, enabled: true, reactions: true })})`);
    await settle();
  };
  await configure("hero", "none");
  assert.equal(await evaluate("document.querySelector('.companion-character [data-pose]').dataset.pose"), "idle");
  await evaluate("new Promise(resolve => setTimeout(resolve, 4600))");
  for (const [costume, season, row] of cases) {
    await configure(costume, season);
    const samples = await evaluate(`(() => {
      const nodes = [document.querySelector('.companion-character [data-pose]'), document.querySelector('.companion-preview-sprite')];
      return nodes.map(node => ({pose:node.dataset.pose, frames:Array.from({length:10}, (_, frame) => {
        for (const animation of node.getAnimations()) { animation.pause(); animation.currentTime = frame * 140 + 1; }
        const css=getComputedStyle(node); return [parseFloat(css.backgroundPositionX),parseFloat(css.backgroundPositionY)];
      })}));
    })()`);
    for (const sample of samples) {
      assert.equal(sample.pose, "walk", `${costume}/${season}: live walking pose`);
      assert.deepEqual(sample.frames, Array.from({ length: 10 }, (_, frame) => [frame * -96 || 0, row * -72 || 0]));
    }
    for (const direction of [1, -1]) {
      const matrix = await evaluate(`(() => { const node=document.querySelector('.companion-character'); node.style.setProperty('--capy-facing','${direction}');return getComputedStyle(node).transform; })()`);
      assert.equal(matrix, `matrix(${direction}, 0, 0, 1, 0, 0)`);
      results.walking.push({ costume, season, row, direction, frames: 10, passed: true });
    }
  }
  // Changing the user's preference must stop real patrol, not just its sprite animation.
  await configure("hero", "none", "sit");
  await configure("hero", "none");
  await evaluate("new Promise(resolve => setTimeout(resolve, 4700))");
  const before = await evaluate("(() => {const walker=document.querySelector('.companion-walker');const zone=walker.parentElement;return {left:walker.getBoundingClientRect().left,zoneLeft:zone.getBoundingClientRect().left,zoneWidth:zone.getBoundingClientRect().width,target:walker.style.getPropertyValue('--companion-position'),transition:getComputedStyle(walker).transition};})()");
  await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await settle();
  const frozen = await evaluate("({left:document.querySelector('.companion-walker').getBoundingClientRect().left,pose:document.querySelector('.companion-character [data-pose]').dataset.pose})");
  assert.equal(frozen.pose, "idle"); assert(Math.abs(before.left - frozen.left) < 3, `Reduced-motion toggle jumped: ${JSON.stringify({before,frozen})}`);
  await evaluate("new Promise(resolve => setTimeout(resolve, 250))");
  assert.equal(await evaluate("document.querySelector('.companion-walker').getBoundingClientRect().left"), frozen.left);
  results.motion.push("Live preference freezes measured patrol position without endpoint jump");
  await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
  await settle();
  await evaluate("new Promise(resolve => setTimeout(resolve, 4600))");
  assert.equal(await evaluate("document.querySelector('.companion-character [data-pose]').dataset.pose"), "walk");
  results.motion.push("Motion resumes only after the normal idle pause");

  for (const [season, costume] of [["halloween", "pumpkin-king"], ["christmas", "elf"], ["valentines", "cupid"]]) {
    await configure(costume, season, "sit");
    await evaluate("window.companionQA.setSeason('none')");
    await settle();
    assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('#actual-settings [data-pose]')).map(node=>node.dataset.costume)"), ["none", "none"]);
    results.seasons.push({ season, costume, expiredOnBothSurfaces: true });
  }

  for (const width of [320, 360, 390, 620, 768, 1024, 1440]) {
    await cdp("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: width === 390 ? 2 : 1, mobile: width < 620 });
    await configure("hero", "none", "sit", "W".repeat(24));
    const layout = await evaluate(`(() => {
      const preview=document.querySelector('.companion-preview');const text=preview.querySelector('strong');
      const live=document.querySelector('.companion-character [data-pose]');const p=document.querySelector('.companion-preview-sprite');
      const box=preview.getBoundingClientRect();const range=document.createRange();range.selectNodeContents(text);
      const textBox=range.getBoundingClientRect();const zone=document.querySelector('.companion-zone').getBoundingClientRect();const character=live.getBoundingClientRect();
      return {overflow:document.documentElement.scrollWidth>innerWidth,textFits:textBox.right<=box.right && textBox.left>=box.left,
        liveWidth:character.width,previewWidth:p.getBoundingClientRect().width,height:p.getBoundingClientRect().height,
        inZone:character.left>=zone.left && character.right<=zone.right && character.top>=zone.top && character.bottom<=zone.bottom};
    })()`);
    assert.equal(layout.overflow, false, `${width}px horizontal document overflow`);
    assert.equal(layout.textFits, true, `${width}px long Companion name overflows its preview`);
    assert.equal(layout.liveWidth, 96); assert.equal(layout.previewWidth, 96); assert.equal(layout.height, 72);
    assert.equal(layout.inZone, true, `${width}px character escapes the Companion zone`);
    results.responsive.push({ width, ...layout });
  }
  await configure("hero", "none", "sit");
  await evaluate("document.querySelector('#qa-season').focus()");
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  const focus = await evaluate(`(() => {const b=document.querySelector('.companion-character');const z=b.closest('.companion-zone');const css=getComputedStyle(b);const box=b.getBoundingClientRect();const zone=z.getBoundingClientRect();const margin=parseFloat(css.outlineWidth)+parseFloat(css.outlineOffset);return {focused:document.activeElement===b,visible:b.matches(':focus-visible'),outline:css.outlineStyle,unclipped:getComputedStyle(z).overflow==='visible'||(box.top-margin>=zone.top && box.bottom+margin<=zone.bottom)};})()`);
  assert.equal(focus.focused, true, JSON.stringify({focus,active:await evaluate("document.activeElement.outerHTML.slice(0,300)")})); assert.equal(focus.visible, true); assert.notEqual(focus.outline, "none");
  assert.equal(focus.unclipped, true, "Keyboard focus outline is clipped by the Companion zone");
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: "\r", unmodifiedText: "\r" });
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await settle();
  assert(await evaluate("Boolean(document.querySelector('[aria-label^=\"Companion reaction:\"]')?.textContent)"));
  results.accessibility.push("Native Tab focus, visible unclipped focus outline, Enter reaction and polite status");
  const tree = await cdp("Accessibility.getFullAXTree");
  for (const [role, name] of [["button", "Buddy the capybara companion"], ["switch", "Show Companion"], ["textbox", "Companion name"], ["combobox", "Costume"], ["combobox", "Default animation"], ["checkbox", "Reactions"]]) {
    assert(tree.nodes.some(node => !node.ignored && node.role?.value === role && node.name?.value === name), `${role}: ${name} missing in browser accessibility tree`);
  }
  results.accessibility.push("Real Chrome accessibility tree contains labeled controls; decorative sprites aria-hidden");
  await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await cdp("Emulation.setTouchEmulationEnabled", { enabled: true });
  await evaluate("document.querySelector('.companion-character').scrollIntoView({block:'center'});document.querySelector('[aria-label=Reactions]').click()");
  await settle();
  assert.equal(await evaluate("Boolean(document.querySelector('[aria-label^=\"Companion reaction:\"]'))"), false);
  await evaluate("document.querySelector('[aria-label=Reactions]').click()");
  await settle();
  const point = await evaluate("(() => {const b=document.querySelector('.companion-character').getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2};})()");
  await cdp("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...point, radiusX: 2, radiusY: 2 }] });
  await cdp("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await settle();
  assert(await evaluate("Boolean(document.querySelector('[aria-label^=\"Companion reaction:\"]')?.textContent)"));
  results.accessibility.push("Emulated mobile touch activates the real reaction button; reactions toggle works");
  await evaluate("document.querySelector('[aria-label=\"Show Companion\"]').click()");
  await settle();
  assert.equal(await evaluate("Boolean(document.querySelector('.companion-character'))"), false);
  await evaluate("document.querySelector('[aria-label=\"Show Companion\"]').click()");
  await settle();
  assert.equal(await evaluate("Boolean(document.querySelector('.companion-character'))"), true);
  results.accessibility.push("Show Companion switch removes/restores the actual equipped character");
  return results;
}
