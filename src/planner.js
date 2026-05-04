import './styles/main.css';
import './styles/components.css';
import './styles/pages.css';
import { getAll, putAll } from './utils/db.js';
import { categories, priorityLabels } from './data/cities.js';
import { icons, formatScore, debounce, parseEstimatedDurationToMinutes, formatDurationMinutes } from './utils/helpers.js';
import { renderPlaceMap, getGoogleMapsUrl } from './utils/maps.js';
import { registerSW } from 'virtual:pwa-register';
import Sortable from 'sortablejs';
import { bindMobileNav, renderMobileMenu } from './utils/nav.js';
import { sortCities } from './utils/cityData.js';
import { formatBestTimeLabel, normalizePlaceRecord } from './utils/placeData.js';
import { runDataMigration } from './utils/dataMigration.js';
import { renderPlaceDetailModal } from './utils/placeDetailModal.js';

if ('serviceWorker' in navigator) {
  registerSW({ immediate: true });
}

const app = document.getElementById('app');
const DEFAULT_MAP_CENTER = { lat: 36.2048, lng: 138.2529 };
const DAY_ROUTE_COLORS = ['#e94560', '#0ea5e9', '#22c55e', '#f97316', '#8b5cf6', '#14b8a6', '#f59e0b'];
const EXPORT_SATURATION_ACTIVITY_LIMIT = 7;
const EXPORT_SATURATION_MINUTES_LIMIT = 480;
const EXPORT_MAP_CAPTURE_SCALE = 2;
const EXPORT_MAP_TILE_TIMEOUT_MS = 4500;

let _places = [];
let _plannerItems = [];
let _globalSettings = {};
let _totalTripDays = 7;
let _citiesArray = [];
let _viewMode = 'calendar';
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

