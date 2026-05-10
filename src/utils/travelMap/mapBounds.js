const DESKTOP_PADDING = [48, 48];
const MOBILE_PADDING = [24, 24];

export function getLatLngFromPlace(place) {
  const lat = Number.parseFloat(place?.lat);
  const lng = Number.parseFloat(place?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

export function getBoundsFromPlaces(places = []) {
  const points = places
    .map(getLatLngFromPlace)
    .filter(Boolean)
    .map((latLng) => [latLng.lat, latLng.lng]);

  return points.length ? L.latLngBounds(points) : null;
}

export function fitMapToPlaces(map, places = [], options = {}) {
  if (!map || typeof L === 'undefined') return;
  const points = places.map(getLatLngFromPlace).filter(Boolean);
  fitMapToLatLngs(map, points, options);
}

export function fitMapToEntries(map, entries = [], options = {}) {
  if (!map || typeof L === 'undefined') return;
  const points = entries.map((entry) => entry.latLng || getLatLngFromPlace(entry.place)).filter(Boolean);
  fitMapToLatLngs(map, points, options);
}

export function fitMapToLatLngs(map, points = [], options = {}) {
  if (!map || !points.length) return;
  const zoom = options.singleZoom || 14;
  const padding = options.padding || (window.innerWidth < 768 ? MOBILE_PADDING : DESKTOP_PADDING);

  if (points.length === 1) {
    map.setView([points[0].lat, points[0].lng], zoom);
    return;
  }

  map.fitBounds(points.map((point) => [point.lat, point.lng]), { padding });
}
