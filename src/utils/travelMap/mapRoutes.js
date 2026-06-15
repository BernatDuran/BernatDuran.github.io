import { getLatLngFromPlace } from './mapBounds.js';
import { hasUsablePolyline } from '../routes/routePolyline.js';

export function clearRoutes(layerGroup) {
  layerGroup?.clearLayers?.();
}

export function createRoutePolyline(entries = [], options = {}) {
  const latLngs = entries
    .map((entry) => entry.latLng || getLatLngFromPlace(entry.place))
    .filter(Boolean)
    .map((latLng) => [latLng.lat, latLng.lng]);

  if (latLngs.length < 2) return null;

  return L.polyline(latLngs, {
    color: options.color || '#e94560',
    weight: options.weight || (window.innerWidth < 768 ? 4 : 3),
    opacity: options.opacity ?? 0.78,
    lineJoin: 'round',
    lineCap: 'round',
    dashArray: options.dashed ? '8 10' : null
  });
}

function createWalkingSegmentPolyline(segment, options = {}) {
  const route = segment.route;
  const hasRealRoute = hasUsablePolyline(route);
  const isWalking = (segment.travelMode || route?.mode || 'walking') === 'walking';
  const latLngs = hasRealRoute
    ? route.latLngs
    : [segment.originEntry, segment.destinationEntry]
      .map((entry) => entry.latLng || getLatLngFromPlace(entry.place))
      .filter(Boolean)
      .map((latLng) => [latLng.lat, latLng.lng]);

  if (latLngs.length < 2) return null;

  return L.polyline(latLngs, {
    color: options.color || '#e94560',
    weight: hasRealRoute ? 4 : isWalking ? 3 : 4,
    opacity: hasRealRoute ? 0.88 : isWalking ? 0.38 : 0.72,
    lineJoin: 'round',
    lineCap: 'round',
    dashArray: hasRealRoute ? null : isWalking ? '7 9' : '3 7'
  });
}

export function renderPlannerRoutes(map, routes = [], options = {}) {
  const layerGroup = options.layerGroup || L.layerGroup().addTo(map);
  clearRoutes(layerGroup);

  routes.forEach((route) => {
    if (Array.isArray(route.walkingSegments) && route.walkingSegments.length) {
      route.walkingSegments.forEach((segment) => {
        const polyline = createWalkingSegmentPolyline(segment, { color: route.color });
        if (polyline) polyline.addTo(layerGroup);
      });
      return;
    }

    const entries = route.entries
      .map((entry) => ({
        ...entry,
        latLng: entry.latLng || getLatLngFromPlace(entry.place)
      }))
      .filter((entry) => entry.latLng);

    const polyline = createRoutePolyline(entries, {
      color: route.color,
      opacity: options.scope === 'all' ? 0.68 : 0.86,
      dashed: route.entries.length !== route.allEntries?.length
    });
    if (polyline) polyline.addTo(layerGroup);
  });

  return layerGroup;
}
