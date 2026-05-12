import { decodeEncodedPolyline } from './routePolyline.js';

export function formatRouteDuration(seconds) {
  const totalSeconds = Number(seconds);
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return 'N/D';

  const roundedSeconds = Math.round(totalSeconds);
  const hours = Math.floor(roundedSeconds / 3600);
  const minutes = Math.floor((roundedSeconds % 3600) / 60);
  const secondsLeft = roundedSeconds % 60;

  if (hours > 0 && minutes > 0) return `${hours} h ${minutes} min`;
  if (hours > 0) return `${hours} h`;
  if (minutes > 0 && secondsLeft > 0 && minutes < 10) return `${minutes} min ${secondsLeft} s`;
  if (minutes > 0) return `${minutes} min`;
  return `${secondsLeft} s`;
}

export function formatRouteDistance(meters) {
  const distanceMeters = Number(meters);
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) return 'N/D';
  if (distanceMeters < 1000) return `${Math.round(distanceMeters)} m`;
  return `${(distanceMeters / 1000).toFixed(1).replace('.', ',')} km`;
}

export function normalizeRouteResponse(raw, context) {
  const distanceMeters = Number(raw?.distanceMeters);
  const durationSeconds = Number(raw?.durationSeconds);
  const encodedPolyline = raw?.encodedPolyline || '';
  const latLngs = decodeEncodedPolyline(encodedPolyline);

  return {
    id: context.id,
    provider: 'google',
    mode: 'walking',
    originPlaceId: context.originPlaceId,
    destinationPlaceId: context.destinationPlaceId,
    distanceMeters: Number.isFinite(distanceMeters) ? distanceMeters : null,
    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : null,
    distanceText: formatRouteDistance(distanceMeters),
    durationText: formatRouteDuration(durationSeconds),
    encodedPolyline,
    latLngs,
    fetchedAt: new Date().toISOString(),
    status: latLngs.length >= 2 && Number.isFinite(distanceMeters) && Number.isFinite(durationSeconds) ? 'ok' : 'error'
  };
}
