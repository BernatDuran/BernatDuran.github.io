import {
  buildWalkingRouteCacheKey,
  getCachedWalkingRoute,
  setCachedWalkingRoute
} from './routeCache.js';
import { normalizeRouteResponse } from './routeFormatters.js';
import { getPlaceLatLng } from '../placeData.js';

const ROUTE_TIMEOUT_MS = 12000;

function buildRouteError(originPlace, destinationPlace, status, message) {
  return {
    id: buildWalkingRouteCacheKey(originPlace?.id || 'unknown', destinationPlace?.id || 'unknown'),
    provider: 'google',
    mode: 'walking',
    originPlaceId: originPlace?.id || null,
    destinationPlaceId: destinationPlace?.id || null,
    distanceMeters: null,
    durationSeconds: null,
    distanceText: null,
    durationText: null,
    encodedPolyline: null,
    latLngs: [],
    fetchedAt: new Date().toISOString(),
    status,
    message
  };
}

function getRoutesProxyUrl() {
  return import.meta.env.VITE_ROUTES_PROXY_URL?.replace(/\/+$/, '') || '/api';
}

function buildRouteUrl(proxyUrl, originLatLng, destinationLatLng) {
  const url = new URL(`${proxyUrl}/route`, window.location.origin);
  url.searchParams.set('mode', 'walking');
  url.searchParams.set('fromLat', String(originLatLng.lat));
  url.searchParams.set('fromLng', String(originLatLng.lng));
  url.searchParams.set('toLat', String(destinationLatLng.lat));
  url.searchParams.set('toLng', String(destinationLatLng.lng));
  return url;
}

function withTimeout(signal) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), ROUTE_TIMEOUT_MS);

  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  return { signal: controller.signal, timeoutId };
}

export async function getWalkingRouteBetweenPlaces(originPlace, destinationPlace, options = {}) {
  const originLatLng = getPlaceLatLng(originPlace);
  const destinationLatLng = getPlaceLatLng(destinationPlace);
  const routeId = buildWalkingRouteCacheKey(originPlace?.id || 'unknown', destinationPlace?.id || 'unknown');

  if (!originPlace?.id || !destinationPlace?.id || !originLatLng || !destinationLatLng) {
    const route = buildRouteError(originPlace, destinationPlace, 'missing-coordinates', 'Sin coordenadas suficientes');
    options.onRouteError?.(route);
    return route;
  }

  if (!options.forceRefresh) {
    const cached = getCachedWalkingRoute(originPlace.id, destinationPlace.id);
    if (cached) {
      options.onRouteLoaded?.(cached);
      return cached;
    }
  }

  const proxyUrl = getRoutesProxyUrl();
  const { signal, timeoutId } = withTimeout(options.signal);

  try {
    const response = await fetch(buildRouteUrl(proxyUrl, originLatLng, destinationLatLng), { signal });
    if (!response.ok) {
      const route = buildRouteError(originPlace, destinationPlace, 'error', 'No se pudo calcular la ruta a pie');
      options.onRouteError?.(route);
      return route;
    }

    const raw = await response.json();
    const route = normalizeRouteResponse(raw, {
      id: routeId,
      originPlaceId: originPlace.id,
      destinationPlaceId: destinationPlace.id
    });

    if (route.status === 'ok') {
      setCachedWalkingRoute(originPlace.id, destinationPlace.id, route);
      options.onRouteLoaded?.(route);
      return route;
    }

    const errorRoute = { ...route, status: 'error', message: 'Google Routes no devolvio una polyline valida' };
    options.onRouteError?.(errorRoute);
    return errorRoute;
  } catch {
    const route = buildRouteError(originPlace, destinationPlace, 'error', 'No se pudo conectar con el proxy de rutas');
    options.onRouteError?.(route);
    return route;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function getWalkingRoutesForEntries(entries, options = {}) {
  const results = [];

  for (let index = 1; index < entries.length; index += 1) {
    const originEntry = entries[index - 1];
    const destinationEntry = entries[index];
    const route = await getWalkingRouteBetweenPlaces(originEntry.place, destinationEntry.place, options);
    results.push({
      originEntry,
      destinationEntry,
      route
    });
  }

  return results;
}
