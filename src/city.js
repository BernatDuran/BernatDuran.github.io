import './styles/main.css';
import './styles/components.css';
import './styles/pages.css';
import { categories, priorityLabels } from './data/cities.js';
import { filterPlaces, getZones } from './utils/filters.js';
import { icons, formatScore, debounce, getTimeIcon } from './utils/helpers.js';
import { initLeafletMap, updateMapMarkers, renderPlaceMap, getGoogleMapsUrl } from './utils/maps.js';
import { registerSW } from 'virtual:pwa-register';
import { getById, getAll, putAll } from './utils/db.js';
import { bindMobileNav, renderMobileMenu } from './utils/nav.js';
import { formatRecommendedDays, sortCities } from './utils/cityData.js';
import { BEST_TIME_OPTIONS, formatBestTimeLabel, normalizePlaceRecord } from './utils/placeData.js';
import { runDataMigration } from './utils/dataMigration.js';
import { renderPlaceDetailModal } from './utils/placeDetailModal.js';
// Register PWA Service Worker
if ('serviceWorker' in navigator) {
  registerSW({ immediate: true });
}

export function initCityPage(cityMeta, places, citiesArray, initialPlannerItems, globalSettings, pendingEditPlaceId = '') {
  const app = document.getElementById('app');
  const cityColor = cityMeta.color;

  function slugifyPlaceSegment(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');
  }

  function buildAutoPlaceId(name, existingId = null) {
    const baseSlug = slugifyPlaceSegment(name) || 'actividad';
    const baseId = `${cityMeta.id}-${baseSlug}`;
    let candidate = baseId;
    let suffix = 2;

    while (places.some((entry) => entry.id === candidate && entry.id !== existingId)) {
      candidate = `${baseId}-${suffix}`;
      suffix += 1;
    }

    return candidate;
  }

  function clearPendingEditUrl() {
    try {
      sessionStorage.removeItem('pendingPlaceEdit');
    } catch {
      // Storage can be unavailable in some browser privacy modes.
    }

    const url = new URL(window.location.href);
    if (url.searchParams.has('editPlace')) {
      url.searchParams.delete('editPlace');
      window.history.replaceState({}, '', `${url.pathname}${url.search}`);
    }
  }

  let totalTripDays = 1;
  let datesFormatted = '30 junio &mdash; 16 julio 2026';
  if (globalSettings && globalSettings.startDate && globalSettings.endDate) {
    const start = new Date(globalSettings.startDate);
    const end = new Date(globalSettings.endDate);
    const days = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
    if (days >= 1 && !isNaN(days)) totalTripDays = days;
    const formattedStart = start.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
    const formattedEnd = end.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    datesFormatted = `${formattedStart} &mdash; ${formattedEnd}`;
  }

  // State
  let state = {
    search: '',
    category: '',
    priority: '',
    zone: '',
    timeOfDay: '',
    scoreBands: [],
    plannerFilter: '', // '', 'none', 'in-tray', 'planned', 'done', 'discarded'
    plannerDay: '',
    rainyFriendly: false
  };
  
  let plannerItems = initialPlannerItems || [];
  let mapInstance = null;
  let savedMapElement = null;
  let scoreDropdownOpen = false;

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

  function restoreTransientUiState() {
    requestAnimationFrame(() => {
      if (!scoreDropdownOpen) return;
      document.querySelector('.score-filter-group')?.setAttribute('open', '');
    });
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

  function getPlannerItem(placeId) {
    return plannerItems.find(p => p.placeId === placeId) || {};
  }

  function getFilteredPlaces() {
    let filtered = filterPlaces(places, state);
    if (state.plannerFilter || state.plannerDay) {
      filtered = filtered.filter(p => {
        const item = getPlannerItem(p.id);
        
        // Check planner status
        if (state.plannerFilter) {
          if (state.plannerFilter === 'none' && item.status) return false;
          if (state.plannerFilter !== 'none' && item.status !== state.plannerFilter) return false;
        }
        
        // Check planner day
        if (state.plannerDay) {
          if (String(item.assignedDay) !== state.plannerDay) return false;
        }
        
        return true;
      });
    }
    return filtered;
  }

  function render() {
    const focusState = captureInputFocusState();
    const oldMapContainer = document.getElementById('city-map-container');
    if (oldMapContainer && mapInstance) {
      savedMapElement = oldMapContainer;
    }

    const filtered = getFilteredPlaces();
    const zones = getZones(places);
    const mustSeeCount = places.filter(p => p.priority === 'must-see').length;
    const trayCount = plannerItems.filter(p => p.status === 'in-tray' && places.some(pl => pl.id === p.placeId)).length;

    app.innerHTML = `
      ${renderNav(cityMeta, citiesArray)}
      ${renderHero(cityMeta)}
      <section class="section-sm">
        <div class="container">
          ${renderSummary(cityMeta, places, mustSeeCount)}
        </div>
      </section>
      <section class="section-sm" style="padding-top:0;">
        <div class="container">
          <div class="city-action-bar">
            <div>
              <div class="city-action-title">Gesti&oacute;n de actividades</div>
            </div>
            <button class="maps-link-btn city-create-btn" id="btn-create-place">&#x2795; Nueva actividad</button>
          </div>
        </div>
      </section>
      <div class="filters-section" id="filters-section">
        <div class="filters-inner">
          <div class="filters-row filters-row-search">
            <div class="search-bar-container" style="flex:1;max-width:400px;">
              <span class="search-bar-icon">${icons.search}</span>
              <input type="text" class="search-bar" id="search-input" placeholder="Buscar lugar, zona o tipo..." value="${state.search}">
              <button class="search-clear ${state.search ? 'visible' : ''}" id="search-clear">&#x2715;</button>
            </div>
            <div class="filters-inline-actions">
              ${renderPriorityFilters(false)}
              <span class="nav-separator filter-soft-separator" aria-hidden="true">|</span>
              <button class="filter-pill ${state.rainyFriendly ? 'active' : ''}" id="rainy-filter">&#x2614; Solo lluvia</button>
            </div>
            <span class="results-count" id="results-count">${filtered.length} de ${places.length} lugares</span>
          </div>
          <div class="filters-row filters-row-controls">
            ${renderCategoryFilters()}
            ${renderSingleSelectFilter({
              id: 'zone',
              value: state.zone,
              fallbackLabel: 'Todas las zonas',
              options: [
                { value: '', label: 'Todas las zonas' },
                ...zones.map((zone) => ({ value: zone, label: zone }))
              ]
            })}
            ${renderSingleSelectFilter({
              id: 'timeOfDay',
              value: state.timeOfDay,
              fallbackLabel: '&#x1F551; Cualquier momento',
              options: [
                { value: '', label: '&#x1F551; Cualquier momento' },
                { value: 'mañana', label: '&#x2600;&#xFE0F; Ma&ntilde;ana' },
                { value: 'tarde', label: '&#x1F307; Tarde' },
                { value: 'noche', label: '&#x1F319; Noche' }
              ]
            })}
            ${renderScoreFilters()}
            ${renderSingleSelectFilter({
              id: 'plannerFilter',
              value: state.plannerFilter,
              fallbackLabel: 'Todos los estados',
              options: [
                { value: '', label: 'Todos los estados' },
                { value: 'none', label: 'Sin asignar' },
                { value: 'in-tray', label: 'En bandeja' },
                { value: 'planned', label: 'Planeado' },
                { value: 'done', label: 'Realizado' },
                { value: 'discarded', label: 'Descartado' }
              ]
            })}
            ${renderSingleSelectFilter({
              id: 'plannerDay',
              className: 'day-filter-dropdown',
              value: state.plannerDay,
              fallbackLabel: 'Todos los d&iacute;as',
              options: [
                { value: '', label: 'Todos los d&iacute;as' },
                ...Array.from({ length: totalTripDays }, (_, i) => ({ value: String(i + 1), label: `D&iacute;a ${i + 1}` }))
              ]
            })}
            ${hasActiveFilters() ? `<button class="clear-filters" id="clear-filters">Limpiar filtros</button>` : ''}
          </div>
        </div>
      </div>
      <section class="section-sm">
        <div class="container">
          ${filtered.length > 0 ? `<div class="places-grid" id="places-grid">${filtered.map(p => renderPlaceCard(p)).join('')}</div>` :
            `<div class="empty-state"><div class="empty-state-icon">&#x1F50D;</div><h3>No se encontraron lugares</h3><p>Prueba a cambiar los filtros o el texto de b&uacute;squeda</p></div>`}
        </div>
      </section>
      
      <section class="city-map-section section-sm">
        <div class="container">
          <div class="home-section-title"><h2>&#x1F5FA;&#xFE0F; Mapa Interactivo</h2><p>Explora la ciudad y encuentra lugares cercanos</p></div>
          <div id="map-placeholder-div"><div id="city-map-container" class="city-map-container"></div></div>
        </div>
      </section>
      
      ${renderItineraries(cityMeta, places)}
      ${renderFooter()}
      <div class="modal-overlay" id="modal-overlay"><div class="modal" id="modal"></div></div>
      <button class="back-to-top" id="back-to-top">${icons.chevronUp}</button>
    `;
    attachEvents();
    restoreInputFocusState(focusState);
    restoreTransientUiState();
    
    // Restore or Initialize map
    if (savedMapElement) {
      const placeholder = document.getElementById('map-placeholder-div');
      if (placeholder) {
        placeholder.replaceWith(savedMapElement);
      }
      updateMapMarkers(mapInstance, filtered, openModal);
    } else {
      const mapContainer = document.getElementById('city-map-container');
      if (mapContainer && !mapInstance) {
        setTimeout(() => {
          mapInstance = initLeafletMap('city-map-container', cityMeta.center, cityMeta.defaultZoom);
          updateMapMarkers(mapInstance, filtered, openModal);
        }, 100);
      }
    }
  }

  function renderNav(city, citiesArray) {
    const plannerLink = `<a href="/planner.html" style="color:var(--accent); font-weight:bold;">&#x1F5D3;&#xFE0F; Planner</a>`;
    return `<nav class="nav" id="main-nav">
      <div class="nav-inner">
        <a href="/" class="nav-logo">&#x1F1EF;&#x1F1F5; Jap&oacute;n 2026 <span class="ja">&#x65E5;&#x672C;</span></a>
        <div class="nav-links">
          <a href="/">Inicio</a>
          <span class="nav-separator" aria-hidden="true">|</span>
          ${citiesArray.map(c => `<a href="/city.html?id=${c.id}" class="${c.id === city.id ? 'active' : ''}">${c.name}</a>`).join('')}
          <span class="nav-separator" aria-hidden="true">|</span>
          ${plannerLink}
          <div class="nav-tools">
            <a href="/admin.html" class="nav-tool-btn" title="Administraci&oacute;n">&#x2699;&#xFE0F;</a>
          </div>
        </div>
        <div class="nav-mobile-tools">
          <a href="/admin.html" class="nav-tool-btn" title="Admin">&#x2699;&#xFE0F;</a>
          ${renderMobileMenu('mobile-toggle', 'mobile-menu', `
            <a href="/">Inicio</a>
            ${citiesArray.map(c => `<a href="/city.html?id=${c.id}" class="${c.id === city.id ? 'active' : ''}">${c.name} ${c.nameJa || ''}</a>`).join('')}
            ${plannerLink}
          `)}
        </div>
      </div>
    </nav>`;
  }

  function renderHero(city) {
    return `<div class="city-hero" style="background: ${city.gradient}; color: white;">
      <div class="city-hero-content">
        <a href="/" class="back-link" style="color:rgba(255,255,255,0.8);">${icons.arrowLeft} Volver al inicio</a>
        <h1>${city.name}</h1>
        <p class="city-ja">${city.nameJa} &mdash; ${city.tagline}</p>
        <p class="city-hero-desc">${city.description}</p>
      </div>
    </div>`;
  }

  function renderSummary(city, allPlaces, mustSeeCount) {
    return `<div class="city-summary">
      <div class="summary-card"><div class="summary-card-icon">&#x1F3AF;</div><h4>Experiencia</h4><p>${city.summary}</p></div>
      <div class="summary-card"><div class="summary-card-icon">&#x1F465;</div><h4>Ideal para</h4><p>${city.idealFor}</p></div>
      <div class="summary-card"><div class="summary-card-icon">&#x1F4CA;</div><h4>En n&uacute;meros</h4><p>${allPlaces.length} lugares &middot; ${mustSeeCount} imprescindibles &middot; ${city.zones.length} zonas &middot; ${formatRecommendedDays(city.recommendedDays)}</p></div>
    </div>`;
  }

  function renderCategoryFilters() {
    return renderSingleSelectFilter({
      id: 'category',
      value: state.category,
      fallbackLabel: 'Todas las categor&iacute;as',
      options: [
        { value: '', label: 'Todas las categor&iacute;as' },
        ...categories
          .filter(c => places.some(p => p.category === c.id))
          .map(c => ({ value: c.id, label: `${c.icon} ${c.label}` }))
      ]
    });
  }

  function escapeFilterAttribute(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function renderSingleSelectFilter({ id, value, fallbackLabel, options, className = '' }) {
    const current = options.find((option) => String(option.value) === String(value));
    const summaryLabel = current?.label || fallbackLabel;

    return `
      <details class="filter-dropdown single-select-dropdown ${className}">
        <summary class="zone-select single-select-summary">${summaryLabel}</summary>
        <div class="single-select-panel">
          ${options.map((option) => {
            const isActive = String(option.value) === String(value);
            return `
              <button type="button"
                      class="single-select-option ${isActive ? 'active' : ''}"
                      data-filter-target="${id}"
                      data-value="${escapeFilterAttribute(option.value)}">
                ${option.label}
              </button>
            `;
          }).join('')}
        </div>
      </details>
    `;
  }

  function renderScoreFilters() {
    const scoreOptions = [
      { value: 'all', label: 'Todas' },
      { value: '0-4', label: '0-4' },
      { value: '5-6', label: '5-6' },
      { value: '7-8', label: '7-8' },
      { value: '9', label: '9' },
      { value: '10', label: '10' }
    ];

    const hasSpecificSelection = state.scoreBands.length > 0;

    const summaryLabel = !hasSpecificSelection
      ? '&#x2B50; Todas'
      : `&#x2B50; ${state.scoreBands.join(', ')}`;

    return `
      <details class="filter-dropdown multi-select-dropdown score-filter-group">
        <summary class="zone-select multi-select-summary">${summaryLabel}</summary>
        <div class="multi-select-panel">
          ${scoreOptions.map((option) => {
            const checked = option.value === 'all'
              ? !hasSpecificSelection
              : state.scoreBands.includes(option.value);
            return `
              <label class="multi-select-option">
                <input type="checkbox" data-score-band="${option.value}" ${checked ? 'checked' : ''}>
                <span>&#x2B50; ${option.label}</span>
              </label>
            `;
          }).join('')}
        </div>
      </details>
    `;
  }

  function renderPriorityFilters(iconOnly = false) {
    return Object.entries(priorityLabels)
      .map(([key, val]) => iconOnly
        ? `<button class="filter-pill filter-pill-icon-only ${state.priority === key ? 'active' : ''}" data-priority="${key}" title="${val.label}" aria-label="${val.label}"><span class="icon">${val.icon}</span></button>`
        : `<button class="filter-pill ${state.priority === key ? 'active' : ''}" data-priority="${key}"><span class="icon">${val.icon}</span> ${val.label}</button>`)
      .join('');
  }

  function getPlannerChipUI(placeId) {
    const item = getPlannerItem(placeId);
    const status = item.status || 'none';
    let label = 'Sin asignar';
    let icon = '&#x2795;';
    let style = 'background:var(--bg-secondary); color:var(--text-primary); border-color:var(--border);';
    
    if (status === 'in-tray') {
      label = 'En bandeja'; icon = '&#x1F4E5;'; style = 'background:#fef3c7; color:#b45309; border-color:#fde68a;';
    } else if (status === 'planned') {
      label = `D&iacute;a ${item.assignedDay || 1}`; icon = '&#x1F5D3;&#xFE0F;'; style = 'background:#e0e7ff; color:#4338ca; border-color:#c7d2fe;';
    } else if (status === 'done') {
      label = 'Realizada'; icon = '&#x2705;'; style = 'background:#dcfce7; color:#15803d; border-color:#bbf7d0;';
    } else if (status === 'discarded') {
      label = 'Descartada'; icon = '&#x274C;'; style = 'background:#f3f4f6; color:#9ca3af; border-color:#e5e7eb;';
    }

    const dayOptions = Array.from({length: totalTripDays}, (_, i) => i + 1)
      .map(d => `<option value="${d}" ${item.assignedDay == d ? 'selected' : ''}>D&iacute;a ${d}</option>`).join('');

    return `
      <div class="planner-chip-container">
        <div class="planner-chip" style="${style}" onclick="this.nextElementSibling.classList.toggle('open')">
          ${icon} ${label}
        </div>
        <div class="planner-chip-dropdown">
          <button class="planner-dropdown-btn" data-action="in-tray" data-id="${placeId}">&#x1F4E5; Bandeja</button>
          <div class="planner-day-selector">
            <select class="planner-day-select" data-id="${placeId}">
              <option value="" disabled selected>&#x1F5D3;&#xFE0F; Asignar d&iacute;a...</option>
              ${dayOptions}
            </select>
          </div>
          <button class="planner-dropdown-btn" data-action="done" data-id="${placeId}">&#x2705; Realizada</button>
          <button class="planner-dropdown-btn" data-action="discarded" data-id="${placeId}">&#x274C; Descartar</button>
        </div>
      </div>
    `;
  }

  function getUmbrellaSVG(isFriendly, editable, placeId) {
    const color = isFriendly ? '#0ea5e9' : '#9ca3af';
    const bg = isFriendly ? '#e0f2fe' : '#f3f4f6';
    const title = isFriendly ? 'Apto para lluvia' : 'No apto para lluvia';
    const svgPath = `<path d="M12 3v18m0-18C6 3 2 9 2 9h20s-4-6-10-6zm0 18c-1.5 0-3-1-3-3"/>`;
    const crossLine = !isFriendly ? `<line x1="4" y1="4" x2="20" y2="20" stroke="#9ca3af" stroke-width="2"/>` : '';
    const cursor = editable ? 'cursor:pointer;' : 'cursor:default;';
    const classes = editable ? 'rainy-toggle-btn' : '';

    return `
      <div class="${classes}" data-id="${placeId}" title="${title}" style="display:flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:50%; background:${bg}; color:${color}; ${cursor} transition:all 0.2s;" ${editable ? `onmouseover="this.style.transform='scale(1.1)';" onmouseout="this.style.transform='scale(1)';"` : ''}>
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
          ${svgPath}
          ${crossLine}
        </svg>
      </div>
    `;
  }

  function renderPlaceCard(place) {
    const cat = categories.find(c => c.id === place.category);
    const prio = priorityLabels[place.priority];
    const plannerItem = getPlannerItem(place.id);
    const isDiscarded = plannerItem.status === 'discarded';
    const scoreText = formatScore(place.score);

    return `<div class="place-card ${isDiscarded ? 'discarded-card' : ''}" data-place-id="${place.id}" style="${isDiscarded ? 'opacity:0.6;' : ''}">
      <div class="place-card-header">
        <div>
          <div class="place-card-title">${place.name}</div>
          <div class="place-card-category"><span class="icon">${cat?.icon || '&#x1F4CD;'}</span> ${place.type}</div>
        </div>
        ${getPlannerChipUI(place.id)}
      </div>
      <div class="place-card-desc">${place.description}</div>
      <div class="place-card-meta">
        <div class="place-card-meta-top">
          <span class="priority-badge ${prio.class}">${prio.icon} ${prio.label}</span>
          <span class="place-card-zone">${place.zone}</span>
        </div>
        <div class="place-card-meta-bottom">
          ${place.estimatedDuration ? `<span class="place-card-duration"><span class="place-card-duration-icon">${icons.clock}</span><span class="place-card-duration-text">${place.estimatedDuration}</span></span>` : '<span></span>'}
          <div class="place-card-meta-actions" onclick="event.stopPropagation()">
          ${scoreText ? `<span class="place-card-score">&#x2B50; ${scoreText}</span>` : ''}
          ${getUmbrellaSVG(place.rainyFriendly, false, place.id)}
          <a href="${getGoogleMapsUrl(place, globalSettings?.mapLinkStyle)}" target="_blank" title="Abrir en Google Maps" style="display:flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:50%; background:#f1f5f9; color:#3b82f6; transition:all 0.2s;" onmouseover="this.style.background='#e2e8f0'; this.style.transform='scale(1.1)';" onmouseout="this.style.background='#f1f5f9'; this.style.transform='scale(1)';">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          </a>
        </div>
        </div>
      </div>
    </div>`;
  }

  function renderModal(place) {
    const cat = categories.find(c => c.id === place.category);
    const prio = priorityLabels[place.priority];
    const scoreText = formatScore(place.score);
    return renderPlaceDetailModal({
      place,
      category: cat,
      priority: prio,
      scoreText,
      plannerChipHtml: getPlannerChipUI(place.id),
      requiresTicketHtml: place.requiresTicket ? `<span class="priority-badge" style="background:#eff6ff;color:#2563eb;">&#x1F3AB; Requiere entrada</span>` : '',
      rainyToggleHtml: getUmbrellaSVG(place.rainyFriendly, true, place.id),
      mapsLinkHtml: `<a href="${getGoogleMapsUrl(place, globalSettings?.mapLinkStyle)}" target="_blank" title="Abrir en Google Maps" class="modal-inline-icon-btn">
                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              </a>`,
      googleMapsUrl: getGoogleMapsUrl(place, globalSettings?.mapLinkStyle),
      timeIcon: getTimeIcon(place.bestTime),
      bestTimeLabel: formatBestTimeLabel(place.bestTime),
      closeButtonId: 'modal-close',
      editButtonId: 'edit-place-btn',
      showEditButton: true,
      mapContainerId: `modal-map-${place.id}`,
      commentLabel: 'Nota personal'
    });
  }


  function renderPlaceForm(place = null) {
    const isEdit = Boolean(place);
    const formPlace = place || {
      id: buildAutoPlaceId(''),
      cityId: cityMeta.id,
      name: '',
      category: categories[0]?.id || '',
      type: '',
      priority: 'optional',
      zone: cityMeta.zones?.[0] || '',
      description: '',
      address: '',
      lat: '',
      lng: '',
      estimatedDuration: '',
      bestTime: 'cualquier-momento',
      rainyFriendly: false,
      score: '',
      requiresTicket: false,
      ticketInfo: '',
      tips: '',
      comment: ''
    };

    const latValue = formPlace.lat ?? formPlace.coordinates?.lat ?? '';
    const lngValue = formPlace.lng ?? formPlace.coordinates?.lng ?? '';
    const generatedId = isEdit ? formPlace.id : buildAutoPlaceId(formPlace.name, formPlace.id);

    return `<div class="modal-handle"></div>
      <div class="modal-header">
        <div>
          <h2 style="margin-bottom:4px;">${isEdit ? 'Editar actividad' : 'Nueva actividad'}</h2>
          <div class="place-card-category" style="margin:0;">${cityMeta.name}</div>
        </div>
        <button class="modal-close" id="modal-close-form">&#x2715;</button>
      </div>
      <div class="modal-body">
        <form id="place-form" class="admin-form" data-editing-id="${isEdit ? formPlace.id : ''}">
          <p class="city-form-help">Los campos marcados con <strong>*</strong> son obligatorios. El ID se genera autom&aacute;ticamente en formato seguro, sin acentos ni caracteres especiales.</p>
          <input type="hidden" id="place-form-id" value="${generatedId}">
          <div class="form-group"><label>Ciudad</label><input type="text" value="${cityMeta.name}" readonly style="background:#eee; cursor:not-allowed;"><input type="hidden" id="place-form-city-id" value="${cityMeta.id}"></div>
          <div class="form-group"><label>Nombre *</label><input type="text" id="place-form-name" value="${formPlace.name || ''}" required placeholder="Ej: Templo Senso-ji"></div>
          <div class="form-group"><label>Categor&iacute;a *</label><select id="place-form-category" required>${categories.map((category) => `<option value="${category.id}" ${formPlace.category === category.id ? 'selected' : ''}>${category.label}</option>`).join('')}</select></div>
          <div class="form-group"><label>Tipo *</label><input type="text" id="place-form-type" value="${formPlace.type || ''}" required placeholder="Ej: Templo, mirador, museo"></div>
          <div class="form-group"><label>Prioridad *</label><select id="place-form-priority" required>${Object.entries(priorityLabels).map(([value, config]) => `<option value="${value}" ${formPlace.priority === value ? 'selected' : ''}>${config.label}</option>`).join('')}</select></div>
          <div class="form-group"><label>Zona *</label><input type="text" id="place-form-zone" value="${formPlace.zone || ''}" required placeholder="Ej: Asakusa"></div>
          <div class="form-group"><label>Descripci&oacute;n *</label><textarea id="place-form-description" rows="3" required placeholder="Ej: Templo budista hist&oacute;rico con gran pagoda y acceso f&aacute;cil desde la estaci&oacute;n.">${formPlace.description || ''}</textarea></div>
          <div class="form-group"><label>Direcci&oacute;n</label><input type="text" id="place-form-address" value="${formPlace.address || ''}" placeholder="Ej: 2-3-1 Asakusa, Taito City, Tokyo"></div>
          <div class="form-group" style="display:flex; gap:10px;"><div style="flex:1;"><label>Latitud</label><input type="number" id="place-form-lat" value="${latValue}" step="any"></div><div style="flex:1;"><label>Longitud</label><input type="number" id="place-form-lng" value="${lngValue}" step="any"></div></div>
          <div class="form-group" style="display:flex; gap:10px;"><div style="flex:1;"><label>Duraci&oacute;n estimada</label><input type="text" id="place-form-duration" value="${formPlace.estimatedDuration || ''}" placeholder="Ej: 1 h 30 min"></div><div style="flex:1;"><label>Mejor momento</label><select id="place-form-best-time">${BEST_TIME_OPTIONS.map((option) => `<option value="${option.value}" ${option.value === (formPlace.bestTime || 'cualquier-momento') ? 'selected' : ''}>${option.label}</option>`).join('')}</select></div></div>
          <div class="form-group" style="display:flex; gap:18px; flex-wrap:wrap;"><label style="display:flex; align-items:center; gap:8px; margin:0;"><input type="checkbox" id="place-form-rainy" ${formPlace.rainyFriendly ? 'checked' : ''}> Apto para lluvia</label><label style="display:flex; align-items:center; gap:8px; margin:0;"><input type="checkbox" id="place-form-ticket" ${formPlace.requiresTicket ? 'checked' : ''}> Requiere entrada</label></div>
          <div class="form-group"><label>Puntuaci&oacute;n</label><input type="number" id="place-form-score" value="${formPlace.score ?? ''}" min="1" max="10" step="0.1" placeholder="Ej: 8.7"><small class="city-form-hint">Rango permitido: de 1 a 10. D&eacute;jalo vac&iacute;o si todav&iacute;a no la quieres puntuar.</small></div>
          <div class="form-group"><label>Informaci&oacute;n de entrada</label><input type="text" id="place-form-ticket-info" value="${formPlace.ticketInfo || ''}" placeholder="Ej: Gratuita / 12 € / reserva previa"></div>
          <div class="form-group"><label>Consejos</label><textarea id="place-form-tips" rows="2" placeholder="Ej: Mejor llegar antes de las 9:00 para evitar colas.">${formPlace.tips || ''}</textarea></div>
          <div class="form-group"><label>Comentario</label><textarea id="place-form-comment" rows="2" placeholder="Ej: Ideal para combinar con una ruta por el barrio.">${formPlace.comment || ''}</textarea></div>
          <p id="place-form-error" style="display:none; color:#dc2626; font-weight:600; margin-bottom:12px;"></p>
          <button type="submit" class="maps-link-btn" style="width:100%; justify-content:center;">${isEdit ? 'Guardar cambios' : 'Crear actividad'}</button>
        </form>
      </div>`;
  }

  function openPlaceForm(place = null) {
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('modal');
    if (!overlay || !modal) return;
    modal.innerHTML = renderPlaceForm(place);
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    document.getElementById('modal-close-form')?.addEventListener('click', closeModal);
    const nameInput = document.getElementById('place-form-name');
    const idInput = document.getElementById('place-form-id');
    if (!place && nameInput && idInput) {
      const syncId = () => {
        idInput.value = buildAutoPlaceId(nameInput.value);
      };
      syncId();
      nameInput.addEventListener('input', syncId);
    }
    document.getElementById('place-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const editingId = event.currentTarget.dataset.editingId || null;
      const id = document.getElementById('place-form-id').value.trim().toLowerCase();
      const latRaw = document.getElementById('place-form-lat').value.trim();
      const lngRaw = document.getElementById('place-form-lng').value.trim();
      const scoreRaw = document.getElementById('place-form-score').value.trim();
      const errorEl = document.getElementById('place-form-error');

      if (!id) {
        errorEl.textContent = 'El ID es obligatorio.';
        errorEl.style.display = 'block';
        return;
      }

      if (!editingId && places.some((entry) => entry.id === id)) {
        errorEl.textContent = 'Ya existe una actividad con este ID.';
        errorEl.style.display = 'block';
        return;
      }

      if ((latRaw && !lngRaw) || (!latRaw && lngRaw)) {
        errorEl.textContent = 'Latitud y longitud deben informarse juntas o dejarse vacías.';
        errorEl.style.display = 'block';
        return;
      }

      let parsedScore = null;
      if (scoreRaw) {
        parsedScore = Number.parseFloat(scoreRaw.replace(',', '.'));
        if (!Number.isFinite(parsedScore) || parsedScore < 1 || parsedScore > 10) {
          errorEl.textContent = 'La puntuación debe estar entre 1 y 10.';
          errorEl.style.display = 'block';
          return;
        }
      }

      const draft = normalizePlaceRecord({
        ...(place || {}),
        id,
        cityId: cityMeta.id,
        name: document.getElementById('place-form-name').value.trim(),
        category: document.getElementById('place-form-category').value,
        type: document.getElementById('place-form-type').value.trim(),
        priority: document.getElementById('place-form-priority').value,
        zone: document.getElementById('place-form-zone').value.trim(),
        description: document.getElementById('place-form-description').value.trim(),
        address: document.getElementById('place-form-address').value.trim(),
        lat: latRaw,
        lng: lngRaw,
        estimatedDuration: document.getElementById('place-form-duration').value.trim(),
        bestTime: document.getElementById('place-form-best-time').value,
        rainyFriendly: document.getElementById('place-form-rainy').checked,
        score: parsedScore,
        requiresTicket: document.getElementById('place-form-ticket').checked,
        ticketInfo: document.getElementById('place-form-ticket-info').value.trim(),
        tips: document.getElementById('place-form-tips').value.trim(),
        comment: document.getElementById('place-form-comment').value.trim()
      });

      await putAll('places', [draft]);

      if (editingId) {
        const index = places.findIndex((entry) => entry.id === editingId);
        if (index !== -1) places[index] = draft;
      } else {
        places.push(draft);
      }

      closeModal();
      render();
    });
  }

  function renderItineraries(city, allPlaces) {
    const itineraries = generateItineraries(city, allPlaces);
    if (!itineraries.length) return '';
    return `<section class="section-sm" style="background:var(--bg-secondary);">
      <div class="container">
        <div class="home-section-title"><h2>&#x1F4CB; Itinerarios sugeridos</h2><p>Propuesta de rutas por zonas para optimizar el tiempo</p></div>
        ${itineraries.map(it => `<div class="itinerary-block">
          <div class="itinerary-day"><span class="number" style="background:${cityColor};">${it.day}</span> D&iacute;a ${it.day}: ${it.zone}</div>
          <div class="itinerary-zone">${it.description}</div>
          <div class="itinerary-places">${it.places.map(p => `<div class="itinerary-place"><span class="dot" style="background:${cityColor};"></span><span class="time">${p.time}</span><span class="name">${p.name}</span></div>`).join('')}</div>
        </div>`).join('')}
      </div>
    </section>`;
  }

  function generateItineraries(city, allPlaces) {
    return city.zones.slice(0, 4).map((zone, i) => {
      const zonePlaces = allPlaces.filter(p => p.zone === zone).sort((a,b) => {
        const pr = { 'must-see': 0, 'recommended': 1, 'optional': 2 };
        return (pr[a.priority]||2) - (pr[b.priority]||2);
      }).slice(0, 5);
      const times = ['09:00', '10:30', '12:00', '14:00', '16:00'];
      return {
        day: i + 1,
        zone,
        description: `Explora los principales puntos de inter&eacute;s de ${zone}`,
        places: zonePlaces.map((p, j) => ({ name: p.name, time: times[j] || '17:00' }))
      };
    });
  }

  function renderFooter() {
    return `<footer class="footer"><div class="container"><p>Jap&oacute;n 2026 &middot; ${datesFormatted} &middot; Hecho con <span class="heart">&#x2764;&#xFE0F;</span></p></div></footer>`;
  }

  function hasActiveFilters() {
    return state.search || state.category || state.priority || state.zone || state.timeOfDay || state.scoreBands.length || state.plannerFilter || state.plannerDay || state.rainyFriendly;
  }

  function attachEvents() {
    // Search
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', debounce(e => { state.search = e.target.value; render(); }, 200));
    }
    document.getElementById('btn-create-place')?.addEventListener('click', () => openPlaceForm());
    document.getElementById('search-clear')?.addEventListener('click', () => {
      state.search = '';
      render();
      requestAnimationFrame(() => {
        document.getElementById('search-input')?.focus({ preventScroll: true });
      });
    });

    // Priority filters
    document.querySelectorAll('[data-priority]').forEach(btn => {
      btn.addEventListener('click', () => { state.priority = state.priority === btn.dataset.priority ? '' : btn.dataset.priority; render(); });
    });

    // Single-select dropdown filters
    document.querySelectorAll('[data-filter-target]').forEach((button) => {
      button.addEventListener('click', () => {
        const key = button.dataset.filterTarget;
        if (!Object.prototype.hasOwnProperty.call(state, key)) return;
        state[key] = button.dataset.value || '';
        render();
      });
    });

    // Score filters
    document.querySelectorAll('input[data-score-band]').forEach((input) => {
      input.addEventListener('change', () => {
        const value = input.dataset.scoreBand;
        scoreDropdownOpen = true;
        if (value === 'all') {
          state.scoreBands = [];
        } else if (input.checked) {
          state.scoreBands = Array.from(new Set([...state.scoreBands, value]));
        } else {
          state.scoreBands = state.scoreBands.filter((band) => band !== value);
        }
        render();
      });
    });

    document.querySelector('.score-filter-group')?.addEventListener('toggle', (event) => {
      scoreDropdownOpen = event.currentTarget.open;
    });

    document.querySelectorAll('.filter-dropdown').forEach((dropdown) => {
      dropdown.addEventListener('toggle', (event) => {
        if (!event.currentTarget.open) return;
        document.querySelectorAll('.filter-dropdown[open]').forEach((otherDropdown) => {
          if (otherDropdown !== event.currentTarget) otherDropdown.removeAttribute('open');
        });
        scoreDropdownOpen = event.currentTarget.classList.contains('score-filter-group');
      });
    });

    document.getElementById('rainy-filter')?.addEventListener('click', () => {
      state.rainyFriendly = !state.rainyFriendly;
      render();
    });

    // Clear filters
    document.getElementById('clear-filters')?.addEventListener('click', () => {
      state = { search: '', category: '', priority: '', zone: '', timeOfDay: '', scoreBands: [], plannerFilter: '', plannerDay: '', rainyFriendly: false };
      scoreDropdownOpen = false;
      render();
    });

    // Place card click -> modal
    document.querySelectorAll('.place-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.planner-chip-container')) return; // Ignore clicks on the planner chip
        const place = places.find(p => p.id === card.dataset.placeId);
        if (place) openModal(place);
      });
    });

    // Modal close
    document.getElementById('modal-overlay')?.addEventListener('click', e => { if (e.target.id === 'modal-overlay') closeModal(); });

    bindMobileNav('mobile-toggle', 'mobile-menu');

    // Back to top
    const backToTop = document.getElementById('back-to-top');
    if (backToTop) {
      window.addEventListener('scroll', () => { backToTop.classList.toggle('visible', window.scrollY > 500); });
      backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    }

    // Nav scroll effect
    window.addEventListener('scroll', () => { document.getElementById('main-nav')?.classList.toggle('scrolled', window.scrollY > 10); });
  }

  async function updatePlaceProp(placeId, prop, valueFn) {
    const place = places.find(p => p.id === placeId);
    if (!place) return;
    place[prop] = valueFn(place);
    await putAll('places', [place]);
    
    const isModalOpen = !!document.querySelector('.modal-overlay.open');
    render();
    if (isModalOpen) openModal(places.find(p => p.id === placeId));
  }

  async function setPlannerState(placeId, newStatus, assignedDay = null) {
    let item = plannerItems.find(p => p.placeId === placeId);
    if (!item) {
      item = { placeId, favorite: false, status: newStatus, assignedDay };
      plannerItems.push(item);
    } else {
      item.status = newStatus;
      item.assignedDay = assignedDay;
    }
    await putAll('planner', [item]);
    
    const isModalOpen = !!document.querySelector('.modal-overlay.open');
    render();
    if (isModalOpen) {
      const place = places.find(p => p.id === placeId);
      if (place) openModal(place);
    }
  }

  function openModal(place) {
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('modal');
    if (!overlay || !modal) return;
    modal.innerHTML = renderModal(place);
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    
    modal.querySelector('#modal-close')?.addEventListener('click', closeModal);
    modal.querySelector('#edit-place-btn')?.addEventListener('click', () => openPlaceForm(place));

    // Render minimap
    setTimeout(() => {
      renderPlaceMap(`modal-map-${place.id}`, place);
    }, 100);
  }

  function closeModal() {
    document.getElementById('modal-overlay')?.classList.remove('open');
    document.body.style.overflow = '';
  }

  // Global Delegation for Planner Events (only attach once)
  if (!window.__plannerEventsAttached) {
    document.addEventListener('click', (e) => {
      // 1. Close dropdowns if clicking outside
      if (!e.target.closest('.planner-chip-container')) {
        document.querySelectorAll('.planner-chip-dropdown.open').forEach(d => d.classList.remove('open'));
      }
      // 2. Handle button clicks inside dropdown
      const btn = e.target.closest('.planner-dropdown-btn[data-action]');
      if (btn) {
        e.stopPropagation();
        document.querySelectorAll('.planner-chip-dropdown.open').forEach(d => d.classList.remove('open'));
        setPlannerState(btn.dataset.id, btn.dataset.action);
      }
      
      // 3. Handle rainy friendly toggle
      const rainyBtn = e.target.closest('.rainy-toggle-btn');
      if (rainyBtn) {
        e.stopPropagation();
        updatePlaceProp(rainyBtn.dataset.id, 'rainyFriendly', (place) => !place.rainyFriendly);
      }
    });

    document.addEventListener('change', (e) => {
      if (e.target.classList.contains('planner-day-select')) {
        e.stopPropagation();
        document.querySelectorAll('.planner-chip-dropdown.open').forEach(d => d.classList.remove('open'));
        setPlannerState(e.target.dataset.id, 'planned', parseInt(e.target.value));
      }
    });
    
    window.__plannerEventsAttached = true;
  }

  if (!window.__cityScoreDropdownOutsideBound) {
    window.__cityScoreDropdownOutsideBound = true;
    document.addEventListener('click', (event) => {
      const openDropdown = document.querySelector('.filter-dropdown[open]');
      if (!openDropdown) return;
      if (event.target.closest('.filter-dropdown')) return;
      document.querySelectorAll('.filter-dropdown[open]').forEach((dropdown) => dropdown.removeAttribute('open'));
      scoreDropdownOpen = false;
    });
  }

  // Initial render
  render();
  if (pendingEditPlaceId) {
    const pendingPlace = places.find((place) => String(place.id) === String(pendingEditPlaceId));
    clearPendingEditUrl();
    if (pendingPlace) {
      requestAnimationFrame(() => {
        openPlaceForm(pendingPlace);
      });
    }
  }
}

