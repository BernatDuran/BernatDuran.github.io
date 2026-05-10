import {
  escapeHtml,
  formatPlaceScore,
  getCityDisplayName,
  getPlaceCategory,
  getPlacePriority,
  getPlannerStatusConfig
} from './mapFormatters.js';

function badge(label, className = '') {
  return label ? `<span class="travel-map-popup-badge ${escapeHtml(className)}">${escapeHtml(label)}</span>` : '';
}

function badgeHtml(html, className = '') {
  return html ? `<span class="travel-map-popup-badge ${escapeHtml(className)}">${html}</span>` : '';
}

export function createPlacePopupContent(place, context = {}) {
  const category = context.category || getPlaceCategory(place, context.categories);
  const priority = context.priority || getPlacePriority(place, context.priorityLabels);
  const scoreText = context.scoreText ?? formatPlaceScore(place, context.formatScore);
  const plannerItem = context.plannerItem;
  const statusConfig = getPlannerStatusConfig(plannerItem);
  const mapsUrl = context.mapsUrl || context.getGoogleMapsUrl?.(place, context.mapLinkStyle);

  return `
    <div class="travel-map-popup" data-place-id="${escapeHtml(place.id)}">
      <div class="travel-map-popup-header">
        <span class="travel-map-popup-icon">${category?.icon || '&#x1F4CD;'}</span>
        <div>
          <div class="travel-map-popup-title">${escapeHtml(place.name)}</div>
          <div class="travel-map-popup-meta">${escapeHtml(place.type || '')}${place.zone ? ` &middot; ${escapeHtml(place.zone)}` : ''}</div>
        </div>
      </div>
      <div class="travel-map-popup-badges">
        ${badge(priority?.label, priority?.class || '')}
        ${scoreText ? badgeHtml(`&#x2B50; ${escapeHtml(scoreText)}`) : ''}
        ${place.estimatedDuration ? badgeHtml(`&#x23F1; ${escapeHtml(place.estimatedDuration)}`) : ''}
        ${place.rainyFriendly ? badgeHtml('&#x2602; Lluvia') : ''}
        ${statusConfig ? badge(statusConfig.label, statusConfig.className) : ''}
      </div>
      <div class="travel-map-popup-actions">
        <button type="button" class="travel-map-popup-btn travel-map-popup-btn-primary" data-map-action="details" data-place-id="${escapeHtml(place.id)}">Ver detalles</button>
        ${mapsUrl ? `<a class="travel-map-popup-btn travel-map-popup-btn-secondary" href="${escapeHtml(mapsUrl)}" target="_blank" rel="noopener">Google Maps</a>` : ''}
      </div>
    </div>
  `;
}

export function createPlannerPopupContent(entry, context = {}) {
  const place = entry.place;
  const category = getPlaceCategory(place, context.categories);
  const priority = getPlacePriority(place, context.priorityLabels);
  const scoreText = formatPlaceScore(place, context.formatScore);
  const cityName = getCityDisplayName(place.cityId, context.citiesArray);
  const mapsUrl = context.getGoogleMapsUrl?.(place, context.mapLinkStyle);
  const order = entry.exportOrder || (entry.item?.order ?? 0) + 1;

  return `
    <div class="travel-map-popup travel-map-popup-planner" data-place-id="${escapeHtml(place.id)}">
      <div class="travel-map-popup-header">
        <span class="travel-map-popup-order" style="--travel-marker-color:${escapeHtml(context.color || '#e94560')}">${escapeHtml(order)}</span>
        <div>
          <div class="travel-map-popup-title">${escapeHtml(place.name)}</div>
          <div class="travel-map-popup-meta">Dia ${escapeHtml(entry.day)} &middot; ${escapeHtml(cityName)}${place.zone ? ` &middot; ${escapeHtml(place.zone)}` : ''}</div>
        </div>
      </div>
      <div class="travel-map-popup-badges">
        ${badge(category?.label)}
        ${badge(priority?.label, priority?.class || '')}
        ${scoreText ? badgeHtml(`&#x2B50; ${escapeHtml(scoreText)}`) : ''}
        ${place.estimatedDuration ? badgeHtml(`&#x23F1; ${escapeHtml(place.estimatedDuration)}`) : ''}
      </div>
      <div class="travel-map-popup-actions">
        <button type="button" class="travel-map-popup-btn travel-map-popup-btn-primary" data-map-action="details" data-place-id="${escapeHtml(place.id)}">Ver detalles</button>
        ${mapsUrl ? `<a class="travel-map-popup-btn travel-map-popup-btn-secondary" href="${escapeHtml(mapsUrl)}" target="_blank" rel="noopener">Google Maps</a>` : ''}
      </div>
    </div>
  `;
}

export function bindPopupActions(container, callbacks = {}) {
  if (!container || container.dataset.travelPopupBound === 'true') return;
  container.dataset.travelPopupBound = 'true';
  container.addEventListener('click', (event) => {
    const detailsButton = event.target.closest('[data-map-action="details"]');
    if (!detailsButton) return;
    const placeId = detailsButton.dataset.placeId;
    callbacks.onDetails?.(placeId);
  });
}
