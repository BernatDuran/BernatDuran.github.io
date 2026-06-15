import { getLatLngFromPlace } from './mapBounds.js';
import { createMiniMarkerIcon, createNumberedMarkerIcon, createPlaceMarkerIcon } from './mapIcons.js';
import { createPlacePopupContent, createPlannerPopupContent, bindPopupActions } from './mapPopups.js';
import { createPlaceTooltipContent, bindTooltip } from './mapTooltips.js';
import { getPlaceCategory } from './mapFormatters.js';

function getPlannerItemForPlace(place, plannerItems) {
  if (plannerItems instanceof Map) return plannerItems.get(place.id);
  return Array.isArray(plannerItems) ? plannerItems.find((item) => item.placeId === place.id) : null;
}

export function clearMarkers(layerGroup) {
  layerGroup?.clearLayers?.();
}

export function renderPlaceMarkers(map, places = [], options = {}) {
  const layerGroup = options.layerGroup || L.layerGroup().addTo(map);
  clearMarkers(layerGroup);

  places.forEach((place) => {
    const latLng = getLatLngFromPlace(place);
    if (!latLng) return;

    const category = getPlaceCategory(place, options.categories);
    const plannerItem = getPlannerItemForPlace(place, options.plannerItems);
    const icon = options.markerMode === 'modal'
      ? createMiniMarkerIcon(place, { category })
      : createPlaceMarkerIcon(place, { category, plannerItem });

    const marker = L.marker([latLng.lat, latLng.lng], { icon });
    marker.placeId = place.id;
    marker.bindPopup(options.popupRenderer
      ? options.popupRenderer(place)
      : createPlacePopupContent(place, { ...options, category, plannerItem }));

    if (options.showTooltip !== false) {
      bindTooltip(marker, options.tooltipRenderer
        ? options.tooltipRenderer(place)
        : createPlaceTooltipContent(place, options));
    }

    marker.on('popupopen', (event) => {
      bindPopupActions(event.popup.getElement(), {
        onDetails: (placeId) => {
          const selected = places.find((candidate) => candidate.id === placeId) || place;
          options.onPlaceClick?.(selected);
        }
      });
    });

    marker.on('click', () => options.onMarkerClick?.(place, marker));
    marker.addTo(layerGroup);
  });

  return layerGroup;
}

export function renderPlannerMarkers(map, entries = [], options = {}) {
  const layerGroup = options.layerGroup || L.layerGroup().addTo(map);
  clearMarkers(layerGroup);

  const groups = new Map();
  entries.forEach((entry) => {
    const latLng = entry.latLng || getLatLngFromPlace(entry.place);
    if (!latLng) return;
    const key = `${Number(latLng.lat).toFixed(6)}:${Number(latLng.lng).toFixed(6)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...entry, latLng });
  });

  groups.forEach((groupEntries) => {
    const entry = groupEntries[0];
    const latLng = entry.latLng;
    const markerLabels = groupEntries.map((candidate) => {
      const order = candidate.exportOrder || (candidate.item?.order ?? 0) + 1;
      return options.scope === 'all' && candidate.day ? `${candidate.day}.${order}` : `${order}`;
    });

    const icon = createNumberedMarkerIcon(entry.place, {
      color: entry.color,
      day: entry.day,
      order: entry.exportOrder || (entry.item?.order ?? 0) + 1,
      label: markerLabels.join('/'),
      scope: options.scope
    });

    const marker = L.marker([latLng.lat, latLng.lng], {
      icon,
      riseOnHover: true
    });
    marker.placeId = entry.place.id;

    if (options.openDetailsOnMarkerClick !== true) {
      marker.bindPopup(options.popupRenderer
        ? options.popupRenderer(entry)
        : createPlannerPopupContent(entry, { ...options, color: entry.color }));
      marker.on('popupopen', (event) => {
        bindPopupActions(event.popup.getElement(), {
          onDetails: (placeId) => {
            const selected = entries.find((candidate) => candidate.place.id === placeId) || entry;
            options.onPlaceClick?.(selected.place);
          }
        });
      });
    }

    bindTooltip(marker, createPlaceTooltipContent(entry.place, options));
    marker.on('click', () => {
      if (options.openDetailsOnMarkerClick === true) {
        options.onPlaceClick?.(entry.place);
      }
    });
    marker.addTo(layerGroup);
  });

  return layerGroup;
}
