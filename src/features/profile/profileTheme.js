const SECTION_DEFAULT = {
  background: "#252832",
  border: "#343844",
  accent: "#ffb52e",
  radius: 20,
  opacity: 0.94,
};

export const DEFAULT_THEME = {
  background: "#17191e",
  backgroundStyle: "solid",
  backgroundMedia: null,
  accent: "#ffb52e",
  cardOpacity: 0.94,
  radius: 22,
  borderStyle: "soft",
  font: "Space Grotesk",
  status: "collecting moments",
  message: "make your own little corner of the internet",
  showBoards: true,
  showInterests: true,
  showMusic: true,
  sectionOrder: ["featured", "boards", "about"],
  profileLinks: [],
  favoriteArtist: "",
  statusEmoji: "✦",
  sectionStyles: {
    hero: { ...SECTION_DEFAULT, background: "#252832" },
    boards: { ...SECTION_DEFAULT },
    onRepeat: { ...SECTION_DEFAULT, accent: "#46dac8" },
    activeSpace: { ...SECTION_DEFAULT, accent: "#46dac8" },
    customize: { ...SECTION_DEFAULT },
  },
  buttonStyle: {
    background: "#17191e",
    border: "#343844",
    text: "#f2efe8",
    accent: "#ffb52e",
    radius: 14,
    filled: false,
  },
};

const allowed = {
  backgroundStyle: ["solid", "gradient"],
  borderStyle: ["soft", "bold", "none"],
  font: ["Space Grotesk", "IBM Plex Mono"],
  radius: [],
};


function normalizeBackgroundMedia(value) {
  if (!value || typeof value !== "object" || !/^https?:\/\//.test(String(value.url || ""))) {
    return null;
  }

  const positionX = Number(value.positionX);
  const positionY = Number(value.positionY);
  const scale = Number(value.scale);

  return {
    url: String(value.url),
    type: value.type === "video" ? "video" : "image",
    mimeType: String(value.mimeType || ""),
    positionX: Number.isFinite(positionX) ? Math.min(100, Math.max(0, positionX)) : 50,
    positionY: Number.isFinite(positionY) ? Math.min(100, Math.max(0, positionY)) : 50,
    scale: Number.isFinite(scale) ? Math.min(1.6, Math.max(1, scale)) : 1,
  };
}

function normalizeSectionStyle(value, fallback) {
  const next = { ...SECTION_DEFAULT, ...fallback, ...(value || {}) };
  if (!/^#[0-9a-fA-F]{6}$/.test(next.background)) next.background = fallback.background;
  if (!/^#[0-9a-fA-F]{6}$/.test(next.border)) next.border = fallback.border;
  if (!/^#[0-9a-fA-F]{6}$/.test(next.accent)) next.accent = fallback.accent;
  next.radius = Math.min(36, Math.max(12, Number(next.radius) || fallback.radius));
  next.opacity = Math.min(1, Math.max(0.65, Number(next.opacity) || fallback.opacity));
  return next;
}

export function sanitizeProfileLinks(input = []) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((value) => value && typeof value === "object")
    .slice(0, 3)
    .map((value) => {
      const rawUrl = String(value.url || "").trim();
      if (!rawUrl) return null;
      const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : "https://" + rawUrl;
      try {
        const parsed = new URL(url);
        if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) return null;
      } catch {
        return null;
      }
      return {
        label: String(value.label || "").trim().slice(0, 40),
        url: url.slice(0, 500),
      };
    })
    .filter(Boolean);
}

export function sanitizeProfileTheme(input = {}) {
  const t = {
    ...DEFAULT_THEME,
    ...(input || {}),
    sectionStyles: {
      ...DEFAULT_THEME.sectionStyles,
      ...(input?.sectionStyles || {}),
    },
    buttonStyle: {
      ...DEFAULT_THEME.buttonStyle,
      ...(input?.buttonStyle || {}),
    },
  };

  if (!/^#[0-9a-fA-F]{6}$/.test(t.background)) t.background = DEFAULT_THEME.background;
  if (!/^#[0-9a-fA-F]{6}$/.test(t.accent)) t.accent = DEFAULT_THEME.accent;
  if (!allowed.backgroundStyle.includes(t.backgroundStyle)) t.backgroundStyle = DEFAULT_THEME.backgroundStyle;
  if (!allowed.borderStyle.includes(t.borderStyle)) t.borderStyle = DEFAULT_THEME.borderStyle;
  if (!allowed.font.includes(t.font)) t.font = DEFAULT_THEME.font;
  const themeRadius = Number(t.radius);
  t.radius = Number.isFinite(themeRadius)
    ? Math.min(36, Math.max(12, themeRadius))
    : DEFAULT_THEME.radius;

  t.cardOpacity = Math.min(1, Math.max(0.72, Number(t.cardOpacity) || DEFAULT_THEME.cardOpacity));
  t.message = String(t.message || "").slice(0, 180);
  t.favoriteArtist = String(t.favoriteArtist || "").slice(0, 80);
  t.status = String(t.status || "").slice(0, 60);
  t.statusEmoji = String(t.statusEmoji || "✦").slice(0, 4);
  t.showBoards = Boolean(t.showBoards);
  t.showInterests = Boolean(t.showInterests);
  t.showMusic = Boolean(t.showMusic);
  t.profileLinks = sanitizeProfileLinks(t.profileLinks);

  t.backgroundMedia = normalizeBackgroundMedia(t.backgroundMedia);

  const sectionFallbacks = DEFAULT_THEME.sectionStyles;
  t.sectionStyles = Object.fromEntries(
    Object.keys(sectionFallbacks).map((key) => [
      key,
      normalizeSectionStyle(t.sectionStyles?.[key], sectionFallbacks[key]),
    ]),
  );

  const button = { ...DEFAULT_THEME.buttonStyle, ...(t.buttonStyle || {}) };
  if (!/^#[0-9a-fA-F]{6}$/.test(button.background)) button.background = DEFAULT_THEME.buttonStyle.background;
  if (!/^#[0-9a-fA-F]{6}$/.test(button.border)) button.border = DEFAULT_THEME.buttonStyle.border;
  if (!/^#[0-9a-fA-F]{6}$/.test(button.text)) button.text = DEFAULT_THEME.buttonStyle.text;
  if (!/^#[0-9a-fA-F]{6}$/.test(button.accent)) button.accent = DEFAULT_THEME.buttonStyle.accent;
  button.radius = Math.min(36, Math.max(12, Number(button.radius) || DEFAULT_THEME.buttonStyle.radius));
  button.filled = Boolean(button.filled);
  t.buttonStyle = button;

  t.sectionOrder = Array.isArray(t.sectionOrder)
    ? t.sectionOrder.filter((x) => ["featured", "boards", "about"].includes(x))
    : DEFAULT_THEME.sectionOrder;

  return t;
}
