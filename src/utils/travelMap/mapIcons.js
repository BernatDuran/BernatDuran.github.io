import { escapeHtml } from './mapFormatters.js';

function priorityClass(priority) {
  return priority ? `priority-${escapeHtml(priority)}` : 'priority-optional';
}

export function createPlaceMarkerIcon(place, options = {}) {
  const category = options.category;
  const plannerItem = options.plannerItem;
  const status = plannerItem?.status ? ` travel-marker-${plannerItem.status}` : '';
  const rainy = place?.rainyFriendly ? ' travel-marker-rainy' : '';
  const dimmed = options.isDimmed ? ' travel-marker-dimmed' : '';
  const selected = options.isSelected ? ' travel-marker-selected' : '';
  const badge = plannerItem?.assignedDay ? `<span class="travel-marker-badge">D${plannerItem.assignedDay}</span>` : '';

  return L.divIcon({
    className: 'travel-marker-leaflet',
    html: `<div class="travel-marker travel-marker-v2 ${priorityClass(place?.priority)}${status}${rainy}${dimmed}${selected}">
      <span class="travel-marker-emoji">${category?.icon || '&#x1F4CD;'}</span>
      ${badge}
    </div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 38],
    popupAnchor: [0, -38]
  });
}

export function createNumberedMarkerIcon(place, options = {}) {
  const color = options.color || '#e94560';
  const order = options.order ?? options.exportOrder ?? 1;
  const day = options.day;
  const label = options.label || (options.scope === 'all' && day ? `${day}.${order}` : `${order}`);
  const locationIcon = place?.entityType === 'location'
    ? place.plannerKind === 'accommodation' ? '&#x1F3E8;' : '&#x1F689;'
    : '';
  const locationClass = place?.entityType === 'location' ? ` travel-marker-${place.plannerKind}` : '';

  return L.divIcon({
    className: 'travel-marker-numbered-leaflet',
    html: `<div class="travel-marker travel-marker-numbered${locationClass}" style="--travel-marker-color:${escapeHtml(color)}">
      <span class="travel-marker-order">${escapeHtml(label)}</span>
      ${locationIcon ? `<span class="travel-marker-location-icon">${locationIcon}</span>` : ''}
    </div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18]
  });
}

export function createMiniMarkerIcon(place, options = {}) {
  const category = options.category;
  return L.divIcon({
    className: 'travel-marker-mini-leaflet',
    html: `<div class="travel-marker travel-marker-mini ${priorityClass(place?.priority)}">
      <span>${category?.icon || '&#x1F4CD;'}</span>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32]
  });
}
