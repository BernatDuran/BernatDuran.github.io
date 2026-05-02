import './styles/main.css';
import './styles/components.css';
import './styles/pages.css';
import { getAll, putAll } from './utils/db.js';
import { categories, priorityLabels } from './data/cities.js';
import { icons, formatScore } from './utils/helpers.js';
import { registerSW } from 'virtual:pwa-register';
import Sortable from 'sortablejs';

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

let _dropdownPortal = null;
let _dropdownPlaceId = null;
let _sortableInstances = [];
let _plannerMap = null;

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

function buildGroupedData() {
  const groups = { tray: [], unassigned: [] };
  for (let day = 1; day <= _totalTripDays; day += 1) {
    groups[day] = [];
  }

  _places.forEach((place) => {
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

  return `
    <div class="planner-mini-card ${isDiscarded ? 'planner-card-discarded' : ''}"
         data-id="${place.id}" data-place-id="${place.id}" data-clickable-card="true">
      <span class="planner-mini-cat-icon" style="font-size:1rem;">${cat?.icon || '&#x1F4CD;'}</span>
      <div class="planner-mini-info">
        <div class="planner-mini-name">${place.name}</div>
        <div class="planner-mini-meta">
          ${cityName ? `<span class="planner-mini-city">${cityName}</span>` : ''}
          <span class="planner-mini-sep">&middot;</span>
          <span title="${prio.label}" style="font-size:0.74rem;">${prio.icon}</span>
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

function renderModal(place) {
  const cat = categories.find((c) => c.id === place.category);
  const prio = priorityLabels[place.priority];
  const scoreText = formatScore(place.score);
  const plannerItem = _plannerItems.find((p) => p.placeId === place.id) || {};
  const cfg = getStatusConfig(plannerItem);

  return `
    <div class="modal-handle"></div>
    <div class="modal-header">
      <div>
        <h2 style="margin-bottom:4px;">${place.name}</h2>
        <div class="place-card-category" style="margin:0;"><span class="icon">${cat?.icon || '&#x1F4CD;'}</span> ${place.type} &middot; ${place.zone}</div>
      </div>
      <button class="modal-close" id="planner-modal-close">&#x2715;</button>
    </div>
    <div class="modal-body">
      <div style="margin-bottom:15px; display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
        <button class="planner-chip-trigger"
                data-chip-place-id="${place.id}"
                style="background:${cfg.bg}; color:${cfg.color}; border:1px solid ${cfg.border}; border-radius:999px; padding:5px 12px; font-size:0.8rem; font-weight:600; cursor:pointer; white-space:nowrap; display:flex; align-items:center; gap:5px; transition:all 0.15s;">
          <span>${cfg.icon}</span><span>${cfg.label}</span>
          <svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </button>
        <span class="priority-badge ${prio.class}">${prio.icon} ${prio.label}</span>
      </div>
      <div class="modal-section"><div class="modal-section-title">Descripci&oacute;n</div><p style="line-height:1.7;">${place.description}</p></div>
      ${place.tips ? `<div class="modal-section"><div class="modal-section-title">Consejos pr&aacute;cticos</div><div class="modal-tip">${place.tips}</div></div>` : ''}
      <div class="modal-section"><div class="modal-section-title">Informaci&oacute;n &uacute;til</div>
        <div class="modal-info-grid">
          <div class="modal-info-item"><span class="modal-info-label">&#x23F1;&#xFE0F; Duraci&oacute;n</span><span class="modal-info-value">${place.estimatedDuration || '&mdash;'}</span></div>
          <div class="modal-info-item"><span class="modal-info-label">&#x2600;&#xFE0F; Mejor momento</span><span class="modal-info-value">${place.bestTime || 'Cualquier momento'}</span></div>
          ${scoreText ? `<div class="modal-info-item"><span class="modal-info-label">&#x2B50; Puntuaci&oacute;n</span><span class="modal-info-value">${scoreText}</span></div>` : ''}
          ${place.ticketInfo ? `<div class="modal-info-item"><span class="modal-info-label">&#x1F3AB; Entrada</span><span class="modal-info-value">${place.ticketInfo}</span></div>` : ''}
        </div>
      </div>
      ${place.address ? `<div class="modal-section"><div class="modal-section-title">Direcci&oacute;n</div><div class="modal-address">${icons.mapPin} <a href="https://www.google.com/maps/search/${encodeURIComponent(place.address)}" target="_blank" class="address-link">${place.address}</a></div></div>` : ''}
    </div>`;
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
          ${_citiesArray.map((c) => `<a href="/city.html?id=${c.id}">${c.name}</a>`).join('')}
          ${plannerLink}
          <div class="nav-tools">
            <a href="/admin.html" class="nav-tool-btn" title="Admin">&#x2699;&#xFE0F;</a>
          </div>
        </div>
        <div class="nav-mobile-tools">
          <a href="/admin.html" class="nav-tool-btn">&#x2699;&#xFE0F;</a>
          <button class="nav-mobile-toggle" id="mobile-toggle">${icons.menu}</button>
        </div>
      </div>
      <div class="nav-mobile-menu" id="mobile-menu">
        <a href="/">Inicio</a>
        ${_citiesArray.map((c) => `<a href="/city.html?id=${c.id}">${c.name}</a>`).join('')}
        ${plannerLink}
      </div>
    </nav>
  `;
}

function renderPlannerPage() {
  destroyPlannerMap();

  const groups = buildGroupedData();
  const plannerLink = `<a href="/planner.html" style="color:var(--accent); font-weight:bold;">&#x1F5D3;&#xFE0F; Planner</a>`;
  const trayCount = groups.tray.length + groups.unassigned.length;
  const plannedCount = Array.from({ length: _totalTripDays }, (_, i) => i + 1)
    .reduce((acc, day) => acc + groups[day].length, 0);
  const doneCount = _plannerItems.filter((p) => p.status === 'done' && _places.some((pl) => pl.id === p.placeId)).length;

  _selectedMapScope = normalizeMapScope(_selectedMapScope);
  const mapModel = buildMapModel(_selectedMapScope, groups);

  const daysHtml = Array.from({ length: _totalTripDays }, (_, i) => {
    const day = i + 1;
    const entries = groups[day];
    return `
      <div class="planner-day-block" data-day="${day}">
        <div class="planner-day-header">
          <div class="planner-day-number">${day}</div>
          <div>
            <div class="planner-day-label">${formatDayLabel(day)}</div>
            <div class="planner-day-count">${entries.length} actividad${entries.length !== 1 ? 'es' : ''}</div>
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

    ${_viewMode === 'calendar' ? calendarLayout : renderMapPanel(mapModel)}

    <div class="modal-overlay" id="planner-modal-overlay">
      <div class="modal" id="planner-modal"></div>
    </div>
  `;

  document.getElementById('mobile-toggle')?.addEventListener('click', () => {
    document.getElementById('mobile-menu')?.classList.toggle('open');
  });

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
      const iconHtml = `
        <div class="planner-route-marker" style="--route-color:${route.color};">
          <span class="planner-route-emoji">${cat?.icon || '&#x1F4CD;'}</span>
          <span class="planner-route-day-badge">D${entry.day}</span>
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
            <span class="popup-priority" style="background:${route.color}; color:#fff;">Ruta D&iacute;a ${entry.day}</span>
          </div>
          <button class="popup-btn planner-map-popup-btn" data-place-id="${entry.place.id}">Ver detalles</button>
        </div>
      `);
    });

    if (latlngs.length >= 2) {
      L.polyline(latlngs, {
        color: route.color,
        weight: 4,
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

function openPlaceModal(place) {
  const overlay = document.getElementById('planner-modal-overlay');
  const modal = document.getElementById('planner-modal');
  if (!overlay || !modal) return;

  modal.innerHTML = renderModal(place);
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  document.getElementById('planner-modal-close')?.addEventListener('click', closePlaceModal);
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

window.addEventListener('scroll', () => {
  document.getElementById('main-nav')?.classList.toggle('scrolled', window.scrollY > 10);
});

async function boot() {
  const settingsArray = (await getAll('settings')) || [];
  _globalSettings = settingsArray.find((s) => s.id === 'global') || {};

  if (!_globalSettings.plannerEnabled) {
    app.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; gap:20px; text-align:center; padding:20px;">
        <div style="font-size:4rem;">&#x1F5D3;&#xFE0F;</div>
        <h2 style="font-family:'Outfit',sans-serif;">Planificador desactivado</h2>
        <p style="color:var(--text-secondary);">Activa el m&oacute;dulo en <a href="/admin.html" style="color:var(--accent);">Administraci&oacute;n &rarr; Configuraci&oacute;n del Viaje</a> y guarda los ajustes.</p>
        <a href="/" style="padding:10px 20px; background:var(--accent); color:white; border-radius:999px; font-weight:600; text-decoration:none;">Volver al Inicio</a>
      </div>`;
    return;
  }

  _places = await getAll('places');
  _plannerItems = (await getAll('planner')) || [];
  _citiesArray = await getAll('cities');
  _totalTripDays = calcTripDays(_globalSettings);

  const groups = buildGroupedData();
  _selectedMapScope = getRecommendedMapScope(groups);

  document.title = 'Planificador \u2014 Jap\u00F3n 2026';
  renderPlannerPage();
}

boot();