async function boot() {
  await runDataMigration();
  const urlParams = new URLSearchParams(window.location.search);
  const cityId = urlParams.get('id');
  
  if (!cityId) {
    window.location.href = '/';
    return;
  }

  const cityMeta = await getById('cities', cityId);
  if (!cityMeta) {
    app.innerHTML = '<div style="padding: 50px; text-align: center;"><h1>Ciudad no encontrada</h1><a href="/">Volver</a></div>';
    return;
  }

  const allPlaces = (await getAll('places')).map((place) => normalizePlaceRecord(place));
  let pendingEditPlaceId = urlParams.get('editPlace') || '';

  try {
    const pendingEdit = JSON.parse(sessionStorage.getItem('pendingPlaceEdit') || 'null');
    const isFresh = pendingEdit?.createdAt && Date.now() - pendingEdit.createdAt < 5 * 60 * 1000;
    if (isFresh && pendingEdit.placeId) {
      pendingEditPlaceId = pendingEdit.placeId;
    }
  } catch {
    pendingEditPlaceId = pendingEditPlaceId || '';
  }

  if (pendingEditPlaceId) {
    const targetPlace = allPlaces.find((place) => String(place.id) === String(pendingEditPlaceId));
    if (targetPlace?.cityId && targetPlace.cityId !== cityId) {
      window.location.href = `/city.html?id=${encodeURIComponent(targetPlace.cityId)}`;
      return;
    }
  }

  const places = allPlaces.filter(p => p.cityId === cityId);
  const citiesArray = sortCities(await getAll('cities'));
  const plannerItems = await getAll('planner');
  
  const settingsArray = await getAll('settings') || [];
  const globalSettings = settingsArray.find(s => s.id === 'global') || {};
  
  document.title = `${cityMeta.name} — Japón 2026`;
  
  initCityPage(cityMeta, places, citiesArray, plannerItems, globalSettings, pendingEditPlaceId);
}

boot();

