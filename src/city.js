import './styles/main.css';
import './styles/components.css';
import './styles/pages.css';
import { categories, priorityLabels } from './data/cities.js';
import { filterPlaces, getZones } from './utils/filters.js';
import { icons, formatScore, debounce, getTimeIcon } from './utils/helpers.js';
import { initLeafletMap, updateMapMarkers, renderPlaceMap, getGoogleMapsUrl } from './utils/maps.js';
import { registerSW } from 'virtual:pwa-register';
import { getById, getAll, putAll } from './utils/db.js';
// Register PWA Service Worker
if ('serviceWorker' in navigator) {
  registerSW({ immediate: true });
}

export function initCityPage(cityMeta, places, citiesArray, initialPlannerItems, globalSettings) {
  const app = document.getElementById('app');
  const cityColor = cityMeta.color;

  let totalTripDays = 1;
  let datesFormatted = '30 junio — 16 julio 2026';
  if (globalSettings && globalSettings.startDate && globalSettings.endDate) {
    const start = new Date(globalSettings.startDate);
    const end = new Date(globalSettings.endDate);
    const days = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
    if (days >= 1 && !isNaN(days)) totalTripDays = days;
    const formattedStart = start.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
    const formattedEnd = end.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    datesFormatted = `${formattedStart} — ${formattedEnd}`;
  }

  // State
  let state = {
    search: '',
    category: '',
    priority: '',
    zone: '',
    timeOfDay: '',
    plannerFilter: '', // '', 'none', 'in-tray', 'planned', 'done', 'discarded'
    plannerDay: '',
    rainyFriendly: false
  };
  
  let plannerItems = initialPlannerItems || [];
  let mapInstance = null;
  let savedMapElement = null;

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
      <div class="filters-section" id="filters-section">
        <div class="filters-inner">
          <div class="filters-row">
            <div class="search-bar-container" style="flex:1;max-width:400px;">
              <span class="search-bar-icon">${icons.search}</span>
              <input type="text" class="search-bar" id="search-input" placeholder="Buscar lugar, zona o tipo..." value="${state.search}">
              <button class="search-clear ${state.search ? 'visible' : ''}" id="search-clear">✕</button>
            </div>
            <span class="results-count" id="results-count">${filtered.length} de ${places.length} lugares</span>
          </div>
          <div class="filters-row">
            <span class="filter-label">Categoría</span>
            ${renderCategoryFilters()}
          </div>
          <div class="filters-row">
            <span class="filter-label">Prioridad</span>
            ${renderPriorityFilters()}
            <div class="filter-divider"></div>
            <select class="zone-select" id="zone-select">
              <option value="">Todas las zonas</option>
              ${zones.map(z => `<option value="${z}" ${state.zone === z ? 'selected' : ''}>${z}</option>`).join('')}
            </select>
            <select id="time-filter" class="zone-select">
              <option value="">⏰ Momento</option>
              <option value="mañana" ${state.timeOfDay === 'mañana' ? 'selected' : ''}>☀️ Mañana</option>
              <option value="tarde" ${state.timeOfDay === 'tarde' ? 'selected' : ''}>🌇 Tarde</option>
              <option value="noche" ${state.timeOfDay === 'noche' ? 'selected' : ''}>🌙 Noche</option>
            </select>
            <select id="status-filter" class="zone-select">
              <option value="">Todos los estados</option>
              <option value="none" ${state.plannerFilter === 'none' ? 'selected' : ''}>Sin asignar</option>
              <option value="in-tray" ${state.plannerFilter === 'in-tray' ? 'selected' : ''}>En bandeja</option>
              <option value="planned" ${state.plannerFilter === 'planned' ? 'selected' : ''}>Planeado</option>
              <option value="done" ${state.plannerFilter === 'done' ? 'selected' : ''}>Realizado</option>
              <option value="discarded" ${state.plannerFilter === 'discarded' ? 'selected' : ''}>Descartado</option>
            </select>
            <select id="day-filter" class="zone-select">
              <option value="">Todos los días</option>
              ${Array.from({length: totalTripDays}, (_, i) => `<option value="${i+1}" ${state.plannerDay === String(i+1) ? 'selected' : ''}>Día ${i+1}</option>`).join('')}
            </select>
            <button class="filter-pill ${state.rainyFriendly ? 'active' : ''}" id="rainy-filter">☔ Solo Lluvia</button>
            ${hasActiveFilters() ? `<button class="clear-filters" id="clear-filters">Limpiar filtros</button>` : ''}
          </div>
        </div>
      </div>
      <section class="section-sm">
        <div class="container">
          ${filtered.length > 0 ? `<div class="places-grid" id="places-grid">${filtered.map(p => renderPlaceCard(p)).join('')}</div>` :
            `<div class="empty-state"><div class="empty-state-icon">🔍</div><h3>No se encontraron lugares</h3><p>Prueba a cambiar los filtros o el texto de búsqueda</p></div>`}
        </div>
      </section>
      
      <section class="city-map-section section-sm">
        <div class="container">
          <div class="home-section-title"><h2>🗺️ Mapa Interactivo</h2><p>Explora la ciudad y encuentra lugares cercanos</p></div>
          <div id="map-placeholder-div"><div id="city-map-container" class="city-map-container"></div></div>
        </div>
      </section>
      
      ${renderItineraries(cityMeta, places)}
      ${renderTips(cityMeta)}
      ${renderFooter()}
      <div class="modal-overlay" id="modal-overlay"><div class="modal" id="modal"></div></div>
      <button class="back-to-top" id="back-to-top">${icons.chevronUp}</button>
    `;
    attachEvents();
    
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
    const plannerLink = globalSettings?.plannerEnabled ? `<a href="/planner.html" style="color:var(--accent); font-weight:bold;">🗓️ Planner</a>` : '';
    return `<nav class="nav" id="main-nav">
      <div class="nav-inner">
        <a href="/" class="nav-logo">🇯🇵 Japón 2026 <span class="ja">日本</span></a>
        <div class="nav-links">
          <a href="/">Inicio</a>
          ${citiesArray.map(c => `<a href="/city.html?id=${c.id}" class="${c.id === city.id ? 'active' : ''}">${c.name}</a>`).join('')}
          ${plannerLink}
          <div class="nav-tools">
            <a href="/admin.html" class="nav-tool-btn" title="Administración">⚙️</a>
          </div>
        </div>
        <div class="nav-mobile-tools">
          <a href="/admin.html" class="nav-tool-btn" title="Admin">⚙️</a>
          <button class="nav-mobile-toggle" id="mobile-toggle">${icons.menu}</button>
        </div>
      </div>
      <div class="nav-mobile-menu" id="mobile-menu">
        <a href="/">Inicio</a>
        ${citiesArray.map(c => `<a href="/city.html?id=${c.id}">${c.name} ${c.nameJa || ''}</a>`).join('')}
        ${plannerLink}
      </div>
    </nav>`;
  }

  function renderHero(city) {
    return `<div class="city-hero" style="background: ${city.gradient}; color: white;">
      <div class="city-hero-content">
        <a href="/" class="back-link" style="color:rgba(255,255,255,0.8);">${icons.arrowLeft} Volver al inicio</a>
        <h1>${city.name}</h1>
        <p class="city-ja">${city.nameJa} — ${city.tagline}</p>
        <p class="city-hero-desc">${city.description}</p>
      </div>
    </div>`;
  }

  function renderSummary(city, allPlaces, mustSeeCount) {
    return `<div class="city-summary">
      <div class="summary-card"><div class="summary-card-icon">🎯</div><h4>Experiencia</h4><p>${city.summary}</p></div>
      <div class="summary-card"><div class="summary-card-icon">👥</div><h4>Ideal para</h4><p>${city.idealFor}</p></div>
      <div class="summary-card"><div class="summary-card-icon">📊</div><h4>En números</h4><p>${allPlaces.length} lugares · ${mustSeeCount} imprescindibles · ${city.zones.length} zonas · ${city.recommendedDays} recomendados</p></div>
    </div>`;
  }

  function renderCategoryFilters() {
    return categories
      .filter(c => places.some(p => p.category === c.id))
      .map(c => `<button class="filter-pill ${state.category === c.id ? 'active' : ''}" data-category="${c.id}"><span class="icon">${c.icon}</span> ${c.label}</button>`)
      .join('');
  }

  function renderPriorityFilters() {
    return Object.entries(priorityLabels)
      .map(([key, val]) => `<button class="filter-pill ${state.priority === key ? 'active' : ''}" data-priority="${key}"><span class="icon">${val.icon}</span> ${val.label}</button>`)
      .join('');
  }

  function getPlannerChipUI(placeId) {
    const item = getPlannerItem(placeId);
    const status = item.status || 'none';
    let label = 'Sin asignar';
    let icon = '➕';
    let style = 'background:var(--bg-secondary); color:var(--text-primary); border-color:var(--border);';
    
    if (status === 'in-tray') {
      label = 'En bandeja'; icon = '📍'; style = 'background:#fef3c7; color:#b45309; border-color:#fde68a;';
    } else if (status === 'planned') {
      label = `Día ${item.assignedDay || 1}`; icon = '🗓️'; style = 'background:#e0e7ff; color:#4338ca; border-color:#c7d2fe;';
    } else if (status === 'done') {
      label = 'Realizada'; icon = '✅'; style = 'background:#dcfce7; color:#15803d; border-color:#bbf7d0;';
    } else if (status === 'discarded') {
      label = 'Descartada'; icon = '❌'; style = 'background:#f3f4f6; color:#9ca3af; border-color:#e5e7eb;';
    }

    const dayOptions = Array.from({length: totalTripDays}, (_, i) => i + 1)
      .map(d => `<option value="${d}" ${item.assignedDay == d ? 'selected' : ''}>Día ${d}</option>`).join('');

    return `
      <div class="planner-chip-container">
        <div class="planner-chip" style="${style}" onclick="this.nextElementSibling.classList.toggle('open')">
          ${icon} ${label}
        </div>
        <div class="planner-chip-dropdown">
          <button class="planner-dropdown-btn" data-action="in-tray" data-id="${placeId}">📍 Bandeja</button>
          <div class="planner-day-selector">
            <select class="planner-day-select" data-id="${placeId}">
              <option value="" disabled selected>🗓️ Asignar Día...</option>
              ${dayOptions}
            </select>
          </div>
          <button class="planner-dropdown-btn" data-action="done" data-id="${placeId}">✅ Realizada</button>
          <button class="planner-dropdown-btn" data-action="discarded" data-id="${placeId}">❌ Descartar</button>
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
          <div class="place-card-category"><span class="icon">${cat?.icon || '📍'}</span> ${place.type}</div>
        </div>
        ${getPlannerChipUI(place.id)}
      </div>
      <div class="place-card-desc">${place.description}</div>
      <div class="place-card-meta">
        <span class="priority-badge ${prio.class}">${prio.icon} ${prio.label}</span>
        <span class="place-card-zone">${place.zone}</span>
        ${place.estimatedDuration ? `<span class="place-card-duration">🕐 ${place.estimatedDuration}</span>` : ''}
        <div style="margin-left:auto; display:flex; align-items:center; gap:6px;" onclick="event.stopPropagation()">
          ${scoreText ? `<span style="font-size:0.85rem; font-weight:bold; color:var(--text-secondary); margin-right:2px;">⭐ ${scoreText}</span>` : ''}
          ${getUmbrellaSVG(place.rainyFriendly, false, place.id)}
          <a href="${getGoogleMapsUrl(place, globalSettings?.mapLinkStyle)}" target="_blank" title="Abrir en Google Maps" style="display:flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:50%; background:#f1f5f9; color:#3b82f6; transition:all 0.2s;" onmouseover="this.style.background='#e2e8f0'; this.style.transform='scale(1.1)';" onmouseout="this.style.background='#f1f5f9'; this.style.transform='scale(1)';">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          </a>
        </div>
      </div>
    </div>`;
  }

  function renderModal(place) {
    const cat = categories.find(c => c.id === place.category);
    const prio = priorityLabels[place.priority];
    const scoreText = formatScore(place.score);
    
    return `<div class="modal-handle"></div>
      <div class="modal-header">
        <div>
          <h2 style="margin-bottom:4px;">${place.name}</h2>
          <div class="place-card-category" style="margin:0;"><span class="icon">${cat?.icon||'📍'}</span> ${place.type} · ${place.zone}</div>
        </div>
        <button class="modal-close" id="modal-close">✕</button>
      </div>
      <div class="modal-body">
        <div class="modal-badges" style="margin-bottom:15px; display:flex; gap:10px;">
          ${getPlannerChipUI(place.id)}
        </div>
        <div class="modal-badges">
          <span class="priority-badge ${prio.class}">${prio.icon} ${prio.label}</span>
          ${place.requiresTicket ? `<span class="priority-badge" style="background:#eff6ff;color:#2563eb;">🎫 Requiere entrada</span>` : ''}
          <div style="margin-left:auto; display:flex; align-items:center; gap:6px;">
            ${getUmbrellaSVG(place.rainyFriendly, true, place.id)}
            <a href="${getGoogleMapsUrl(place, globalSettings?.mapLinkStyle)}" target="_blank" title="Abrir en Google Maps" style="display:flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:50%; background:#f1f5f9; color:#3b82f6; transition:all 0.2s;" onmouseover="this.style.background='#e2e8f0'; this.style.transform='scale(1.1)';" onmouseout="this.style.background='#f1f5f9'; this.style.transform='scale(1)';">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            </a>
          </div>
        </div>
        <div class="modal-section"><div class="modal-section-title">Descripción</div><p style="line-height:1.7;">${place.description}</p></div>
        ${place.tips ? `<div class="modal-section"><div class="modal-section-title">Consejos prácticos</div><div class="modal-tip">${place.tips}</div></div>` : ''}
        <div class="modal-section"><div class="modal-section-title">Información útil</div>
        <div class="modal-info-grid">
          <div class="modal-info-item"><span class="modal-info-label">⏱️ Duración estimada</span><span class="modal-info-value">${place.estimatedDuration || 'Pendiente'}</span></div>
          <div class="modal-info-item"><span class="modal-info-label">☀️ Mejor momento</span><span class="modal-info-value">${place.bestTime || 'Cualquier momento'}</span></div>
          ${scoreText ? `<div class="modal-info-item"><span class="modal-info-label">⭐ Puntuación</span><span class="modal-info-value">${scoreText}</span></div>` : ''}
          ${place.ticketInfo ? `<div class="modal-info-item"><span class="modal-info-label">🎫 Entrada</span><span class="modal-info-value">${place.ticketInfo}</span></div>` : ''}
        </div></div>
        ${place.comment ? `<div class="modal-section"><div class="modal-section-title">Nota personal</div><div class="modal-comment">"${place.comment}"</div></div>` : ''}
        ${place.address ? `<div class="modal-section"><div class="modal-section-title">Dirección</div><div class="modal-address">${icons.mapPin} <a href="https://www.google.com/maps/search/${encodeURIComponent(place.address).replace(/%20/g, '+')}" target="_blank" class="address-link">${place.address}</a></div></div>` : ''}
        
        <div class="modal-section">
          <div class="modal-section-title">Ubicación</div>
          <div id="modal-map-${place.id}" class="modal-map"></div>
          <a href="${getGoogleMapsUrl(place, globalSettings?.mapLinkStyle)}" target="_blank" class="maps-link-btn" style="width:100%;text-align:center;justify-content:center;padding:12px;margin-top:12px;">📍 Abrir en Google Maps (Navegar)</a>
        </div>
      </div>`;
  }

  function renderItineraries(city, allPlaces) {
    const itineraries = generateItineraries(city, allPlaces);
    if (!itineraries.length) return '';
    return `<section class="section-sm" style="background:var(--bg-secondary);">
      <div class="container">
        <div class="home-section-title"><h2>📋 Itinerarios sugeridos</h2><p>Propuesta de rutas por zonas para optimizar el tiempo</p></div>
        ${itineraries.map(it => `<div class="itinerary-block">
          <div class="itinerary-day"><span class="number" style="background:${cityColor};">${it.day}</span> Día ${it.day}: ${it.zone}</div>
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
        description: `Explora los principales puntos de interés de ${zone}`,
        places: zonePlaces.map((p, j) => ({ name: p.name, time: times[j] || '17:00' }))
      };
    });
  }

  function renderTips(city) {
    const tips = [
      { icon: '🚃', title: 'Transporte', text: `Usa el transporte público. En ${city.name} es eficiente y puntual. Consigue un IC Card (Suica/ICOCA) para mayor comodidad.` },
      { icon: '🗾', title: 'Idioma', text: 'Google Translate con cámara es muy útil para menús y carteles. La app es imprescindible.' },
      { icon: '💴', title: 'Efectivo', text: 'Japón sigue usando mucho efectivo. Lleva siempre yenes encima, especialmente para templos y mercados.' },
      { icon: '🏮', title: 'Costumbres', text: 'Quítate los zapatos al entrar a templos y algunos restaurantes. No des propina. Sé respetuoso en los santuarios.' },
      { icon: '📱', title: 'Conectividad', text: 'Alquila un pocket WiFi o compra una eSIM para tener internet durante todo el viaje.' },
      { icon: '🌡️', title: 'Clima en julio', text: 'Julio es caluroso y húmedo en Japón (30-35°C). Lleva ropa ligera, protección solar y mantente hidratado.' }
    ];
    return `<section class="section-sm"><div class="container">
      <div class="home-section-title"><h2>💡 Consejos prácticos</h2><p>Información útil para moverte por ${city.name}</p></div>
      <div class="tips-grid">${tips.map(t => `<div class="tip-card"><div class="tip-card-icon">${t.icon}</div><h4>${t.title}</h4><p>${t.text}</p></div>`).join('')}</div>
    </div></section>`;
  }

  function renderFooter() {
    return `<footer class="footer"><div class="container"><p>Japón 2026 · ${datesFormatted} · Hecho con <span class="heart">❤️</span></p></div></footer>`;
  }

  function hasActiveFilters() {
    return state.search || state.category || state.priority || state.zone || state.timeOfDay || state.plannerFilter || state.plannerDay || state.rainyFriendly;
  }

  function attachEvents() {
    // Search
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', debounce(e => { state.search = e.target.value; render(); }, 200));
      searchInput.focus && setTimeout(() => { searchInput.selectionStart = searchInput.value.length; }, 0);
    }
    document.getElementById('search-clear')?.addEventListener('click', () => { state.search = ''; render(); });

    // Category filters
    document.querySelectorAll('[data-category]').forEach(btn => {
      btn.addEventListener('click', () => { state.category = state.category === btn.dataset.category ? '' : btn.dataset.category; render(); });
    });

    // Priority filters
    document.querySelectorAll('[data-priority]').forEach(btn => {
      btn.addEventListener('click', () => { state.priority = state.priority === btn.dataset.priority ? '' : btn.dataset.priority; render(); });
    });

    // Zone select
    document.getElementById('zone-select')?.addEventListener('change', e => { state.zone = e.target.value; render(); });

    // Time select
    document.getElementById('time-filter')?.addEventListener('change', e => { state.timeOfDay = e.target.value; render(); });

    // Status select
    document.getElementById('status-filter')?.addEventListener('change', e => { state.plannerFilter = e.target.value; render(); });

    // Day select
    document.getElementById('day-filter')?.addEventListener('change', e => { state.plannerDay = e.target.value; render(); });

    document.getElementById('rainy-filter')?.addEventListener('click', () => {
      state.rainyFriendly = !state.rainyFriendly;
      render();
    });

    // Clear filters
    document.getElementById('clear-filters')?.addEventListener('click', () => {
      state = { search: '', category: '', priority: '', zone: '', timeOfDay: '', plannerFilter: '', plannerDay: '', rainyFriendly: false };
      render();
    });

    // Place card click → modal
    document.querySelectorAll('.place-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.planner-chip-container')) return; // Ignore clicks on the planner chip
        const place = places.find(p => p.id === card.dataset.placeId);
        if (place) openModal(place);
      });
    });

    // Modal close
    document.getElementById('modal-overlay')?.addEventListener('click', e => { if (e.target.id === 'modal-overlay') closeModal(); });

    // Mobile menu toggle
    document.getElementById('mobile-toggle')?.addEventListener('click', () => {
      document.getElementById('mobile-menu')?.classList.toggle('open');
    });

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

  // Initial render
  render();
}

async function boot() {
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

  const allPlaces = await getAll('places');
  const places = allPlaces.filter(p => p.cityId === cityId);
  const citiesArray = await getAll('cities');
  const plannerItems = await getAll('planner');
  
  const settingsArray = await getAll('settings') || [];
  const globalSettings = settingsArray.find(s => s.id === 'global') || {};
  
  document.title = `${cityMeta.name} — Japón 2026`;
  
  initCityPage(cityMeta, places, citiesArray, plannerItems, globalSettings);
}

boot();
