import { escapeHtml, formatPlaceScore, getPlaceCategory } from './mapFormatters.js';

export function createPlaceTooltipContent(place, context = {}) {
  const category = getPlaceCategory(place, context.categories);
  const scoreText = formatPlaceScore(place, context.formatScore);
  const bits = [
    scoreText ? `&#x2B50; ${escapeHtml(scoreText)}` : '',
    place.estimatedDuration ? escapeHtml(place.estimatedDuration) : '',
    place.zone ? escapeHtml(place.zone) : ''
  ].filter(Boolean);

  return `<div class="travel-map-tooltip">
    <strong>${category?.icon || '&#x1F4CD;'} ${escapeHtml(place.name)}</strong>
    ${bits.length ? `<span>${bits.join(' &middot; ')}</span>` : ''}
  </div>`;
}

export function bindTooltip(marker, html, options = {}) {
  if (!marker || !html || window.matchMedia('(pointer: coarse)').matches) return;
  marker.bindTooltip(html, {
    direction: options.direction || 'top',
    offset: options.offset || [0, -28],
    opacity: 0.95,
    className: 'travel-map-tooltip-shell'
  });
}
