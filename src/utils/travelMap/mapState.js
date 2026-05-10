export function createMapLayerState() {
  return {
    markers: null,
    routes: null,
    controls: null,
    overlays: null,
    location: null,
    currentPlaces: [],
    currentEntries: []
  };
}

export function clearLayerGroup(layerGroup) {
  if (layerGroup?.clearLayers) layerGroup.clearLayers();
}

export function ensureLayerGroup(map, state, key) {
  if (!map || !state) return null;
  if (!state[key]) {
    state[key] = L.layerGroup().addTo(map);
  }
  return state[key];
}

export function clearAllTravelLayers(state) {
  if (!state) return;
  ['markers', 'routes', 'controls', 'overlays', 'location'].forEach((key) => clearLayerGroup(state[key]));
}
