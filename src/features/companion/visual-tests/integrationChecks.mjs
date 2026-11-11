import assert from "node:assert/strict";

// Explicit expectations: do not derive expected rows from the production mapper.
export const cases = [
  ["none", "none", 0], ["santa", "none", 1], ["ghost", "none", 2], ["witch", "none", 3],
  ["valentine", "none", 4], ["hero", "none", 5], ["speedster", "none", 6], ["cosmic", "none", 7],
  ["pumpkin-king", "halloween", 8], ["vampire", "halloween", 9], ["reaper", "halloween", 10],
  ["elf", "christmas", 11], ["gingerbread", "christmas", 12], ["reindeer", "christmas", 13],
  ["cupid", "valentines", 14], ["love-letter", "valentines", 15],
  ["none", "halloween", 16], ["hero", "halloween", 17], ["speedster", "halloween", 18],
  ["cosmic", "halloween", 19], ["none", "christmas", 20], ["none", "valentines", 21],
];
export async function runIntegrationChecks({ evaluate, cdp }) {
  const results = [];
  const settle = () => evaluate("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
  await evaluate("window.companionQA.setTab('settings')");
  await settle();
  for (const [costume, season, row] of cases) {
    await evaluate(`window.companionQA.setSeason(${JSON.stringify(season)}); window.companionQA.setValue({enabled:true,name:'Buddy',costume:${JSON.stringify(costume)},animation:'sit',reactions:true})`);
    await settle();
    const appearance = await evaluate(`(() => {
      const live = document.querySelector('.companion-character .capybara-pixel-sprite');
      const preview = document.querySelector('.companion-preview-sprite');
      return [live, preview].map(node => {
        const css = getComputedStyle(node);
        return { costume: node.dataset.costume, pose: node.dataset.pose, source: css.backgroundImage, size: css.backgroundSize,
          width: css.width, height: css.height, y: parseFloat(css.backgroundPositionY), animation: css.animationName,
          pixelated: css.imageRendering, hidden: node.getAttribute('aria-hidden'),
          overlays: ['::before','::after'].map(pseudo => getComputedStyle(node, pseudo).content) };
      });
    })()`);
    for (const surface of appearance) {
      assert.equal(surface.costume, costume); assert.equal(surface.pose, "sit");
      assert(surface.source.includes("companion-fitted-sprite.svg"));
      assert.equal(surface.size, "1152px 1584px");
      assert.equal(surface.width, "96px"); assert.equal(surface.height, "72px");
      assert.equal(surface.y, -row * 72 || 0);
      assert.equal(surface.animation, "capySpriteSit", `${costume}/${season}: seated preview must animate seated frames`);
      assert.equal(surface.pixelated, "pixelated"); assert.equal(surface.hidden, "true");
      assert(surface.overlays.every(value => value === "none"));
    }
    // Sample actual CSS animations at exact times, not just data attributes.
    const seated = await evaluate(`(() => {
      const nodes = [document.querySelector('.companion-character .capybara-pixel-sprite'), document.querySelector('.companion-preview-sprite')];
      return nodes.map(node => [0, 500].map(time => {
        for (const animation of node.getAnimations()) { animation.pause(); animation.currentTime = time; }
        return parseFloat(getComputedStyle(node).backgroundPositionX);
      }));
    })()`);
    assert.deepEqual(seated, [[-960, -1056], [-960, -1056]]);
    // Test both orientations through the same CSS variable used by patrol.
    for (const direction of [1, -1]) {
      const matrices = await evaluate(`(() => {
        const button = document.querySelector('.companion-character');
        button.style.setProperty('--capy-facing', '${direction}');
        const sprite = button.querySelector('.capybara-pixel-sprite');
        return { matrix: getComputedStyle(button).transform, width: sprite.getBoundingClientRect().width, height: sprite.getBoundingClientRect().height };
      })()`);
      assert.equal(matrices.matrix, `matrix(${direction}, 0, 0, 1, 0, 0)`);
      assert.equal(matrices.width, 96); assert.equal(matrices.height, 72);
      results.push({ costume, season, row, direction, pose: "sit", passed: true });
    }
  }
  await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await settle();
  const reduced = await evaluate(`Array.from(document.querySelectorAll('#actual-settings .capybara-pixel-sprite')).map(node => ({animation:getComputedStyle(node).animationName,x:parseFloat(getComputedStyle(node).backgroundPositionX)}))`);
  assert(reduced.every(item => item.animation === "none" && item.x === -960), "Reduced motion must retain a seated frame on both surfaces");
  await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
  return results;
}
