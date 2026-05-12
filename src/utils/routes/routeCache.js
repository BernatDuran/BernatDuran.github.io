const ROUTE_CACHE_PREFIX = 'route:v1:walking';

export function buildWalkingRouteCacheKey(originPlaceId, destinationPlaceId) {
  return `${ROUTE_CACHE_PREFIX}:${originPlaceId}:${destinationPlaceId}`;
}

export function isRouteCacheValid(route) {
  return route?.status === 'ok'
    && route.mode === 'walking'
    && typeof route.originPlaceId === 'string'
    && typeof route.destinationPlaceId === 'string'
    && Number.isFinite(route.distanceMeters)
    && Number.isFinite(route.durationSeconds)
    && Array.isArray(route.latLngs)
    && route.latLngs.length >= 2;
}

export function getCachedWalkingRoute(originPlaceId, destinationPlaceId) {
  const key = buildWalkingRouteCacheKey(originPlaceId, destinationPlaceId);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (isRouteCacheValid(parsed)) return parsed;
    localStorage.removeItem(key);
    return null;
  } catch {
    try {
      localStorage.removeItem(key);
    } catch {
      // localStorage can be unavailable in private or restricted browser contexts.
    }
    return null;
  }
}

export function setCachedWalkingRoute(originPlaceId, destinationPlaceId, route) {
  if (!isRouteCacheValid(route)) return;
  const key = buildWalkingRouteCacheKey(originPlaceId, destinationPlaceId);
  try {
    localStorage.setItem(key, JSON.stringify(route));
  } catch {
    // Cache writes are best-effort; the planner keeps its fallback line if this fails.
  }
}

export function clearCachedWalkingRoute(originPlaceId, destinationPlaceId) {
  const key = buildWalkingRouteCacheKey(originPlaceId, destinationPlaceId);
  try {
    localStorage.removeItem(key);
  } catch {
    // No-op by design.
  }
}
