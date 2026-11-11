import { getPrototypePose, renderPrototypeSprite } from "./costumePrototype.js";

const sheetResponse = await fetch("/companion/companion-sprite.svg");
if (!sheetResponse.ok) throw new Error(`Sprite sheet failed: ${sheetResponse.status}`);
const sheet = await sheetResponse.text();
const definitions = sheet.match(/<defs>([\s\S]*?)<\/defs>/)[1];
const costumes = [["hero", "Superhero", 0], ["santa", "Santa", 1], ["witch", "Witch", 3]];
const states = [["Idle", 0], ["Walk · raised", 1], ["Walk · lowered", 3], ["Sit · A", 10], ["Sit · B", 11]];
const comparisons = document.querySelector("#comparisons");
const motion = matchMedia("(prefers-reduced-motion: reduce)");
let timer;
let walkFrame = 1;
let sequence = 0;

function fitted(costume, frame) {
  return renderPrototypeSprite({ costume, frame, definitions, id: `review-${sequence++}` });
}

function spriteImage(source) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
}

function render() {
  comparisons.innerHTML = costumes.map(([costume, label, row]) => `<section aria-label="${label} comparison">
    <h2>${label}</h2>
    <div class="frames">${states.map(([name, fixedFrame], index) => {
      const frame = index === 1 && timer ? walkFrame : fixedFrame;
      return `<article class="frame"><h3>${name} · frame ${frame}</h3>
        <div class="label">Current</div><div class="stage"><span aria-hidden="true" class="capybara-pixel-sprite companion-costume-${costume}" style="--sprite-row:${row};background-position-x:${frame * -96}px"></span></div>
        <div class="label after">Fitted prototype</div><div class="stage"><img class="fitted" alt="" width="96" height="72" src="${spriteImage(fitted(costume, frame))}"></div>
      </article>`;
    }).join("")}</div>
    <div class="preview-row"><div><div class="label">Current Settings preview</div><span aria-hidden="true" class="companion-preview-sprite companion-costume-${costume}" style="--sprite-row:${row}"></span></div>
      <div><div class="label after">Proposed shared preview · idle</div><img class="fitted" alt="" width="96" height="72" src="${spriteImage(fitted(costume, 0))}"></div>
      <div><div class="label after">Proposed shared preview · sit</div><img class="fitted" alt="" width="96" height="72" src="${spriteImage(fitted(costume, 10))}"></div></div>
    </section>`).join("");
}

function stop() {
  clearInterval(timer);
  timer = undefined;
  const play = document.querySelector("#play");
  play.textContent = "Play walk frames";
  play.setAttribute("aria-pressed", "false");
  play.disabled = motion.matches;
  document.querySelector("#motion-note").textContent = motion.matches ? "Reduced motion: static frames only." : "Static comparisons by default.";
  render();
}

document.querySelector("#play").addEventListener("click", () => {
  if (timer || motion.matches) return stop();
  timer = setInterval(() => { walkFrame = (walkFrame + 1) % 10; render(); }, 140);
  document.querySelector("#play").textContent = "Pause walk frames";
  document.querySelector("#play").setAttribute("aria-pressed", "true");
  render();
});
document.querySelector("#facing").addEventListener("change", (event) => {
  document.documentElement.style.setProperty("--facing", event.target.value);
});
motion.addEventListener("change", stop);
window.addEventListener("pagehide", stop, { once: true });
stop();

async function pixels(source) {
  const image = new Image();
  image.src = spriteImage(source);
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 72;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  return context.getImageData(0, 0, 96, 72).data;
}

// Real browser raster checks complement Vitest's geometry/occlusion guards.
// These are invariants, not approved screenshot goldens or a claim of app integration.
window.prototypeChecks = (async () => {
  const results = [];
  for (const [costume] of costumes) {
    for (let frame = 0; frame < 12; frame += 1) {
      const pose = getPrototypePose(frame);
      const original = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="72"><defs>${definitions}</defs><use href="#${pose.base}"/></svg>`;
      const source = fitted(costume, frame);
      const doc = new DOMParser().parseFromString(source, "image/svg+xml");
      for (const layer of doc.querySelectorAll("[data-layer]:not([data-layer=clothing])")) layer.remove();
      const [base, after, clothing] = await Promise.all([pixels(original), pixels(source), pixels(new XMLSerializer().serializeToString(doc))]);
      const failures = new Set();
      const [hx, hy] = pose.head;
      const regions = [[57 + hx, 12 + hy, 9, 10], [63 + hx, 27 + hy, 5, 6], [75, 32 + hy, 16, 15], [0, 62, 96, 9]];
      for (const [x, y, width, height] of regions) {
        for (let py = y; py < y + height; py += 1) {
          for (let px = x; px < x + width; px += 1) {
            const offset = (py * 96 + px) * 4;
            if (!base[offset + 3]) continue;
            if (base.slice(offset, offset + 4).some((channel, i) => channel !== after[offset + i])) failures.add("Protected ear/eye/muzzle/foot pixels changed");
          }
        }
      }
      let changed = 0;
      for (let i = 0; i < clothing.length; i += 4) {
        if (clothing[i + 3] && base[i + 3] !== 255) failures.add("Clothing floats outside opaque body");
        if (![0, 255].includes(clothing[i + 3])) failures.add("Clothing has blurred edges");
        if (after[i] !== base[i] || after[i + 1] !== base[i + 1] || after[i + 2] !== base[i + 2]) changed += 1;
      }
      if (!changed) failures.add("Costume did not render");
      results.push({ costume, frame, passed: !failures.size, failures: [...failures] });
    }
  }
  const failed = results.filter((result) => !result.passed);
  document.querySelector("#checks").textContent = failed.length
    ? `FAIL: ${failed.length}/${results.length} raster cases. ${JSON.stringify(failed)}`
    : `PASS: ${results.length}/${results.length} raster cases — three outfits × twelve frames. Clothing stays on opaque body pixels; eyes, ears, muzzle, and feet are unchanged; costume edges have no partial alpha.`;
  document.querySelector("#checks").dataset.result = failed.length ? "fail" : "pass";
  return results;
})();
