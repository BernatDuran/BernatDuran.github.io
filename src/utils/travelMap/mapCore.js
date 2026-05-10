import { addDefaultTileLayer } from './mapTiles.js';

const JAPAN_CENTER = { lat: 36.2048, lng: 138.2529 };

function normalizeCenter(center) {
  const lat = Number.parseFloat(center?.lat);
  const lng = Number.parseFloat(center?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : JAPAN_CENTER;
}

export function isLeafletAvailable() {
  return typeof window !== 'undefined' && typeof window.L !== 'undefined';
}

export function createTravelMap(containerId, options = {}) {
  if (!isLeafletAvailable()) {
    throw new Error('Leaflet no esta disponible. Asegurate de cargar Leaflet antes de inicializar el mapa.');
  }

  const container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
  if (!container) {
    console.warn(`No se encontro el contenedor de mapa: ${containerId}`);
    return null;
  }

  if (container._leaflet_id) {
    container._leaflet_id = null;
  }

  const center = normalizeCenter(options.center);
  const map = L.map(container, {
    scrollWheelZoom: options.scrollWheelZoom ?? true,
    dragging: options.dragging ?? true,
    zoomControl: options.zoomControl ?? false,
    attributionControl: options.attributionControl ?? true,
    tap: true
  }).setView([center.lat, center.lng], options.zoom || 6);

  if (options.className) container.classList.add(options.className);
  addDefaultTileLayer(map, options.tileProvider);
  return map;
}

export function destroyTravelMap(map) {
  if (!map) return;
  map.off();
  map.remove();
}

export function invalidateTravelMapSize(map) {
  if (!map) return;
  requestAnimationFrame(() => map.invalidateSize({ pan: false }));
}
