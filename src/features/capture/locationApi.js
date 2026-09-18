const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

function normalizeResult(result) {
  if (!result) return null;
  const address = result.address || {};
  const city =
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.county ||
    "";
  const name =
    result.name ||
    address.amenity ||
    address.shop ||
    address.tourism ||
    city ||
    result.display_name?.split(",")[0] ||
    "Pinned location";

  return {
    name: String(name),
    city: String(city),
    latitude: Number(result.lat),
    longitude: Number(result.lon),
    placeId: result.osm_type && result.osm_id ? `${result.osm_type}${result.osm_id}` : String(result.place_id || ""),
    displayName: String(result.display_name || name),
  };
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Location search is unavailable right now.");
  }

  return response.json();
}

export async function searchLocations(query, { limit = 6 } = {}) {
  const clean = String(query || "").trim();
  if (!clean) return [];

  const params = new URLSearchParams({
    q: clean,
    format: "jsonv2",
    addressdetails: "1",
    limit: String(Math.max(1, Math.min(limit, 10))),
  });

  const results = await fetchJson(`${NOMINATIM_BASE}/search?${params.toString()}`);
  return (results || []).map(normalizeResult).filter((result) => (
    result &&
    Number.isFinite(result.latitude) &&
    Number.isFinite(result.longitude)
  ));
}

export async function reverseGeocode(latitude, longitude) {
  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    format: "jsonv2",
    addressdetails: "1",
    zoom: "18",
  });

  return normalizeResult(
    await fetchJson(`${NOMINATIM_BASE}/reverse?${params.toString()}`)
  );
}

export function getCurrentLocation() {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.reject(new Error("Location services are not available in this browser."));
  }

  if (typeof window !== "undefined" && window.isSecureContext === false) {
    return Promise.reject(new Error("Current location requires HTTPS or localhost. On a phone, an HTTP address using your computer's IP cannot request location."));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          resolve(await reverseGeocode(position.coords.latitude, position.coords.longitude));
        } catch (error) {
          reject(error);
        }
      },
      (error) => {
        if (error?.code === 1) {
          reject(new Error("Location access is blocked for this site. Allow Location in your browser's site permissions, then try again."));
        } else if (error?.code === 2) {
          reject(new Error("Your device could not determine a location. Check that Location Services are turned on."));
        } else if (error?.code === 3) {
          reject(new Error("Location lookup timed out. Try again."));
        } else {
          reject(new Error("Could not determine your location."));
        }
      },
      {
        enableHighAccuracy: false,
        maximumAge: 300000,
        timeout: 10000,
      },
    );
  });
}
