// Compute a decorative profile accent locally from a downscaled image.
// Text, actions, and core brand colors are intentionally not recolored.
export function getProfileImageAccent(pixelData) {
  if (!pixelData?.length) return null;
  let x = 0;
  let y = 0;
  let weightTotal = 0;

  for (let index = 0; index + 3 < pixelData.length; index += 4) {
    const alpha = pixelData[index + 3] / 255;
    if (alpha < 0.5) continue;
    const r = pixelData[index] / 255;
    const g = pixelData[index + 1] / 255;
    const b = pixelData[index + 2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const chroma = max - min;
    if (chroma < 0.13 || max < 0.15 || min > 0.93) continue;

    let hue;
    if (max === r) hue = ((g - b) / chroma) % 6;
    else if (max === g) hue = (b - r) / chroma + 2;
    else hue = (r - g) / chroma + 4;
    const radians = (hue * 60 * Math.PI) / 180;
    const weight = chroma * alpha;
    x += Math.cos(radians) * weight;
    y += Math.sin(radians) * weight;
    weightTotal += weight;
  }

  if (!weightTotal) return null;
  const hue = ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
  // Keep the palette bright enough for low-contrast decorative strokes.
  return `hsl(${Math.round(hue)} 61% 72%)`;
}
