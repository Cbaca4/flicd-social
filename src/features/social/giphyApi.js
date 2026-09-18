const API_BASE = "https://api.giphy.com/v1/gifs";

export const GIPHY_ATTRIBUTION_TEXT = "Powered By GIPHY";

function getApiKey(explicitKey) {
  return String(
    explicitKey ?? import.meta.env.VITE_GIPHY_API_KEY ?? "",
  ).trim();
}

function normalizeGif(item) {
  const preview = item?.images?.fixed_width;
  const original = item?.images?.original;
  if (!item?.id || !preview?.url || !original?.url) return null;

  return {
    id: item.id,
    title: item.title || "",
    previewUrl: preview.url,
    fullUrl: original.url,
    width: Number(preview.width) || 0,
    height: Number(preview.height) || 0,
  };
}

async function request(path, params, apiKey) {
  const key = getApiKey(apiKey);
  if (!key) {
    throw new Error(
      "GIPHY is not configured. Add VITE_GIPHY_API_KEY to .env.local and restart Vite.",
    );
  }

  const url = new URL(`${API_BASE}/${path}`);
  url.search = new URLSearchParams({
    api_key: key,
    rating: "pg-13",
    ...params,
  }).toString();

  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("GIPHY rejected this API key. Check that your key is active and configured for this app.");
    }

    if (response.status === 429) {
      throw new Error("GIPHY rate limit reached. Try again in a little while.");
    }

    throw new Error("GIPHY could not load GIFs.");
  }

  const payload = await response.json();
  return (payload.data || []).map(normalizeGif).filter(Boolean);
}

export function searchGifs(query, options = {}) {
  const clean = String(query || "").trim();
  return request(
    "search",
    { q: clean, limit: String(options.limit || 18) },
    options.apiKey,
  );
}

export function getTrendingGifs(options = {}) {
  return request(
    "trending",
    { limit: String(options.limit || 18) },
    options.apiKey,
  );
}
