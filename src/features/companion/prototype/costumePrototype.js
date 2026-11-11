// Review-only experiment. This module is deliberately not imported by the app.
const WALK_BOB = [0, -1, 0, 1, 0, -1, 0, 1, 0, -1];

export function getPrototypePose(frame) {
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

export function renderPrototypeSprite({ costume, frame, definitions, id }) {
  const pose = getPrototypePose(frame);
  if (!["hero", "santa", "witch"].includes(costume)) {
    throw new RangeError("This review prototype supports hero, santa, and witch only");
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
  }[costume];
  const [main, light, dark, accent] = colors;
  const headwear = {
    hero: `<path d="M60 26H71V28H68V33H63V35H60Z" fill="${accent}"/><rect x="68" y="28" width="4" height="6" fill="${accent}"/>`,
    santa: `<path d="M49 17V12H54V8H59V4H67V7H70V17Z" fill="${main}"/><rect x="53" y="12" width="4" height="5" fill="${light}"/><rect x="49" y="17" width="25" height="4" fill="${accent}"/><rect x="65" y="3" width="6" height="5" fill="${accent}"/>`,
    witch: `<path d="M50 19V15H55V10H60V5H64V2H68V11H71V19Z" fill="${main}"/><rect x="55" y="15" width="16" height="4" fill="${accent}"/><rect x="63" y="15" width="4" height="3" fill="#f6d680"/><rect x="46" y="19" width="31" height="4" fill="${dark}"/>`,
  }[costume];
  // The untouched original frame paints over the rear cape. Clothing is clipped
  // to the stepped torso, never the muzzle or legs. Ear/eye pixels win last.
  const cape = costume === "hero"
    ? `<path d="M${x + 16} ${y + 2}H${x + 5}V${y + 7}H${x - 2}V${y + 16}H${x - 6}V${y + height + 6}H${x + 1}V${y + height + 3}H${x + 8}V${y + height + 5}H${x + 14}Z" fill="#b73549"/><rect x="${x - 2}" y="${y + 17}" width="3" height="${height - 12}" fill="#e16566"/>`
    : "";
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
    </g>
    <g data-layer="headwear" transform="translate(${pose.head.join(" ")})">${headwear}</g>
    <use data-layer="ear" href="#${pose.base}" clip-path="url(#${id}-ear)"/>
    <use data-layer="eye" href="#${pose.base}" clip-path="url(#${id}-eye)"/>
  </svg>`;
}
