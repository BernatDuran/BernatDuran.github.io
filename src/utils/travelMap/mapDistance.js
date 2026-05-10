const EARTH_RADIUS_KM = 6371;

export function haversineKm(a, b) {
  if (!a || !b) return null;
  const toRad = (degrees) => degrees * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function calculateRouteDistanceKm(entries = []) {
  const validEntries = entries.filter((entry) => entry.latLng);
  return validEntries.reduce((total, entry, index) => {
    if (index === 0) return total;
    const distance = haversineKm(validEntries[index - 1].latLng, entry.latLng);
    return Number.isFinite(distance) ? total + distance : total;
  }, 0);
}

export function formatDistanceKm(value) {
  if (!Number.isFinite(value)) return 'N/D';
  const decimals = value >= 1 ? 1 : 2;
  return `${value.toFixed(decimals).replace('.', ',')} km`;
}
