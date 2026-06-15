import './styles/main.css';
import './styles/components.css';
import './styles/pages.css';
import './styles/maps.css';
import { getAll, putAll, putManyByStore, remove } from './utils/db.js';
import { categories, priorityLabels } from './data/cities.js';
import { icons, formatScore, debounce, parseEstimatedDurationToMinutes, formatDurationMinutes } from './utils/helpers.js';
import { initLeafletMap, renderPlaceMap, getGoogleMapsRouteUrls, getGoogleMapsUrl, renderPlannerTravelMap } from './utils/maps.js';
import { setupPwa } from './utils/pwa.js';
import Sortable from 'sortablejs';
import { bindMobileNav, renderMobileMenu } from './utils/nav.js';
import { sortCities } from './utils/cityData.js';
import { formatBestTimeLabel, getPlaceLatLng, normalizePlaceRecord } from './utils/placeData.js';
import { runDataMigration } from './utils/dataMigration.js';
import { renderPlaceDetailModal } from './utils/placeDetailModal.js';
import { buildWalkingRouteCacheKey, getCachedWalkingRoute } from './utils/routes/routeCache.js';
import { formatRouteDistance, formatRouteDuration } from './utils/routes/routeFormatters.js';
import { hasUsablePolyline } from './utils/routes/routePolyline.js';
import { getWalkingRoutesForEntries } from './utils/routes/routeService.js';
import {
  LOCATION_KINDS,
  TRAVEL_MODES,
  createPlannerStopId,
  getLocationKindConfig,
  getLocationSubtypeLabel,
  getTravelModeConfig,
  normalizeDayPlanRecord,
  normalizeLocationRecord,
  normalizePlannerStopRecord,
  normalizeTravelMode
} from './utils/locationData.js';
import {
  canConfigureEntryTravelMode,
  composeDayItinerary,
  getEntryTravelMode,
  splitItineraryEntries
} from './utils/itineraryData.js';

setupPwa();

const app = document.getElementById('app');
const DEFAULT_MAP_CENTER = { lat: 36.2048, lng: 138.2529 };
const DAY_ROUTE_COLORS = ['#e94560', '#0ea5e9', '#22c55e', '#f97316', '#8b5cf6', '#14b8a6', '#f59e0b'];
const EXPORT_SATURATION_ACTIVITY_LIMIT = 7;
const EXPORT_SATURATION_MINUTES_LIMIT = 480;
const EXPORT_MAP_CAPTURE_SCALE = 2;
const EXPORT_MAP_TILE_TIMEOUT_MS = 4500;
const ROUTE_VALIDATION_STORAGE_KEY = 'planner:validated-route-days:v1';
const PLANNER_COLLAPSED_DAYS_STORAGE_KEY = 'planner:collapsed-days:v1';

let _places = [];
let _plannerItems = [];
let _globalSettings = {};
let _totalTripDays = 7;
let _citiesArray = [];
let _locations = [];
let _dayPlans = [];
let _plannerStops = [];
let _viewMode = getPlannerViewModeFromUrl() || 'calendar';
let _selectedMapScope = 'all';
let _plannerFilterState = { search: '', cityId: '', priority: '', scoreBands: [] };

let _dropdownPortal = null;
let _dropdownPlaceId = null;
let _sortableInstances = [];
let _plannerMap = null;
let _toastPortal = null;
let _toastHideTimer = null;
let _toastRemoveTimer = null;
let _plannerScoreDropdownOpen = false;
let _walkingRoutesLoading = false;
let _walkingRouteMessage = '';
let _walkingRouteMessageTone = 'idle';
let _walkingRouteResults = new Map();
let _walkingRouteStaleDays = new Set();
let _validatedRouteDays = loadValidatedRouteDays();
let _collapsedPlannerDays = loadCollapsedPlannerDays();
let _plannerDayMapModalDay = null;
let _plannerDayMap = null;
const _pdfEmojiCache = new Map();

function captureInputFocusState() {
  const activeElement = document.activeElement;
  if (!(activeElement instanceof HTMLInputElement) && !(activeElement instanceof HTMLTextAreaElement)) {
    return null;
  }

  if (!activeElement.id) return null;

  return {
    id: activeElement.id,
    selectionStart: activeElement.selectionStart,
    selectionEnd: activeElement.selectionEnd
  };
}

function restoreInputFocusState(focusState) {
  if (!focusState?.id) return;

  requestAnimationFrame(() => {
    const input = document.getElementById(focusState.id);
    if (!(input instanceof HTMLInputElement) && !(input instanceof HTMLTextAreaElement)) return;

    input.focus({ preventScroll: true });
    if (typeof focusState.selectionStart === 'number' && typeof focusState.selectionEnd === 'number') {
      input.setSelectionRange(focusState.selectionStart, focusState.selectionEnd);
    }
  });
}

function restoreTransientUiState() {
  requestAnimationFrame(() => {
    if (!_plannerScoreDropdownOpen) return;
    document.querySelector('.score-filter-group')?.setAttribute('open', '');
  });
}

function loadValidatedRouteDays() {
  try {
    const raw = localStorage.getItem(ROUTE_VALIDATION_STORAGE_KEY);
    const parsed = JSON.parse(raw || '[]');
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map((day) => Number.parseInt(day, 10)).filter(Number.isFinite));
  } catch {
    return new Set();
  }
}

function saveValidatedRouteDays() {
  try {
    localStorage.setItem(ROUTE_VALIDATION_STORAGE_KEY, JSON.stringify(Array.from(_validatedRouteDays)));
  } catch {
    // Local storage can be unavailable in private browsing contexts.
  }
}

function isRouteDayValidated(day) {
  return _validatedRouteDays.has(Number.parseInt(day, 10));
}

function setRouteDayValidated(day, isValidated) {
  const normalizedDay = Number.parseInt(day, 10);
  if (!Number.isFinite(normalizedDay)) return;
  if (isValidated) {
    _validatedRouteDays.add(normalizedDay);
  } else {
    _validatedRouteDays.delete(normalizedDay);
  }
  saveValidatedRouteDays();
}

function loadCollapsedPlannerDays() {
  try {
    const raw = localStorage.getItem(PLANNER_COLLAPSED_DAYS_STORAGE_KEY);
    const parsed = JSON.parse(raw || '[]');
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map((day) => Number.parseInt(day, 10)).filter(Number.isFinite));
  } catch {
    return new Set();
  }
}

function saveCollapsedPlannerDays() {
  try {
    localStorage.setItem(PLANNER_COLLAPSED_DAYS_STORAGE_KEY, JSON.stringify(Array.from(_collapsedPlannerDays)));
  } catch {
    // Local storage can be unavailable in private browsing contexts.
  }
}

function isPlannerDayCollapsed(day) {
  return _collapsedPlannerDays.has(Number.parseInt(day, 10));
}

function setPlannerDayCollapsed(day, isCollapsed) {
  const normalizedDay = Number.parseInt(day, 10);
  if (!Number.isFinite(normalizedDay)) return;
  if (isCollapsed) {
    _collapsedPlannerDays.add(normalizedDay);
  } else {
    _collapsedPlannerDays.delete(normalizedDay);
  }
  saveCollapsedPlannerDays();
}

function setAllPlannerDaysCollapsed(isCollapsed) {
  _collapsedPlannerDays = new Set();
  if (isCollapsed) {
    for (let day = 1; day <= _totalTripDays; day += 1) {
      _collapsedPlannerDays.add(day);
    }
  }
  saveCollapsedPlannerDays();
}

function destroyPlannerMap() {
  if (_plannerMap) {
    _plannerMap.off();
    _plannerMap.remove();
    _plannerMap = null;
  }
}

function getDropdownPortal() {
  if (!_dropdownPortal) {
    _dropdownPortal = document.createElement('div');
    _dropdownPortal.id = 'planner-dropdown-portal';
    _dropdownPortal.style.cssText = `
      position: fixed; z-index: 99999;
      background: var(--bg-primary); border: 1px solid var(--border);
      border-radius: var(--radius-md); box-shadow: var(--shadow-lg);
      min-width: 165px; opacity: 0; visibility: hidden;
      transform: translateY(-8px); transition: opacity 0.15s ease, transform 0.15s ease;
    `;
    document.body.appendChild(_dropdownPortal);
  }
  return _dropdownPortal;
}

function getToastPortal() {
  if (!_toastPortal) {
    _toastPortal = document.createElement('div');
    _toastPortal.className = 'planner-toast-stack';
    document.body.appendChild(_toastPortal);
  }
  return _toastPortal;
}

function hideToast() {
  if (!_toastPortal) return;
  _toastPortal.classList.remove('is-visible');
  if (_toastRemoveTimer) window.clearTimeout(_toastRemoveTimer);
  _toastRemoveTimer = window.setTimeout(() => {
    if (_toastPortal) _toastPortal.innerHTML = '';
  }, 220);
}

function showToast(message, tone = 'success') {
  const portal = getToastPortal();
  if (_toastHideTimer) window.clearTimeout(_toastHideTimer);
  if (_toastRemoveTimer) window.clearTimeout(_toastRemoveTimer);

  portal.innerHTML = `
    <div class="planner-toast planner-toast-${tone}" role="status" aria-live="polite">
      <span class="planner-toast-icon" aria-hidden="true">${tone === 'success' ? '&#x2705;' : '&#x2139;&#xFE0F;'}</span>
      <span class="planner-toast-message">${escapeHtml(message)}</span>
    </div>
  `;

  requestAnimationFrame(() => {
    portal.classList.add('is-visible');
  });

  _toastHideTimer = window.setTimeout(() => {
    hideToast();
  }, 2600);
}

function openDropdown(anchorEl, placeId) {
  const portal = getDropdownPortal();
  _dropdownPlaceId = placeId;
  const plannerItem = _plannerItems.find((p) => p.placeId === placeId) || {};

  let dayOptions = '';
  for (let i = 1; i <= _totalTripDays; i += 1) {
    dayOptions += `<option value="${i}" ${plannerItem.assignedDay === i ? 'selected' : ''}>D&iacute;a ${i}</option>`;
  }

  portal.innerHTML = `
    <button class="planner-dropdown-btn" data-action="in-tray" data-id="${placeId}">&#x1F4E5; En bandeja</button>
    <div style="display:flex; align-items:center; gap:6px; padding:6px 12px;">
      <span>&#x1F5D3;&#xFE0F;</span>
      <select class="planner-day-select" data-id="${placeId}" style="flex:1; padding:4px 6px; border-radius:4px; border:1px solid var(--border); font-size:0.85rem; background:var(--bg-secondary); cursor:pointer;">
        <option value="">Asignar d&iacute;a...</option>
        ${dayOptions}
      </select>
    </div>
    <button class="planner-dropdown-btn" data-action="done" data-id="${placeId}">&#x2705; Realizada</button>
    <button class="planner-dropdown-btn" data-action="discarded" data-id="${placeId}">&#x274C; Descartar</button>
  `;

  const rect = anchorEl.getBoundingClientRect();
  const portalWidth = 170;
  let left = rect.left;
  if (left + portalWidth > window.innerWidth - 8) {
    left = window.innerWidth - portalWidth - 8;
  }

  portal.style.top = `${rect.bottom + 6}px`;
  portal.style.left = `${left}px`;
  portal.style.opacity = '1';
  portal.style.visibility = 'visible';
  portal.style.transform = 'translateY(0)';
}

function closeDropdown() {
  if (!_dropdownPortal) return;
  _dropdownPortal.style.opacity = '0';
  _dropdownPortal.style.visibility = 'hidden';
  _dropdownPortal.style.transform = 'translateY(-8px)';
  _dropdownPlaceId = null;
}

function normalizeMapScope(scope) {
  if (scope === 'all') return 'all';
  const parsed = Number.parseInt(scope, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > _totalTripDays) return 'all';
  return parsed;
}

function getDayColor(day) {
  return DAY_ROUTE_COLORS[(day - 1) % DAY_ROUTE_COLORS.length];
}

function hasValidCoordinates(place) {
  return Boolean(getPlaceLatLng(place));
}

