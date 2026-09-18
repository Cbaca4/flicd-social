export function distanceKm(fromLatitude, fromLongitude, toLatitude, toLongitude) {
  const lat1 = Number(fromLatitude);
  const lon1 = Number(fromLongitude);
  const lat2 = Number(toLatitude);
  const lon2 = Number(toLongitude);

  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return null;

  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistanceKm(value) {
  const distance = Number(value);
  if (!Number.isFinite(distance)) return "";
  if (distance < 0.1) return "0.0 km";
  if (distance < 10) return `${distance.toFixed(1)} km`;
  return `${Math.round(distance)} km`;
}
