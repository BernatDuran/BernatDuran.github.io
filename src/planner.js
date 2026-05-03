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

function hasValidCoordinates(place) {
  return Number.isFinite(place?.coordinates?.lat) && Number.isFinite(place?.coordinates?.lng);
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
        cityName
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
    .map((day) => ({
      day,
      color: getDayColor(day),
      entries: mappableEntries.filter((entry) => entry.day === day)
    }))
    .filter((route) => route.entries.length > 0);

  return {
    scope: normalizedScope,
    selectedDays,
    allPlannedCount,
    plannedCount: scopedEntries.length,
    mappedCount: mappableEntries.length,
    missingCount: missingEntries.length,
    missingEntries,
    routes
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
    commentLabel: 'Nota personal'
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
    .map((route) => `<span class="planner-map-legend-chip"><span class="planner-map-legend-dot" style="background:${route.color};"></span>D&iacute;a ${route.day}</span>`)
    .join('');

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
        <div class="planner-map-stats">
          <div class="planner-map-stat"><strong>${model.plannedCount}</strong><span>planificadas</span></div>
          <div class="planner-map-stat"><strong>${model.mappedCount}</strong><span>geolocalizadas</span></div>
          <div class="planner-map-stat"><strong>${model.missingCount}</strong><span>omitidas</span></div>
          <div class="planner-map-stat"><strong>${model.allPlannedCount}</strong><span>total viaje</span></div>
        </div>
      </div>

      ${renderMapLegend(model)}

      <div class="planner-map-shell">
        <div id="planner-map-container" class="planner-map-container ${model.mappedCount === 0 ? 'is-hidden' : ''}"></div>
        ${emptyMessage ? `<div class="planner-map-empty">${emptyMessage}</div>` : ''}
      </div>

      ${renderMapMissingList(model)}
    </div>
  `;
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
      const latlng = [entry.place.coordinates.lat, entry.place.coordinates.lng];
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

      const marker = L.marker([entry.place.coordinates.lat, entry.place.coordinates.lng], { icon }).addTo(_plannerMap);
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

