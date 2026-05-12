import { decode } from '@googlemaps/polyline-codec';

export function decodeEncodedPolyline(encodedPolyline) {
  if (!encodedPolyline || typeof encodedPolyline !== 'string') return [];

  try {
    return decode(encodedPolyline).map(([lat, lng]) => [lat, lng]);
  } catch {
    return [];
  }
}

export function hasUsablePolyline(route) {
  return Array.isArray(route?.latLngs) && route.latLngs.length >= 2;
}