function escapeHtml(value) {
  const str = String(value ?? '');
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function calcTripDays(settings) {
  if (!settings?.startDate || !settings?.endDate) return 7;
  const start = new Date(settings.startDate);
  const end = new Date(settings.endDate);
  const days = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
  return days >= 1 && !Number.isNaN(days) ? days : 7;
}

function getStatusConfig(item) {
  if (!item || !item.status || item.status === 'none') {
    return { label: 'Sin asignar', icon: '&#x2795;', bg: '#f3f4f6', color: '#6b7280', border: '#e5e7eb' };
  }

  const map = {
    'in-tray': { label: 'En bandeja', icon: '&#x1F4E5;', bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
    planned: { label: `D&iacute;a ${item.assignedDay ?? '?'}`, icon: '&#x1F5D3;&#xFE0F;', bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
    done: { label: 'Realizada', icon: '&#x2705;', bg: '#f0fdf4', color: '#15803d', border: '#86efac' },
    discarded: { label: 'Descartada', icon: '&#x274C;', bg: '#fef2f2', color: '#dc2626', border: '#fecaca' }
  };

  return map[item.status] || map['in-tray'];
}

function formatDayLabel(dayNum) {
  if (!_globalSettings?.startDate) return `D&iacute;a ${dayNum}`;
  const date = new Date(_globalSettings.startDate);
  date.setDate(date.getDate() + dayNum - 1);
  const weekday = date.toLocaleDateString('es-ES', { weekday: 'short' });
  const dayMonth = date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  return `D&iacute;a ${dayNum} &middot; ${weekday} ${dayMonth}`;
}

function getPlaceName(placeId) {
  const place = _places.find((candidate) => candidate.id === placeId);
  if (place) return place.name;
  const stop = _plannerStops.find((candidate) => candidate.id === placeId);
  return getLocation(stop?.locationId)?.name || 'Elemento';
}

function getDropToastMessage(evt) {
  const placeId = evt.item?.dataset?.id;
  const placeName = getPlaceName(placeId);
  const fromDay = Number.parseInt(evt.from?.closest('.planner-day-block')?.dataset.day || '', 10);
  const toDay = Number.parseInt(evt.to?.closest('.planner-day-block')?.dataset.day || '', 10);
  const fromZone = getZoneFromElement(evt.from);
  const toZone = getZoneFromElement(evt.to);
  const movedBetweenContainers = evt.from !== evt.to;

  if (toZone === 'day' && Number.isFinite(toDay)) {
    if (fromZone === 'tray' || (Number.isFinite(fromDay) && fromDay !== toDay)) {
      return `${placeName} movida al Dia ${toDay}. Ruta actualizada.`;
    }
    return `Orden del Dia ${toDay} actualizado.`;
  }

  if (toZone === 'tray') {
    if (fromZone === 'day' && Number.isFinite(fromDay) && movedBetweenContainers) {
      return `${placeName} enviada a bandeja. Ruta actualizada.`;
    }
    if (fromZone === 'tray') {
      return 'Bandeja actualizada.';
    }
  }

  return 'Plan actualizado.';
}

function isNoopPlannerDrop(evt) {
  if (!evt || evt.from !== evt.to) return false;
  const oldIndex = Number.isFinite(evt.oldDraggableIndex) ? evt.oldDraggableIndex : evt.oldIndex;
  const newIndex = Number.isFinite(evt.newDraggableIndex) ? evt.newDraggableIndex : evt.newIndex;
  return Number.isFinite(oldIndex) && Number.isFinite(newIndex) && oldIndex === newIndex;
}

function getNoopDropToastMessage(evt) {
  const placeName = getPlaceName(evt.item?.dataset?.id);
  const day = Number.parseInt(evt.to?.closest('.planner-day-block')?.dataset.day || '', 10);
  if (Number.isFinite(day)) return `${placeName} se mantiene en la misma posición del Dia ${day}.`;
  if (getZoneFromElement(evt.to) === 'tray') return `${placeName} se mantiene en la misma posición de la bandeja.`;
  return 'Sin cambios en el plan.';
}

function getStateToastMessage(placeId, newStatus, assignedDay) {
  const placeName = getPlaceName(placeId);

  if (newStatus === 'planned' && assignedDay) {
    return `${placeName} asignada al Dia ${assignedDay}. Ruta actualizada.`;
  }
  if (newStatus === 'in-tray') {
    return `${placeName} enviada a bandeja.`;
  }
  if (newStatus === 'done') {
    return `${placeName} marcada como realizada.`;
  }
  if (newStatus === 'discarded') {
    return `${placeName} descartada del plan.`;
  }

  return 'Estado actualizado.';
}

function getCityName(cityId) {
  const city = _citiesArray.find((c) => c.id === cityId);
  return city?.name || cityId || '';
}

function getRecommendedMapScope(groups) {
  for (let day = 1; day <= _totalTripDays; day += 1) {
    if (groups[day]?.length) return day;
  }
  return 'all';
}

function getFilteredPlannerPlaces() {
  const searchQuery = _plannerFilterState.search.trim().toLowerCase();

  return _places.filter((place) => {
    if (_plannerFilterState.cityId && place.cityId !== _plannerFilterState.cityId) return false;
    if (_plannerFilterState.priority && place.priority !== _plannerFilterState.priority) return false;
    if (_plannerFilterState.scoreBands.length > 0) {
      const numericScore = place.score == null ? null : Number(place.score);
      const matchesScoreBand = _plannerFilterState.scoreBands.some((band) => {
        if (!Number.isFinite(numericScore)) return false;
        if (band === '0-4') return numericScore >= 0 && numericScore <= 4;
        if (band === '5-6') return numericScore >= 5 && numericScore <= 6;
        if (band === '7-8') return numericScore >= 7 && numericScore <= 8;
        if (band === '9') return numericScore === 9;
        if (band === '10') return numericScore === 10;
        return false;
      });
      if (!matchesScoreBand) return false;
    }

    if (searchQuery) {
      const category = categories.find((entry) => entry.id === place.category);
      const cityName = getCityName(place.cityId);
      const haystack = [
        place.name,
        place.description,
        place.zone,
        place.type,
        category?.label,
        cityName,
        place.comment
      ].filter(Boolean).join(' ').toLowerCase();

      if (!haystack.includes(searchQuery)) return false;
    }

    return true;
  });
}

function hasActivePlannerFilters() {
  return Boolean(_plannerFilterState.search || _plannerFilterState.cityId || _plannerFilterState.priority || _plannerFilterState.scoreBands.length);
}

function buildGroupedData(filteredPlaces = _places) {
  const groups = { tray: [], unassigned: [] };
  for (let day = 1; day <= _totalTripDays; day += 1) {
    groups[day] = [];
  }

  filteredPlaces.forEach((place) => {
    const item = _plannerItems.find((p) => p.placeId === place.id) || {};

    if (item.status === 'in-tray') {
      groups.tray.push({ place, item });
    } else if (item.status === 'planned' && item.assignedDay >= 1 && item.assignedDay <= _totalTripDays) {
      groups[item.assignedDay].push({ place, item });
    } else if (item.status !== 'done' && item.status !== 'discarded') {
      groups.unassigned.push({ place, item });
    }
  });

  const sortByOrder = (a, b) => (a.item?.order ?? 999) - (b.item?.order ?? 999);
  groups.tray.sort(sortByOrder);
  groups.unassigned.sort(sortByOrder);
  for (let day = 1; day <= _totalTripDays; day += 1) {
    groups[day].sort(sortByOrder);
  }

  return groups;
}

function getComposedDayEntries(day, groups) {
  return composeDayItinerary({
    day,
    activityEntries: groups[day] || [],
    locations: _locations,
    dayPlans: _dayPlans,
    plannerStops: _plannerStops
  });
}

function getLocation(locationId) {
  return _locations.find((location) => location.id === locationId) || null;
}

function getDayPlan(day) {
  return _dayPlans.find((plan) => Number(plan.day) === Number(day))
    || normalizeDayPlanRecord({ day });
}

function getPlannerStop(stopId) {
  return _plannerStops.find((stop) => stop.id === stopId) || null;
}

function getPlannerItem(placeId) {
  return _plannerItems.find((item) => item.placeId === placeId) || null;
}

function getLocationPickerTypeLabel(location = {}) {
  return getLocationSubtypeLabel(location.kind, location.subtype)
    || getLocationKindConfig(location.kind).label;
}

function getLocationPickerMeta(location = {}) {
  return [
    getCityName(location.cityId),
    getLocationPickerTypeLabel(location)
  ].filter(Boolean).join(' - ');
}

function renderPlannerLocationPicker({
  id,
  selectedId = '',
  kind = null,
  placeholder = 'Selecciona una ubicacion',
  selectedMeta = 'none'
} = {}) {
  const locations = _locations
    .filter((location) => location.active !== false)
    .filter((location) => !kind || location.kind === kind)
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));
  const selectedLocation = locations.find((location) => location.id === selectedId) || null;
  const selectedLabel = selectedLocation?.name || placeholder;
  const selectedMetaText = selectedMeta === 'city' && selectedLocation
    ? getCityName(selectedLocation.cityId)
    : '';

  const optionHtml = locations.map((location) => {
    const cityName = getCityName(location.cityId);
    return `
      <button type="button"
              class="planner-location-picker-option ${location.id === selectedId ? 'is-selected' : ''}"
              role="option"
              aria-selected="${location.id === selectedId ? 'true' : 'false'}"
              data-location-picker-option
              data-location-id="${escapeHtml(location.id)}"
              data-location-label="${escapeHtml(location.name)}"
              data-location-selected-meta="${escapeHtml(selectedMeta === 'city' ? cityName : '')}">
        <span class="planner-location-picker-option-name">${escapeHtml(location.name)}</span>
        <span class="planner-location-picker-option-meta">${escapeHtml(getLocationPickerMeta(location))}</span>
      </button>
    `;
  }).join('');

  return `
    <div class="planner-location-picker" data-location-picker>
      <input type="hidden" id="${escapeHtml(id)}" value="${escapeHtml(selectedLocation?.id || '')}">
      <button type="button"
              class="planner-location-picker-trigger"
              data-location-picker-toggle
              aria-haspopup="listbox"
              aria-expanded="false">
        <span class="planner-location-picker-selected" data-location-picker-selected>${escapeHtml(selectedLabel)}</span>
        <span class="planner-location-picker-selected-meta" data-location-picker-selected-meta>${escapeHtml(selectedMetaText)}</span>
        <span class="planner-location-picker-caret" aria-hidden="true">v</span>
      </button>
      <div class="planner-location-picker-menu" role="listbox">
        <button type="button"
                class="planner-location-picker-option ${selectedLocation ? '' : 'is-selected'}"
                role="option"
                aria-selected="${selectedLocation ? 'false' : 'true'}"
                data-location-picker-option
                data-location-id=""
                data-location-label="${escapeHtml(placeholder)}"
                data-location-selected-meta="">
          <span class="planner-location-picker-option-name">${escapeHtml(placeholder)}</span>
          <span class="planner-location-picker-option-meta">Sin asignar</span>
        </button>
        ${optionHtml}
      </div>
    </div>
  `;
}

function renderTravelModeSelect(entryType, entryId, value, options = {}) {
  if (options.hidden) return '';
  const mode = getTravelModeConfig(value);
  return `
    <label class="planner-entry-mode" title="Modo de llegada desde el punto anterior">
      <span class="planner-entry-mode-icon">${mode.icon}</span>
      <select data-entry-mode="${entryType}" data-entry-id="${escapeHtml(entryId)}" data-entry-day="${options.day || ''}" aria-label="Modo de llegada">
        ${TRAVEL_MODES.map((entry) => `<option value="${entry.id}" ${entry.id === mode.id ? 'selected' : ''}>${entry.label}</option>`).join('')}
      </select>
    </label>
  `;
}

function renderLocationEntryCard(entry, day) {
  const { location, entryType } = entry;
  const kind = getLocationKindConfig(location.kind);
  const isAnchor = entryType === 'day-start' || entryType === 'day-end';
  const isStart = entryType === 'day-start';
  const stop = entry.stop;
  const label = isStart
    ? 'Inicio del dia'
    : entryType === 'day-end'
      ? 'Final del dia'
      : stop?.purpose || 'Parada logistica';
  const subtype = getLocationSubtypeLabel(location.kind, location.subtype);
  const classes = [
    'planner-mini-card',
    'planner-location-card',
    `planner-location-${location.kind}`,
    isAnchor ? 'planner-anchor-card' : 'planner-sortable-card'
  ].join(' ');
  const dataAttributes = isAnchor
    ? `data-entry-type="${entryType}" data-entry-id="${entry.entryId}"`
    : `data-entry-type="location-stop" data-entry-id="${escapeHtml(stop.id)}" data-id="${escapeHtml(stop.id)}"`;

  return `
    <div class="${classes}" ${dataAttributes} data-location-id="${escapeHtml(location.id)}">
      <span class="planner-mini-cat-icon planner-location-kind-icon">${kind.icon}</span>
      <div class="planner-mini-info">
        <div class="planner-location-kicker">${escapeHtml(label)}</div>
        <div class="planner-mini-name">${escapeHtml(location.name)}</div>
        <div class="planner-mini-meta">
          <span>${escapeHtml(subtype)}</span>
          ${stop?.durationMinutes ? `<span class="planner-mini-sep">&middot;</span><span>${stop.durationMinutes} min</span>` : ''}
          ${stop?.note ? `<span class="planner-mini-sep">&middot;</span><span>${escapeHtml(stop.note)}</span>` : ''}
        </div>
      </div>
      <div class="planner-location-card-actions">
        ${renderTravelModeSelect(
          isAnchor ? entryType : 'location-stop',
          isAnchor ? String(day) : stop.id,
          entry.travelModeFromPrevious,
          { day, hidden: isStart }
        )}
        ${isAnchor
          ? `<button type="button" class="planner-location-action" data-day-plan-open="${day}" title="Configurar inicio y final">Editar</button>`
          : `
            <button type="button" class="planner-location-action" data-stop-edit="${escapeHtml(stop.id)}">Editar</button>
            <button type="button" class="planner-location-action is-danger" data-stop-delete="${escapeHtml(stop.id)}">Quitar</button>
          `}
      </div>
    </div>
  `;
}

function renderPlannerEntryCard(entry, day) {
  if (entry.entryType === 'activity') {
    return renderMiniCard(entry.place, entry.item, { day });
  }
  return renderLocationEntryCard(entry, day);
}

function renderPlannerPriorityFilters(iconOnly = false) {
  return Object.entries(priorityLabels)
    .map(([key, val]) => iconOnly
      ? `<button class="filter-pill filter-pill-icon-only ${_plannerFilterState.priority === key ? 'active' : ''}" data-planner-priority="${key}" title="${val.label}" aria-label="${val.label}"><span class="icon">${val.icon}</span></button>`
      : `<button class="filter-pill ${_plannerFilterState.priority === key ? 'active' : ''}" data-planner-priority="${key}"><span class="icon">${val.icon}</span> ${val.label}</button>`)
    .join('');
}

function renderPlannerScoreFilters() {
  const scoreOptions = [
    { value: 'all', label: 'Todas' },
    { value: '0-4', label: '0-4' },
    { value: '5-6', label: '5-6' },
    { value: '7-8', label: '7-8' },
    { value: '9', label: '9' },
    { value: '10', label: '10' }
  ];

  const hasSpecificSelection = _plannerFilterState.scoreBands.length > 0;

  const summaryLabel = !hasSpecificSelection
    ? '&#x2B50; Todas'
    : `&#x2B50; ${_plannerFilterState.scoreBands.join(', ')}`;

  return `
    <details class="filter-dropdown multi-select-dropdown score-filter-group">
      <summary class="zone-select multi-select-summary">${summaryLabel}</summary>
      <div class="multi-select-panel">
        ${scoreOptions.map((option) => {
          const checked = option.value === 'all'
            ? !hasSpecificSelection
            : _plannerFilterState.scoreBands.includes(option.value);
          return `
            <label class="multi-select-option">
              <input type="checkbox" data-planner-score-band="${option.value}" ${checked ? 'checked' : ''}>
              <span>&#x2B50; ${option.label}</span>
            </label>
          `;
        }).join('')}
      </div>
    </details>
  `;
}

function escapeFilterAttribute(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function renderPlannerSingleSelectFilter({ id, value, fallbackLabel, options }) {
  const current = options.find((option) => String(option.value) === String(value));
  const summaryLabel = current?.label || fallbackLabel;

  return `
    <details class="filter-dropdown single-select-dropdown">
      <summary class="zone-select single-select-summary">${summaryLabel}</summary>
      <div class="single-select-panel">
        ${options.map((option) => {
          const isActive = String(option.value) === String(value);
          return `
            <button type="button"
                    class="single-select-option ${isActive ? 'active' : ''}"
                    data-planner-filter-target="${id}"
                    data-value="${escapeFilterAttribute(option.value)}">
              ${option.label}
            </button>
          `;
        }).join('')}
      </div>
    </details>
  `;
}

function renderPlannerFilters(filteredCount) {
  return `
    <div class="filters-section" id="planner-filters-section">
      <div class="filters-inner planner-filters-wrap">
        <div class="filters-row filters-row-search">
          <div class="search-bar-container" style="flex:1;max-width:420px;">
            <span class="search-bar-icon">${icons.search}</span>
            <input type="text" class="search-bar" id="planner-search-input" placeholder="Buscar actividad, zona o ciudad..." value="${escapeHtml(_plannerFilterState.search)}">
            <button class="search-clear ${_plannerFilterState.search ? 'visible' : ''}" id="planner-search-clear">&#x2715;</button>
          </div>
          <div class="filters-inline-actions">
            ${renderViewToggle('filters')}
            ${renderPlannerPriorityFilters(true)}
            <button class="maps-link-btn planner-export-btn" id="planner-export-btn" type="button">&#x1F4C4; Exportar itinerario</button>
            ${hasActivePlannerFilters() ? `<button class="clear-filters" id="planner-clear-filters">Limpiar filtros</button>` : ''}
          </div>
          <span class="results-count">${filteredCount} actividades visibles</span>
        </div>
        <div class="filters-row filters-row-controls">
          ${renderPlannerSingleSelectFilter({
            id: 'cityId',
            value: _plannerFilterState.cityId,
            fallbackLabel: 'Todas las ciudades',
            options: [
              { value: '', label: 'Todas las ciudades' },
              ..._citiesArray.map((city) => ({ value: city.id, label: city.name }))
            ]
          })}
          ${renderPlannerScoreFilters()}
          ${renderPlannerDayCollapseControls()}
        </div>
      </div>
    </div>
  `;
}

function buildMapModel(scope, groups) {
  const normalizedScope = normalizeMapScope(scope);
  const selectedDays = normalizedScope === 'all'
    ? Array.from({ length: _totalTripDays }, (_, i) => i + 1)
    : [normalizedScope];

  const allPlannedCount = Array.from({ length: _totalTripDays }, (_, i) => i + 1)
    .reduce((acc, day) => acc + (groups[day]?.length || 0), 0);

  const scopedEntries = [];
  selectedDays.forEach((day) => {
    getComposedDayEntries(day, groups).forEach((entry) => scopedEntries.push({ ...entry, day }));
  });

  const mappableEntries = [];
  const missingEntries = [];

  scopedEntries.forEach((entry) => {
    if (hasValidCoordinates(entry.place)) {
      mappableEntries.push(entry);
    } else {
      missingEntries.push(entry);
    }
  });

  const routes = selectedDays
    .map((day) => {
      const allEntries = scopedEntries
        .filter((entry) => entry.day === day)
        .map((entry, index) => ({
          ...entry,
          exportOrder: index + 1
        }));
      return {
        day,
        color: getDayColor(day),
        allEntries,
        entries: allEntries.filter((entry) => hasValidCoordinates(entry.place))
      };
    })
    .filter((route) => route.allEntries.length > 0);

  const routesWithWalking = routes.map((route) => ({
    ...route,
    walkingSegments: buildWalkingRouteSegmentsForRoute(route)
  }));
  const distance = buildMapDistanceModel(routesWithWalking);
  const walking = buildWalkingRouteModel(routesWithWalking);

  return {
    scope: normalizedScope,
    selectedDays,
    allPlannedCount,
    plannedCount: scopedEntries.length,
    mappedCount: mappableEntries.length,
    missingCount: missingEntries.length,
    missingEntries,
    routes: routesWithWalking,
    distance,
    walking
  };
}

function renderMiniCard(place, plannerItem, options = {}) {
  const cat = categories.find((c) => c.id === place.category);
  const prio = priorityLabels[place.priority];
  const cfg = getStatusConfig(plannerItem);
  const isDiscarded = plannerItem?.status === 'discarded';
  const cityName = getCityName(place.cityId);
  const scoreText = formatScore(place.score);
  const durationText = place.estimatedDuration || '';
  const hasCity = Boolean(cityName);
  const bestTimeIconByValue = {
    'mañana': { icon: '&#x1F305;', label: 'Mejor por la mañana' },
    tarde: { icon: '&#x1F307;', label: 'Mejor por la tarde' },
    noche: { icon: '&#x1F319;', label: 'Mejor por la noche' }
  };
  const bestTimeIcon = bestTimeIconByValue[place.bestTime]
    ? `<span class="planner-mini-best-time-icon" title="${bestTimeIconByValue[place.bestTime].label}" aria-label="${bestTimeIconByValue[place.bestTime].label}">${bestTimeIconByValue[place.bestTime].icon}</span>`
    : '';
  const ticketIcon = place.requiresTicket
    ? `<span class="planner-mini-ticket-chip" title="Requiere entrada" aria-label="Requiere entrada">&#x1F3AB;</span>`
    : '';
  const metaItems = [
    hasCity ? `<span class="planner-mini-city">${cityName}</span>` : '',
    `<span title="${prio?.label || 'Prioridad'}" style="font-size:0.74rem;">${prio?.icon || ''}</span>`,
    bestTimeIcon,
    ticketIcon,
    durationText ? `<span class="planner-mini-duration-inline">${escapeHtml(durationText)}</span>` : ''
  ].filter(Boolean);

  return `
    <div class="planner-mini-card planner-sortable-card ${isDiscarded ? 'planner-card-discarded' : ''}"
         data-id="${place.id}" data-entry-id="${place.id}" data-entry-type="activity" data-place-id="${place.id}" data-clickable-card="true">
      <span class="planner-mini-cat-icon" style="font-size:1rem;">${cat?.icon || '&#x1F4CD;'}</span>
      <div class="planner-mini-info">
        <div class="planner-mini-name">${place.name}</div>
        <div class="planner-mini-meta">
          ${metaItems.map((item, index) => `${index > 0 ? '<span class="planner-mini-sep">&middot;</span>' : ''}${item}`).join('')}
        </div>
      </div>
      <div style="display:flex; align-items:center; flex-shrink:0;">
        ${renderTravelModeSelect('activity', place.id, plannerItem?.travelModeFromPrevious, {
          day: options.day,
          hidden: !options.day || !canConfigureEntryTravelMode({ entryType: 'activity', place, item: plannerItem })
        })}
        ${scoreText ? `<span style="font-size:0.7rem; font-weight:bold; color:var(--text-secondary); margin-right:6px;">&#x2B50; ${scoreText}</span>` : ''}
        <button class="planner-chip-trigger"
                data-chip-place-id="${place.id}"
                style="background:${cfg.bg}; color:${cfg.color}; border:1px solid ${cfg.border}; border-radius:999px; padding:3px 9px; font-size:0.72rem; font-weight:600; cursor:pointer; white-space:nowrap; display:flex; align-items:center; gap:4px; transition:all 0.15s;">
          <span>${cfg.icon}</span><span>${cfg.label}</span>
          <svg width="9" height="9" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </button>
      </div>
    </div>`;
}

function renderWalkingRouteLeg(segment) {
  const mode = getTravelModeConfig(segment.travelMode);
  return `
    <div class="walking-route-leg ${getWalkingRouteStatusClass(segment)}">
      <span class="walking-route-leg-arrow">&darr;</span>
      <span class="walking-route-leg-icon">${mode.icon}</span>
      <span>${getWalkingRouteStatusText(segment)}</span>
    </div>
  `;
}

function renderRouteValidationToggle(day, options = {}) {
  const isChecked = isRouteDayValidated(day);
  const readonly = options.readonly === true;
  const className = [
    'planner-route-validation',
    isChecked ? 'is-validated' : '',
    readonly ? 'is-readonly' : ''
  ].filter(Boolean).join(' ');
  const title = isChecked ? 'Ruta validada' : 'Validar ruta antes de calcular trayectos a pie';
  return `
    <label class="${className}" title="${title}" aria-label="${title}">
      <input type="checkbox" data-route-validation-day="${day}" ${isChecked ? 'checked' : ''} ${readonly ? 'disabled' : ''}>
      <span class="planner-route-validation-box" aria-hidden="true">&#x2713;</span>
    </label>
  `;
}

function renderDayCoordinateWarning(entries) {
  const invalidCount = entries.filter((entry) => !hasValidCoordinates(entry.place)).length;
  if (!invalidCount) return '';
  return `<span class="planner-day-coordinate-warning" title="Hay actividades sin latitud/longitud v&aacute;lidas">${invalidCount} sin coordenadas</span>`;
}

function renderDayPlannerCards(entries, day) {
  if (!entries.length) return `<div class="planner-empty-day">Sin actividades ni ubicaciones asignadas</div>`;

  const route = {
    day,
    color: getDayColor(day),
    allEntries: entries.map((entry, index) => ({
      ...entry,
      day,
      exportOrder: index + 1
    }))
  };
  const walkingSegments = buildWalkingRouteSegmentsForRoute(route);

  return entries.map((entry, index) => `
    ${renderPlannerEntryCard(entry, day)}
    ${walkingSegments[index] ? renderWalkingRouteLeg(walkingSegments[index]) : ''}
  `).join('');
}

function renderDayMapSummaryButton(day) {
  return `
    <button type="button" class="planner-day-map-btn planner-day-icon-btn" data-day-map-open="${day}" aria-label="Abrir mapa del Dia ${day}" title="Abrir mapa del Dia ${day}">
      <span class="planner-day-map-btn-icon">&#x1F5FA;&#xFE0F;</span>
    </button>
  `;
}

function renderDayCollapseButton(day) {
  const isCollapsed = isPlannerDayCollapsed(day);
  const stateClass = isCollapsed ? 'is-collapsed' : 'is-open';
  return `
    <button type="button"
            class="planner-day-collapse-btn ${stateClass}"
            data-planner-day-collapse="${day}"
            aria-expanded="${isCollapsed ? 'false' : 'true'}"
            title="${isCollapsed ? 'Expandir d&iacute;a' : 'Contraer d&iacute;a'}"
            aria-label="${isCollapsed ? 'Expandir d&iacute;a' : 'Contraer d&iacute;a'}"
            aria-controls="planner-day-cards-${day}">
      <span class="planner-day-collapse-icon" aria-hidden="true">${renderChevronIcon(isCollapsed ? 'right' : 'down')}</span>
    </button>
  `;
}

function renderChevronIcon(direction = 'down') {
  const points = direction === 'right' ? '9 6 15 12 9 18' : '6 9 12 15 18 9';
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="${points}"></polyline></svg>`;
}

function renderPlannerDayCollapseControls() {
  return `
    <div class="planner-days-collapse-actions" aria-label="Expandir o contraer dias">
      <button type="button" class="planner-days-collapse-btn is-open" data-planner-days-collapse="expand" title="Expandir d&iacute;as" aria-label="Expandir d&iacute;as">${renderChevronIcon('down')}</button>
      <button type="button" class="planner-days-collapse-btn is-collapsed" data-planner-days-collapse="collapse" title="Contraer d&iacute;as" aria-label="Contraer d&iacute;as">${renderChevronIcon('right')}</button>
    </div>
  `;
}

function getPlannerUmbrellaSVG(isFriendly) {
  const color = isFriendly ? '#0ea5e9' : '#9ca3af';
  const bg = isFriendly ? '#e0f2fe' : '#f3f4f6';
  const title = isFriendly ? 'Apto para lluvia' : 'No apto para lluvia';
  const svgPath = `<path d="M12 3v18m0-18C6 3 2 9 2 9h20s-4-6-10-6zm0 18c-1.5 0-3-1-3-3"/>`;
  const crossLine = !isFriendly ? `<line x1="4" y1="4" x2="20" y2="20" stroke="#9ca3af" stroke-width="2"/>` : '';

  return `
    <div title="${title}" style="display:flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:50%; background:${bg}; color:${color};">
      <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
        ${svgPath}
        ${crossLine}
      </svg>
    </div>
  `;
}

function renderModal(place) {
  const cat = categories.find((c) => c.id === place.category);
  const prio = priorityLabels[place.priority];
  const scoreText = formatScore(place.score);
  const plannerItem = _plannerItems.find((p) => p.placeId === place.id) || {};
  const cfg = getStatusConfig(plannerItem);
  const mapsUrl = getGoogleMapsUrl(place, _globalSettings?.mapLinkStyle);
  const plannerChipHtml = `<div class="planner-chip-container">
        <button class="planner-chip-trigger"
                data-chip-place-id="${place.id}"
                style="background:${cfg.bg}; color:${cfg.color}; border:1px solid ${cfg.border}; border-radius:999px; padding:5px 12px; font-size:0.8rem; font-weight:600; cursor:pointer; white-space:nowrap; display:flex; align-items:center; gap:5px; transition:all 0.15s;">
          <span>${cfg.icon}</span><span>${cfg.label}</span>
          <svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </button>
      </div>`;

  return renderPlaceDetailModal({
    place,
    category: cat,
    priority: prio,
    scoreText,
    plannerChipHtml,
    requiresTicketHtml: place.requiresTicket ? `<span class="priority-badge" style="background:#eff6ff;color:#2563eb;">&#x1F3AB; Requiere entrada</span>` : '',
    rainyToggleHtml: getPlannerUmbrellaSVG(place.rainyFriendly),
    mapsLinkHtml: `<a href="${mapsUrl}" target="_blank" title="Abrir en Google Maps" class="modal-inline-icon-btn">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
      </a>`,
    googleMapsUrl: mapsUrl,
    timeIcon: place.bestTime ? '' : '&#x2600;&#xFE0F;',
    bestTimeLabel: formatBestTimeLabel(place.bestTime),
    closeButtonId: 'planner-modal-close',
    editButtonId: 'planner-edit-place-btn',
    showEditButton: true,
    mapContainerId: `modal-map-${place.id}`,
    commentLabel: 'Comentarios'
  });
}

function renderViewToggle(variant = 'hero') {
  const calendarHref = '/planner.html?view=calendar';
  const mapHref = '/planner.html?view=map';
  return `
    <div class="planner-view-toggle ${variant === 'filters' ? 'planner-view-toggle-inline' : ''}">
      <a href="${calendarHref}" class="planner-view-btn ${_viewMode === 'calendar' ? 'active' : ''}" data-view-mode="calendar">Calendario</a>
      <a href="${mapHref}" class="planner-view-btn ${_viewMode === 'map' ? 'active' : ''}" data-view-mode="map">Mapa</a>
    </div>
  `;
}

function getPlannerViewModeFromUrl() {
  if (typeof window === 'undefined') return null;
  const viewMode = new URLSearchParams(window.location.search).get('view');
  if (viewMode === 'map' || viewMode === 'calendar') return viewMode;
  if (window.location.href.includes('view=map')) return 'map';
  if (window.location.href.includes('view=calendar')) return 'calendar';
  return null;
}

function renderMapScopeBar(model) {
  const allBtn = `<button class="planner-map-scope-btn ${model.scope === 'all' ? 'active' : ''}" data-map-scope="all">Todos</button>`;
  const dayBtns = Array.from({ length: _totalTripDays }, (_, i) => i + 1)
    .map((day) => `<button class="planner-map-scope-btn ${model.scope === day ? 'active' : ''}" data-map-scope="${day}">D&iacute;a ${day}</button>`)
    .join('');

  return `
    <div class="planner-map-scope-row">
      ${allBtn}
      ${dayBtns}
    </div>
  `;
}

function renderMapLegend(model) {
  if (model.scope !== 'all' || model.routes.length === 0) return '';

  const chips = model.routes
    .filter((route) => route.entries.length > 0)
    .map((route) => {
      const { segments, omittedCount } = buildPlannerSegments(route.allEntries || route.entries);
      const summary = calculateDayDistanceSummary(segments);
      const meta = [
        `${route.entries.length} ubic.`,
        summary.segmentCount ? formatTotalDistanceKm(summary.totalDistanceKm) : '',
        omittedCount ? `${omittedCount} sin coord.` : ''
      ].filter(Boolean).join(' &middot; ');
      return `<span class="planner-map-legend-chip"><span class="planner-map-legend-dot" style="background:${route.color};"></span>D&iacute;a ${route.day}${meta ? ` &middot; ${meta}` : ''}</span>`;
    })
    .join('');

  if (!chips) return '';
  return `<div class="planner-map-legend">${chips}</div>`;
}

function renderMapMissingList(model) {
  if (model.missingCount === 0) return '';

  const items = model.missingEntries
    .slice(0, 12)
    .map((entry) => `<li>${escapeHtml(entry.place.name)} <span>D&iacute;a ${entry.day}</span></li>`)
    .join('');

  const more = model.missingEntries.length > 12
    ? `<div class="planner-map-missing-more">+${model.missingEntries.length - 12} m&aacute;s sin coordenadas</div>`
    : '';

  return `
    <div class="planner-map-missing">
      <h4>Puntos sin coordenadas (${model.missingCount})</h4>
      <ul>${items}</ul>
      ${more}
    </div>
  `;
}

function calculateHaversineDistanceKm(coordA, coordB) {
  const earthRadiusKm = 6371;
  const toRadians = (degrees) => degrees * Math.PI / 180;
  const latDelta = toRadians(coordB.lat - coordA.lat);
  const lngDelta = toRadians(coordB.lng - coordA.lng);
  const latA = toRadians(coordA.lat);
  const latB = toRadians(coordB.lat);
  const haversine = Math.sin(latDelta / 2) ** 2
    + Math.cos(latA) * Math.cos(latB) * Math.sin(lngDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function formatSegmentDistanceKm(distanceKm) {
  if (!Number.isFinite(distanceKm)) return 'N/D';
  const formattedDistance = distanceKm >= 1 ? distanceKm.toFixed(1) : distanceKm.toFixed(2);
  return `${formattedDistance.replace('.', ',')} km`;
}

function formatTotalDistanceKm(distanceKm) {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return '0 km';
  return `${distanceKm.toFixed(1).replace('.', ',')} km`;
}

function buildPlannerSegments(orderedEntries) {
  const segments = [];
  let omittedCount = 0;

  for (let index = 1; index < orderedEntries.length; index += 1) {
    const fromEntry = orderedEntries[index - 1];
    const toEntry = orderedEntries[index];
    const fromCoord = getPlaceLatLng(fromEntry.place);
    const toCoord = getPlaceLatLng(toEntry.place);

    if (!fromCoord || !toCoord) {
      omittedCount += 1;
      continue;
    }

    const fromOrder = fromEntry.exportOrder || (fromEntry.item?.order ?? index - 1) + 1;
    const toOrder = toEntry.exportOrder || (toEntry.item?.order ?? index) + 1;

    segments.push({
      day: fromEntry.day,
      fromOrder,
      toOrder,
      fromPlace: fromEntry.place,
      toPlace: toEntry.place,
      distanceKm: calculateHaversineDistanceKm(fromCoord, toCoord)
    });
  }

  return { segments, omittedCount };
}

function calculateDayDistanceSummary(segments) {
  const totalDistanceKm = segments.reduce((sum, segment) => sum + segment.distanceKm, 0);
  const longestSegment = segments.reduce((longest, segment) => (
    !longest || segment.distanceKm > longest.distanceKm ? segment : longest
  ), null);

  return {
    segmentCount: segments.length,
    totalDistanceKm,
    longestSegment
  };
}

function getDistanceDensityLabel(totalKm) {
  if (!Number.isFinite(totalKm) || totalKm <= 3) return 'Concentrado';
  if (totalKm <= 7) return 'Razonable';
  if (totalKm <= 12) return 'Disperso';
  return 'Revisar orden';
}

function buildMapDistanceModel(routes) {
  const allSegments = [];
  let omittedCount = 0;

  routes.forEach((route) => {
    const { segments, omittedCount: routeOmittedCount } = buildPlannerSegments(route.allEntries || route.entries);
    allSegments.push(...segments);
    omittedCount += routeOmittedCount;
  });

  return {
    segments: allSegments,
    summary: calculateDayDistanceSummary(allSegments),
    omittedCount
  };
}

function buildWalkingRouteSegmentsForRoute(route) {
  const segments = [];
  const entries = route.allEntries || [];

  for (let index = 1; index < entries.length; index += 1) {
    const originEntry = entries[index - 1];
    const destinationEntry = entries[index];
    const originPlace = originEntry.place;
    const destinationPlace = destinationEntry.place;
    const travelMode = getEntryTravelMode(destinationEntry);
    const cacheKey = buildWalkingRouteCacheKey(originPlace.id, destinationPlace.id);
    const cachedRoute = travelMode === 'walking'
      ? _walkingRouteResults.get(cacheKey) || getCachedWalkingRoute(originPlace.id, destinationPlace.id)
      : null;
    const hasCoordinates = hasValidCoordinates(originPlace) && hasValidCoordinates(destinationPlace);
    const routeData = cachedRoute || {
      id: cacheKey,
      mode: travelMode,
      originPlaceId: originPlace.id,
      destinationPlaceId: destinationPlace.id,
      status: !hasCoordinates ? 'missing-coordinates' : travelMode === 'walking' ? 'pending' : 'non-walking',
      distanceMeters: null,
      durationSeconds: null,
      distanceText: null,
      durationText: null,
      latLngs: []
    };

    segments.push({
      day: route.day,
      color: route.color,
      originEntry,
      destinationEntry,
      travelMode,
      fromOrder: originEntry.exportOrder || index,
      toOrder: destinationEntry.exportOrder || index + 1,
      linearDistanceKm: getLinearDistanceKmBetweenPlaces(originPlace, destinationPlace),
      route: routeData,
      status: routeData.status
    });
  }

  return segments;
}

function buildWalkingRouteSummary(segments) {
  return segments.reduce((summary, segment) => {
    const route = segment.route;
    if (route?.status === 'ok') {
      summary.calculatedCount += 1;
      summary.distanceMeters += Number(route.distanceMeters) || 0;
      summary.durationSeconds += Number(route.durationSeconds) || 0;
    } else if (route?.status === 'missing-coordinates') {
      summary.missingCount += 1;
    } else if (route?.status === 'error') {
      summary.errorCount += 1;
    } else if (route?.status === 'non-walking') {
      summary.nonWalkingCount += 1;
    } else {
      summary.pendingCount += 1;
    }

    return summary;
  }, {
    calculatedCount: 0,
    pendingCount: 0,
    errorCount: 0,
    missingCount: 0,
    nonWalkingCount: 0,
    distanceMeters: 0,
    durationSeconds: 0
  });
}

function buildWalkingRouteModel(routes) {
  const segments = routes.flatMap((route) => route.walkingSegments || []);
  return {
    segments,
    summary: buildWalkingRouteSummary(segments),
    staleDays: Array.from(_walkingRouteStaleDays)
  };
}

function getCalculableRouteDays(model) {
  return (model.routes || [])
    .filter((route) => (route.walkingSegments || []).some((segment) => segment.travelMode === 'walking'))
    .map((route) => route.day);
}

function getRouteValidationModel(model) {
  const days = getCalculableRouteDays(model);
  const unvalidatedDays = days.filter((day) => !isRouteDayValidated(day));
  return {
    days,
    unvalidatedDays,
    canCalculate: days.length > 0 && unvalidatedDays.length === 0
  };
}

function hasOnlyCalculatedWalkingSegments(model) {
  const segments = (model.walking?.segments || []).filter((segment) => segment.travelMode === 'walking');
  return segments.length > 0 && segments.every((segment) => segment.route?.status === 'ok');
}

function confirmWalkingRouteRefresh(model) {
  return new Promise((resolve) => {
    const existingOverlay = document.getElementById('planner-route-confirm-overlay');
    existingOverlay?.remove();

    const segmentCount = model.walking?.segments?.length || 0;
    const dayText = model.selectedDays?.length === 1
      ? `el d&iacute;a ${model.selectedDays[0]}`
      : 'estos d&iacute;as';
    const overlay = document.createElement('div');
    overlay.id = 'planner-route-confirm-overlay';
    overlay.className = 'planner-route-confirm-overlay open';
    overlay.innerHTML = `
      <div class="planner-route-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="planner-route-confirm-title" tabindex="-1">
        <div class="planner-route-confirm-kicker">Ahorro de consultas API</div>
        <h3 id="planner-route-confirm-title">Las rutas ya est&aacute;n calculadas</h3>
        <p>Hay ${segmentCount} tramo${segmentCount !== 1 ? 's' : ''} de ${dayText} ya resuelto${segmentCount !== 1 ? 's' : ''}. Recalcularlos volver&aacute; a consultar Google Routes.</p>
        <div class="planner-route-confirm-actions">
          <button type="button" class="planner-route-confirm-btn planner-route-confirm-cancel" data-route-confirm="cancel">Mantener rutas</button>
          <button type="button" class="planner-route-confirm-btn planner-route-confirm-accept" data-route-confirm="accept">Recalcular igualmente</button>
        </div>
      </div>
    `;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') close(false);
    };

    const close = (result) => {
      document.removeEventListener('keydown', onKeyDown);
      overlay.classList.remove('open');
      window.setTimeout(() => overlay.remove(), 180);
      resolve(result);
    };

    overlay.addEventListener('click', (event) => {
      const action = event.target.closest('[data-route-confirm]')?.dataset.routeConfirm;
      if (action === 'accept') close(true);
      if (action === 'cancel' || event.target === overlay) close(false);
    });

    document.body.appendChild(overlay);
    document.addEventListener('keydown', onKeyDown);
    overlay.querySelector('.planner-route-confirm-cancel')?.focus();
  });
}

function renderDistanceSummary(model) {
  const summary = model.distance.summary;
  const longestText = summary.longestSegment
    ? formatSegmentDistanceKm(summary.longestSegment.distanceKm)
    : 'N/D';

  return `
    <div class="planner-map-distance-summary" aria-label="Resumen de distancia lineal">
      <div class="planner-map-distance-stat"><strong>${model.plannedCount}</strong><span>puntos de ruta</span></div>
      <div class="planner-map-distance-stat"><strong>${summary.segmentCount}</strong><span>tramos</span></div>
      <div class="planner-map-distance-stat"><strong>${formatTotalDistanceKm(summary.totalDistanceKm)}</strong><span>distancia lineal total</span></div>
      <div class="planner-map-distance-stat"><strong>${longestText}</strong><span>tramo m&aacute;s largo</span></div>
    </div>
  `;
}

function getWalkingRouteStatusText(segment) {
  const route = segment.route;
  if (route?.status === 'non-walking') {
    const mode = getTravelModeConfig(segment.travelMode);
    const linearDistanceText = Number.isFinite(segment.linearDistanceKm)
      ? ` &middot; ${formatSegmentDistanceKm(segment.linearDistanceKm)} lineales`
      : '';
    return `${mode.icon} ${mode.label}${linearDistanceText}`;
  }
  if (route?.status === 'ok') {
    return `${route.durationText || formatRouteDuration(route.durationSeconds)} &middot; ${route.distanceText || formatRouteDistance(route.distanceMeters)}`;
  }
  if (route?.status === 'missing-coordinates') return 'Sin coordenadas suficientes';
  if (route?.status === 'error') return 'No disponible &middot; linea estimada en mapa';
  const linearDistanceText = Number.isFinite(segment.linearDistanceKm)
    ? ` (${formatSegmentDistanceKm(segment.linearDistanceKm)} lineales)`
    : '';
  return `Pendiente de calcular${linearDistanceText}`;
}

function getWalkingRouteStatusClass(segment) {
  if (segment.route?.status === 'ok') return 'walking-route-leg-ok';
  if (segment.route?.status === 'non-walking') return 'walking-route-leg-transport';
  if (segment.route?.status === 'error') return 'walking-route-leg-error';
  if (segment.route?.status === 'missing-coordinates') return 'walking-route-leg-error';
  return 'walking-route-leg-pending';
}

function renderWalkingRouteControls(model) {
  const summary = model.walking.summary;
  const hasSegments = model.walking.segments.some((segment) => segment.travelMode === 'walking');
  const hasCalculated = summary.calculatedCount > 0;
  const routeValidation = getRouteValidationModel(model);
  const isRouteActionDisabled = !hasSegments || _walkingRoutesLoading || !routeValidation.canCalculate;
  const staleInScope = model.selectedDays.some((day) => _walkingRouteStaleDays.has(day));
  const statusText = _walkingRoutesLoading
    ? 'Calculando rutas a pie...'
    : _walkingRouteMessage || (staleInScope ? 'Rutas pendientes de actualizar' : '');
  const validationHint = routeValidation.unvalidatedDays.length
    ? `Valida ${routeValidation.unvalidatedDays.length === 1 ? `el d&iacute;a ${routeValidation.unvalidatedDays[0]}` : 'los d&iacute;as con rutas'} antes de llamar a la API.`
    : '';

  return `
    <div class="walking-route-actions">
      <div class="walking-route-action-copy">
        <strong>Rutas a pie por calles</strong>
        <span>${validationHint || (hasCalculated ? 'Usando rutas reales calculadas por Google Routes.' : 'Calcula los desplazamientos andando cuando quieras.')}</span>
      </div>
      <div class="walking-route-buttons">
        <button type="button" class="walking-route-btn" data-walking-route-action="calculate" ${isRouteActionDisabled ? 'disabled' : ''}>
          ${hasCalculated ? 'Calcular faltantes' : 'Calcular rutas a pie'}
        </button>
        <button type="button" class="walking-route-btn walking-route-btn-secondary" data-walking-route-action="refresh" ${isRouteActionDisabled ? 'disabled' : ''}>
          Actualizar rutas a pie
        </button>
      </div>
      ${statusText ? `<div class="walking-route-status walking-route-status-${_walkingRouteMessageTone}">${statusText}</div>` : ''}
    </div>
  `;
}

function renderWalkingRouteSummary(model) {
  const summary = model.walking.summary;
  if (!model.walking.segments.length) {
    return `<div class="walking-route-summary">Desplazamientos a pie: sin tramos en este alcance</div>`;
  }

  if (summary.calculatedCount === 0) {
    const details = [
      summary.pendingCount ? 'Desplazamientos a pie pendientes de calcular' : '',
      summary.nonWalkingCount ? `${summary.nonWalkingCount} tramo${summary.nonWalkingCount !== 1 ? 's' : ''} en transporte` : '',
      summary.missingCount ? `${summary.missingCount} sin coordenadas` : ''
    ].filter(Boolean);
    return `<div class="walking-route-summary">${details.join(' &middot; ') || 'Sin desplazamientos calculables'}</div>`;
  }

  const details = [
    `${summary.calculatedCount} tramo${summary.calculatedCount !== 1 ? 's' : ''}`,
    formatRouteDistance(summary.distanceMeters),
    formatRouteDuration(summary.durationSeconds),
    summary.pendingCount ? `${summary.pendingCount} pendiente${summary.pendingCount !== 1 ? 's' : ''}` : '',
    summary.errorCount ? `${summary.errorCount} no disponible${summary.errorCount !== 1 ? 's' : ''}` : '',
    summary.missingCount ? `${summary.missingCount} sin coordenadas` : '',
    summary.nonWalkingCount ? `${summary.nonWalkingCount} en transporte` : ''
  ].filter(Boolean);

  return `<div class="walking-route-summary">Desplazamientos a pie: ${details.join(' &middot; ')}</div>`;
}

function renderDistanceSegmentsList(model, options = {}) {
  const segments = model.walking.segments;
  const headingAddon = Number.isFinite(options.day)
    ? renderRouteValidationToggle(options.day, { readonly: true })
    : '';
  if (!segments.length && model.plannedCount > 1) {
    return `
      <aside class="planner-map-segments-card">
        <div class="planner-map-segments-heading"><h4>Tramos del itinerario</h4>${headingAddon}</div>
        <p class="planner-map-segments-empty">No hay tramos calculables con coordenadas v&aacute;lidas.</p>
      </aside>
    `;
  }
  if (!segments.length) return '';

  const showDay = model.scope === 'all';
  const rows = segments.map((segment) => `
    <li class="planner-map-segment-row ${getWalkingRouteStatusClass(segment)}">
      <div class="planner-map-segment-main">
        <span class="planner-map-segment-orders">${segment.fromOrder} &rarr; ${segment.toOrder}</span>
        <span class="planner-map-segment-names">${escapeHtml(segment.originEntry.place.name)} &rarr; ${escapeHtml(segment.destinationEntry.place.name)}</span>
        ${showDay ? `<span class="planner-map-segment-day">D&iacute;a ${segment.day}</span>` : ''}
      </div>
      <span class="planner-map-segment-status">${getWalkingRouteStatusText(segment)}</span>
    </li>
  `).join('');

  return `
    <aside class="planner-map-segments-card">
      <div class="planner-map-segments-heading"><h4>Tramos del itinerario</h4>${headingAddon}</div>
      <ul>${rows}</ul>
    </aside>
  `;
}

function renderGoogleMapsRouteButton(entries, variant = '') {
  const routeUrls = getGoogleMapsRouteUrls(entries || [], { travelMode: 'walking', maxWaypoints: 8 });
  const isInlineDayRoute = variant.split(/\s+/).includes('planner-day-inline-route');
  const getRouteLabel = (index = 0) => {
    const partLabel = routeUrls.length > 1 ? ` ${index + 1}/${routeUrls.length}` : '';
    return `Google Maps${partLabel}`;
  };
  if (!routeUrls.length) {
    return `
      <div class="planner-map-route-actions ${variant}">
        <span class="planner-map-route-link is-disabled" aria-disabled="true" aria-label="Google Maps no disponible" title="Google Maps no disponible">
          <span class="planner-map-route-link-icon" aria-hidden="true">&#x1F4CD;</span>
          ${isInlineDayRoute ? '' : '<span>Google Maps</span>'}
        </span>
      </div>
    `;
  }

  return `
    <div class="planner-map-route-actions ${variant}">
      ${routeUrls.map((routeUrl, index) => `
        <a class="planner-map-route-link" href="${routeUrl}" target="_blank" rel="noopener" aria-label="Abrir ruta en ${getRouteLabel(index)}" title="Abrir ruta en ${getRouteLabel(index)}">
          <span class="planner-map-route-link-icon" aria-hidden="true">&#x1F4CD;</span>
          ${isInlineDayRoute ? '' : `<span>${getRouteLabel(index)}</span>`}
        </a>
      `).join('')}
    </div>
  `;
}

function renderPlannerMapRouteAction(model) {
  if (model.scope === 'all') return '';
  const route = model.routes.find((candidate) => candidate.day === model.scope);
  return renderGoogleMapsRouteButton(route?.entries || []);
}

function renderMapPanel(model) {
  let emptyMessage = '';
  if (model.plannedCount === 0) {
    emptyMessage = 'No hay actividades planificadas para este alcance.';
  } else if (model.mappedCount === 0) {
    emptyMessage = 'No hay actividades geolocalizadas para este alcance.';
  }

  return `
    <div class="planner-map-layout">
      <div class="planner-map-toolbar">
        ${renderMapScopeBar(model)}
        ${renderWalkingRouteControls(model)}
        ${renderWalkingRouteSummary(model)}
        ${renderDistanceSummary(model)}
      </div>

      ${renderMapLegend(model)}
      ${renderPlannerMapRouteAction(model)}

      <div class="planner-map-content-grid">
        <div class="planner-map-shell">
          <div id="planner-map-container" class="planner-map-container ${model.mappedCount === 0 ? 'is-hidden' : ''}"></div>
          ${emptyMessage ? `<div class="planner-map-empty">${emptyMessage}</div>` : ''}
        </div>
        ${renderDistanceSegmentsList(model)}
      </div>

      ${model.distance.omittedCount ? `<div class="planner-map-distance-warning">Algunos tramos no se han podido calcular por falta de coordenadas.</div>` : ''}
      ${renderMapMissingList(model)}
    </div>
  `;
}

function getDateTextForDay(dayNum) {
  if (!_globalSettings?.startDate) return `Dia ${dayNum}`;
  const date = new Date(_globalSettings.startDate);
  date.setDate(date.getDate() + dayNum - 1);
  return date.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function getMostCommonLabel(values) {
  const counts = new Map();
  values.filter(Boolean).forEach((value) => {
    counts.set(value, (counts.get(value) || 0) + 1);
  });
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
}

function getExportDaySummary(entries) {
  const parts = splitItineraryEntries(entries);
  const totalMinutes = entries.reduce((sum, entry) => {
    const minutes = entry.entryType === 'location-stop'
      ? Number(entry.stop?.durationMinutes)
      : entry.entryType === 'activity'
        ? parseEstimatedDurationToMinutes(entry.place?.estimatedDuration)
        : null;
    return Number.isFinite(minutes) ? sum + minutes : sum;
  }, 0);
  const priorityCounts = parts.activities.reduce((acc, entry) => {
    const priority = entry.place.priority || 'optional';
    acc[priority] = (acc[priority] || 0) + 1;
    return acc;
  }, {});
  const mainCity = getMostCommonLabel(entries.map((entry) => getCityName(entry.place.cityId)));
  const mainZone = getMostCommonLabel(entries.map((entry) => entry.place.zone));

  return {
    activityCount: parts.activities.length,
    stopCount: parts.stops.length,
    anchorCount: parts.anchors.length,
    totalMinutes,
    totalDurationText: formatDurationMinutes(totalMinutes, { approximate: true }) || 'Sin duracion estimada',
    priorityCounts,
    mainLabel: [mainCity, mainZone].filter(Boolean).join(' · '),
    rainyCount: parts.activities.filter((entry) => entry.place.rainyFriendly).length,
    ticketCount: parts.activities.filter((entry) => entry.place.requiresTicket).length,
    isSaturated: parts.activities.length >= EXPORT_SATURATION_ACTIVITY_LIMIT || totalMinutes >= EXPORT_SATURATION_MINUTES_LIMIT
  };
}

function getExportDistanceModel(entries) {
  const walkingDistance = buildExportWalkingDistanceModel(entries);
  if (walkingDistance) return walkingDistance;

  const { segments, omittedCount } = buildPlannerSegments(entries);
  const summary = calculateDayDistanceSummary(segments);
  return {
    mode: 'linear',
    segments,
    omittedCount,
    summary,
    densityLabel: getDistanceDensityLabel(summary.totalDistanceKm)
  };
}

function getLinearDistanceKmBetweenPlaces(originPlace, destinationPlace) {
  const originCoord = getPlaceLatLng(originPlace);
  const destinationCoord = getPlaceLatLng(destinationPlace);
  if (!originCoord || !destinationCoord) return null;
  return calculateHaversineDistanceKm(originCoord, destinationCoord);
}

function formatEstimatedLinearDistanceNote(distanceKm, prefix = '+ ') {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return '';
  return `${prefix}${formatSegmentDistanceKm(distanceKm).replace(' km', ' km lineales estimados')}`;
}

function buildExportWalkingDistanceModel(entries) {
  if (!Array.isArray(entries) || entries.length < 2) return null;

  const route = {
    day: entries[0]?.day || 1,
    color: getDayColor(entries[0]?.day || 1),
    entries,
    allEntries: entries
  };
  const walkingSegments = buildWalkingRouteSegmentsForRoute(route);
  const summary = buildWalkingRouteSummary(walkingSegments);
  if (!summary.calculatedCount) return null;

  const segments = walkingSegments.map((segment) => {
    const fromPlace = segment.originEntry.place;
    const toPlace = segment.destinationEntry.place;
    const fromCoord = getPlaceLatLng(fromPlace);
    const toCoord = getPlaceLatLng(toPlace);
    const fallbackLatLngs = [fromCoord, toCoord]
      .filter(Boolean)
      .map((coord) => [coord.lat, coord.lng]);
    const realLatLngs = hasUsablePolyline(segment.route) ? segment.route.latLngs : [];
    const linearDistanceKm = getLinearDistanceKmBetweenPlaces(fromPlace, toPlace);
    const distanceKm = Number.isFinite(segment.route?.distanceMeters)
      ? segment.route.distanceMeters / 1000
      : null;

    return {
      ...segment,
      fromPlace,
      toPlace,
      distanceKm,
      linearDistanceKm,
      durationSeconds: Number.isFinite(segment.route?.durationSeconds) ? segment.route.durationSeconds : null,
      latLngs: realLatLngs.length >= 2 ? realLatLngs : fallbackLatLngs,
      hasRealRoute: realLatLngs.length >= 2
    };
  });

  const estimatedLinearDistanceKm = segments.reduce((sum, segment) => (
    !segment.hasRealRoute && Number.isFinite(segment.linearDistanceKm)
      ? sum + segment.linearDistanceKm
      : sum
  ), 0);

  const longestSegment = segments.reduce((longest, segment) => (
    Number.isFinite(segment.distanceKm) && (!longest || segment.distanceKm > longest.distanceKm)
      ? segment
      : longest
  ), null);

  return {
    mode: 'walking',
    segments,
    omittedCount: summary.missingCount,
    summary: {
      ...summary,
      segmentCount: segments.length,
      totalDistanceKm: summary.distanceMeters / 1000,
      estimatedLinearDistanceKm,
      longestSegment
    },
    densityLabel: getDistanceDensityLabel(summary.distanceMeters / 1000)
  };
}

function getPdfDaySummaryItems(dayData) {
  const summary = getExportDaySummary(dayData.entries);
  const distance = getExportDistanceModel(dayData.entries);
  if (distance.mode === 'walking') {
    const estimatedNote = formatEstimatedLinearDistanceNote(distance.summary.estimatedLinearDistanceKm, '+ ');
    return [
      `${summary.activityCount} actividades`,
      summary.stopCount ? `${summary.stopCount} paradas logisticas` : '',
      `${summary.totalDurationText} visitas`,
      `${formatRouteDistance(distance.summary.distanceMeters)} a pie${estimatedNote ? ` (${estimatedNote})` : ''}`,
      `${formatRouteDuration(distance.summary.durationSeconds)} desplazamientos`,
      `${summary.ticketCount} con entrada/reserva`,
      `${summary.rainyCount} aptas lluvia`
    ].filter(Boolean);
  }
  const longestText = distance.summary.longestSegment
    ? `tramo más largo ${formatSegmentDistanceKm(distance.summary.longestSegment.distanceKm)}`
    : null;

  return [
    `${summary.activityCount} actividades`,
    summary.stopCount ? `${summary.stopCount} paradas logisticas` : '',
    `${summary.totalDurationText} visitas`,
    `${formatTotalDistanceKm(distance.summary.totalDistanceKm)} lineales`,
    longestText,
    `${summary.ticketCount} con entrada/reserva`,
    `${summary.rainyCount} aptas lluvia`
  ].filter(Boolean);
}

function getExportDays(scope, selectedDay) {
  const groups = buildGroupedData(_places);
  const days = scope === 'day'
    ? [Number.parseInt(selectedDay, 10)]
    : Array.from({ length: _totalTripDays }, (_, i) => i + 1);

  return days
    .filter((day) => Number.isFinite(day) && day >= 1 && day <= _totalTripDays)
    .map((day) => ({
      day,
      dateText: getDateTextForDay(day),
      entries: getComposedDayEntries(day, groups).map((entry, index) => ({
        ...entry,
        day,
        exportOrder: index + 1
      }))
    }))
    .filter((dayData) => dayData.entries.length > 0);
}

function openPlannerExportModal() {
  const overlay = document.getElementById('planner-export-overlay');
  const modal = document.getElementById('planner-export-modal');
  if (!overlay || !modal) return;

  const dayOptions = Array.from({ length: _totalTripDays }, (_, i) => i + 1)
    .map((day) => {
      const isActive = day === 1;
      return `
        <button type="button"
                class="single-select-option ${isActive ? 'active' : ''}"
                data-export-day="${day}">
          Dia ${day} · ${escapeHtml(getDateTextForDay(day))}
        </button>
      `;
    })
    .join('');

  modal.innerHTML = `
    <div class="modal-scroll">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <div>
          <h2>Exportar itinerario</h2>
          <div class="place-card-category" style="margin:0;">PDF visual para preparar o llevar durante el viaje</div>
        </div>
        <button class="modal-close" id="planner-export-close">&#x2715;</button>
      </div>
      <div class="modal-body">
        <form id="planner-export-form" class="planner-export-form">
          <div class="planner-export-fieldset">
            <div class="planner-export-label">Alcance de exportacion</div>
            <label><input type="radio" name="exportScope" value="all" checked> Todo el viaje</label>
            <label><input type="radio" name="exportScope" value="day"> Dia concreto</label>
          </div>
          <div class="planner-export-fieldset is-hidden" id="planner-export-day-field">
            <div class="planner-export-label">Selector de dia</div>
            <input type="hidden" id="planner-export-day" value="1">
            <details class="filter-dropdown single-select-dropdown planner-export-day-dropdown">
              <summary class="zone-select single-select-summary" id="planner-export-day-summary">Dia 1 · ${escapeHtml(getDateTextForDay(1))}</summary>
              <div class="single-select-panel">
                ${dayOptions}
              </div>
            </details>
          </div>
          <div class="planner-export-fieldset">
            <div class="planner-export-label">Tipo de exportacion</div>
            <label><input type="radio" name="exportType" value="detailed" checked> PDF detallado</label>
            <label><input type="radio" name="exportType" value="summary"> PDF resumen</label>
          </div>
          <p class="planner-export-note">El PDF mantiene el texto seleccionable. El mapa intenta usar calles reales y, si los tiles externos fallan, usa un esquema seguro.</p>
          <button type="submit" class="maps-link-btn planner-export-submit">&#x1F4C4; Generar PDF</button>
        </form>
      </div>
    </div>
  `;

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  modal.querySelector('#planner-export-close')?.addEventListener('click', closePlannerExportModal);
  modal.querySelectorAll('input[name="exportScope"]').forEach((input) => {
    input.addEventListener('change', () => {
      modal.querySelector('#planner-export-day-field')?.classList.toggle('is-hidden', input.value !== 'day' || !input.checked);
    });
  });
  modal.querySelectorAll('[data-export-day]').forEach((button) => {
    button.addEventListener('click', () => {
      const selectedDay = button.dataset.exportDay || '1';
      const selectedLabel = button.textContent.trim();
      const hiddenInput = modal.querySelector('#planner-export-day');
      const summary = modal.querySelector('#planner-export-day-summary');
      if (hiddenInput) hiddenInput.value = selectedDay;
      if (summary) summary.textContent = selectedLabel;
      modal.querySelectorAll('[data-export-day]').forEach((option) => option.classList.toggle('active', option === button));
      modal.querySelector('.planner-export-day-dropdown')?.removeAttribute('open');
    });
  });
  modal.querySelector('#planner-export-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const scope = modal.querySelector('input[name="exportScope"]:checked')?.value || 'all';
    const exportType = modal.querySelector('input[name="exportType"]:checked')?.value || 'detailed';
    const selectedDay = modal.querySelector('#planner-export-day')?.value || '1';
    await generatePlannerPdf({ scope, exportType, selectedDay });
  });
}

function closePlannerExportModal() {
  document.getElementById('planner-export-overlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

function getJsPdfConstructor() {
  return window.jspdf?.jsPDF || window.jsPDF || null;
}

function getHtml2Canvas() {
  return window.html2canvas || null;
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function toPdfText(value) {
  return String(value ?? '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&middot;/g, '·')
    .replace(/&mdash;/g, '-')
    .replace(/[\u{1F000}-\u{1FAFF}\u2600-\u27BF]/gu, '')
    .replace(/[^\u0009\u000A\u000D\u0020-\u00FF]/g, (char) => {
      const normalized = char.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return /^[\u0020-\u00FF]+$/.test(normalized) ? normalized : '';
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function hexToRgb(hex) {
  const normalized = String(hex || '').replace('#', '');
  if (normalized.length !== 6) return [17, 24, 39];
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16)
  ];
}

function setPdfColor(doc, hex, mode = 'text') {
  const [r, g, b] = hexToRgb(hex);
  if (mode === 'draw') doc.setDrawColor(r, g, b);
  else if (mode === 'fill') doc.setFillColor(r, g, b);
  else doc.setTextColor(r, g, b);
}

function createPdfLayout(doc) {
  const marginLeft = 10;
  const marginRight = 12;
  return {
    pageWidth: doc.internal.pageSize.getWidth(),
    pageHeight: doc.internal.pageSize.getHeight(),
    marginX: marginLeft,
    marginRight,
    marginTop: 12,
    marginBottom: 14,
    contentWidth: doc.internal.pageSize.getWidth() - marginLeft - marginRight,
    accent: '#e94560',
    dark: '#111827',
    muted: '#64748b',
    softBorder: '#e5e7eb',
    softBg: '#f8fafc'
  };
}

function ensurePdfSpace(doc, layout, y, neededHeight) {
  if (y + neededHeight <= layout.pageHeight - layout.marginBottom) return y;
  doc.addPage();
  return layout.marginTop;
}

function drawWrappedPdfText(doc, text, x, y, width, options = {}) {
  const fontSize = options.fontSize || 9;
  const lineHeight = options.lineHeight || fontSize * 0.44;
  doc.setFont('helvetica', options.bold ? 'bold' : 'normal');
  doc.setFontSize(fontSize);
  if (options.color) setPdfColor(doc, options.color);
  const lines = doc.splitTextToSize(toPdfText(text), width);
  if (lines.length) doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function drawPdfSummaryCard(doc, x, y, width, stats, layout) {
  setPdfColor(doc, layout.softBg, 'fill');
  setPdfColor(doc, layout.softBorder, 'draw');
  doc.roundedRect(x, y, width, 12, 3, 3, 'FD');
  const columnWidth = width / stats.length;
  stats.forEach((stat, index) => {
    const columnX = x + columnWidth * index;
    if (index > 0) {
      setPdfColor(doc, layout.softBorder, 'draw');
      doc.setLineWidth(0.25);
      doc.line(columnX, y + 2.5, columnX, y + 9.5);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    setPdfColor(doc, layout.accent);
    doc.text(toPdfText(stat.value), columnX + 4, y + 5);
    if (stat.note) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5);
      setPdfColor(doc, layout.muted);
      doc.text(toPdfText(stat.note), columnX + 4, y + 7.5);
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.1);
    setPdfColor(doc, layout.muted);
    doc.text(toPdfText(stat.label).toUpperCase(), columnX + 4, y + 10.2);
  });
}

function drawPdfCover(doc, layout, days, exportType) {
  const totalActivities = days.reduce((sum, dayData) => sum + dayData.entries.length, 0);
  const totalMinutes = days.reduce((sum, dayData) => sum + getExportDaySummary(dayData.entries).totalMinutes, 0);
  const distanceTotals = days.reduce((totals, dayData) => {
    const distance = getExportDistanceModel(dayData.entries);
    totals.totalDistanceKm += distance.summary.totalDistanceKm;
    totals.estimatedLinearDistanceKm += distance.summary.estimatedLinearDistanceKm || 0;
    return totals;
  }, {
    totalDistanceKm: 0,
    estimatedLinearDistanceKm: 0
  });
  let y = layout.marginTop;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  setPdfColor(doc, layout.accent);
  doc.text('JAPON 2026', layout.marginX, y);
  y += 8;

  doc.setFontSize(22);
  setPdfColor(doc, layout.dark);
  doc.text(exportType === 'summary' ? 'Itinerario de viaje (resumen)' : 'Itinerario de viaje', layout.marginX, y);
  y += 8;

  drawPdfSummaryCard(doc, layout.marginX, y, layout.contentWidth, [
    { label: 'dias exportados', value: String(days.length) },
    { label: 'actividades', value: String(totalActivities) },
    { label: 'visitas estimadas', value: formatDurationMinutes(totalMinutes, { approximate: true }) || 'N/D' },
    {
      label: distanceTotals.estimatedLinearDistanceKm > 0 ? 'distancia total (+ estimada)' : 'distancia total',
      value: formatTotalDistanceKm(distanceTotals.totalDistanceKm),
      note: distanceTotals.estimatedLinearDistanceKm > 0
        ? `(+ ${formatSegmentDistanceKm(distanceTotals.estimatedLinearDistanceKm)} lineales estimados)`
        : ''
    }
  ], layout);
  y += 17;

  setPdfColor(doc, layout.accent, 'draw');
  doc.setLineWidth(0.8);
  doc.line(layout.marginX, y, layout.pageWidth - layout.marginX, y);
  return y + 10;
}

function drawPdfDayHeader(doc, layout, dayData, y) {
  const summary = getExportDaySummary(dayData.entries);
  y = ensurePdfSpace(doc, layout, y, 32);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  setPdfColor(doc, layout.accent);
  doc.text(`DIA ${dayData.day}`, layout.marginX, y);
  y += 6;

  doc.setFontSize(15);
  setPdfColor(doc, layout.dark);
  doc.text(toPdfText(dayData.dateText), layout.marginX, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  setPdfColor(doc, layout.muted);
  doc.text(toPdfText(summary.mainLabel || 'Ruta del dia'), layout.marginX, y);
  y += 5;

  const summaryLine = getPdfDaySummaryItems(dayData).join(' · ');
  y = drawWrappedPdfText(doc, summaryLine, layout.marginX, y, layout.contentWidth, {
    fontSize: 7.6,
    lineHeight: 3.8,
    color: '#475569',
    bold: true
  }) + 3;

  if (summary.isSaturated) {
    setPdfColor(doc, '#fff7ed', 'fill');
    setPdfColor(doc, '#fed7aa', 'draw');
    doc.roundedRect(layout.marginX, y, layout.contentWidth, 9, 2, 2, 'FD');
    y = drawWrappedPdfText(doc, 'Dia intenso: revisa pausas, comidas y desplazamientos antes de cerrarlo.', layout.marginX + 3, y + 5.7, layout.contentWidth - 6, {
      fontSize: 8,
      lineHeight: 4,
      color: '#9a3412',
      bold: true
    }) + 2;
  }

  return y + 2;
}

function getPdfRoutePoints(entries, x, y, width, height) {
  const points = entries
    .map((entry) => ({ entry, latLng: getPlaceLatLng(entry.place) }))
    .filter((point) => point.latLng);
  if (!points.length) return [];

  if (points.length === 1) {
    return [{
      ...points[0],
      x: x + width / 2,
      y: y + height / 2
    }];
  }

  const averageLat = points.reduce((sum, point) => sum + point.latLng.lat, 0) / points.length;
  const lngScale = Math.max(Math.cos(averageLat * Math.PI / 180), 0.2);
  const projected = points.map((point) => ({
    ...point,
    mapX: point.latLng.lng * lngScale,
    mapY: point.latLng.lat
  }));
  const xValues = projected.map((point) => point.mapX);
  const yValues = projected.map((point) => point.mapY);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const xSpan = maxX - minX;
  const ySpan = maxY - minY;

  if (xSpan === 0 && ySpan === 0) {
    return projected.map((point) => ({
      ...point,
      x: x + width / 2,
      y: y + height / 2
    }));
  }

  const padding = 5;
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const scale = Math.min(
    xSpan > 0 ? usableWidth / xSpan : Number.POSITIVE_INFINITY,
    ySpan > 0 ? usableHeight / ySpan : Number.POSITIVE_INFINITY
  );
  const routeWidth = xSpan > 0 ? xSpan * scale : 0;
  const routeHeight = ySpan > 0 ? ySpan * scale : 0;
  const offsetX = x + (width - routeWidth) / 2;
  const offsetY = y + (height - routeHeight) / 2;

  return projected.map((point) => ({
    ...point,
    x: xSpan > 0 ? offsetX + (point.mapX - minX) * scale : x + width / 2,
    y: ySpan > 0 ? offsetY + routeHeight - (point.mapY - minY) * scale : y + height / 2
  }));
}

function getPdfMapHeight(compact = false) {
  return 62;
}

function drawPdfRouteMap(doc, layout, entries, y, compact = false) {
  const mapHeight = getPdfMapHeight(compact);
  y = ensurePdfSpace(doc, layout, y, mapHeight + 8);
  const x = layout.marginX;
  const width = layout.contentWidth;
  const points = getPdfRoutePoints(entries, x, y, width, mapHeight);
  const dayColor = getDayColor(entries[0]?.day || 1);
  const [accentR, accentG, accentB] = hexToRgb(dayColor);

  setPdfColor(doc, layout.softBg, 'fill');
  setPdfColor(doc, layout.softBorder, 'draw');
  doc.roundedRect(x, y, width, mapHeight, 3, 3, 'FD');

  if (!points.length) {
    drawWrappedPdfText(doc, 'Sin coordenadas suficientes para dibujar mapa.', x + 6, y + 17, width - 12, {
      fontSize: 8,
      color: layout.muted
    });
    return y + mapHeight + 5;
  }

  if (points.length > 1) {
    doc.setDrawColor(accentR, accentG, accentB);
    doc.setLineWidth(compact ? 0.55 : 0.75);
    for (let i = 1; i < points.length; i += 1) {
      doc.line(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
    }
  }

  points.forEach((point) => {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(accentR, accentG, accentB);
    doc.setLineWidth(0.5);
    doc.circle(point.x, point.y, compact ? 1.55 : 2.05, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(compact ? 4.4 : 5.1);
    setPdfColor(doc, layout.dark);
    doc.text(String(point.entry.exportOrder), point.x, point.y, { align: 'center', baseline: 'middle' });
  });

  return y + mapHeight + 5;
}

function getExportMapEntries(entries) {
  return entries
    .map((entry) => ({ ...entry, latLng: getPlaceLatLng(entry.place) }))
    .filter((entry) => entry.latLng);
}

function createExportMapCaptureHost(widthPx, heightPx) {
  const host = document.createElement('div');
  host.className = 'planner-pdf-map-capture';
  host.style.cssText = `
    position: fixed;
    left: -12000px;
    top: 0;
    width: ${widthPx}px;
    height: ${heightPx}px;
    overflow: hidden;
    background: #eef2f7;
    z-index: -1;
    pointer-events: none;
  `;
  document.body.appendChild(host);
  return host;
}

function waitForTileLayer(tileLayer, timeoutMs = EXPORT_MAP_TILE_TIMEOUT_MS) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      tileLayer.off('load', finish);
      resolve();
    };
    tileLayer.on('load', finish);
    window.setTimeout(finish, timeoutMs);
  });
}

function getExportMapMarkerHtml(entry, color, compact) {
  const size = 21;
  const fontSize = 9.5;
  return `
    <div style="
      width:${size}px;
      height:${size}px;
      box-sizing:border-box;
      border-radius:999px;
      border:2px solid ${color};
      background:#fff;
      color:#111827;
      position:relative;
      font:700 ${fontSize}px/1 Arial, sans-serif;
      text-align:center;
      box-shadow:0 3px 9px rgba(15,23,42,0.18);
    ">
      <span style="
        position:absolute;
        left:50%;
        top:50%;
        transform:translate(-50%, -95%);
        display:block;
        line-height:1;
        width:100%;
        text-align:center;
      ">${entry.exportOrder}</span>
    </div>
  `;
}

async function captureLeafletMapForPdf(entries, compact = false, distanceModel = null) {
  const html2canvas = getHtml2Canvas();
  if (!html2canvas || typeof L === 'undefined') return null;

  const mapEntries = getExportMapEntries(entries);
  if (!mapEntries.length) return null;
  const routeModel = distanceModel || getExportDistanceModel(entries);

  const widthPx = 1180;
  const heightPx = 390;
  const host = createExportMapCaptureHost(widthPx, heightPx);
  let map = null;

  try {
    map = L.map(host, {
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
      dragging: false,
      touchZoom: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      tap: false,
      fadeAnimation: false,
      markerZoomAnimation: false,
      zoomAnimation: false
    });

    const tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
      crossOrigin: true,
      detectRetina: true
    });
    const tilesReady = waitForTileLayer(tileLayer);
    tileLayer.addTo(map);

    const routeColor = getDayColor(entries[0]?.day || 1);
    const boundsLatLngs = [...mapEntries.map((entry) => [entry.latLng.lat, entry.latLng.lng])];

    if (routeModel.mode === 'walking' && routeModel.segments.length) {
      routeModel.segments.forEach((segment) => {
        const segmentLatLngs = Array.isArray(segment.latLngs) ? segment.latLngs : [];
        if (segmentLatLngs.length < 2) return;

        boundsLatLngs.push(...segmentLatLngs);
        L.polyline(segmentLatLngs, {
          color: routeColor,
          weight: segment.hasRealRoute ? 4 : 2.2,
          opacity: segment.hasRealRoute ? 0.9 : 0.38,
          lineJoin: 'round',
          lineCap: 'round',
          dashArray: segment.hasRealRoute ? null : '7 9'
        }).addTo(map);
      });
    } else {
      const latLngs = mapEntries.map((entry) => [entry.latLng.lat, entry.latLng.lng]);
      if (latLngs.length > 1) {
        boundsLatLngs.push(...latLngs);
        L.polyline(latLngs, {
          color: routeColor,
          weight: 3,
          opacity: 0.88,
          lineJoin: 'round',
          lineCap: 'round'
        }).addTo(map);
      }
    }

    mapEntries.forEach((entry) => {
      const icon = L.divIcon({
        className: 'planner-pdf-map-marker',
        html: getExportMapMarkerHtml(entry, routeColor, compact),
        iconSize: [21, 21],
        iconAnchor: [10.5, 10.5]
      });
      L.marker([entry.latLng.lat, entry.latLng.lng], { icon, interactive: false }).addTo(map);
    });

    map.invalidateSize({ pan: false });
    if (boundsLatLngs.length === 1) {
      map.setView(boundsLatLngs[0], 15, { animate: false });
    } else {
      map.fitBounds(boundsLatLngs, { padding: [22, 22], animate: false });
    }

    await Promise.race([tilesReady, wait(EXPORT_MAP_TILE_TIMEOUT_MS)]);
    await wait(350);

    const canvas = await html2canvas(host, {
      backgroundColor: '#eef2f7',
      useCORS: true,
      allowTaint: false,
      logging: false,
      scale: EXPORT_MAP_CAPTURE_SCALE,
      width: widthPx,
      height: heightPx,
      windowWidth: widthPx,
      windowHeight: heightPx
    });

    return {
      dataUrl: canvas.toDataURL('image/jpeg', 0.92),
      widthPx,
      heightPx
    };
  } catch (error) {
    console.warn('No se pudo capturar el mapa Leaflet para el PDF. Se usara el mapa esquematico.', error);
    return null;
  } finally {
    if (map) {
      map.off();
      map.remove();
    }
    host.remove();
  }
}

async function drawPdfRouteMapWithFallback(doc, layout, entries, y, compact = false) {
  const mapHeight = getPdfMapHeight(false);
  y = ensurePdfSpace(doc, layout, y, mapHeight + 8);
  const distanceModel = getExportDistanceModel(entries);

  const capturedMap = await captureLeafletMapForPdf(entries, false, distanceModel);
  if (!capturedMap) {
    return drawPdfRouteMap(doc, layout, entries, y, false);
  }

  const x = layout.marginX;
  const width = layout.contentWidth;
  setPdfColor(doc, layout.softBorder, 'draw');
  doc.roundedRect(x, y, width, mapHeight, 3, 3, 'S');
  doc.addImage(capturedMap.dataUrl, 'JPEG', x, y, width, mapHeight, undefined, 'FAST');
  setPdfColor(doc, layout.softBorder, 'draw');
  doc.roundedRect(x, y, width, mapHeight, 3, 3, 'S');
  return y + mapHeight + 5;
}

function getPdfDistanceBlockHeight(distanceModel, detailed) {
  if (!detailed) return 30;
  const segmentRows = Math.max(distanceModel.segments.length, 1);
  const warningHeight = getPdfDistanceWarningText(distanceModel) ? 8 : 0;
  return 42 + warningHeight + segmentRows * 9.2;
}

function getPdfDistanceBlockTitle(distanceModel) {
  return distanceModel.mode === 'walking' ? 'Rutas a pie del dia' : 'Distancias lineales del dia';
}

function getPdfDistanceWarningText(distanceModel) {
  if (distanceModel.mode === 'walking') {
    const { pendingCount, errorCount, missingCount } = distanceModel.summary;
    if (missingCount) return 'Algunos tramos no pueden calcularse por falta de coordenadas.';
    if (errorCount) return 'Algunos tramos muestran una linea estimada por falta de respuesta de ruta.';
    if (pendingCount) return 'Algunos tramos siguen pendientes y muestran linea estimada.';
    return '';
  }

  return distanceModel.omittedCount ? 'Algunos tramos pueden omitirse si faltan coordenadas' : '';
}

function getPdfWalkingRouteSegmentMetric(segment) {
  if (segment.route?.status === 'ok') {
    return `${segment.route.durationText || formatRouteDuration(segment.route.durationSeconds)} | ${segment.route.distanceText || formatRouteDistance(segment.route.distanceMeters)}`;
  }
  if (segment.route?.status === 'pending') {
    const estimate = Number.isFinite(segment.linearDistanceKm)
      ? ` (${formatSegmentDistanceKm(segment.linearDistanceKm)})`
      : '';
    return `pendiente${estimate}`;
  }
  if (segment.route?.status === 'missing-coordinates') return 'sin coordenadas';
  if (segment.route?.status === 'error') return 'linea estimada';
  return 'pendiente';
}

function getDistanceKpiIconSvg(icon) {
  const icons = {
    ruler: `
      <svg class="distance-kpi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0z"/>
        <path d="m14.5 12.5 2-2"/>
        <path d="m11.5 9.5 2-2"/>
        <path d="m8.5 6.5 2-2"/>
        <path d="m17.5 15.5 2-2"/>
      </svg>
    `,
    segments: `
      <svg class="distance-kpi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="5" cy="19" r="2.5"/>
        <circle cx="12" cy="5" r="2.5"/>
        <circle cx="19" cy="19" r="2.5"/>
        <path d="M6.2 16.8 10.8 7.2"/>
        <path d="m13.2 7.2 4.6 9.6"/>
      </svg>
    `,
    mountain: `
      <svg class="distance-kpi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m8 3 4 8 5-5 5 15H2L8 3z"/>
      </svg>
    `
  };
  return icons[icon] || icons.ruler;
}

function renderDistanceKpiCard({ icon, value, label, note = '' }) {
  return `
    <div class="distance-kpi-card">
      ${getDistanceKpiIconSvg(icon)}
      <div>
        <div class="distance-kpi-head">
          <div class="distance-kpi-value">${escapeHtml(value)}</div>
          ${note ? `<div class="distance-kpi-note">${escapeHtml(note)}</div>` : ''}
        </div>
        <div class="distance-kpi-label">${escapeHtml(label)}</div>
      </div>
    </div>
  `;
}

function renderDistanceKpiCards(stats) {
  return `
    <div class="distance-kpi-grid">
      ${stats.map(renderDistanceKpiCard).join('')}
    </div>
  `;
}

function createPdfHtmlCaptureHost(html, widthPx, heightPx) {
  const host = document.createElement('div');
  host.style.cssText = `
    position: fixed;
    left: -12000px;
    top: 0;
    width: ${widthPx}px;
    min-height: ${heightPx}px;
    background: #ffffff;
    z-index: -1;
    pointer-events: none;
  `;
  host.innerHTML = html;
  document.body.appendChild(host);
  return host;
}

async function captureDistanceKpiCardsForPdf(stats, widthPx) {
  const html2canvas = getHtml2Canvas();
  if (!html2canvas || typeof document === 'undefined') return null;

  const heightPx = 64;
  const html = `
    <style>
      .distance-kpi-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
        margin: 0;
        width: ${widthPx}px;
        box-sizing: border-box;
        font-family: Arial, sans-serif;
      }
      .distance-kpi-card {
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: 64px;
        padding: 12px 14px;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        box-sizing: border-box;
      }
      .distance-kpi-icon {
        width: 24px;
        height: 24px;
        color: #ef476f;
        flex: 0 0 auto;
      }
      .distance-kpi-card > div {
        min-width: 0;
        flex: 1 1 auto;
      }
      .distance-kpi-head {
        display: flex;
        align-items: baseline;
        gap: 5px;
        min-width: 0;
      }
      .distance-kpi-value {
        font-size: 17px;
        line-height: 1.1;
        font-weight: 700;
        color: #0f172a;
        white-space: nowrap;
      }
      .distance-kpi-label {
        margin-top: 2px;
        font-size: 9.8px;
        line-height: 1.2;
        color: #64748b;
        white-space: normal;
      }
      .distance-kpi-note {
        font-size: 8.8px;
        line-height: 1.1;
        color: #94a3b8;
        white-space: nowrap;
        flex: 0 1 auto;
      }
    </style>
    ${renderDistanceKpiCards(stats)}
  `;
  const host = createPdfHtmlCaptureHost(html, widthPx, heightPx);

  try {
    const canvas = await html2canvas(host, {
      backgroundColor: '#ffffff',
      useCORS: true,
      allowTaint: false,
      logging: false,
      scale: 4,
      width: widthPx,
      height: heightPx,
      windowWidth: widthPx,
      windowHeight: heightPx
    });
    return {
      dataUrl: canvas.toDataURL('image/png'),
      widthPx,
      heightPx
    };
  } catch (error) {
    console.warn('No se pudieron capturar los KPIs de distancia para el PDF.', error);
    return null;
  } finally {
    host.remove();
  }
}

function drawPdfDistanceKpiFallback(doc, layout, stats, x, y, width) {
  const gap = 4;
  const cardHeight = 20;
  const statWidth = (width - gap * 2) / 3;
  stats.forEach((stat, index) => {
    const cardX = x + (statWidth + gap) * index;
    setPdfColor(doc, '#ffffff', 'fill');
    setPdfColor(doc, layout.softBorder, 'draw');
    doc.setLineWidth(0.3);
    doc.roundedRect(cardX, y, statWidth, cardHeight, 3, 3, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    setPdfColor(doc, layout.dark);
    doc.text(toPdfText(stat.value), cardX + 5, y + 7);
    if (stat.note) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.4);
      setPdfColor(doc, layout.muted);
      doc.text(toPdfText(stat.note), cardX + 5, y + 10.5);
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.1);
    setPdfColor(doc, layout.muted);
    doc.text(toPdfText(stat.label), cardX + 5, y + 15.2);
  });
  return y + cardHeight + 4;
}

function drawPdfDistanceTitleIcon(doc, x, y, color) {
  setPdfColor(doc, color, 'draw');
  doc.setLineWidth(0.45);
  doc.line(x + 1.4, y + 5, x + 4.4, y + 1.7);
  doc.line(x + 5.2, y + 1.7, x + 8.2, y + 5);
  setPdfColor(doc, '#ffffff', 'fill');
  setPdfColor(doc, color, 'draw');
  doc.circle(x + 1, y + 5.4, 1.05, 'FD');
  doc.circle(x + 4.8, y + 1.3, 1.05, 'FD');
  doc.circle(x + 8.6, y + 5.4, 1.05, 'FD');
}

function drawPdfOrderArrow(doc, layout, fromX, toX, y) {
  const startX = fromX + 3.3;
  const endX = toX - 3.3;
  setPdfColor(doc, layout.muted, 'draw');
  doc.setLineWidth(0.35);
  doc.line(startX, y, endX, y);
  doc.line(endX, y, endX - 1.2, y - 0.9);
  doc.line(endX, y, endX - 1.2, y + 0.9);
}

async function drawPdfDistanceBlock(doc, layout, dayData, y, detailed) {
  const distance = getExportDistanceModel(dayData.entries);
  const height = getPdfDistanceBlockHeight(distance, detailed);
  y = ensurePdfSpace(doc, layout, y, height + 4);

  const x = layout.marginX;
  const cardTop = y;
  const width = layout.contentWidth;
  setPdfColor(doc, '#ffffff', 'fill');
  setPdfColor(doc, layout.softBorder, 'draw');
  doc.setLineWidth(0.35);
  doc.roundedRect(x, y, width, height, 4, 4, 'FD');

  y += 9;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setPdfColor(doc, layout.dark);
  drawPdfDistanceTitleIcon(doc, x + 4, y - 5.3, layout.dark);
  doc.text(getPdfDistanceBlockTitle(distance), x + 16, y);
  y += 8;

  const longestText = distance.summary.longestSegment
    ? distance.mode === 'walking'
      ? formatRouteDistance(distance.summary.longestSegment.route?.distanceMeters)
      : formatSegmentDistanceKm(distance.summary.longestSegment.distanceKm)
    : 'N/D';

  if (!detailed) {
    const line = distance.mode === 'walking'
      ? [
          `${formatRouteDistance(distance.summary.distanceMeters)} a pie${distance.summary.estimatedLinearDistanceKm > 0 ? ` (+ ${formatSegmentDistanceKm(distance.summary.estimatedLinearDistanceKm)} lineales estimados)` : ''}`,
          `${formatRouteDuration(distance.summary.durationSeconds)} desplazamientos`,
          `${distance.summary.segmentCount} tramos`,
          `tramo mas largo ${longestText}`,
          `dispersion: ${distance.densityLabel}`
        ].join(' | ')
      : [
          `${formatTotalDistanceKm(distance.summary.totalDistanceKm)} lineales`,
          `${distance.summary.segmentCount} tramos`,
          `tramo mas largo ${longestText}`,
          `dispersion: ${distance.densityLabel}`
        ].join(' | ');
    y = drawWrappedPdfText(doc, line, x + 5, y + 2, width - 10, {
      fontSize: 8,
      lineHeight: 3.8,
      color: layout.muted,
      bold: true
    });
    return cardTop + height + 4;
  }

  const kpiStats = [{
    icon: 'ruler',
    value: distance.mode === 'walking'
      ? formatRouteDistance(distance.summary.distanceMeters)
      : formatTotalDistanceKm(distance.summary.totalDistanceKm),
    label: distance.mode === 'walking'
      ? `distancia a pie total${distance.summary.estimatedLinearDistanceKm > 0 ? ' (+ estimada)' : ''}`
      : 'distancia lineal total',
    note: distance.mode === 'walking' && distance.summary.estimatedLinearDistanceKm > 0
      ? `(+ ${formatSegmentDistanceKm(distance.summary.estimatedLinearDistanceKm)} lineales estimados)`
      : ''
  }, {
    icon: 'segments',
    value: String(distance.summary.segmentCount),
    label: 'tramos'
  }, {
    icon: 'mountain',
    value: longestText,
    label: distance.mode === 'walking' ? 'tramo a pie mas largo' : 'tramo mas largo'
  }];
  const kpiWidthMm = width - 8;
  const cssPxPerMm = 96 / 25.4;
  const kpiCaptureWidthPx = Math.round(kpiWidthMm * cssPxPerMm);
  const kpiImage = await captureDistanceKpiCardsForPdf(kpiStats, kpiCaptureWidthPx);
  if (kpiImage) {
    const kpiHeightMm = kpiWidthMm * (kpiImage.heightPx / kpiImage.widthPx);
    doc.addImage(kpiImage.dataUrl, 'PNG', x + 4, y, kpiWidthMm, kpiHeightMm);
    y += kpiHeightMm + 4;
  } else {
    y = drawPdfDistanceKpiFallback(doc, layout, kpiStats, x + 4, y, width - 8);
  }

  const warningText = getPdfDistanceWarningText(distance);
  if (warningText) {
    setPdfColor(doc, '#fffbeb', 'fill');
    setPdfColor(doc, '#fde68a', 'draw');
    doc.roundedRect(x + 4, y, width - 8, 6, 2, 2, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    setPdfColor(doc, '#92400e');
    doc.text(toPdfText(warningText), x + 8, y + 4);
    y += 8;
  }

  if (!distance.segments.length) {
    y = drawWrappedPdfText(doc, distance.mode === 'walking' ? 'Sin tramos a pie calculables.' : 'Sin tramos calculables en linea recta.', x + 5, y + 3, width - 10, {
      fontSize: 7,
      lineHeight: 3.6,
      color: layout.muted
    });
    return cardTop + height + 4;
  }

  distance.segments.forEach((segment) => {
    const rowTop = y;
    setPdfColor(doc, layout.softBorder, 'draw');
    doc.setLineWidth(0.25);
    doc.line(x + 4, rowTop + 7.2, x + width - 4, rowTop + 7.2);

    setPdfColor(doc, '#ffffff', 'fill');
    setPdfColor(doc, layout.softBorder, 'draw');
    doc.setLineWidth(0.3);
    doc.circle(x + 8, rowTop + 3.6, 2.35, 'FD');
    doc.circle(x + 18.5, rowTop + 3.6, 2.35, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.4);
    setPdfColor(doc, layout.muted);
    doc.text(String(segment.fromOrder), x + 8, rowTop + 3.65, { align: 'center', baseline: 'middle' });
    doc.text(String(segment.toOrder), x + 18.5, rowTop + 3.65, { align: 'center', baseline: 'middle' });
    drawPdfOrderArrow(doc, layout, x + 8, x + 18.5, rowTop + 3.6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    setPdfColor(doc, layout.dark);
    const nameText = fitPdfTextToWidth(
      doc,
      `${segment.fromPlace.name} -> ${segment.toPlace.name}`,
      width - 64
    );
    doc.text(nameText, x + 30, rowTop + 4.2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    setPdfColor(doc, layout.dark);
    const segmentMetric = distance.mode === 'walking'
      ? getPdfWalkingRouteSegmentMetric(segment)
      : formatSegmentDistanceKm(segment.distanceKm);
    doc.text(toPdfText(segmentMetric), x + width - 5, rowTop + 4.2, { align: 'right' });
    y += 9.2;
  });

  return cardTop + height + 4;
}

function getPdfActivityMeta(place) {
  if (place.entityType === 'location') {
    const kind = getLocationKindConfig(place.plannerKind);
    return `${kind.label} - ${place.type || 'Ubicacion logistica'}${place.cityId ? ` - ${getCityName(place.cityId)}` : ''}`;
  }
  const category = categories.find((item) => item.id === place.category);
  return `${getCityName(place.cityId)} · ${place.zone || 'Zona pendiente'} · ${category?.label || place.category || 'Categoria'}`;
}

function getPdfPriorityEmoji(priority) {
  if (priority === 'must-see') return '\u{1F525}';
  if (priority === 'recommended') return '\u{1F44D}';
  return '\u{1F4A1}';
}

function getPdfActivityChips(place) {
  if (place.entityType === 'location') {
    const kind = getLocationKindConfig(place.plannerKind);
    return [
      { label: kind.label, icon: 'priority', emoji: kind.icon, tone: place.plannerKind === 'accommodation' ? 'info' : 'success' },
      { label: place.type || 'Ubicacion', icon: 'other', emoji: kind.icon, tone: 'neutral' }
    ];
  }
  const priority = priorityLabels[place.priority];
  const priorityTone = place.priority === 'must-see'
    ? 'danger'
    : place.priority === 'recommended'
      ? 'warning'
      : 'neutral';
  return [
    { label: priority?.label || 'Opcional', icon: 'priority', emoji: getPdfPriorityEmoji(place.priority), tone: priorityTone },
    { label: place.estimatedDuration || 'Duracion pendiente', icon: 'clock', emoji: '\u{1F552}', tone: 'neutral' },
    { label: formatBestTimeLabel(place.bestTime), icon: 'sun', emoji: '\u2600\uFE0F', tone: 'sun' },
    { label: place.rainyFriendly ? 'Apta lluvia' : 'Evitar lluvia', icon: 'rain', emoji: place.rainyFriendly ? '\u2614' : '\u{1F327}\uFE0F', tone: place.rainyFriendly ? 'rain' : 'neutral' },
    { label: place.requiresTicket ? 'Requiere entrada' : 'No requiere entrada', icon: 'ticket', emoji: '\u{1F3AB}', tone: place.requiresTicket ? 'info' : 'success' },
    formatScore(place.score) ? { label: formatScore(place.score), icon: 'score', emoji: '\u2B50', tone: 'score' } : null
  ].filter(Boolean);
}

function getPdfActivitySections(place) {
  if (place.entityType === 'location') {
    return [
      place.address ? { label: 'Direccion', value: place.address } : null,
      place.comment ? { label: 'Nota', value: place.comment } : null
    ].filter(Boolean);
  }
  return [
    place.address ? { label: 'Direccion', value: place.address } : null,
    place.ticketInfo ? { label: 'Entrada', value: place.ticketInfo } : null,
    place.tips ? { label: 'Consejo practico', value: place.tips } : null,
    place.comment ? { label: 'Nota', value: place.comment } : null
  ].filter(Boolean);
}

function getPdfChipLabel(chip) {
  return typeof chip === 'string' ? chip : chip?.label || '';
}

function getPdfChipColors(chip, layout) {
  const palettes = {
    danger: { bg: '#fff1f2', border: '#fecdd3', text: '#e11d48', icon: '#ef4444' },
    warning: { bg: '#fff7ed', border: '#fed7aa', text: '#c2410c', icon: '#f97316' },
    sun: { bg: '#fffbeb', border: '#fde68a', text: '#92400e', icon: '#f59e0b' },
    rain: { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', icon: '#2563eb' },
    info: { bg: '#eef2ff', border: '#c7d2fe', text: '#4338ca', icon: '#4f46e5' },
    success: { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', icon: '#16a34a' },
    score: { bg: '#fffbeb', border: '#fde68a', text: '#92400e', icon: '#f59e0b' },
    neutral: { bg: '#f8fafc', border: layout.softBorder, text: layout.muted, icon: '#475569' }
  };
  return palettes[chip?.tone] || palettes.neutral;
}

function getPdfChipWidth(doc, chip) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.85);
  const textWidth = doc.getTextWidth(toPdfText(getPdfChipLabel(chip)));
  if (chip?.icon === 'score') {
    return Math.min(Math.max(textWidth + 7.4, 15.8), 20);
  }
  return Math.min(Math.max(textWidth + 9.3, 18), 64);
}

function fitPdfTextToWidth(doc, text, width) {
  const cleanText = toPdfText(text);
  if (doc.getTextWidth(cleanText) <= width) return cleanText;
  let result = cleanText;
  while (result.length > 1 && doc.getTextWidth(`${result}...`) > width) {
    result = result.slice(0, -1);
  }
  return `${result.trim()}...`;
}

function measurePdfChipRows(doc, chips, width) {
  let rows = 1;
  let currentWidth = 0;
  chips.forEach((chip) => {
    const chipWidth = getPdfChipWidth(doc, chip);
    const nextWidth = currentWidth ? currentWidth + 2 + chipWidth : chipWidth;
    if (nextWidth > width && currentWidth) {
      rows += 1;
      currentWidth = chipWidth;
    } else {
      currentWidth = nextWidth;
    }
  });
  return rows;
}

function getPdfEmojiImage(emoji) {
  if (!emoji || typeof document === 'undefined') return null;
  if (_pdfEmojiCache.has(emoji)) return _pdfEmojiCache.get(emoji);

  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = '64px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 48, 50);

  const dataUrl = canvas.toDataURL('image/png');
  _pdfEmojiCache.set(emoji, dataUrl);
  return dataUrl;
}

function drawPdfChipIcon(doc, chip, x, y, colors) {
  const emojiImage = getPdfEmojiImage(chip.emoji);
  if (emojiImage) {
    doc.addImage(emojiImage, 'PNG', x, y + 0.15, 3.2, 3.2, undefined, 'FAST');
    return;
  }

  setPdfColor(doc, colors.icon, 'draw');
  setPdfColor(doc, colors.icon, 'fill');
  doc.setLineWidth(0.35);
  if (chip.icon === 'clock') {
    doc.circle(x + 1.7, y + 2.75, 1.55, 'S');
    doc.line(x + 1.7, y + 2.75, x + 1.7, y + 1.75);
    doc.line(x + 1.7, y + 2.75, x + 2.55, y + 2.95);
  } else if (chip.icon === 'sun') {
    doc.circle(x + 1.7, y + 2.75, 1.15, 'S');
    doc.line(x + 1.7, y + 0.8, x + 1.7, y + 0.1);
    doc.line(x + 1.7, y + 4.7, x + 1.7, y + 5.4);
    doc.line(x - 0.2, y + 2.75, x - 0.85, y + 2.75);
    doc.line(x + 3.6, y + 2.75, x + 4.25, y + 2.75);
  } else if (chip.icon === 'rain') {
    doc.roundedRect(x + 0.2, y + 1.65, 3.2, 1.7, 0.8, 0.8, 'S');
    doc.line(x + 1, y + 4.1, x + 0.7, y + 4.8);
    doc.line(x + 2.2, y + 4.1, x + 1.9, y + 4.8);
  } else if (chip.icon === 'ticket') {
    doc.roundedRect(x + 0.1, y + 1.55, 3.5, 2.4, 0.35, 0.35, 'S');
    doc.line(x + 1.15, y + 1.55, x + 1.15, y + 3.95);
  } else {
    doc.circle(x + 1.7, y + 2.75, 1.45, 'S');
    doc.line(x + 1.7, y + 1.65, x + 1.7, y + 3.05);
    doc.circle(x + 1.7, y + 3.75, 0.2, 'F');
  }
}

function drawPdfChip(doc, x, y, chip, layout) {
  const chipWidth = getPdfChipWidth(doc, chip);
  const colors = getPdfChipColors(chip, layout);
  const isScoreChip = chip?.icon === 'score';
  setPdfColor(doc, colors.bg, 'fill');
  setPdfColor(doc, colors.border, 'draw');
  doc.roundedRect(x, y, chipWidth, 5.7, 2.85, 2.85, 'FD');
  drawPdfChipIcon(doc, chip, x + (isScoreChip ? 1.75 : 2.2), y + 1.1, colors);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.85);
  setPdfColor(doc, colors.text);
  const text = fitPdfTextToWidth(doc, getPdfChipLabel(chip), chipWidth - (isScoreChip ? 7.2 : 8.9));
  const textWidth = doc.getTextWidth(text);
  const textAreaX = x + (isScoreChip ? 4.55 : 5.35);
  const textAreaWidth = chipWidth - (isScoreChip ? 5.45 : 6.35);
  const textCenter = textAreaX + textAreaWidth / 2;
  doc.text(text, textCenter - textWidth / 2, y + 3.55);
  return chipWidth;
}

function drawPdfChipRow(doc, chips, x, y, width, layout) {
  let currentX = x;
  let currentY = y;
  chips.forEach((chip) => {
    const chipWidth = getPdfChipWidth(doc, chip);
    if (currentX > x && currentX + chipWidth > x + width) {
      currentX = x;
      currentY += 7.3;
    }
    drawPdfChip(doc, currentX, currentY, chip, layout);
    currentX += chipWidth + 2;
  });
  return currentY + 7;
}

function measurePdfActivity(doc, layout, place, detailed) {
  const cardPadding = 7;
  const contentWidth = layout.contentWidth - cardPadding * 2 - 13;
  const titleWidth = contentWidth - 26;
  let height = cardPadding;
  height += doc.splitTextToSize(toPdfText(place.name), titleWidth).length * 4.8;
  height += 3.2;

  if (!detailed) return height + 8;

  height += measurePdfChipRows(doc, getPdfActivityChips(place), contentWidth) * 7.3 + 4.1;
  getPdfActivitySections(place).forEach((section) => {
    height += 3.8;
    height += doc.splitTextToSize(toPdfText(section.value), contentWidth).length * 3.7;
    height += 1.1;
  });
  return height + cardPadding - 2.5;
}

function drawPdfActivity(doc, layout, entry, y, detailed) {
  const { place, exportOrder } = entry;
  const height = measurePdfActivity(doc, layout, place, detailed);
  y = ensurePdfSpace(doc, layout, y, height);
  const x = layout.marginX;
  const cardTop = y;
  const cardPadding = 7;
  const badgeCenterX = x + cardPadding + 3.5;
  const contentX = x + cardPadding + 13;
  const contentWidth = layout.contentWidth - cardPadding * 2 - 13;
  const mapsUrl = getGoogleMapsUrl(place, _globalSettings?.mapLinkStyle);
  const linkWidth = 22;

  setPdfColor(doc, '#ffffff', 'fill');
  setPdfColor(doc, layout.softBorder, 'draw');
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, layout.contentWidth, height - 1, 3, 3, 'FD');

  y += cardPadding + 2.4;

  setPdfColor(doc, '#f8fafc', 'fill');
  setPdfColor(doc, layout.softBorder, 'draw');
  doc.circle(badgeCenterX, y - 0.9, 4.15, 'FD');
  setPdfColor(doc, layout.dark, 'fill');
  doc.circle(badgeCenterX, y - 0.9, 3.45, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(255, 255, 255);
  doc.text(String(exportOrder), badgeCenterX, y - 0.85, { align: 'center', baseline: 'middle' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.2);
  setPdfColor(doc, layout.dark);
  const titleLines = doc.splitTextToSize(toPdfText(place.name), contentWidth - linkWidth - 4);
  doc.text(titleLines, contentX, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.3);
  doc.setTextColor(37, 99, 235);
  const linkX = x + layout.contentWidth - cardPadding - linkWidth;
  if (typeof doc.textWithLink === 'function') {
    doc.textWithLink('Abrir mapa', linkX, y, { url: mapsUrl });
  } else {
    doc.text('Abrir mapa', linkX, y);
    doc.link(linkX, y - 3.5, linkWidth, 5, { url: mapsUrl });
  }

  y += titleLines.length * 4.8 + 0.2;

  y = drawWrappedPdfText(doc, getPdfActivityMeta(place), contentX, y, contentWidth, {
    fontSize: 7.4,
    lineHeight: 3.7,
    color: layout.muted,
    bold: true
  }) + 0.35;

  if (detailed) {
    y = drawPdfChipRow(doc, getPdfActivityChips(place), contentX, y, contentWidth, layout) + 3.8;

    getPdfActivitySections(place).forEach((section) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      setPdfColor(doc, layout.muted);
      doc.text(toPdfText(section.label).toUpperCase(), contentX, y);
      y += 3.6;
      y = drawWrappedPdfText(doc, section.value, contentX, y, contentWidth, {
        fontSize: section.label === 'Nota' ? 7 : 7.2,
        lineHeight: 3.7,
        color: section.label === 'Nota' ? layout.muted : '#263244',
        bold: false
      }) + 1.4;
    });
  } else {
    const priority = priorityLabels[place.priority];
    y = drawWrappedPdfText(doc, `${place.zone || ''} · ${place.estimatedDuration || ''} · ${priority?.label || ''} · ${formatBestTimeLabel(place.bestTime)}`, contentX, y, contentWidth, {
      fontSize: 7.6,
      lineHeight: 4,
      color: layout.muted
    });
  }

  return Math.max(y + 0.8, cardTop + height + 0.8);
}

function addPdfPageNumbers(doc, layout) {
  const pageCount = doc.internal.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Japon 2026 · ${page}/${pageCount}`, layout.marginX, layout.pageHeight - 7);
  }
}

async function drawPlannerPdf(days, exportType, scopeLabel) {
  const JsPDF = getJsPdfConstructor();
  if (!JsPDF) return null;

  const doc = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const layout = createPdfLayout(doc);
  let y = drawPdfCover(doc, layout, days, exportType);
  const detailed = exportType === 'detailed';

  for (const [index, dayData] of days.entries()) {
    if (index > 0 && detailed) {
      doc.addPage();
      y = layout.marginTop;
    } else if (index > 0) {
      y = ensurePdfSpace(doc, layout, y, 60);
    }

    y = drawPdfDayHeader(doc, layout, dayData, y);
    y = await drawPdfRouteMapWithFallback(doc, layout, dayData.entries, y, false);
    y = await drawPdfDistanceBlock(doc, layout, dayData, y, detailed);
    dayData.entries.forEach((entry) => {
      y = drawPdfActivity(doc, layout, entry, y, detailed);
    });
    y += 4;
  }

  addPdfPageNumbers(doc, layout);
  return doc;
}

async function generatePlannerPdf({ scope, exportType, selectedDay }) {
  const days = getExportDays(scope, selectedDay);
  if (!days.length) {
    showToast('No hay actividades planificadas para exportar en ese alcance.', 'info');
    return;
  }

  try {
    const filenameScope = scope === 'day' ? `dia-${selectedDay}` : 'viaje-completo';
    const scopeLabel = scope === 'day' ? `Dia ${selectedDay}` : 'Todo el viaje';
    const pdf = await drawPlannerPdf(days, exportType, scopeLabel);
    if (!pdf) {
      showToast('La libreria PDF no esta disponible. Recarga la pagina e intentalo de nuevo.', 'info');
      return;
    }
    pdf.save(`japon-2026-itinerario-${filenameScope}-${exportType}.pdf`);
    showToast('PDF generado correctamente.');
    closePlannerExportModal();
  } catch (error) {
    console.error(error);
    showToast('No se pudo generar el PDF. Revisa los datos del itinerario e intentalo de nuevo.', 'info');
  }
}

function buildNav(plannerLink) {
  return `
    <nav class="nav" id="main-nav">
      <div class="nav-inner">
        <a href="/" class="nav-logo">&#x1F1EF;&#x1F1F5; Jap&oacute;n 2026 <span class="ja">&#26085;&#26412;</span></a>
        <div class="nav-links">
          <a href="/">Inicio</a>
          <span class="nav-separator" aria-hidden="true">|</span>
          ${_citiesArray.map((c) => `<a href="/city.html?id=${c.id}">${c.name}</a>`).join('')}
          <span class="nav-separator" aria-hidden="true">|</span>
          ${plannerLink}
          <div class="nav-tools">
            <a href="/admin.html" class="nav-tool-btn" title="Admin">&#x2699;&#xFE0F;</a>
          </div>
        </div>
        <div class="nav-mobile-tools">
          <a href="/admin.html" class="nav-tool-btn">&#x2699;&#xFE0F;</a>
          ${renderMobileMenu('mobile-toggle', 'mobile-menu', `
            <a href="/">Inicio</a>
            ${_citiesArray.map((c) => `<a href="/city.html?id=${c.id}">${c.name}</a>`).join('')}
            ${plannerLink}
          `)}
        </div>
      </div>
    </nav>
  `;
}

function renderPlannerPage() {
  _viewMode = getPlannerViewModeFromUrl() || _viewMode;
  const focusState = captureInputFocusState();
  destroyPlannerMap();

  const filteredPlaces = getFilteredPlannerPlaces();
  const groups = buildGroupedData(filteredPlaces);
  const plannerLink = `<a href="/planner.html" style="color:var(--accent); font-weight:bold;">&#x1F5D3;&#xFE0F; Planner</a>`;
  const trayCount = groups.tray.length + groups.unassigned.length;
  const plannedCount = Array.from({ length: _totalTripDays }, (_, i) => i + 1)
    .reduce((acc, day) => acc + groups[day].length, 0);
  const doneCount = _plannerItems.filter((p) => p.status === 'done' && _places.some((pl) => pl.id === p.placeId)).length;

  _selectedMapScope = normalizeMapScope(_selectedMapScope);
  const mapModel = buildMapModel(_selectedMapScope, groups);

  const getDaySummary = (entries) => {
    const parts = splitItineraryEntries(entries);
    const totalMinutes = entries.reduce((sum, entry) => {
      const minutes = entry.entryType === 'location-stop'
        ? Number(entry.stop?.durationMinutes)
        : entry.entryType === 'activity'
          ? parseEstimatedDurationToMinutes(entry.place?.estimatedDuration)
          : null;
      return Number.isFinite(minutes) ? sum + minutes : sum;
    }, 0);

    const formattedDuration = formatDurationMinutes(totalMinutes, { approximate: true });
    return {
      activityText: `${parts.activities.length} actividad${parts.activities.length !== 1 ? 'es' : ''}`,
      logisticsText: parts.stops.length ? `${parts.stops.length} parada${parts.stops.length !== 1 ? 's' : ''}` : null,
      durationText: formattedDuration ? `~ ${formattedDuration}` : null
    };
  };

  const daysHtml = Array.from({ length: _totalTripDays }, (_, i) => {
    const day = i + 1;
    const entries = getComposedDayEntries(day, groups);
    const summary = getDaySummary(entries);
    const routeAction = entries.length ? renderGoogleMapsRouteButton(entries, 'planner-day-inline-route') : '';
    const coordinateWarning = renderDayCoordinateWarning(entries);
    const isCollapsed = isPlannerDayCollapsed(day);
    return `
      <div class="planner-day-block ${isCollapsed ? 'is-collapsed' : ''}" data-day="${day}">
        <div class="planner-day-header">
          ${renderDayCollapseButton(day)}
          <div class="planner-day-number">${day}</div>
          <div class="planner-day-summary">
            <div class="planner-day-label">${formatDayLabel(day)}</div>
            <div class="planner-day-count">
              <span>${summary.activityText}</span>
              ${summary.logisticsText ? `<span class="planner-day-summary-sep">&middot;</span><span>${summary.logisticsText}</span>` : ''}
              ${summary.durationText ? `<span class="planner-day-summary-sep">&middot;</span><span>${summary.durationText}</span>` : ''}
              ${coordinateWarning ? `<span class="planner-day-summary-sep">&middot;</span>${coordinateWarning}` : ''}
            </div>
          </div>
          <div class="planner-day-header-actions">
            <button type="button" class="planner-day-map-btn planner-day-location-btn" data-stop-add="${day}">+ Parada</button>
            <button type="button" class="planner-day-map-btn planner-day-location-btn" data-day-plan-open="${day}">Inicio/fin</button>
            ${routeAction}
            ${entries.length ? renderDayMapSummaryButton(day) : ''}
            ${entries.length ? renderRouteValidationToggle(day) : ''}
          </div>
        </div>
        <div class="planner-day-cards" id="planner-day-cards-${day}">
          ${renderDayPlannerCards(entries, day)}
        </div>
      </div>`;
  }).join('');

  const combined = [...groups.tray, ...groups.unassigned];
  const trayHtml = combined.length === 0
    ? `<div class="planner-empty-day">&#x1F389; Todas las actividades est&aacute;n asignadas</div>`
    : combined.map(({ place, item }) => renderMiniCard(place, item)).join('');

  const calendarLayout = `
    <div class="planner-layout">
      <aside class="planner-tray" id="planner-tray">
        <div class="planner-tray-header">
          <h3>&#x1F4E5; Bandeja <span class="zone-count">${trayCount}</span></h3>
          <p>Actividades pendientes de asignar a un d&iacute;a</p>
        </div>
        <div class="planner-tray-cards">${trayHtml}</div>
      </aside>
      <main class="planner-days">${daysHtml}</main>
    </div>
  `;

  app.innerHTML = `
    ${buildNav(plannerLink)}

    <div class="planner-hero">
      <div class="planner-hero-content">
        <div class="home-hero-badge">&#x1F5D3;&#xFE0F; Planificador de Itinerario</div>
        <h1>Mi Ruta por Jap&oacute;n</h1>
        <p>Organiza tu viaje d&iacute;a a d&iacute;a. Pulsa cualquier actividad para ver detalles o cambia su estado con el chip.</p>
        <div class="planner-stats">
          <div class="planner-stat"><span class="planner-stat-number">${_totalTripDays}</span><span>d&iacute;as</span></div>
          <div class="planner-stat"><span class="planner-stat-number">${plannedCount}</span><span>planificadas</span></div>
          <div class="planner-stat"><span class="planner-stat-number">${trayCount}</span><span>en bandeja</span></div>
          <div class="planner-stat"><span class="planner-stat-number">${doneCount}</span><span>realizadas</span></div>
        </div>
      </div>
    </div>

    ${renderPlannerFilters(filteredPlaces.length)}

    ${_viewMode === 'calendar' ? calendarLayout : renderMapPanel(mapModel)}

    <div class="modal-overlay" id="planner-modal-overlay">
      <div class="modal" id="planner-modal"></div>
    </div>
    <div class="modal-overlay" id="planner-export-overlay">
      <div class="modal" id="planner-export-modal"></div>
    </div>
    <div class="modal-overlay" id="planner-day-map-overlay">
      <div class="modal planner-day-map-modal" id="planner-day-map-modal"></div>
    </div>
  `;

  bindMobileNav('mobile-toggle', 'mobile-menu');
  attachPlannerFilterEvents();
  restoreInputFocusState(focusState);
  restoreTransientUiState();

  if (_viewMode === 'calendar') {
    initSortable();
  } else {
    renderPlannerMap(mapModel);
  }
}

function renderPlannerMap(model) {
  const mapContainer = document.getElementById('planner-map-container');
  if (!mapContainer || model.mappedCount === 0 || typeof L === 'undefined') return;

  try {
    _plannerMap = initLeafletMap('planner-map-container', DEFAULT_MAP_CENTER, 5, {
      controls: true,
      showLocate: true,
      showFullscreen: true,
      showFitBounds: true
    });

    renderPlannerTravelMap(_plannerMap, model, {
      categories,
      priorityLabels,
      citiesArray: _citiesArray,
      formatScore,
      mapLinkStyle: _globalSettings?.mapLinkStyle,
      onPlaceClick: openPlaceModal
    });
  } catch (error) {
    console.error('No se pudo renderizar el mapa del planner.', error);
    mapContainer.insertAdjacentHTML('afterend', '<div class="planner-map-distance-warning">No se pudo cargar el mapa. Recarga la pagina o vuelve a Calendario.</div>');
  }
}

function attachPlannerFilterEvents() {
  const searchInput = document.getElementById('planner-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', debounce((event) => {
      _plannerFilterState.search = event.target.value;
      renderPlannerPage();
    }, 200));
  }

  document.getElementById('planner-search-clear')?.addEventListener('click', () => {
    _plannerFilterState.search = '';
    renderPlannerPage();
    requestAnimationFrame(() => {
      document.getElementById('planner-search-input')?.focus({ preventScroll: true });
    });
  });

  document.getElementById('planner-export-btn')?.addEventListener('click', openPlannerExportModal);

  document.querySelectorAll('[data-planner-filter-target]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.plannerFilterTarget;
      if (!Object.prototype.hasOwnProperty.call(_plannerFilterState, key)) return;
      _plannerFilterState[key] = button.dataset.value || '';
      renderPlannerPage();
    });
  });

  document.querySelectorAll('input[data-planner-score-band]').forEach((input) => {
    input.addEventListener('change', () => {
      const value = input.dataset.plannerScoreBand;
      _plannerScoreDropdownOpen = true;
      if (value === 'all') {
        _plannerFilterState.scoreBands = [];
      } else if (input.checked) {
        _plannerFilterState.scoreBands = Array.from(new Set([..._plannerFilterState.scoreBands, value]));
      } else {
        _plannerFilterState.scoreBands = _plannerFilterState.scoreBands.filter((band) => band !== value);
      }
      renderPlannerPage();
    });
  });

  document.querySelector('.score-filter-group')?.addEventListener('toggle', (event) => {
    _plannerScoreDropdownOpen = event.currentTarget.open;
  });

  document.querySelectorAll('.filter-dropdown').forEach((dropdown) => {
    dropdown.addEventListener('toggle', (event) => {
      if (!event.currentTarget.open) return;
      document.querySelectorAll('.filter-dropdown[open]').forEach((otherDropdown) => {
        if (otherDropdown !== event.currentTarget) otherDropdown.removeAttribute('open');
      });
      _plannerScoreDropdownOpen = event.currentTarget.classList.contains('score-filter-group');
    });
  });

  document.querySelectorAll('[data-planner-priority]').forEach((button) => {
    button.addEventListener('click', () => {
      const value = button.dataset.plannerPriority;
      _plannerFilterState.priority = _plannerFilterState.priority === value ? '' : value;
      renderPlannerPage();
    });
  });

  document.getElementById('planner-clear-filters')?.addEventListener('click', () => {
    _plannerFilterState = { search: '', cityId: '', priority: '', scoreBands: [] };
    _plannerScoreDropdownOpen = false;
    renderPlannerPage();
  });
}

function openPlaceModal(place) {
  const overlay = document.getElementById('planner-modal-overlay');
  const modal = document.getElementById('planner-modal');
  if (!overlay || !modal) return;

  modal.innerHTML = place.entityType === 'location' ? renderLocationModal(place) : renderModal(place);
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  document.getElementById('planner-modal-close')?.addEventListener('click', closePlaceModal);
  if (place.entityType !== 'location') {
    document.getElementById('planner-edit-place-btn')?.addEventListener('click', () => openPlannerPlaceEditor(place));
  }
  setTimeout(() => {
    if (hasValidCoordinates(place)) renderPlaceMap(`modal-map-${place.id}`, place);
  }, 100);
}

function renderLocationModal(place) {
  const location = getLocation(place.sourceLocationId);
  if (!location) return '';
  const kind = getLocationKindConfig(location.kind);
  const mapsUrl = getGoogleMapsUrl(place, _globalSettings?.mapLinkStyle);
  return `
    <div class="modal-scroll">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <div>
          <div class="place-card-category">${kind.icon} ${escapeHtml(kind.label)}</div>
          <h2>${escapeHtml(location.name)}</h2>
        </div>
        <button class="modal-close" id="planner-modal-close">&#x2715;</button>
      </div>
      <div class="modal-body">
        <div class="modal-badges">
          <span class="priority-badge priority-optional">${escapeHtml(getLocationSubtypeLabel(location.kind, location.subtype))}</span>
          ${location.cityId ? `<span class="priority-badge priority-recommended">${escapeHtml(getCityName(location.cityId))}</span>` : ''}
        </div>
        ${location.address ? `<div class="modal-info-section"><h4>Direccion</h4><p>${escapeHtml(location.address)}</p></div>` : ''}
        ${location.notes ? `<div class="modal-info-section"><h4>Notas</h4><p>${escapeHtml(location.notes)}</p></div>` : ''}
        <a href="${mapsUrl}" target="_blank" rel="noopener" class="maps-link-btn">Abrir en Google Maps</a>
        ${hasValidCoordinates(place) ? `<div id="modal-map-${escapeHtml(place.id)}" class="modal-map"></div>` : ''}
      </div>
    </div>
  `;
}

function openPlannerPlaceEditor(place) {
  if (!place?.id || !place?.cityId) return;
  try {
    sessionStorage.setItem('pendingPlaceEdit', JSON.stringify({
      placeId: place.id,
      createdAt: Date.now()
    }));
  } catch {
    // If sessionStorage is unavailable, the URL parameter still opens the editor.
  }
  window.location.href = `/city.html?id=${encodeURIComponent(place.cityId)}&editPlace=${encodeURIComponent(place.id)}`;
}

function openPlannerStopModal(day, stopId = null) {
  const overlay = document.getElementById('planner-modal-overlay');
  const modal = document.getElementById('planner-modal');
  if (!overlay || !modal) return;
  const existing = stopId ? getPlannerStop(stopId) : null;
  const draft = normalizePlannerStopRecord(existing || {
    id: '',
    assignedDay: Number(day),
    locationId: '',
    purpose: '',
    note: '',
    durationMinutes: null,
    travelModeFromPrevious: 'walking'
  });
  const hasLocations = _locations.some((location) => location.active !== false);

  modal.innerHTML = `
    <div class="modal-scroll">
      <div class="modal-header">
        <div>
          <div class="place-card-category">Parada logistica</div>
          <h2>${existing ? 'Editar parada' : `Anadir parada al dia ${day}`}</h2>
        </div>
        <button class="modal-close" id="planner-modal-close">&#x2715;</button>
      </div>
      <div class="modal-body">
        <form id="planner-stop-form" class="admin-form">
          <div class="form-group">
            <label>Ubicacion *</label>
            ${renderPlannerLocationPicker({
              id: 'planner-stop-location',
              selectedId: draft.locationId,
              placeholder: 'Selecciona una ubicacion'
            })}
          </div>
          <div class="form-group">
            <label>Motivo</label>
            <input type="text" id="planner-stop-purpose" value="${escapeHtml(draft.purpose || '')}" placeholder="Dejar mochilas, coger el tren, descansar...">
          </div>
          <div class="admin-form-grid compact">
            <div class="form-group">
              <label>Duracion aproximada</label>
              <input type="number" id="planner-stop-duration" min="0" step="5" value="${draft.durationMinutes ?? ''}" placeholder="Minutos">
            </div>
            <div class="form-group">
              <label>Llegada desde el punto anterior</label>
              <select id="planner-stop-mode">
                ${TRAVEL_MODES.map((mode) => `<option value="${mode.id}" ${mode.id === draft.travelModeFromPrevious ? 'selected' : ''}>${mode.icon} ${mode.label}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Nota</label>
            <textarea id="planner-stop-note" rows="2">${escapeHtml(draft.note || '')}</textarea>
          </div>
          ${hasLocations
            ? ''
            : '<p class="planner-map-distance-warning">Primero crea un alojamiento o punto de transporte en <a href="/admin.html#ubicaciones">Configuracion &gt; Ubicaciones</a>.</p>'}
          <p id="planner-stop-error" class="admin-inline-msg"></p>
          <button type="submit" class="maps-link-btn" style="width:100%;justify-content:center;" ${hasLocations ? '' : 'disabled'}>Guardar parada</button>
        </form>
      </div>
    </div>
  `;
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  document.getElementById('planner-modal-close')?.addEventListener('click', closePlaceModal);
  document.getElementById('planner-stop-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const locationId = document.getElementById('planner-stop-location').value;
    if (!locationId) {
      const error = document.getElementById('planner-stop-error');
      error.textContent = 'Selecciona una ubicacion.';
      error.style.display = 'block';
      return;
    }
    const maxOrder = Math.max(
      -1,
      ..._plannerItems.filter((item) => Number(item.assignedDay) === Number(day)).map((item) => Number(item.order) || 0),
      ..._plannerStops.filter((stop) => Number(stop.assignedDay) === Number(day)).map((stop) => Number(stop.order) || 0)
    );
    const nextStop = normalizePlannerStopRecord({
      ...draft,
      id: existing?.id || createPlannerStopId(),
      locationId,
      assignedDay: Number(day),
      order: existing?.order ?? maxOrder + 1,
      purpose: document.getElementById('planner-stop-purpose').value.trim(),
      durationMinutes: document.getElementById('planner-stop-duration').value,
      travelModeFromPrevious: document.getElementById('planner-stop-mode').value,
      note: document.getElementById('planner-stop-note').value.trim()
    });
    await putAll('plannerStops', [nextStop]);
    const index = _plannerStops.findIndex((stop) => stop.id === nextStop.id);
    if (index >= 0) _plannerStops[index] = nextStop;
    else _plannerStops.push(nextStop);
    markWalkingRoutesAsStale([Number(day)]);
    closePlaceModal();
    renderPlannerPage();
    showToast(existing ? 'Parada actualizada.' : 'Parada anadida al itinerario.');
  });
}

function openPlannerDayPlanModal(day) {
  const overlay = document.getElementById('planner-modal-overlay');
  const modal = document.getElementById('planner-modal');
  if (!overlay || !modal) return;
  const plan = getDayPlan(day);
  modal.innerHTML = `
    <div class="modal-scroll">
      <div class="modal-header">
        <div>
          <div class="place-card-category">Anclas de jornada</div>
          <h2>Inicio y final del dia ${day}</h2>
        </div>
        <button class="modal-close" id="planner-modal-close">&#x2715;</button>
      </div>
      <div class="modal-body">
        <form id="planner-day-plan-form" class="admin-form">
          <div class="form-group">
            <label>Alojamiento de inicio</label>
            ${renderPlannerLocationPicker({
              id: 'planner-day-start',
              selectedId: plan.startLocationId,
              kind: 'accommodation',
              placeholder: 'Sin alojamiento de inicio',
              selectedMeta: 'city'
            })}
          </div>
          <div class="form-group">
            <label>Alojamiento de final</label>
            ${renderPlannerLocationPicker({
              id: 'planner-day-end',
              selectedId: plan.endLocationId,
              kind: 'accommodation',
              placeholder: 'Sin alojamiento final',
              selectedMeta: 'city'
            })}
          </div>
          <div class="form-group">
            <label>Modo de llegada al alojamiento final</label>
            <select id="planner-day-end-mode">
              ${TRAVEL_MODES.map((mode) => `<option value="${mode.id}" ${mode.id === plan.endTravelModeFromPrevious ? 'selected' : ''}>${mode.icon} ${mode.label}</option>`).join('')}
            </select>
          </div>
          ${_locations.some((location) => location.kind === 'accommodation' && location.active !== false)
            ? ''
            : '<p class="planner-map-distance-warning">Primero crea un alojamiento en <a href="/admin.html#ubicaciones">Configuracion &gt; Ubicaciones</a>.</p>'}
          <button type="submit" class="maps-link-btn" style="width:100%;justify-content:center;">Guardar inicio y final</button>
        </form>
      </div>
    </div>
  `;
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  document.getElementById('planner-modal-close')?.addEventListener('click', closePlaceModal);
  document.getElementById('planner-day-plan-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const updated = normalizeDayPlanRecord({
      day: Number(day),
      startLocationId: document.getElementById('planner-day-start').value,
      endLocationId: document.getElementById('planner-day-end').value,
      endTravelModeFromPrevious: document.getElementById('planner-day-end-mode').value
    });
    await putAll('dayPlans', [updated]);
    const index = _dayPlans.findIndex((candidate) => Number(candidate.day) === Number(day));
    if (index >= 0) _dayPlans[index] = updated;
    else _dayPlans.push(updated);
    markWalkingRoutesAsStale([Number(day)]);
    closePlaceModal();
    renderPlannerPage();
    showToast(`Inicio y final del dia ${day} actualizados.`);
  });
}

function closePlaceModal() {
  closeLocationPickers();
  document.getElementById('planner-modal-overlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

function destroyPlannerDayMapModal() {
  if (_plannerDayMap?.remove) {
    _plannerDayMap.remove();
  }
  _plannerDayMap = null;
}

function closePlannerDayMapModal() {
  destroyPlannerDayMapModal();
  _plannerDayMapModalDay = null;
  document.getElementById('planner-day-map-overlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

function closeLocationPickers(exceptPicker = null) {
  document.querySelectorAll('.planner-location-picker.is-open').forEach((picker) => {
    if (picker === exceptPicker) return;
    picker.classList.remove('is-open');
    picker.querySelector('[data-location-picker-toggle]')?.setAttribute('aria-expanded', 'false');
  });
}

function setLocationPickerValue(option) {
  const picker = option.closest('[data-location-picker]');
  if (!picker) return;
  const input = picker.querySelector('input[type="hidden"]');
  const selected = picker.querySelector('[data-location-picker-selected]');
  const selectedMeta = picker.querySelector('[data-location-picker-selected-meta]');
  if (input) input.value = option.dataset.locationId || '';
  if (selected) selected.textContent = option.dataset.locationLabel || 'Selecciona una ubicacion';
  if (selectedMeta) selectedMeta.textContent = option.dataset.locationSelectedMeta || '';
  picker.querySelectorAll('[data-location-picker-option]').forEach((candidate) => {
    const isSelected = candidate === option;
    candidate.classList.toggle('is-selected', isSelected);
    candidate.setAttribute('aria-selected', isSelected ? 'true' : 'false');
  });
  closeLocationPickers();
}

function renderPlannerDayMapOverlay(model, day) {
  const staleInScope = model.selectedDays.some((selectedDay) => _walkingRouteStaleDays.has(selectedDay));
  const statusText = _walkingRoutesLoading
    ? 'Calculando rutas a pie...'
    : _walkingRouteMessage || (staleInScope ? 'Rutas pendientes de actualizar' : '');
  const routeEntries = model.routes.find((route) => route.day === day)?.entries || [];
  const routeValidation = getRouteValidationModel(model);
  const isRouteActionDisabled = !model.walking.segments.length || _walkingRoutesLoading || !routeValidation.canCalculate;

  return `
    <div class="planner-day-map-modal-scroll">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <div>
          <h2>Mapa del ${formatDayLabel(day)}</h2>
          <div class="place-card-category" style="margin:0;">Vista dedicada al itinerario de este dia</div>
        </div>
        <button class="modal-close" id="planner-day-map-close">&#x2715;</button>
      </div>
      <div class="modal-body planner-day-map-modal-body">
        <div class="planner-day-map-modal-layout">
          <aside class="planner-day-map-modal-sidebar">
            ${statusText ? `<div class="walking-route-status walking-route-status-${_walkingRouteMessageTone}">${statusText}</div>` : ''}
            ${renderWalkingRouteSummary(model)}
            ${renderDistanceSegmentsList(model, { day })}
          </aside>
          <div class="planner-day-map-modal-main">
            <div class="planner-day-map-modal-actions">
              <div class="planner-day-map-route-action">
                ${renderGoogleMapsRouteButton(routeEntries, 'planner-day-modal-route')}
              </div>
              <div class="planner-day-map-api-actions ${isRouteActionDisabled ? 'is-disabled' : ''}">
                <button type="button" class="walking-route-btn planner-day-map-action-btn" data-day-map-walking-route-action="calculate" ${isRouteActionDisabled ? 'disabled' : ''}>Calcular faltantes</button>
                <button type="button" class="walking-route-btn walking-route-btn-secondary planner-day-map-action-btn" data-day-map-walking-route-action="refresh" ${isRouteActionDisabled ? 'disabled' : ''}>Actualizar ruta</button>
              </div>
            </div>
            <div class="planner-day-map-modal-map-shell">
            <div id="planner-day-map-modal-container" class="planner-map-container ${model.mappedCount === 0 ? 'is-hidden' : ''}"></div>
            ${model.mappedCount === 0 ? '<div class="planner-map-empty">No hay actividades geolocalizadas para este dia.</div>' : ''}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function openPlannerDayMapModal(day, options = {}) {
  const overlay = document.getElementById('planner-day-map-overlay');
  const modal = document.getElementById('planner-day-map-modal');
  if (!overlay || !modal) return;

  const normalizedDay = Number.parseInt(day, 10);
  if (!Number.isFinite(normalizedDay) || normalizedDay < 1 || normalizedDay > _totalTripDays) return;

  _plannerDayMapModalDay = normalizedDay;
  const model = getMapModelForDay(normalizedDay);
  modal.innerHTML = renderPlannerDayMapOverlay(model, normalizedDay);
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  modal.querySelector('#planner-day-map-close')?.addEventListener('click', closePlannerDayMapModal);

  destroyPlannerDayMapModal();
  const mapContainer = document.getElementById('planner-day-map-modal-container');
  if (!mapContainer || model.mappedCount === 0 || typeof L === 'undefined') return;

  try {
    _plannerDayMap = initLeafletMap('planner-day-map-modal-container', DEFAULT_MAP_CENTER, 5, {
      controls: true,
      showLocate: true,
      showFullscreen: true,
      showFitBounds: true
    });

    renderPlannerTravelMap(_plannerDayMap, model, {
      categories,
      priorityLabels,
      citiesArray: _citiesArray,
      formatScore,
      mapLinkStyle: _globalSettings?.mapLinkStyle,
      onPlaceClick: openPlaceModal
    });

    requestAnimationFrame(() => {
      _plannerDayMap?.invalidateSize?.();
    });
  } catch (error) {
    console.error('No se pudo renderizar el mapa diario del planner.', error);
    mapContainer.insertAdjacentHTML('afterend', '<div class="planner-map-distance-warning">No se pudo cargar el mapa de este dia.</div>');
  }

  if (options.preserveOverlay !== true) {
    requestAnimationFrame(() => {
      _plannerDayMap?.invalidateSize?.();
    });
  }
}

function setMapScope(scope) {
  _selectedMapScope = normalizeMapScope(scope);
  if (_viewMode !== 'map') _viewMode = 'map';
  const url = new URL(window.location.href);
  url.searchParams.set('view', 'map');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  renderPlannerPage();
}

function getCurrentMapModel() {
  const filteredPlaces = getFilteredPlannerPlaces();
  const groups = buildGroupedData(filteredPlaces);
  _selectedMapScope = normalizeMapScope(_selectedMapScope);
  return buildMapModel(_selectedMapScope, groups);
}

function getMapModelForDay(day) {
  const filteredPlaces = getFilteredPlannerPlaces();
  const groups = buildGroupedData(filteredPlaces);
  return buildMapModel(day, groups);
}

function clearStaleDays(days) {
  days.forEach((day) => _walkingRouteStaleDays.delete(day));
}

function markWalkingRoutesAsStale(days) {
  const validDays = days.filter((day) => Number.isFinite(day) && day >= 1 && day <= _totalTripDays);
  if (!validDays.length) return;
  validDays.forEach((day) => _walkingRouteStaleDays.add(day));
  _walkingRouteMessage = 'Rutas pendientes de actualizar';
  _walkingRouteMessageTone = 'stale';
}

async function calculateWalkingRoutesForCurrentScope(options = {}) {
  return calculateWalkingRoutesForModel(getCurrentMapModel(), options);
}

async function calculateWalkingRoutesForModel(model, options = {}) {
  if (_walkingRoutesLoading) return;

  const forceRefresh = options.forceRefresh === true;
  const calculableRoutes = model.routes.filter((route) => (
    (route.walkingSegments || []).some((segment) => segment.travelMode === 'walking')
  ));
  const routeValidation = getRouteValidationModel(model);

  if (!calculableRoutes.length) {
    _walkingRouteMessage = 'No hay suficientes actividades con coordenadas';
    _walkingRouteMessageTone = 'info';
    renderPlannerPage();
    if (_plannerDayMapModalDay) openPlannerDayMapModal(_plannerDayMapModalDay, { preserveOverlay: true });
    showToast(_walkingRouteMessage, 'info');
    return;
  }

  if (!routeValidation.canCalculate) {
    _walkingRouteMessage = routeValidation.unvalidatedDays.length === 1
      ? `Valida la ruta del día ${routeValidation.unvalidatedDays[0]} antes de calcular.`
      : 'Valida las rutas de los días antes de calcular.';
    _walkingRouteMessageTone = 'info';
    renderPlannerPage();
    if (_plannerDayMapModalDay) openPlannerDayMapModal(_plannerDayMapModalDay, { preserveOverlay: true });
    showToast(_walkingRouteMessage, 'info');
    return;
  }

  if (forceRefresh && model.walking?.segments?.length > 1 && hasOnlyCalculatedWalkingSegments(model)) {
    const shouldRefresh = await confirmWalkingRouteRefresh(model);
    if (!shouldRefresh) return;
  }

  _walkingRoutesLoading = true;
  _walkingRouteMessage = 'Calculando rutas a pie...';
  _walkingRouteMessageTone = 'loading';
  renderPlannerPage();
  if (_plannerDayMapModalDay) openPlannerDayMapModal(_plannerDayMapModalDay, { preserveOverlay: true });

  const results = [];
  for (const route of calculableRoutes) {
    const routeResults = await getWalkingRoutesForEntries(route.allEntries, { forceRefresh });
    results.push(...routeResults);
    routeResults.forEach((segment) => {
      _walkingRouteResults.set(segment.route.id, segment.route);
    });
  }

  const okCount = results.filter((segment) => segment.route.status === 'ok').length;
  const errorCount = results.filter((segment) => segment.route.status === 'error').length;
  const missingCount = results.filter((segment) => segment.route.status === 'missing-coordinates').length;

  clearStaleDays(model.selectedDays);
  _walkingRoutesLoading = false;

  if (okCount > 0 && errorCount === 0 && missingCount === 0) {
    _walkingRouteMessage = 'Rutas actualizadas';
    _walkingRouteMessageTone = 'ok';
    showToast('Rutas a pie actualizadas.');
  } else if (okCount > 0) {
    _walkingRouteMessage = 'Algunas rutas no se han podido calcular';
    _walkingRouteMessageTone = 'partial';
    showToast(_walkingRouteMessage, 'info');
  } else {
    _walkingRouteMessage = 'No se han podido calcular rutas a pie';
    _walkingRouteMessageTone = 'error';
    showToast(_walkingRouteMessage, 'info');
  }

  renderPlannerPage();
  if (_plannerDayMapModalDay) openPlannerDayMapModal(_plannerDayMapModalDay, { preserveOverlay: true });
}

function getZoneFromElement(el) {
  const dayBlock = el?.closest('.planner-day-block');
  if (dayBlock) return 'day';
  const trayCards = el?.closest('.planner-tray-cards');
  if (trayCards) return 'tray';
  return null;
}

function collectPlannerUpdatesFromDOM() {
  const planner = [];
  const stops = [];

  const trayCards = document.querySelectorAll('.planner-tray-cards > .planner-sortable-card[data-entry-type="activity"]');
  trayCards.forEach((card, idx) => {
    const placeId = card.dataset.id;
    if (!placeId) return;
    const existing = getPlannerItem(placeId);
    planner.push({
      ...existing,
      placeId,
      status: 'in-tray',
      assignedDay: null,
      order: idx,
      travelModeFromPrevious: normalizeTravelMode(existing?.travelModeFromPrevious)
    });
  });

  for (let day = 1; day <= _totalTripDays; day += 1) {
    const dayCards = document.querySelectorAll(`.planner-day-block[data-day="${day}"] .planner-day-cards > .planner-sortable-card`);
    dayCards.forEach((card, idx) => {
      const entryId = card.dataset.id;
      if (!entryId) return;
      if (card.dataset.entryType === 'location-stop') {
        const existing = getPlannerStop(entryId);
        if (!existing) return;
        stops.push(normalizePlannerStopRecord({
          ...existing,
          assignedDay: day,
          order: idx
        }));
        return;
      }
      const existing = getPlannerItem(entryId);
      planner.push({
        ...existing,
        placeId: entryId,
        status: 'planned',
        assignedDay: day,
        order: idx,
        travelModeFromPrevious: normalizeTravelMode(existing?.travelModeFromPrevious)
      });
    });
  }

  return { planner, stops };
}

async function handleDropEnd(evt) {
  const toZoneType = getZoneFromElement(evt.to);
  if (!toZoneType) {
    renderPlannerPage();
    return;
  }

  if (isNoopPlannerDrop(evt)) {
    renderPlannerPage();
    showToast(getNoopDropToastMessage(evt), 'info');
    return;
  }

  const updates = collectPlannerUpdatesFromDOM();
  if (updates.planner.length === 0 && updates.stops.length === 0) {
    renderPlannerPage();
    return;
  }

  const toastMessage = getDropToastMessage(evt);
  const affectedDays = [
    Number.parseInt(evt.from?.closest('.planner-day-block')?.dataset.day || '', 10),
    Number.parseInt(evt.to?.closest('.planner-day-block')?.dataset.day || '', 10)
  ];

  updates.planner.forEach((update) => {
    const existing = _plannerItems.find((item) => item.placeId === update.placeId);
    if (existing) {
      existing.status = update.status;
      existing.assignedDay = update.assignedDay;
      existing.order = update.order;
    } else {
      _plannerItems.push({ ...update });
    }
  });
  updates.stops.forEach((update) => {
    const index = _plannerStops.findIndex((stop) => stop.id === update.id);
    if (index >= 0) _plannerStops[index] = update;
  });

  await putManyByStore({
    planner: updates.planner,
    plannerStops: updates.stops
  });
  markWalkingRoutesAsStale(affectedDays);
  renderPlannerPage();
  showToast(toastMessage);
}

function initSortable() {
  _sortableInstances.forEach((instance) => instance.destroy());
  _sortableInstances = [];
  if (hasActivePlannerFilters()) return;

  const trayContainer = document.querySelector('.planner-tray-cards');
  if (trayContainer) {
    _sortableInstances.push(Sortable.create(trayContainer, {
      animation: 250,
      ghostClass: 'planning-ghost',
      chosenClass: 'planning-chosen',
      dragClass: 'planning-drag',
      fallbackOnBody: true,
      swapThreshold: 0.65,
      group: {
        name: 'planner-shared',
        pull: true,
        put: (_to, _from, dragEl) => dragEl?.dataset?.entryType === 'activity'
      },
      draggable: '.planner-sortable-card',
      sort: true,
      filter: '.planner-chip-trigger, .planner-card-discarded, .planner-entry-mode, .planner-location-action',
      onEnd: handleDropEnd
    }));
  }

  for (let day = 1; day <= _totalTripDays; day += 1) {
    const dayBlock = document.querySelector(`.planner-day-block[data-day="${day}"]`);
    const dayContainer = dayBlock?.querySelector('.planner-day-cards');
    if (!dayContainer) continue;

    _sortableInstances.push(Sortable.create(dayContainer, {
      animation: 250,
      ghostClass: 'planning-ghost',
      chosenClass: 'planning-chosen',
      dragClass: 'planning-drag',
      fallbackOnBody: true,
      swapThreshold: 0.65,
      group: { name: 'planner-shared', pull: true, put: true },
      draggable: '.planner-sortable-card',
      sort: true,
      filter: '.planner-chip-trigger, .planner-card-discarded, .planner-entry-mode, .planner-location-action',
      onEnd: handleDropEnd
    }));
  }
}

async function setPlannerState(placeId, newStatus, assignedDay) {
  const toastMessage = getStateToastMessage(placeId, newStatus, assignedDay);
  let item = _plannerItems.find((p) => p.placeId === placeId);
  const previousDay = Number.parseInt(item?.assignedDay || '', 10);
  if (!item) {
    item = { placeId, status: newStatus, assignedDay, order: 0, travelModeFromPrevious: 'walking' };
    _plannerItems.push(item);
  } else {
    item.status = newStatus;
    item.assignedDay = newStatus === 'planned' ? assignedDay : null;
  }

  await putAll('planner', [item]);
  markWalkingRoutesAsStale([previousDay, assignedDay]);
  closePlaceModal();
  renderPlannerPage();
  showToast(toastMessage);
}

function handlePageClick(e) {
  const locationPickerOption = e.target.closest('[data-location-picker-option]');
  if (locationPickerOption) {
    e.preventDefault();
    e.stopPropagation();
    setLocationPickerValue(locationPickerOption);
    return;
  }

  const locationPickerToggle = e.target.closest('[data-location-picker-toggle]');
  if (locationPickerToggle) {
    e.preventDefault();
    e.stopPropagation();
    const picker = locationPickerToggle.closest('[data-location-picker]');
    const shouldOpen = !picker?.classList.contains('is-open');
    closeLocationPickers(picker);
    picker?.classList.toggle('is-open', shouldOpen);
    locationPickerToggle.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    return;
  }

  if (!e.target.closest('[data-location-picker]')) {
    closeLocationPickers();
  }

  const viewBtn = e.target.closest('[data-view-mode]');
  if (viewBtn) {
    return;
  }

  const dayCollapseBtn = e.target.closest('[data-planner-day-collapse]');
  if (dayCollapseBtn) {
    e.preventDefault();
    const day = dayCollapseBtn.dataset.plannerDayCollapse;
    setPlannerDayCollapsed(day, !isPlannerDayCollapsed(day));
    renderPlannerPage();
    return;
  }

  const daysCollapseBtn = e.target.closest('[data-planner-days-collapse]');
  if (daysCollapseBtn) {
    e.preventDefault();
    setAllPlannerDaysCollapsed(daysCollapseBtn.dataset.plannerDaysCollapse === 'collapse');
    renderPlannerPage();
    showToast(daysCollapseBtn.dataset.plannerDaysCollapse === 'collapse'
      ? 'Días contraídos.'
      : 'Días expandidos.', 'info');
    return;
  }

  const dayMapBtn = e.target.closest('[data-day-map-open]');
  if (dayMapBtn) {
    e.preventDefault();
    openPlannerDayMapModal(dayMapBtn.dataset.dayMapOpen);
    return;
  }

  const addStopBtn = e.target.closest('[data-stop-add]');
  if (addStopBtn) {
    e.preventDefault();
    openPlannerStopModal(Number.parseInt(addStopBtn.dataset.stopAdd, 10));
    return;
  }

  const editStopBtn = e.target.closest('[data-stop-edit]');
  if (editStopBtn) {
    e.preventDefault();
    const stop = getPlannerStop(editStopBtn.dataset.stopEdit);
    if (stop) openPlannerStopModal(stop.assignedDay, stop.id);
    return;
  }

  const deleteStopBtn = e.target.closest('[data-stop-delete]');
  if (deleteStopBtn) {
    e.preventDefault();
    const stop = getPlannerStop(deleteStopBtn.dataset.stopDelete);
    if (!stop) return;
    remove('plannerStops', stop.id).then(() => {
      _plannerStops = _plannerStops.filter((candidate) => candidate.id !== stop.id);
      markWalkingRoutesAsStale([stop.assignedDay]);
      renderPlannerPage();
      showToast('Parada eliminada.');
    });
    return;
  }

  const dayPlanBtn = e.target.closest('[data-day-plan-open]');
  if (dayPlanBtn) {
    e.preventDefault();
    openPlannerDayPlanModal(Number.parseInt(dayPlanBtn.dataset.dayPlanOpen, 10));
    return;
  }

  const mapScopeBtn = e.target.closest('[data-map-scope]');
  if (mapScopeBtn) {
    e.preventDefault();
    setMapScope(mapScopeBtn.dataset.mapScope);
    return;
  }

  const walkingRouteBtn = e.target.closest('[data-walking-route-action]');
  if (walkingRouteBtn) {
    e.preventDefault();
    calculateWalkingRoutesForCurrentScope({
      forceRefresh: walkingRouteBtn.dataset.walkingRouteAction === 'refresh'
    });
    return;
  }

  const dayMapWalkingRouteBtn = e.target.closest('[data-day-map-walking-route-action]');
  if (dayMapWalkingRouteBtn && _plannerDayMapModalDay) {
    e.preventDefault();
    calculateWalkingRoutesForModel(getMapModelForDay(_plannerDayMapModalDay), {
      forceRefresh: dayMapWalkingRouteBtn.dataset.dayMapWalkingRouteAction === 'refresh'
    });
    return;
  }

  const mapPopupBtn = e.target.closest('.planner-map-popup-btn[data-place-id]');
  if (mapPopupBtn) {
    e.preventDefault();
    const place = _places.find((p) => p.id === mapPopupBtn.dataset.placeId);
    if (place) openPlaceModal(place);
    return;
  }

  const chipBtn = e.target.closest('[data-chip-place-id]');
  if (chipBtn) {
    e.stopPropagation();
    const placeId = chipBtn.dataset.chipPlaceId;
    if (_dropdownPlaceId === placeId) {
      closeDropdown();
    } else {
      openDropdown(chipBtn, placeId);
    }
    return;
  }

  const dropBtn = e.target.closest('.planner-dropdown-btn[data-action]');
  if (dropBtn) {
    e.stopPropagation();
    closeDropdown();
    setPlannerState(dropBtn.dataset.id, dropBtn.dataset.action, null);
    return;
  }

  const portal = document.getElementById('planner-dropdown-portal');
  if (portal && !portal.contains(e.target)) {
    closeDropdown();
  }

  const card = e.target.closest('[data-clickable-card]');
  if (card && !chipBtn) {
    const place = _places.find((p) => p.id === card.dataset.placeId);
    if (place) openPlaceModal(place);
    return;
  }

  const overlay = e.target.closest('#planner-modal-overlay');
  if (overlay && !e.target.closest('#planner-modal')) {
    closePlaceModal();
  }

  const exportOverlay = e.target.closest('#planner-export-overlay');
  if (exportOverlay && !e.target.closest('#planner-export-modal')) {
    closePlannerExportModal();
    return;
  }

  const dayMapOverlay = e.target.closest('#planner-day-map-overlay');
  if (dayMapOverlay && !e.target.closest('#planner-day-map-modal')) {
    closePlannerDayMapModal();
  }
}

async function handlePageChange(e) {
  const modeSelect = e.target.closest('[data-entry-mode]');
  if (modeSelect) {
    const entryType = modeSelect.dataset.entryMode;
    const entryId = modeSelect.dataset.entryId;
    const day = Number.parseInt(modeSelect.dataset.entryDay, 10);
    const travelModeFromPrevious = normalizeTravelMode(modeSelect.value);
    if (entryType === 'activity') {
      const item = getPlannerItem(entryId);
      const place = _places.find((candidate) => candidate.id === entryId);
      if (item && canConfigureEntryTravelMode({ entryType: 'activity', place, item })) {
        item.travelModeFromPrevious = travelModeFromPrevious;
        await putAll('planner', [item]);
      }
    } else if (entryType === 'location-stop') {
      const stop = getPlannerStop(entryId);
      if (stop) {
        stop.travelModeFromPrevious = travelModeFromPrevious;
        await putAll('plannerStops', [stop]);
      }
    } else if (entryType === 'day-end') {
      const plan = getDayPlan(day);
      plan.endTravelModeFromPrevious = travelModeFromPrevious;
      const index = _dayPlans.findIndex((candidate) => Number(candidate.day) === day);
      if (index >= 0) _dayPlans[index] = plan;
      else _dayPlans.push(plan);
      await putAll('dayPlans', [plan]);
    }
    markWalkingRoutesAsStale([day]);
    renderPlannerPage();
    showToast('Modo de desplazamiento actualizado.');
    return;
  }

  const routeValidationInput = e.target.closest('[data-route-validation-day]');
  if (routeValidationInput && !routeValidationInput.disabled) {
    const day = routeValidationInput.dataset.routeValidationDay;
    setRouteDayValidated(day, routeValidationInput.checked);
    const toastMessage = routeValidationInput.checked
      ? `Ruta del día ${day} validada para calcular.`
      : `Validación retirada del día ${day}.`;
    renderPlannerPage();
    if (_plannerDayMapModalDay) openPlannerDayMapModal(_plannerDayMapModalDay, { preserveOverlay: true });
    showToast(toastMessage, 'info');
    return;
  }

  if (e.target.classList.contains('planner-day-select') && e.target.value) {
    closeDropdown();
    setPlannerState(e.target.dataset.id, 'planned', Number.parseInt(e.target.value, 10));
  }
}

document.addEventListener('click', handlePageClick);
document.addEventListener('change', handlePageChange);
window.addEventListener('popstate', () => {
  _viewMode = getPlannerViewModeFromUrl() || 'calendar';
  renderPlannerPage();
});

if (!window.__plannerScoreDropdownOutsideBound) {
  window.__plannerScoreDropdownOutsideBound = true;
  document.addEventListener('click', (event) => {
    const openDropdown = document.querySelector('.filter-dropdown[open]');
    if (!openDropdown) return;
    if (event.target.closest('.filter-dropdown')) return;
    document.querySelectorAll('.filter-dropdown[open]').forEach((dropdown) => dropdown.removeAttribute('open'));
    _plannerScoreDropdownOpen = false;
  });
}

window.addEventListener('scroll', () => {
  document.getElementById('main-nav')?.classList.toggle('scrolled', window.scrollY > 10);
});

async function boot() {
  await runDataMigration();
  const settingsArray = (await getAll('settings')) || [];
  _globalSettings = settingsArray.find((s) => s.id === 'global') || {};

  _places = (await getAll('places')).map((place) => normalizePlaceRecord(place));
  _plannerItems = ((await getAll('planner')) || []).map((item) => ({
    ...item,
    travelModeFromPrevious: normalizeTravelMode(item.travelModeFromPrevious)
  }));
  _citiesArray = sortCities(await getAll('cities'));
  _locations = (await getAll('locations')).map(normalizeLocationRecord);
  _dayPlans = (await getAll('dayPlans')).map(normalizeDayPlanRecord);
  _plannerStops = (await getAll('plannerStops')).map(normalizePlannerStopRecord);
  _totalTripDays = calcTripDays(_globalSettings);

  const groups = buildGroupedData();
  _selectedMapScope = getRecommendedMapScope(groups);
  _viewMode = getPlannerViewModeFromUrl() || _viewMode;

  document.title = 'Planificador \u2014 Jap\u00F3n 2026';
  renderPlannerPage();
}

boot();

