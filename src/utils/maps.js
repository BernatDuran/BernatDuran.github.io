import { categories, priorityLabels } from '../data/cities.js';
import { getPlaceLatLng } from './placeData.js';
import {
  addTravelMapControls,
  clearAllTravelLayers,
  createMapLayerState,
  createTravelMap,
  destroyTravelMap,
  ensureLayerGroup,
  fitMapToEntries,
  fitMapToPlaces,
  invalidateTravelMapSize,
  renderPlaceMarkers,
  renderPlannerMarkers,
  renderPlannerRoutes
} from './travelMap/index.js';

const mapStates = new WeakMap();

function getState(map) {
  if (!map) return null;
  if (!mapStates.has(map)) {
    mapStates.set(map, createMapLayerState());
  }
  return mapStates.get(map);
}

function locateUser(map, state) {
  if (!navigator.geolocation || !map) {
    console.warn('Geolocation no esta disponible en este navegador.');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      const layer = ensureLayerGroup(map, state, 'location');
      layer.clearLayers();
      const latLng = [coords.latitude, coords.longitude];
      L.circleMarker(latLng, {
        radius: 8,
        color: '#2563eb',
        weight: 3,
        fillColor: '#60a5fa',
        fillOpacity: 0.85
      }).addTo(layer);
      map.setView(latLng, Math.max(map.getZoom(), 14));
    },
    (error) => console.warn('No se pudo obtener la ubicacion actual.', error),
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

export function initLeafletMap(containerId, center, zoom, options = {}) {
  const map = createTravelMap(containerId, {
    center,
    zoom,
    scrollWheelZoom: options.scrollWheelZoom ?? true,
    dragging: options.dragging ?? true,
    zoomControl: options.zoomControl ?? false,
    attributionControl: options.attributionControl ?? true,
    className: options.className
  });

  if (!map) return null;
  const state = getState(map);

  if (options.controls !== false) {
    addTravelMapControls(map, {
      showLocate: options.showLocate ?? true,
      showFullscreen: options.showFullscreen ?? true,
      showFitBounds: options.showFitBounds ?? true,
      showZoom: options.showZoom ?? true,
      onLocate: () => locateUser(map, state),
      onFitBounds: () => {
        if (state.currentEntries?.length) {
          fitMapToEntries(map, state.currentEntries);
        } else {
          fitMapToPlaces(map, state.currentPlaces || []);
        }
      }
    });
  }

  return map;
}

export function updateMapMarkers(map, places, openModalCallback, options = {}) {
  if (!map) return;
  const state = getState(map);
  const markersLayer = ensureLayerGroup(map, state, 'markers');
  state.currentPlaces = places || [];

  renderPlaceMarkers(map, places || [], {
    layerGroup: markersLayer,
    categories: options.categories || categories,
    priorityLabels: options.priorityLabels || priorityLabels,
    plannerItems: options.plannerItems,
    mapLinkStyle: options.mapLinkStyle,
    formatScore: options.formatScore,
    showTooltip: options.showTooltip,
    markerMode: options.markerMode,
    getGoogleMapsUrl,
    onPlaceClick: openModalCallback
  });

  if (options.fitBounds) {
    fitMapToPlaces(map, places || [], options.fitBoundsOptions);
  }

  invalidateTravelMapSize(map);
}

export function renderPlannerTravelMap(map, model, options = {}) {
  if (!map || !model) return;
  const state = getState(map);
  const markersLayer = ensureLayerGroup(map, state, 'markers');
  const routesLayer = ensureLayerGroup(map, state, 'routes');

  const routes = model.routes.map((route) => ({
    ...route,
    allEntries: (route.allEntries || []).map((entry) => ({
      ...entry,
      color: route.color,
      latLng: getPlaceLatLng(entry.place)
    })),
    entries: (route.entries || []).map((entry) => ({
      ...entry,
      color: route.color,
      latLng: getPlaceLatLng(entry.place)
    }))
  }));

  const entries = routes.flatMap((route) => route.entries);

  state.currentEntries = entries;
  state.currentPlaces = entries.map((entry) => entry.place);

  renderPlannerRoutes(map, routes, {
    layerGroup: routesLayer,
    scope: model.scope
  });

  renderPlannerMarkers(map, entries, {
    layerGroup: markersLayer,
    scope: model.scope,
    categories: options.categories || categories,
    priorityLabels: options.priorityLabels || priorityLabels,
    citiesArray: options.citiesArray || [],
    formatScore: options.formatScore,
    mapLinkStyle: options.mapLinkStyle,
    getGoogleMapsUrl,
    openDetailsOnMarkerClick: true,
    onPlaceClick: options.onPlaceClick
  });

  fitMapToEntries(map, entries, { singleZoom: 14 });
  invalidateTravelMapSize(map);
}

export function clearTravelMap(map) {
  const state = getState(map);
  clearAllTravelLayers(state);
}

export function destroyMap(map) {
  if (!map) return;
  const state = getState(map);
  clearAllTravelLayers(state);
  destroyTravelMap(map);
}

export function renderPlaceMap(containerId, place, options = {}) {
  const latLng = getPlaceLatLng(place);
  if (!latLng) return null;

  const map = initLeafletMap(containerId, latLng, options.zoom || 16, {
    controls: options.controls ?? false,
    scrollWheelZoom: false,
    dragging: options.dragging ?? false,
    zoomControl: false,
    attributionControl: options.attributionControl ?? true,
    showLocate: false,
    showFitBounds: false,
    showFullscreen: false,
    className: 'travel-map-modal'
  });

  if (!map) return null;
  updateMapMarkers(map, [place], null, {
    categories,
    priorityLabels,
    showTooltip: false,
    fitBounds: false,
    markerMode: 'modal'
  });
  setTimeout(() => invalidateTravelMapSize(map), 80);
  return map;
}

export function getGoogleMapsUrl(place, mapLinkStyle = 'smart') {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const nameEncoded = encodeURIComponent(place.name);
  const latLng = getPlaceLatLng(place);

  if (!latLng) {
    const query = encodeURIComponent(`${place.name}, ${place.cityId || 'Japan'}`);
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  }

  const { lat, lng } = latLng;

  if (mapLinkStyle === 'coords') {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }

  if (isMobile) {
    return `geo:${lat},${lng}?q=${lat},${lng}(${nameEncoded})`;
  }

  const query = encodeURIComponent(`${place.name}, ${place.cityId || 'Japan'}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export function getGoogleMapsRouteUrl(entries = [], options = {}) {
  const valid = entries
    .map((entry) => entry.latLng || getPlaceLatLng(entry.place))
    .filter(Boolean);

  if (valid.length < 2) return '';

  const maxWaypoints = options.maxWaypoints ?? 8;
  const origin = valid[0];
  const destination = valid[valid.length - 1];
  const waypoints = valid.slice(1, -1).slice(0, maxWaypoints);
  const travelMode = options.travelMode || 'walking';
  const params = new URLSearchParams({
    api: '1',
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    travelmode: travelMode
  });

  if (waypoints.length) {
    params.set('waypoints', waypoints.map((point) => `${point.lat},${point.lng}`).join('|'));
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
