import React from "react";
import "../../../styles.css";
import "../../../mobile.css";
import "../CompanionCostume.css";
import "./fixture.css";
import { fixtureDates as dates, setFixtureSeason } from "./fixtureClock.mjs";
import legacyCSS from "../prototype/legacy/Companion.css?raw";
import legacyCostumeCSS from "../prototype/legacy/CompanionCostume.css?raw";
import Companion from "../Companion.jsx";
import CompanionSettings from "../CompanionSettings.jsx";
import CompanionSprite from "../CompanionSprite.jsx";
import { COMPANION_SPRITE_ROWS } from "../companionSprite.js";
import { getFittedPose, renderFittedFrame } from "../art/companionArt.js";
import { renderPrototypeSprite } from "../prototype/costumePrototype.js";

// Real Companion components, synthetic calendar/local settings; no application APIs.
export default function Fixture() {
  const [value, setValue] = React.useState({ enabled: true, name: "Buddy", costume: "hero", animation: "sit", reactions: true });
  const [activeSeason, setSeason] = React.useState("none");
  const [direction, setDirection] = React.useState("right");
  const [tab, setTab] = React.useState("gallery");
  React.useEffect(() => { window.dispatchEvent(new CustomEvent("flicd:companion-settings", { detail: value })); }, [value, activeSeason]);
  React.useEffect(() => {
    window.companionQA = { setValue, setTab, setDirection, setSeason: (next) => { setFixtureSeason(next); setSeason(next); } };
    return () => { delete window.companionQA; };
  }, []);
  return <main className={`qa qa-${direction}`}>
    <h1>Companion · fitted costume implementation</h1>
    <p>All original costumes and seasonal variations. Native 96×72 frames, unchanged body art. Approved prototype and screenshots are preserved separately.</p>
    <nav aria-label="Verification controls">
      <label>View <select id="qa-view" value={tab} onChange={(event) => setTab(event.target.value)}><option value="gallery">All costumes</option><option value="settings">Actual Companion Settings</option><option value="comparison">Before / integrated comparison</option></select></label>
      <label>Gallery facing <select id="qa-direction" value={direction} onChange={(event) => setDirection(event.target.value)}><option value="right">Right</option><option value="left">Left</option></select></label>
    </nav>
    <div hidden={tab !== "gallery"} id="gallery">
      <div className="qa-gallery">{COMPANION_SPRITE_ROWS.map((row, index) => <section className="qa-outfit" key={index}>
        <h2>{row.costume === "none" ? "Everyday" : row.costume} <small>{row.season !== "none" ? row.season : ""}</small></h2>
        <div className="qa-poses">{[["Idle", 0], ["Walk", 1], ["Sit A", 10], ["Sit B", 11]].map(([label, frame]) => <div key={frame}>
          <span>{label}</span><div className="qa-pixel-frame"><CompanionSprite costume={row.costume} seasonalEventId={row.season} /><i style={{ display: "none" }} /></div>
          <style>{`.qa-outfit:nth-child(${index + 1}) .qa-poses > div:nth-child(${[0, 1, 10, 11].indexOf(frame) + 1}) .capybara-pixel-sprite { background-position-x: ${frame * -96}px; }`}</style>
        </div>)}</div>
      </section>)}</div>
    </div>
    <div hidden={tab !== "settings"} id="actual-settings">
      <label>Test season <select id="qa-season" value={activeSeason} onChange={(event) => window.companionQA.setSeason(event.target.value)}>{Object.keys(dates).map((id) => <option key={id}>{id}</option>)}</select></label>
      <div className="qa-live-stage"><Companion userId="companion-visual-test" /><div className="qa-dock" aria-hidden="true">Companion interaction area</div></div>
      <CompanionSettings value={value} onChange={setValue} />
    </div>
    <div hidden={tab !== "comparison"} className="qa-comparisons">
      <p>Legacy shipped CSS (top) versus integrated fitted renderer (bottom). Frames: idle, raised walk, lowered walk, sit A, sit B. Native pixels; neutral season.</p>
      {[['hero', 0], ['santa', 1], ['witch', 3]].map(([costume, row]) => <section key={costume}>
        <h2>{costume === 'hero' ? 'Superhero' : costume === 'santa' ? 'Santa' : 'Witch'}</h2>
        <iframe title={`${costume} legacy costume comparison`} sandbox="" srcDoc={`<style>${legacyCostumeCSS}\n${legacyCSS}\nbody{margin:0;display:flex;justify-content:space-around;background:#151b26}.capybara-pixel-sprite{flex:none;transform:scaleX(${direction === 'left' ? -1 : 1});}</style>${[0,1,3,10,11].map(frame => `<span class="capybara-pixel-sprite companion-costume-${costume}" style="--sprite-row:${row};background-position-x:${frame * -96}px"></span>`).join('')}`} />
        <div className="qa-comparison-fitted">{[0,1,3,10,11].map(frame => <div key={frame} className="qa-pixel-frame"><CompanionSprite costume={costume} seasonalEventId="none" /><style>{`.qa-comparisons section:nth-of-type(${['hero','santa','witch'].indexOf(costume)+1}) .qa-comparison-fitted > div:nth-child(${[0,1,3,10,11].indexOf(frame)+1}) .capybara-pixel-sprite{background-position-x:${frame * -96}px}`}</style></div>)}</div>
      </section>)}
    </div>
    <p id="qa-result" role="status">Pixel checks run by the local verification script.</p>
  </main>;
}
async function image(source) { const result = new Image(); result.src = source; await result.decode(); return result; }
const svgURL = (source) => `data:image/svg+xml,${encodeURIComponent(source)}`;
function pixels(img, x = 0, y = 0) {
  const canvas = document.createElement("canvas"); canvas.width = 96; canvas.height = 72;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(img, x, y, 96, 72, 0, 0, 96, 72);
  return context.getImageData(0, 0, 96, 72).data;
}
const equal = (a, b) => a.length === b.length && a.every((value, i) => value === b[i]);

