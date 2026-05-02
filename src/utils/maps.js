import { categories, priorityLabels } from '../data/cities.js';

let currentMap = null;
let currentMarkers = [];

export function initLeafletMap(containerId, center, zoom) {
  // If map already exists, remove it
  if (currentMap) {
    currentMap.remove();
  }

  // Initialize new map
  // We use Leaflet global object 'L' which is loaded via CDN
  currentMap = L.map(containerId).setView([center.lat, center.lng], zoom);

  // Add OpenStreetMap tiles
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(currentMap);

  return currentMap;
}

export function updateMapMarkers(map, places, openModalCallback) {
  // Clear existing markers
  currentMarkers.forEach(marker => marker.remove());
  currentMarkers = [];

  // Add new markers
  places.forEach(place => {
    if (!place.coordinates || !place.coordinates.lat || !place.coordinates.lng) return;

    const cat = categories.find(c => c.id === place.category);
    const prio = priorityLabels[place.priority];
    
    // Create custom icon
    const iconHtml = `<div class="custom-marker priority-${place.priority}">
      <span class="marker-emoji">${cat?.icon || '📍'}</span>
    </div>`;

    const customIcon = L.divIcon({
      className: 'custom-leaflet-icon',
      html: iconHtml,
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      popupAnchor: [0, -36]
    });

    // Create marker
    const marker = L.marker([place.coordinates.lat, place.coordinates.lng], { icon: customIcon }).addTo(map);

    // Create popup content
    const popupContent = document.createElement('div');
    popupContent.className = 'map-popup-content';
    popupContent.innerHTML = `
      <div class="popup-header">
        <span class="popup-emoji">${cat?.icon || '📍'}</span>
        <strong>${place.name}</strong>
      </div>
      <div class="popup-meta">
        <span class="popup-type">${place.type}</span>
        <span class="popup-priority ${prio.class}">${prio.label}</span>
      </div>
      <button class="popup-btn">Ver detalles</button>
    `;

    // Add click event to button inside popup
    popupContent.querySelector('.popup-btn').addEventListener('click', () => {
      openModalCallback(place);
    });

    marker.bindPopup(popupContent);
    currentMarkers.push(marker);
  });
}

export function renderPlaceMap(containerId, place) {
  if (!place.coordinates || !place.coordinates.lat || !place.coordinates.lng) return null;
  
  const map = L.map(containerId, {
    zoomControl: false,
    dragging: false,
    scrollWheelZoom: false
  }).setView([place.coordinates.lat, place.coordinates.lng], 16);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap & CARTO',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  const cat = categories.find(c => c.id === place.category);
  const iconHtml = `<div class="custom-marker priority-${place.priority}">
    <span class="marker-emoji">${cat?.icon || '📍'}</span>
  </div>`;

  const customIcon = L.divIcon({
    className: 'custom-leaflet-icon',
    html: iconHtml,
    iconSize: [40, 40],
    iconAnchor: [20, 40]
  });

  L.marker([place.coordinates.lat, place.coordinates.lng], { icon: customIcon }).addTo(map);

  return map;
}

export function getGoogleMapsUrl(place, mapLinkStyle = 'smart') {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const nameEncoded = encodeURIComponent(place.name);

  // If we don't have coordinates, fallback to searching by name and city
  if (!place.coordinates || !place.coordinates.lat || !place.coordinates.lng) {
    const query = encodeURIComponent(`${place.name}, ${place.cityId || 'Japan'}`);
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  }

  const { lat, lng } = place.coordinates;

  if (mapLinkStyle === 'coords') {
    // Classic mode: just coordinates
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }

  // Smart mode
  if (isMobile) {
    // Native protocol for mobile devices (opens Google Maps / Apple Maps app)
    return `geo:${lat},${lng}?q=${lat},${lng}(${nameEncoded})`;
  } else {
    // Pro search for desktop (opens the Google Maps rich place card)
    const query = encodeURIComponent(`${place.name}, ${place.cityId || 'Japan'}`);
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  }
}