function getPlaceLatLng(place) {
  const lat = Number(place?.lat);
  const lng = Number(place?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
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
  return _places.find((place) => place.id === placeId)?.name || 'Actividad';
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
    (groups[day] || []).forEach((entry) => scopedEntries.push({ ...entry, day }));
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

  const distance = buildMapDistanceModel(routes);

  return {
    scope: normalizedScope,
    selectedDays,
    allPlannedCount,
    plannedCount: scopedEntries.length,
    mappedCount: mappableEntries.length,
    missingCount: missingEntries.length,
    missingEntries,
    routes,
    distance
  };
}

function renderMiniCard(place, plannerItem) {
  const cat = categories.find((c) => c.id === place.category);
  const prio = priorityLabels[place.priority];
  const cfg = getStatusConfig(plannerItem);
  const isDiscarded = plannerItem?.status === 'discarded';
  const cityName = getCityName(place.cityId);
  const scoreText = formatScore(place.score);
  const durationText = place.estimatedDuration || '';
  const hasCity = Boolean(cityName);

  return `
    <div class="planner-mini-card ${isDiscarded ? 'planner-card-discarded' : ''}"
         data-id="${place.id}" data-place-id="${place.id}" data-clickable-card="true">
      <span class="planner-mini-cat-icon" style="font-size:1rem;">${cat?.icon || '&#x1F4CD;'}</span>
      <div class="planner-mini-info">
        <div class="planner-mini-name">${place.name}</div>
        <div class="planner-mini-meta">
          ${hasCity ? `<span class="planner-mini-city">${cityName}</span>` : ''}
          ${hasCity ? `<span class="planner-mini-sep">&middot;</span>` : ''}
          <span title="${prio.label}" style="font-size:0.74rem;">${prio.icon}</span>
          ${durationText ? `<span class="planner-mini-sep">&middot;</span><span class="planner-mini-duration-inline">${escapeHtml(durationText)}</span>` : ''}
        </div>
      </div>
      <div style="display:flex; align-items:center; flex-shrink:0;">
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
    showEditButton: false,
    mapContainerId: `modal-map-${place.id}`,
    commentLabel: 'Comentarios'
  });
}

function renderViewToggle() {
  return `
    <div class="planner-view-toggle">
      <button class="planner-view-btn ${_viewMode === 'calendar' ? 'active' : ''}" data-view-mode="calendar">Calendario</button>
      <button class="planner-view-btn ${_viewMode === 'map' ? 'active' : ''}" data-view-mode="map">Mapa</button>
    </div>
  `;
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
    .map((route) => `<span class="planner-map-legend-chip"><span class="planner-map-legend-dot" style="background:${route.color};"></span>D&iacute;a ${route.day}</span>`)
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
    ? `<div class="planner-m&aacute;s sin coordenadas</div>`
    : '';

  return `
    <div class="planner-map-missing">
      <h4>Actividades sin coordenadas (${model.missingCount})</h4>
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
  return `${distanceKm >= 1 ? distanceKm.toFixed(1) : distanceKm.toFixed(2)} km`;
}

function formatTotalDistanceKm(distanceKm) {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return '0 km';
  return `${distanceKm.toFixed(1)} km`;
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

function renderDistanceSummary(model) {
  const summary = model.distance.summary;
  const longestText = summary.longestSegment
    ? formatSegmentDistanceKm(summary.longestSegment.distanceKm)
    : 'N/D';

  return `
    <div class="planner-map-distance-summary" aria-label="Resumen de distancia lineal">
      <div class="planner-map-distance-stat"><strong>${model.plannedCount}</strong><span>actividades</span></div>
      <div class="planner-map-distance-stat"><strong>${summary.segmentCount}</strong><span>tramos</span></div>
      <div class="planner-map-distance-stat"><strong>${formatTotalDistanceKm(summary.totalDistanceKm)}</strong><span>distancia lineal total</span></div>
      <div class="planner-map-distance-stat"><strong>${longestText}</strong><span>tramo m&aacute;s largo</span></div>
    </div>
  `;
}

function renderDistanceSegmentsList(model) {
  const segments = model.distance.segments;
  if (!segments.length && model.plannedCount > 1) {
    return `
      <aside class="planner-map-segments-card">
        <h4>Tramos en l&iacute;nea recta</h4>
        <p class="planner-map-segments-empty">No hay tramos calculables con coordenadas v&aacute;lidas.</p>
      </aside>
    `;
  }
  if (!segments.length) return '';

  const showDay = model.scope === 'all';
  const rows = segments.map((segment) => `
    <li class="planner-map-segment-row">
      <div class="planner-map-segment-main">
        <span class="planner-map-segment-orders">${segment.fromOrder} &rarr; ${segment.toOrder}</span>
        <span class="planner-map-segment-names">${escapeHtml(segment.fromPlace.name)} &rarr; ${escapeHtml(segment.toPlace.name)}</span>
        ${showDay ? `<span class="planner-map-segment-day">D&iacute;a ${segment.day}</span>` : ''}
      </div>
      <strong>${formatSegmentDistanceKm(segment.distanceKm)}</strong>
    </li>
  `).join('');

  return `
    <aside class="planner-map-segments-card">
      <h4>Tramos en l&iacute;nea recta</h4>
      <ul>${rows}</ul>
    </aside>
  `;
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
        ${renderDistanceSummary(model)}
      </div>

      ${renderMapLegend(model)}

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
  const totalMinutes = entries.reduce((sum, entry) => {
    const minutes = parseEstimatedDurationToMinutes(entry.place?.estimatedDuration);
    return Number.isFinite(minutes) ? sum + minutes : sum;
  }, 0);
  const priorityCounts = entries.reduce((acc, entry) => {
    const priority = entry.place.priority || 'optional';
    acc[priority] = (acc[priority] || 0) + 1;
    return acc;
  }, {});
  const mainCity = getMostCommonLabel(entries.map((entry) => getCityName(entry.place.cityId)));
  const mainZone = getMostCommonLabel(entries.map((entry) => entry.place.zone));

  return {
    activityCount: entries.length,
    totalMinutes,
    totalDurationText: formatDurationMinutes(totalMinutes, { approximate: true }) || 'Sin duracion estimada',
    priorityCounts,
    mainLabel: [mainCity, mainZone].filter(Boolean).join(' · '),
    rainyCount: entries.filter((entry) => entry.place.rainyFriendly).length,
    ticketCount: entries.filter((entry) => entry.place.requiresTicket).length,
    isSaturated: entries.length >= EXPORT_SATURATION_ACTIVITY_LIMIT || totalMinutes >= EXPORT_SATURATION_MINUTES_LIMIT
  };
}

function getExportDistanceModel(entries) {
  const { segments, omittedCount } = buildPlannerSegments(entries);
  const summary = calculateDayDistanceSummary(segments);
  return {
    segments,
    omittedCount,
    summary,
    densityLabel: getDistanceDensityLabel(summary.totalDistanceKm)
  };
}

function getPdfDaySummaryItems(dayData) {
  const summary = getExportDaySummary(dayData.entries);
  const distance = getExportDistanceModel(dayData.entries);
  const longestText = distance.summary.longestSegment
    ? `tramo más largo ${formatSegmentDistanceKm(distance.summary.longestSegment.distanceKm)}`
    : null;

  return [
    `${summary.activityCount} actividades`,
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
      entries: (groups[day] || []).map((entry, index) => ({
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
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    setPdfColor(doc, layout.muted);
    doc.text(toPdfText(stat.label).toUpperCase(), columnX + 4, y + 9.2);
  });
}

function drawPdfCover(doc, layout, days, exportType) {
  const totalActivities = days.reduce((sum, dayData) => sum + dayData.entries.length, 0);
  const totalMinutes = days.reduce((sum, dayData) => sum + getExportDaySummary(dayData.entries).totalMinutes, 0);
  const totalLinearDistanceKm = days.reduce((sum, dayData) => (
    sum + getExportDistanceModel(dayData.entries).summary.totalDistanceKm
  ), 0);
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
    { label: 'distancia lineal total', value: formatTotalDistanceKm(totalLinearDistanceKm) }
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

async function captureLeafletMapForPdf(entries, compact = false) {
  const html2canvas = getHtml2Canvas();
  if (!html2canvas || typeof L === 'undefined') return null;

  const mapEntries = getExportMapEntries(entries);
  if (!mapEntries.length) return null;

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
    const latLngs = mapEntries.map((entry) => [entry.latLng.lat, entry.latLng.lng]);

    if (latLngs.length > 1) {
      L.polyline(latLngs, {
        color: routeColor,
        weight: 3,
        opacity: 0.88,
        lineJoin: 'round',
        lineCap: 'round'
      }).addTo(map);
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
    if (latLngs.length === 1) {
      map.setView(latLngs[0], 15, { animate: false });
    } else {
      map.fitBounds(latLngs, { padding: [22, 22], animate: false });
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

  const capturedMap = await captureLeafletMapForPdf(entries, false);
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
  const warningHeight = distanceModel.omittedCount ? 8 : 0;
  return 42 + warningHeight + segmentRows * 9.2;
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

function renderDistanceKpiCard({ icon, value, label }) {
  return `
    <div class="distance-kpi-card">
      ${getDistanceKpiIconSvg(icon)}
      <div>
        <div class="distance-kpi-value">${escapeHtml(value)}</div>
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
        gap: 12px;
        min-height: 64px;
        padding: 12px 16px;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        box-sizing: border-box;
      }
      .distance-kpi-icon {
        width: 26px;
        height: 26px;
        color: #ef476f;
        flex: 0 0 auto;
      }
      .distance-kpi-value {
        font-size: 19px;
        line-height: 1.1;
        font-weight: 700;
        color: #0f172a;
        white-space: nowrap;
      }
      .distance-kpi-label {
        margin-top: 3px;
        font-size: 11px;
        line-height: 1.2;
        color: #64748b;
        white-space: nowrap;
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
  const cardHeight = 17;
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
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.4);
    setPdfColor(doc, layout.muted);
    doc.text(toPdfText(stat.label), cardX + 5, y + 12.2);
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
  doc.text('Distancias lineales del día', x + 16, y);
  y += 8;

  const longestText = distance.summary.longestSegment
    ? formatSegmentDistanceKm(distance.summary.longestSegment.distanceKm)
    : 'N/D';

  if (!detailed) {
    const line = [
      `${formatTotalDistanceKm(distance.summary.totalDistanceKm)} lineales`,
      `${distance.summary.segmentCount} tramos`,
      `tramo más largo ${longestText}`,
      `dispersion: ${distance.densityLabel}`
    ].join(' · ');
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
    value: formatTotalDistanceKm(distance.summary.totalDistanceKm),
    label: 'distancia lineal total'
  }, {
    icon: 'segments',
    value: String(distance.summary.segmentCount),
    label: 'tramos'
  }, {
    icon: 'mountain',
    value: longestText,
    label: 'tramo más largo'
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

  if (distance.omittedCount) {
    setPdfColor(doc, '#fffbeb', 'fill');
    setPdfColor(doc, '#fde68a', 'draw');
    doc.roundedRect(x + 4, y, width - 8, 6, 2, 2, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    setPdfColor(doc, '#92400e');
    doc.text('Algunos tramos pueden omitirse si faltan coordenadas', x + 8, y + 4);
    y += 8;
  }

  if (!distance.segments.length) {
    y = drawWrappedPdfText(doc, 'Sin tramos calculables en linea recta.', x + 5, y + 3, width - 10, {
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
    doc.text(formatSegmentDistanceKm(segment.distanceKm), x + width - 5, rowTop + 4.2, { align: 'right' });
    y += 9.2;
  });

  return cardTop + height + 4;
}

function getPdfActivityMeta(place) {
  const category = categories.find((item) => item.id === place.category);
  return `${getCityName(place.cityId)} · ${place.zone || 'Zona pendiente'} · ${category?.label || place.category || 'Categoria'}`;
}

function getPdfPriorityEmoji(priority) {
  if (priority === 'must-see') return '\u{1F525}';
  if (priority === 'recommended') return '\u{1F44D}';
  return '\u{1F4A1}';
}

function getPdfActivityChips(place) {
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
    const totalMinutes = entries.reduce((sum, entry) => {
      const minutes = parseEstimatedDurationToMinutes(entry.place?.estimatedDuration);
      return Number.isFinite(minutes) ? sum + minutes : sum;
    }, 0);

    const formattedDuration = formatDurationMinutes(totalMinutes, { approximate: true });
    return {
      activityText: `${entries.length} actividad${entries.length !== 1 ? 'es' : ''}`,
      durationText: formattedDuration ? `${formattedDuration} aprox.` : null
    };
  };

  const daysHtml = Array.from({ length: _totalTripDays }, (_, i) => {
    const day = i + 1;
    const entries = groups[day];
    const summary = getDaySummary(entries);
    return `
      <div class="planner-day-block" data-day="${day}">
        <div class="planner-day-header">
          <div class="planner-day-number">${day}</div>
          <div>
            <div class="planner-day-label">${formatDayLabel(day)}</div>
            <div class="planner-day-count">
              <span>${summary.activityText}</span>
              ${summary.durationText ? `<span class="planner-day-summary-sep">&middot;</span><span>${summary.durationText}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="planner-day-cards">
          ${entries.length === 0
            ? `<div class="planner-empty-day">Sin actividades asignadas</div>`
            : entries.map(({ place, item }) => renderMiniCard(place, item)).join('')}
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
        ${renderViewToggle()}
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

  _plannerMap = L.map('planner-map-container').setView([DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng], 5);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(_plannerMap);

  const boundsPoints = [];

  model.routes.forEach((route) => {
    const latlngs = route.entries.map((entry) => {
      const placeLatLng = getPlaceLatLng(entry.place);
      const latlng = [placeLatLng.lat, placeLatLng.lng];
      boundsPoints.push(latlng);
      return latlng;
    });

    route.entries.forEach((entry) => {
      const cat = categories.find((c) => c.id === entry.place.category);
      const prio = priorityLabels[entry.place.priority];
      const scoreText = formatScore(entry.place.score);
      const orderLabel = (entry.item?.order ?? 0) + 1;
      const iconHtml = `
        <div class="planner-route-marker" style="--route-color:${route.color};">
          <span class="planner-route-emoji">${cat?.icon || '&#x1F4CD;'}</span>
          <span class="planner-route-day-badge">D${entry.day} (#${orderLabel})</span>
        </div>
      `;

      const icon = L.divIcon({
        className: 'planner-route-icon',
        html: iconHtml,
        iconSize: [42, 42],
        iconAnchor: [21, 42],
        popupAnchor: [0, -40]
      });

      const placeLatLng = getPlaceLatLng(entry.place);
      const marker = L.marker([placeLatLng.lat, placeLatLng.lng], { icon }).addTo(_plannerMap);
      marker.bindPopup(`
        <div class="map-popup-content">
          <div class="popup-header">
            <span class="popup-emoji">${cat?.icon || '&#x1F4CD;'}</span>
            <strong>${escapeHtml(entry.place.name)}</strong>
          </div>
          <div class="popup-meta">
            <span class="popup-type">D&iacute;a ${entry.day} &middot; ${escapeHtml(entry.place.type || '')}</span>
            <div class="planner-map-popup-details">
              <span class="popup-priority" style="background:${route.color}; color:#fff;">Ruta D&iacute;a ${entry.day}</span>
              ${prio ? `<span class="planner-map-popup-chip" title="${escapeHtml(prio.label)}">${prio.icon}</span>` : ''}
              ${scoreText ? `<span class="planner-map-popup-chip">&#x2B50; ${scoreText}</span>` : ''}
              ${entry.place.estimatedDuration ? `<span class="planner-map-popup-chip">${icons.clock} ${escapeHtml(entry.place.estimatedDuration)}</span>` : ''}
            </div>
          </div>
          <button class="popup-btn planner-map-popup-btn" data-place-id="${entry.place.id}">Ver detalles</button>
        </div>
      `);
    });

    if (latlngs.length >= 2) {
      L.polyline(latlngs, {
        color: route.color,
        weight: 3,
        opacity: model.scope === 'all' ? 0.7 : 0.85,
        lineJoin: 'round'
      }).addTo(_plannerMap);
    }
  });

  if (boundsPoints.length === 1) {
    _plannerMap.setView(boundsPoints[0], 14);
  } else if (boundsPoints.length > 1) {
    _plannerMap.fitBounds(boundsPoints, { padding: [40, 40] });
  }

  setTimeout(() => {
    _plannerMap?.invalidateSize({ pan: false });
  }, 0);
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

  modal.innerHTML = renderModal(place);
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  document.getElementById('planner-modal-close')?.addEventListener('click', closePlaceModal);
  setTimeout(() => {
    renderPlaceMap(`modal-map-${place.id}`, place);
  }, 100);
}

function closePlaceModal() {
  document.getElementById('planner-modal-overlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

function setPlannerViewMode(mode) {
  if (mode !== 'calendar' && mode !== 'map') return;
  _viewMode = mode;
  renderPlannerPage();
}

function setMapScope(scope) {
  _selectedMapScope = normalizeMapScope(scope);
  if (_viewMode !== 'map') _viewMode = 'map';
  renderPlannerPage();
}

function getZoneFromElement(el) {
  const dayBlock = el?.closest('.planner-day-block');
  if (dayBlock) return 'day';
  const trayCards = el?.closest('.planner-tray-cards');
  if (trayCards) return 'tray';
  return null;
}

function collectPlannerUpdatesFromDOM() {
  const updates = [];

  const trayCards = document.querySelectorAll('.planner-tray-cards > .planner-mini-card');
  trayCards.forEach((card, idx) => {
    const placeId = card.dataset.id;
    if (!placeId) return;
    updates.push({ placeId, status: 'in-tray', assignedDay: null, order: idx });
  });

  for (let day = 1; day <= _totalTripDays; day += 1) {
    const dayCards = document.querySelectorAll(`.planner-day-block[data-day="${day}"] .planner-day-cards > .planner-mini-card`);
    dayCards.forEach((card, idx) => {
      const placeId = card.dataset.id;
      if (!placeId) return;
      updates.push({ placeId, status: 'planned', assignedDay: day, order: idx });
    });
  }

  return updates;
}

async function handleDropEnd(evt) {
  const toZoneType = getZoneFromElement(evt.to);
  if (!toZoneType) {
    renderPlannerPage();
    return;
  }

  const updates = collectPlannerUpdatesFromDOM();
  if (updates.length === 0) {
    renderPlannerPage();
    return;
  }

  const toastMessage = getDropToastMessage(evt);

  updates.forEach((update) => {
    const existing = _plannerItems.find((item) => item.placeId === update.placeId);
    if (existing) {
      existing.status = update.status;
      existing.assignedDay = update.assignedDay;
      existing.order = update.order;
    } else {
      _plannerItems.push({ ...update });
    }
  });

  await putAll('planner', updates);
  renderPlannerPage();
  showToast(toastMessage);
}

function initSortable() {
  _sortableInstances.forEach((instance) => instance.destroy());
  _sortableInstances = [];

  const trayContainer = document.querySelector('.planner-tray-cards');
  if (trayContainer) {
    _sortableInstances.push(Sortable.create(trayContainer, {
      animation: 250,
      ghostClass: 'planning-ghost',
      chosenClass: 'planning-chosen',
      dragClass: 'planning-drag',
      fallbackOnBody: true,
      swapThreshold: 0.65,
      group: { name: 'planner-shared', pull: true, put: true },
      sort: true,
      filter: '.planner-chip-trigger, .planner-card-discarded',
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
      sort: true,
      filter: '.planner-chip-trigger, .planner-card-discarded',
      onEnd: handleDropEnd
    }));
  }
}

async function setPlannerState(placeId, newStatus, assignedDay) {
  const toastMessage = getStateToastMessage(placeId, newStatus, assignedDay);
  let item = _plannerItems.find((p) => p.placeId === placeId);
  if (!item) {
    item = { placeId, status: newStatus, assignedDay, order: 0 };
    _plannerItems.push(item);
  } else {
    item.status = newStatus;
    item.assignedDay = newStatus === 'planned' ? assignedDay : null;
  }

  await putAll('planner', [item]);
  closePlaceModal();
  renderPlannerPage();
  showToast(toastMessage);
}

function handlePageClick(e) {
  const viewBtn = e.target.closest('[data-view-mode]');
  if (viewBtn) {
    e.preventDefault();
    setPlannerViewMode(viewBtn.dataset.viewMode);
    return;
  }

  const mapScopeBtn = e.target.closest('[data-map-scope]');
  if (mapScopeBtn) {
    e.preventDefault();
    setMapScope(mapScopeBtn.dataset.mapScope);
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
  }
}

function handlePageChange(e) {
  if (e.target.classList.contains('planner-day-select') && e.target.value) {
    closeDropdown();
    setPlannerState(e.target.dataset.id, 'planned', Number.parseInt(e.target.value, 10));
  }
}

document.addEventListener('click', handlePageClick);
document.addEventListener('change', handlePageChange);

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
  _plannerItems = (await getAll('planner')) || [];
  _citiesArray = sortCities(await getAll('cities'));
  _totalTripDays = calcTripDays(_globalSettings);

  const groups = buildGroupedData();
  _selectedMapScope = getRecommendedMapScope(groups);

  document.title = 'Planificador \u2014 Jap\u00F3n 2026';
  renderPlannerPage();
}

boot();

