export const TILE_PROVIDERS = {
  cartoVoyager: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    options: {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19
    }
  }
};

export function addDefaultTileLayer(map, provider = 'cartoVoyager') {
  if (!map || typeof L === 'undefined') return null;
  const tileProvider = TILE_PROVIDERS[provider] || TILE_PROVIDERS.cartoVoyager;
  return L.tileLayer(tileProvider.url, tileProvider.options).addTo(map);
}