window.runCompanionRasterChecks = async () => {
  const original = await (await fetch("/companion/companion-sprite.svg")).text();
  const definitions = original.match(/<defs>([\s\S]*?)<\/defs>/)[1];
  const assembled = await image("/companion/companion-fitted-sprite.svg");
  const bases = await Promise.all(Array.from({ length: 12 }, async (_, frame) => {
    const base = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="72"><defs>${definitions}</defs><use href="#${getFittedPose(frame).base}"/></svg>`;
    return pixels(await image(svgURL(base)));
  }));
  const results = [];
  for (const [row, { costume, season: rowSeason }] of COMPANION_SPRITE_ROWS.entries()) {
    for (let frame = 0; frame < 12; frame += 1) {
      const options = { costume, season: rowSeason, frame, definitions, id: `qa-${row}-${frame}` };
      const source = renderFittedFrame(options);
      const after = pixels(await image(svgURL(source)));
      const base = bases[frame];
      const failures = new Set();
      if (!equal(after, pixels(assembled, frame * 96, row * 72))) failures.add("Generated sheet differs from fitted source frame");
      const doc = new DOMParser().parseFromString(source, "image/svg+xml");
      for (const node of doc.querySelectorAll("[data-layer]:not([data-layer=clothing])")) node.remove();
      const clothing = pixels(await image(svgURL(new XMLSerializer().serializeToString(doc))));
      for (let offset = 0; offset < clothing.length; offset += 4) {
        if (clothing[offset + 3] && base[offset + 3] !== 255) failures.add("Clothing extends beyond opaque body");
        if (![0, 255].includes(clothing[offset + 3])) failures.add("Clothing contains blurred edges");
      }
      const [hx, hy] = getFittedPose(frame).head;
      const protectedRegions = [[57 + hx, 12 + hy, 9, 10], [63 + hx, 27 + hy, 5, 6], [75, 32 + hy, 16, 15], [0, 62, 96, 9]];
      for (const [x, y, width, height] of protectedRegions) {
        for (let py = y; py < y + height; py += 1) for (let px = x; px < x + width; px += 1) {
          // Intentional costume details on the original nose/mouth, not arbitrary exceptions.
          if (costume === "reindeer" && px >= 84 && px < 90 && py >= 35 + hy && py < 41 + hy) continue;
          if (costume === "vampire" && [79, 80, 83, 84].includes(px) && py >= 43 + hy && py < 46 + hy) continue;
          const offset = (py * 96 + px) * 4;
          if (base[offset + 3] && !equal(base.slice(offset, offset + 4), after.slice(offset, offset + 4))) failures.add("Protected ear/eye/muzzle/feet changed");
        }
      }
      if (costume === "none" && rowSeason === "none" && !equal(base, after)) failures.add("Everyday body changed");
      if (costume !== "none" && equal(base, after)) failures.add("Costume missing");
      if (rowSeason === "none" && ["hero", "santa", "witch"].includes(costume)) {
        const approved = pixels(await image(svgURL(renderPrototypeSprite(options))));
        if (!equal(after, approved)) failures.add("Approved visual reference changed");
      }
      results.push({ costume, season: rowSeason, frame, passed: !failures.size, failures: [...failures] });
    }
  }
  document.querySelector("#qa-result").textContent = `${results.filter((result) => result.passed).length}/${results.length} real-browser raster cases passed.`;
  return results;
};
