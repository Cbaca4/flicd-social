// Build-time art only; the application animates the generated sprite sheet.
import { COMPANION_SPRITE, COMPANION_SPRITE_ROWS } from "../companionSprite.js";

const WALK_BOB = [0, -1, 0, 1, 0, -1, 0, 1, 0, -1];

export function getFittedPose(frame) {
  if (!Number.isInteger(frame) || frame < 0 || frame > 11) {
    throw new RangeError("Expected a Companion frame from 0 to 11");
  }
  if (frame >= 10) {
    const second = frame === 11;
    return {
      base: second ? "sit1" : "sit0",
      head: second ? [3, 5] : [2, 4],
      torso: second ? [21, 35, 48, 20] : [24, 33, 43, 22],
    };
  }
  return {
    base: `walk${frame}`,
    head: [0, WALK_BOB[frame]],
    torso: [14, 25 + WALK_BOB[frame], 56, 30],
  };
}

export function renderFittedFrame({ costume, season = "none", frame, definitions, id }) {
  const pose = getFittedPose(frame);
  if (!COMPANION_SPRITE_ROWS.some((row) => row.costume === costume)) {
    throw new RangeError("Unknown Companion costume");
  }
  if (!/^[a-z][a-z0-9-]*$/i.test(id)) throw new TypeError("Expected a safe SVG identifier");
  const [hx, hy] = pose.head;
  const [x, y, width, height] = pose.torso;
  const seated = frame >= 10;
  const torsoPath = seated
    ? `${x},${y + 5} ${x + 5 + (frame - 10)},${y + 5} ${x + 5 + (frame - 10)},${y} ${50 + (frame - 10)},${y} ${50 + (frame - 10)},54 ${x + width - 3},54 ${x + width - 3},55 ${x},55`
    : `14,${31 + hy} 19,${31 + hy} 19,${27 + hy} 24,${27 + hy} 24,${25 + hy} 48,${25 + hy} 48,${50 + hy} 66,${50 + hy} 66,${55 + hy} 14,${55 + hy}`;
  const colors = {
    hero: ["#425ac5", "#7895e8", "#293c8a", "#f2d85f"],
    santa: ["#c83f46", "#e36561", "#91343d", "#f2e9df"],
    witch: ["#53317a", "#8960ad", "#392251", "#df9b43"],
    none: ["none", "none", "none", "none"],
    ghost: ["#eef1f8", "#ffffff", "#b7c1d5", "#d5ddea"],
    valentine: ["#e45c88", "#f6a6c0", "#b63862", "#fff0f2"],
    speedster: ["#d9473f", "#f17a54", "#9d3139", "#f5cd4a"],
    cosmic: ["#5142a8", "#7771d8", "#2e3475", "#43c4e5"],
    "pumpkin-king": ["#db7a29", "#f7ac43", "#a75227", "#783e9c"],
    vampire: ["#402a42", "#75516f", "#27202e", "#b83b55"],
    reaper: ["#302a3b", "#61576f", "#211d2b", "#c5b7d0"],
    elf: ["#34815a", "#6fbb80", "#235b49", "#df6261"],
    gingerbread: ["#b47a46", "#daaa73", "#885432", "#fff3d4"],
    reindeer: ["#a47146", "#c79663", "#744b37", "#e8cda2"],
    cupid: ["#f2bbcf", "#ffe1e9", "#d98da9", "#fff5dc"],
    "love-letter": ["#fff0ec", "#fffafa", "#e5b6bd", "#d85a7d"],
  }[costume];
  const [main, light, dark, accent] = colors;
  const santaHat = `<path d="M49 17V12H54V8H59V4H67V7H70V17Z" fill="#c83f46"/><rect x="53" y="12" width="4" height="5" fill="#e36561"/><rect x="49" y="17" width="25" height="4" fill="#f2e9df"/><rect x="65" y="3" width="6" height="5" fill="#f2e9df"/>`;
  const heart = (left, top, color) => `<path d="M${left} ${top}h3v1h2v-1h3v3h-1v2h-2v2h-2v-2h-2v-2h-1Z" fill="${color}"/>`;
  const headwear = ({
    hero: `<path d="M60 26H71V28H68V33H63V35H60Z" fill="${accent}"/><rect x="68" y="28" width="4" height="6" fill="${accent}"/>`,
    santa: `<path d="M49 17V12H54V8H59V4H67V7H70V17Z" fill="${main}"/><rect x="53" y="12" width="4" height="5" fill="${light}"/><rect x="49" y="17" width="25" height="4" fill="${accent}"/><rect x="65" y="3" width="6" height="5" fill="${accent}"/>`,
    witch: `<path d="M50 19V15H55V10H60V5H64V2H68V11H71V19Z" fill="${main}"/><rect x="55" y="15" width="16" height="4" fill="${accent}"/><rect x="63" y="15" width="4" height="3" fill="#f6d680"/><rect x="46" y="19" width="31" height="4" fill="${dark}"/>`,
    none: season === "christmas" ? santaHat : season === "valentines" ? heart(51, 20, "#ee6d99") + heart(60, 19, "#f4a0bc") : "",
    ghost: `<path d="M48 22H54V19H73V24H77V30H72V26H55V42H48Z" fill="${main}"/><rect x="54" y="19" width="17" height="3" fill="${light}"/>`,
    valentine: `<path d="M50 21H56V23H60V21H68V26H61V24H57V26H50Z" fill="${main}"/><rect x="57" y="22" width="4" height="4" fill="${light}"/>`,
    speedster: `<path d="M52 19H71V24H62V26H53Z" fill="${main}"/><path d="M53 19H58V21H55V24H51V22H53Z" fill="${accent}"/>`,
    cosmic: `<rect x="52" y="19" width="19" height="4" fill="${dark}"/><rect x="62" y="19" width="4" height="4" fill="#fff6a6"/><rect x="54" y="21" width="4" height="3" fill="${accent}"/>`,
    "pumpkin-king": `<path d="M49 20V13H53V16H58V11H63V16H68V13H72V23H49Z" fill="${main}"/><rect x="59" y="8" width="4" height="5" fill="#4e8e53"/><rect x="49" y="20" width="23" height="3" fill="${accent}"/>`,
    vampire: `<path d="M49 21H54V18H70V21H73V25H69V23H54V25H49Z" fill="${dark}"/><rect x="51" y="23" width="4" height="13" fill="${accent}"/>`,
    reaper: `<path d="M48 22H53V17H68V20H72V26H68V23H55V44H48Z" fill="${main}"/><rect x="50" y="24" width="3" height="16" fill="${light}"/>`,
    elf: `<path d="M49 18V13H54V7H62V10H70V13H76V17H68V20Z" fill="${main}"/><rect x="49" y="18" width="24" height="4" fill="${accent}"/><rect x="74" y="14" width="4" height="4" fill="#f3d67b"/>`,
    reindeer: `<path d="M51 19V9H47V3H50V7H54V3H57V10H55V19ZM68 19V10H72V3H75V7H79V10H75V14H72V19Z" fill="#7a4a35"/><rect x="51" y="18" width="21" height="3" fill="${accent}"/>`,
    cupid: heart(53, 20, "#ec7caa"),
  }[costume]) || "";
  // The untouched original frame paints over the rear cape. Clothing is clipped
  // to the stepped torso, never the muzzle or legs. Ear/eye pixels win last.
  const capeColor = costume === "hero" ? "#b73549" : costume === "vampire" ? "#7d314d" : "#2e3475";
  const cape = ["hero", "vampire", "cosmic"].includes(costume)
    ? `<path d="M${x + 16} ${y + 2}H${x + 5}V${y + 7}H${x - 2}V${y + 16}H${x - 6}V${y + height + 6}H${x + 1}V${y + height + 3}H${x + 8}V${y + height + 5}H${x + 14}Z" fill="${capeColor}"/><rect x="${x - 2}" y="${y + 17}" width="3" height="${height - 12}" fill="${costume === "hero" ? "#e16566" : light}"/>`
    : costume === "cupid" ? `<path d="M${x + 18} ${y + 14}H${x + 10}V${y + 9}H${x + 5}V${y + 3}H${x + 1}V${y - 4}H${x + 5}V${y - 8}H${x + 9}V${y - 3}H${x + 13}V${y + 3}H${x + 18}Z" fill="#fff0e9"/><rect x="${x + 5}" y="${y - 2}" width="3" height="8" fill="#e9abc4"/>` : "";
  let detail = "";
  if (["valentine", "cupid"].includes(costume)) detail = heart(x + 14, y + 12, costume === "valentine" ? "#fff0f2" : "#e45c88");
  if (costume === "speedster") detail = `<path d="M${x + 20} ${y + 8}h8v3h-4v4h-3v5h-4v-7h3Z" fill="${accent}"/>`;
  if (costume === "cosmic") detail = `<path d="M${x + 21} ${y + 8}h3v3h3v3h-3v3h-3v-3h-3v-3h3Z" fill="#fff6a6"/><rect x="${x + 9}" y="${y + 16}" width="2" height="2" fill="#ffffff"/>`;
  if (costume === "pumpkin-king") detail = `<rect x="${x + 12}" y="${y + 12}" width="4" height="4" fill="#392735"/><rect x="${x + 22}" y="${y + 12}" width="4" height="4" fill="#392735"/><path d="M${x + 12} ${y + 19}h5v2h4v-2h5v4h-14Z" fill="#392735"/>`;
  if (costume === "reaper") detail = `<rect x="${x + width - 24}" y="${y + 10}" width="8" height="5" fill="#eee6dc"/><rect x="${x + width - 22}" y="${y + 11}" width="2" height="2" fill="${dark}"/><rect x="${x + width - 18}" y="${y + 11}" width="2" height="2" fill="${dark}"/>`;
  if (costume === "gingerbread") detail = `<path d="M${x + 5} ${y + 8}h6v2h6v-2h6v2h6v-2h6v2h6v2h-8v-2h-6v2h-6v-2h-6v2h-8Z" fill="${accent}"/><rect x="${x + 19}" y="${y + 17}" width="3" height="3" fill="#d64f58"/><rect x="${x + 19}" y="${y + 23}" width="3" height="3" fill="#4e9460"/>`;
  if (costume === "love-letter") detail = `<path d="M${x} ${y + 8}h6v3h6v3h6v3h6v-3h6v-3h6v-3h6v3h-4v3h-6v3h-6v3h-10v-3h-6v-3h-6Z" fill="${accent}"/>${heart(x + 17, y + 15, accent)}`;
  if (season === "halloween" && ["none", "hero", "speedster", "cosmic"].includes(costume)) detail += `<rect x="${x + 8}" y="${y + 12}" width="9" height="7" fill="#ef8f27"/><rect x="${x + 12}" y="${y + 10}" width="2" height="3" fill="#56975b"/><rect x="${x + 10}" y="${y + 14}" width="2" height="2" fill="#783e9c"/><rect x="${x + 14}" y="${y + 14}" width="2" height="2" fill="#783e9c"/>`;
  const accessories = costume === "reindeer"
    ? `<rect x="84" y="${35 + hy}" width="6" height="6" fill="#d84747"/><rect x="85" y="${36 + hy}" width="2" height="2" fill="#f3a0a0"/>`
    : costume === "vampire" ? `<rect x="79" y="${43 + hy}" width="2" height="3" fill="#f1f1f1"/><rect x="83" y="${43 + hy}" width="2" height="3" fill="#f1f1f1"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="72" viewBox="0 0 96 72" shape-rendering="crispEdges">
    <defs>${definitions}
      <clipPath id="${id}-torso"><polygon points="${torsoPath}"/></clipPath>
      <clipPath id="${id}-ear"><rect x="${57 + hx}" y="${12 + hy}" width="9" height="10"/></clipPath>
      <clipPath id="${id}-eye"><rect x="${63 + hx}" y="${27 + hy}" width="5" height="6"/></clipPath>
    </defs>
    <g data-layer="rear">${cape}</g>
    <use href="#${pose.base}" data-layer="base"/>
    <g data-layer="clothing" clip-path="url(#${id}-torso)">
      <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${main}"/>
      <rect x="${x + 5}" y="${y + 3}" width="${seated ? 16 : 24}" height="3" fill="${light}"/>
      <rect x="${x}" y="${y + height - 6}" width="${width}" height="6" fill="${dark}"/>
      <rect x="${x + width - 22}" y="${y}" width="4" height="${height}" fill="${accent}"/>
      ${costume === "hero" ? `<path d="M${x + 16} ${y + 10}H${x + 22}V${y + 14}H${x + 20}V${y + 18}H${x + 18}V${y + 14}H${x + 16}Z" fill="${accent}"/>` : ""}
      ${costume === "santa" ? `<rect x="${x}" y="${y + height - 7}" width="${width}" height="3" fill="#372c30"/><rect x="${x + width - 23}" y="${y + height - 8}" width="6" height="5" fill="#e8bf61"/>` : ""}
      ${detail}
    </g>
    <g data-layer="headwear" transform="translate(${pose.head.join(" ")})">${headwear}</g>
    <use data-layer="ear" href="#${pose.base}" clip-path="url(#${id}-ear)"/>
    <use data-layer="eye" href="#${pose.base}" clip-path="url(#${id}-eye)"/>
    ${accessories ? `<g data-layer="accessories">${accessories}</g>` : ""}
  </svg>`;
}

export function buildFittedSheet(original) {
  const definitions = original.match(/<defs>([\s\S]*?)<\/defs>/)?.[1].split('<g id="frame-row">')[0];
  if (!definitions?.includes('id="sit1"')) throw new TypeError("Expected the original twelve-frame Companion sheet");
  const cells = COMPANION_SPRITE_ROWS.flatMap(({ costume, season }, row) =>
    Array.from({ length: COMPANION_SPRITE.frames }, (_, frame) =>
      renderFittedFrame({ costume, season, frame, definitions: "", id: `fit-${row}-${frame}` })
        .replace('<svg xmlns="http://www.w3.org/2000/svg"', `<svg x="${frame * 96}" y="${row * 72}" data-frame="${frame}" data-row="${row}" overflow="hidden"`),
    ),
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${COMPANION_SPRITE.width}" height="${COMPANION_SPRITE.height}" viewBox="0 0 ${COMPANION_SPRITE.width} ${COMPANION_SPRITE.height}" shape-rendering="crispEdges">\n<!-- Generated by src/features/companion/art/generateCompanionSprite.mjs; do not edit by hand. -->\n<defs>${definitions}</defs>\n${cells.join("\n")}\n</svg>\n`;
}
