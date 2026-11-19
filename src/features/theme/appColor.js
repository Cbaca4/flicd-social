// User-selected application colors. Preferences are stored inside the existing
// RLS-protected profiles.profile_theme JSON, not in a shared localStorage key.
export const DEFAULT_APP_COLOR = Object.freeze({
  enabled: false,
  hue: 318,
  intensity: 75,
  mode: "dark",
});

export function sanitizeAppColor(value) {
  const input = value && typeof value === "object" ? value : {};
  const hue = Number(input.hue);
  const intensity = Number(input.intensity);
  return {
    enabled: input.enabled === true,
    hue: Number.isFinite(hue) ? Math.min(360, Math.max(0, Math.round(hue))) : DEFAULT_APP_COLOR.hue,
    intensity: Number.isFinite(intensity) ? Math.min(100, Math.max(20, Math.round(intensity))) : DEFAULT_APP_COLOR.intensity,
    mode: input.mode === "light" ? "light" : "dark",
  };
}

function srgb(channel) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function hslRgb(h, s, l) {
  const hue = ((h % 360) + 360) % 360;
  const saturation = s / 100, lightness = l / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const k = (hue / 60) % 2;
  const x = chroma * (1 - Math.abs(k - 1));
  const m = lightness - chroma / 2;
  const triplets = [[chroma, x, 0], [x, chroma, 0], [0, chroma, x],
    [0, x, chroma], [x, 0, chroma], [chroma, 0, x]];
  return triplets[Math.floor(hue / 60)].map((c) => Math.round((c + m) * 255));
}

function luminance(rgb) {
  const [r, g, b] = rgb.map(srgb);
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

export function colorContrast(foreground, background) {
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function accessibleAccent(hue, intensity, mode = "dark") {
  const ink = mode === "light" ? [255, 255, 255] : [21, 19, 27];
  let lightness = mode === "light" ? 36 : 72;
  const direction = mode === "light" ? -1 : 1;
  while (colorContrast(hslRgb(hue, intensity, lightness), ink) < 4.5 &&
         lightness > 9 && lightness < 94) {
    lightness += direction;
  }
  return { css: `hsl(${hue} ${intensity}% ${lightness}%)`, contrast: colorContrast(hslRgb(hue, intensity, lightness), ink) };
}

export function appColorCssVars(colorInput) {
  const color = sanitizeAppColor(colorInput);
  if (!color.enabled) return {};
  const { hue, intensity, mode } = color;
  const accent = accessibleAccent(hue, intensity, mode).css;
  const secondary = accessibleAccent((hue + 45) % 360, Math.max(45, intensity - 10), mode).css;
  const light = mode === "light";
  return {
    "--bg": light ? `hsl(${hue} 24% 96%)` : `hsl(${hue} 16% 7%)`,
    "--surface": light ? "#ffffff" : `hsl(${hue} 13% 11%)`,
    "--elev": light ? `hsl(${hue} 21% 91%)` : `hsl(${hue} 13% 15%)`,
    "--card": light ? `hsl(${hue} 18% 98%)` : `hsl(${hue} 14% 17%)`,
    "--border": light ? `hsl(${hue} 12% 71%)` : `hsl(${hue} 11% 31%)`,
    "--text": light ? "#16171b" : "#f8f5fa",
    "--muted": light ? "#50515b" : "#b6acba",
    "--dock": light ? `hsla(${hue}, 22%, 97%, .93)` : `hsla(${hue}, 19%, 10%, .88)`,
    "--amber": accent,
    "--cyan": secondary,
    "--pink": accent,
    "--violet": secondary,
    "--flicd-global-accent": accent,
    "--flicd-global-soft": `hsla(${hue}, ${intensity}%, 66%, .16)`,
    "--flicd-accent-ink": light ? "#ffffff" : "#15131b",
  };
}
