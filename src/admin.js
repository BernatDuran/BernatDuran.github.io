import './styles/main.css';
import './styles/components.css';
import './styles/pages.css';
import { getAll, getById, putAll, clear } from './utils/db.js';
import Sortable from 'sortablejs';
import { icons } from './utils/helpers.js';
import { ensureBaseCitiesExist, runDataMigration } from './utils/dataMigration.js';
import { normalizePlaceRecord, PLACE_IMPORT_EXPORT_FIELDS, toImportExportRow } from './utils/placeData.js';
import { formatRecommendedDays, normalizeCityRecord, sortCities } from './utils/cityData.js';
import { categories, priorityLabels } from './data/cities.js';
import { buildDemoDataset } from './data/demoDataset.js';
import * as XLSX from 'xlsx';

const app = document.getElementById('app');
const PLANNER_IMPORT_EXPORT_FIELDS = ['placeId', 'cityId', 'favorite', 'status', 'assignedDay', 'order'];
const PLANNER_STATUS_VALUES = ['in-tray', 'planned', 'done', 'discarded'];
const CITY_ID_PATTERN = /^[a-z0-9-]+$/;

function getCityIdList(citiesArray = []) {
  return sortCities(citiesArray).map((city) => city.id).filter(Boolean);
}

function formatInlineCodeList(values) {
  return values.map((value) => `<code>${value}</code>`).join(', ');
}

function buildExactPlaceHeaderMessage() {
  return `Cabeceras obligatorias y en este orden exacto: ${PLACE_IMPORT_EXPORT_FIELDS.join(', ')}`;
}

function validateExactPlaceWorkbookHeaders(rows = []) {
  const headers = Object.keys(rows[0] || {});
  const extraHeaders = headers.filter((header) => !PLACE_IMPORT_EXPORT_FIELDS.includes(header));
  const missingHeaders = PLACE_IMPORT_EXPORT_FIELDS.filter((field) => !headers.includes(field));
  const orderedCorrectly = headers.length === PLACE_IMPORT_EXPORT_FIELDS.length
    && PLACE_IMPORT_EXPORT_FIELDS.every((field, index) => headers[index] === field);

  if (!extraHeaders.length && !missingHeaders.length && orderedCorrectly) return null;

  const details = [];
  if (missingHeaders.length) details.push(`faltan: ${missingHeaders.join(', ')}`);
  if (extraHeaders.length) details.push(`sobran o estan mal escritas: ${extraHeaders.join(', ')}`);
  if (!orderedCorrectly && !missingHeaders.length && !extraHeaders.length) details.push('el orden no coincide');

  return `${buildExactPlaceHeaderMessage()}. Problema detectado: ${details.join('; ')}.`;
}

function validatePlaceJsonFieldNames(place = {}) {
  const headers = Object.keys(place || {});
  const extraHeaders = headers.filter((header) => !PLACE_IMPORT_EXPORT_FIELDS.includes(header));
  if (!extraHeaders.length) return null;
  return `campos no soportados o mal escritos: ${extraHeaders.join(', ')}`;
}

function buildPlaceFieldHelp(citiesArray = []) {
  const cityIds = getCityIdList(citiesArray);
  return [
    '<li><strong>id</strong>: (Texto, obligatorio) Identificador único en minúsculas, sin espacios. Ejemplo: <code>takayama-sanmachi-suji</code>.</li>',
    '<li><strong>name</strong>: (Texto, obligatorio) Nombre visible del lugar.</li>',
    `<li><strong>cityId</strong>: (Opción, obligatorio) ID de ciudad existente. Valores actuales: ${formatInlineCodeList(cityIds)}.</li>`,
    `<li><strong>category</strong>: (Opción) ${formatInlineCodeList(categories.map((category) => category.id))}.</li>`,
    '<li><strong>type</strong>: (Texto) Tipo descriptivo, por ejemplo <code>Templo</code>, <code>Mercado</code> o <code>Mirador</code>.</li>',
    `<li><strong>priority</strong>: (Opción) ${formatInlineCodeList(Object.keys(priorityLabels))}. Si se deja vacío, se guarda como <code>optional</code>.</li>`,
    '<li><strong>zone</strong>: (Texto) Barrio o zona dentro de la ciudad.</li>',
    '<li><strong>description</strong>: (Texto largo) Descripción principal.</li>',
    '<li><strong>address</strong>: (Texto) Dirección legible para el usuario.</li>',
    '<li><strong>lat / lng</strong>: (Número) Coordenadas decimales con punto. Deben informarse juntas o dejarse ambas vacías.</li>',
    '<li><strong>estimatedDuration</strong>: (Texto) Duración estimada, por ejemplo <code>1 h</code> o <code>90 min</code>.</li>',
    '<li><strong>bestTime</strong>: (Opción) <code>mañana</code>, <code>tarde</code>, <code>noche</code> o <code>cualquier-momento</code>.</li>',
    '<li><strong>rainyFriendly</strong>: (Booleano) <code>true</code>/<code>false</code>, <code>1</code>/<code>0</code>, <code>si</code>/<code>no</code>.</li>',
    '<li><strong>score</strong>: (Número) Puntuación de 1 a 10. Puede tener decimales.</li>',
    '<li><strong>requiresTicket</strong>: (Booleano) Si necesita entrada de pago o reserva.</li>',
    '<li><strong>ticketInfo</strong>: (Texto) Precio o aclaración sobre la entrada.</li>',
    '<li><strong>tips</strong>: (Texto largo) Consejos prácticos.</li>',
    '<li><strong>comment</strong>: (Texto largo) Nota personal.</li>'
  ].join('');
}

function showInlineMessage(elementId, message, tone = 'success') {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message;
  el.style.display = 'block';
  el.style.color = tone === 'error' ? '#dc2626' : 'var(--accent)';
}

function clearInlineMessage(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.style.display = 'none';
  el.textContent = '';
}

function showAdminToast(message, tone = 'success') {
  let portal = document.getElementById('admin-toast-portal');
  if (!portal) {
    portal = document.createElement('div');
    portal.id = 'admin-toast-portal';
    portal.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:99999;display:flex;flex-direction:column;gap:10px;';
    document.body.appendChild(portal);
  }

  const toast = document.createElement('div');
  toast.style.cssText = `min-width:280px;max-width:420px;padding:12px 14px;border-radius:14px;background:${tone === 'error' ? '#7f1d1d' : '#1f2937'};color:white;box-shadow:var(--shadow-xl);font-size:0.9rem;line-height:1.45;`;
  toast.textContent = message;
  portal.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
    if (!portal.childElementCount) portal.remove();
  }, 3200);
}

function closeAdminModal() {
  const modalOverlay = document.getElementById('admin-modal-overlay');
  if (!modalOverlay) return;
  modalOverlay.classList.remove('open');
  document.body.style.overflow = '';
}

function openAdminConfirmModal({ title, message, confirmLabel, tone = 'danger', onConfirm }) {
  const modalOverlay = document.getElementById('admin-modal-overlay');
  const modal = document.getElementById('admin-modal');
  if (!modalOverlay || !modal) return;

  const confirmStyle = tone === 'danger'
    ? 'background:#dc2626; color:#fff; border:none;'
    : 'background:var(--accent); color:#fff; border:none;';

  modal.innerHTML = `
    <div class="modal-header">
      <h2>${title}</h2>
      <button class="modal-close" id="admin-modal-close">&#x2715;</button>
    </div>
    <div class="modal-body" style="font-size:0.95rem; line-height:1.6;">
      <p>${message}</p>
      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px; flex-wrap:wrap;">
        <button type="button" class="filter-pill" id="admin-confirm-cancel" style="border:1px solid var(--border); background:var(--bg-secondary);">Cancelar</button>
        <button type="button" class="maps-link-btn" id="admin-confirm-action" style="${confirmStyle}">${confirmLabel}</button>
      </div>
    </div>
  `;

  modalOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  document.getElementById('admin-modal-close')?.addEventListener('click', closeAdminModal);
  document.getElementById('admin-confirm-cancel')?.addEventListener('click', closeAdminModal);
  document.getElementById('admin-confirm-action')?.addEventListener('click', async () => {
    try {
      closeAdminModal();
      await onConfirm();
    } catch (error) {
      showAdminToast(`No se pudo completar la accion: ${error.message}`, 'error');
    }
  });
}

function openAdminScopedClearModal({ title, message, confirmLabel, tone = 'danger', citiesArray = [], onConfirm }) {
  const modalOverlay = document.getElementById('admin-modal-overlay');
  const modal = document.getElementById('admin-modal');
  if (!modalOverlay || !modal) return;

  const confirmStyle = tone === 'danger'
    ? 'background:#dc2626; color:#fff; border:none;'
    : 'background:var(--accent); color:#fff; border:none;';
  const cityOptions = sortCities(citiesArray)
    .map((city) => `<option value="${city.id}">${city.name} (${city.id})</option>`)
    .join('');

  modal.innerHTML = `
    <div class="modal-header admin-scoped-clear-header">
      <div>
        <span class="admin-modal-kicker">Acci&oacute;n destructiva</span>
        <h2>${title}</h2>
      </div>
      <button class="modal-close" id="admin-modal-close" aria-label="Cerrar">&#x2715;</button>
    </div>
    <div class="modal-body admin-scoped-clear-body">
      <p class="admin-scoped-clear-message">${message}</p>
      <div class="form-group admin-scoped-clear-field">
        <label for="admin-clear-scope">Alcance obligatorio</label>
        <select id="admin-clear-scope" required>
          <option value="" selected disabled>Selecciona el alcance...</option>
          <option value="all">Todas las ciudades</option>
          ${cityOptions}
        </select>
      </div>
      <p id="admin-clear-scope-error" class="admin-scoped-clear-error">Selecciona todas las ciudades o una ciudad concreta para continuar.</p>
      <div class="admin-scoped-clear-actions">
        <button type="button" class="admin-scoped-clear-btn admin-scoped-clear-btn-secondary" id="admin-confirm-cancel">Cancelar</button>
        <button type="button" class="admin-scoped-clear-btn admin-scoped-clear-btn-primary" id="admin-confirm-action" style="${confirmStyle}">${confirmLabel}</button>
      </div>
    </div>
  `;

  modalOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  document.getElementById('admin-modal-close')?.addEventListener('click', closeAdminModal);
  document.getElementById('admin-confirm-cancel')?.addEventListener('click', closeAdminModal);
  document.getElementById('admin-confirm-action')?.addEventListener('click', async () => {
    const scope = document.getElementById('admin-clear-scope')?.value || '';
    const errorEl = document.getElementById('admin-clear-scope-error');
    if (!scope) {
      if (errorEl) errorEl.style.display = 'block';
      return;
    }

    try {
      closeAdminModal();
      await onConfirm(scope);
    } catch (error) {
      showAdminToast(`No se pudo completar la accion: ${error.message}`, 'error');
    }
  });
}

function normalizeImportBoolean(value) {
  if (value === '' || value == null) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const normalized = String(value).trim().toLowerCase();
  return ['true', '1', 'si', 'sí', 'yes'].includes(normalized);
}

function normalizePlannerRecord(item) {
  return {
    placeId: String(item?.placeId || '').trim(),
    favorite: normalizeImportBoolean(item?.favorite),
    status: item?.status || null,
    assignedDay: item?.assignedDay == null || item?.assignedDay === '' ? null : Number.parseInt(item.assignedDay, 10),
    order: item?.order == null || item?.order === '' ? 0 : Number.parseInt(item.order, 10)
  };
}

function normalizePlaceImportDraft(values) {
  const obj = {};

  Object.keys(values || {}).forEach((header) => {
    let value = values[header];
    if (value === '') return;

    if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
      try { value = JSON.parse(value); } catch {}
    }

    obj[header] = value;
  });

  ['id', 'name', 'cityId', 'category', 'priority'].forEach((field) => {
    if (obj[field] == null) return;
    obj[field] = String(obj[field]).trim();
  });
  if (obj.cityId) obj.cityId = obj.cityId.toLowerCase();
  if (obj.category) obj.category = obj.category.toLowerCase();
  if (obj.priority) obj.priority = obj.priority.toLowerCase();

  return obj;
}

function hasImportValue(value) {
  return value !== '' && value != null;
}

function validateCoordinatesDraft(obj) {
  const hasLat = hasImportValue(obj.lat);
  const hasLng = hasImportValue(obj.lng);
  if (!hasLat && !hasLng) return null;
  if (hasLat !== hasLng) return 'lat y lng deben informarse juntas';

  const lat = Number.parseFloat(String(obj.lat).replace(',', '.'));
  const lng = Number.parseFloat(String(obj.lng).replace(',', '.'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return 'lat/lng deben ser numéricas';
  if (lat < -90 || lat > 90) return 'lat debe estar entre -90 y 90';
  if (lng < -180 || lng > 180) return 'lng debe estar entre -180 y 180';
  return null;
}

function validatePlaceImportDraft(obj, cityIdSet) {
  if (!obj.id || !obj.cityId || !obj.name) return 'faltan id, name o cityId';
  if (!CITY_ID_PATTERN.test(obj.cityId)) return `cityId inválido: ${obj.cityId}`;
  if (!cityIdSet.has(obj.cityId)) return `cityId no existe: ${obj.cityId}`;
  if (obj.category && !categories.some((category) => category.id === obj.category)) return `category no válida: ${obj.category}`;
  if (obj.priority && !priorityLabels[obj.priority]) return `priority no válida: ${obj.priority}`;

  const coordinateError = validateCoordinatesDraft(obj);
  if (coordinateError) return coordinateError;

  if (hasImportValue(obj.score)) {
    const score = Number.parseFloat(String(obj.score).replace(',', '.'));
    if (!Number.isFinite(score) || score < 1 || score > 10) return 'score debe estar entre 1 y 10';
  }

  return null;
}

function mergeBaseCities(citiesArray = []) {
  const normalizedInput = sortCities(citiesArray).map((city, index) => normalizeCityRecord(city, index));
  const byId = new Map(normalizedInput.map((city) => [city.id, city]));
  const maxSortOrder = normalizedInput.reduce((max, city, index) => {
    const parsed = Number.parseInt(city?.sortOrder, 10);
    return Math.max(max, Number.isFinite(parsed) ? parsed : index);
  }, -1);

  let nextSortOrder = maxSortOrder + 1;
  buildDemoDataset().cities.forEach((city) => {
    if (byId.has(city.id)) return;
    byId.set(city.id, normalizeCityRecord({ ...city, sortOrder: nextSortOrder }, nextSortOrder));
    nextSortOrder += 1;
  });

  return sortCities(Array.from(byId.values()));
}

function buildPlannerExportRows(plannerItems, places) {
  const placeById = new Map(places.map((place) => [place.id, normalizePlaceRecord(place)]));
  return plannerItems
    .map((item) => normalizePlannerRecord(item))
    .filter((item) => item.placeId)
    .map((item) => {
      const place = placeById.get(item.placeId);
      return {
        placeId: item.placeId,
        cityId: place?.cityId || '',
        favorite: item.favorite,
        status: item.status,
        assignedDay: item.assignedDay,
        order: item.order
      };
    });
}

function validatePlannerImportRow(row, placeById, totalTripDays) {
  const item = normalizePlannerRecord(row);
  if (!item.placeId || !placeById.has(item.placeId)) {
    return { error: 'La actividad no existe en la base de datos actual.' };
  }

  const place = placeById.get(item.placeId);
  const rowCityId = String(row?.cityId || '').trim().toLowerCase();
  if (rowCityId && rowCityId !== place.cityId) {
    return { error: `cityId no coincide con la actividad ${item.placeId}.` };
  }

  if (item.status && !PLANNER_STATUS_VALUES.includes(item.status)) {
    return { error: `status no válido: ${item.status}.` };
  }

  if (item.status === 'planned') {
    if (!Number.isFinite(item.assignedDay) || item.assignedDay < 1 || item.assignedDay > totalTripDays) {
      return { error: 'assignedDay debe ser un día válido del viaje para status=planned.' };
    }
  }

  return { item };
}

function downloadJsonFile(payload, fileName) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadTextFile(content, fileName, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function parseWorkbookRows(arrayBuffer) {
  const data = new Uint8Array(arrayBuffer);
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json(worksheet, { defval: '' });
}

function getTotalTripDays(globalSettings = {}) {
  if (!globalSettings.startDate || !globalSettings.endDate) return 7;
  const start = new Date(globalSettings.startDate);
  const end = new Date(globalSettings.endDate);
  const days = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
  return days >= 1 && !Number.isNaN(days) ? days : 7;
}

const ADMIN_TABS = [
  {
    id: 'viaje',
    icon: '&#x1F5FA;&#xFE0F;',
    label: 'Viaje y ciudades',
    description: 'Fechas y estructura'
  },
  {
    id: 'datos',
    icon: '&#x1F4E5;',
    label: 'Datos',
    description: 'Importar y exportar'
  },
  {
    id: 'mantenimiento',
    icon: '&#x1F6E0;&#xFE0F;',
    label: 'Mantenimiento',
    description: 'Backup y limpieza'
  }
];

const DEFAULT_ADMIN_TAB = 'viaje';

function getAdminActiveTab() {
  const hash = window.location.hash.replace('#', '').trim();
  return ADMIN_TABS.some((tab) => tab.id === hash) ? hash : DEFAULT_ADMIN_TAB;
}

function renderAdminTabs(activeTab) {
  return ADMIN_TABS.map((tab) => `
    <button type="button"
            class="admin-tab ${activeTab === tab.id ? 'active' : ''}"
            data-admin-tab="${tab.id}"
            id="admin-tab-${tab.id}"
            role="tab"
            aria-controls="admin-panel-${tab.id}"
            aria-selected="${activeTab === tab.id ? 'true' : 'false'}">
      <span class="admin-tab-icon" aria-hidden="true">${tab.icon}</span>
      <span>
        <strong>${tab.label}</strong>
        <small>${tab.description}</small>
      </span>
    </button>
  `).join('');
}

function renderAdminPanel(id, title, description, body, activeTab) {
  return `
    <section class="admin-tab-panel ${activeTab === id ? 'active' : ''}"
             data-admin-panel="${id}"
             id="admin-panel-${id}"
             role="tabpanel"
             aria-labelledby="admin-tab-${id}"
             aria-hidden="${activeTab === id ? 'false' : 'true'}">
      <div class="admin-panel-header">
        <div>
          <span class="admin-panel-kicker">M&oacute;dulo</span>
          <h3>${title}</h3>
          <p>${description}</p>
        </div>
      </div>
      ${body}
    </section>
  `;
}

function setActiveAdminTab(tabId, updateHash = true) {
  const nextTab = ADMIN_TABS.some((tab) => tab.id === tabId) ? tabId : DEFAULT_ADMIN_TAB;
  document.querySelectorAll('[data-admin-tab]').forEach((button) => {
    const isActive = button.dataset.adminTab === nextTab;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  document.querySelectorAll('[data-admin-panel]').forEach((panel) => {
    const isActive = panel.dataset.adminPanel === nextTab;
    panel.classList.toggle('active', isActive);
    panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
  });

  if (updateHash) {
    const nextHash = `#${nextTab}`;
    if (window.location.hash !== nextHash) {
      history.replaceState(null, '', nextHash);
    }
  }
}

function syncAdminTabsFromHash() {
  setActiveAdminTab(getAdminActiveTab(), false);
}

async function boot() {
  await runDataMigration();
  render();
}

async function render() {
  const citiesArray = sortCities(await getAll('cities'));
  const settingsArray = await getAll('settings');
  const globalSettings = settingsArray.find(s => s.id === 'global') || {};
  const activeTab = getAdminActiveTab();

  app.innerHTML = `
    <nav class="nav" id="main-nav">
      <div class="nav-inner">
        <a href="/" class="nav-logo">&#x1F1EF;&#x1F1F5; Jap&oacute;n 2026 <span class="ja">Admin</span></a>
        <div class="nav-links">
          <a href="/">Volver al Inicio</a>
          
        </div>
      </div>
    </nav>
    <main class="admin-page">
      <div class="admin-workspace">
        <aside class="admin-tabs" role="tablist" aria-label="Secciones de administraci&oacute;n">
          ${renderAdminTabs(activeTab)}
        </aside>

        <div class="admin-panels">
          ${renderAdminPanel('viaje', 'Viaje y ciudades', 'Fechas globales, estilo de mapas y estructura de ciudades.', `
            <div class="admin-card admin-travel-settings-card">
              <div class="admin-section-heading">
                <div>
                  <h3>&#x1F30D; Configuraci&oacute;n del viaje</h3>
                </div>
              </div>
              <div class="admin-form-grid admin-travel-settings-grid">
                <div class="form-group">
                  <label>Fecha de inicio</label>
                  <input type="date" id="global-start-date" value="${globalSettings.startDate || ''}">
                </div>
                <div class="form-group">
                  <label>Fecha de fin</label>
                  <input type="date" id="global-end-date" value="${globalSettings.endDate || ''}">
                </div>
                <div class="form-group">
                  <label>Estilo de enlaces de Mapa</label>
                  <select id="global-map-link-style">
                    <option value="smart" ${globalSettings.mapLinkStyle === 'smart' || !globalSettings.mapLinkStyle ? 'selected' : ''}>Inteligente (App nativa / ficha Google)</option>
                    <option value="coords" ${globalSettings.mapLinkStyle === 'coords' ? 'selected' : ''}>Solo coordenadas (modo cl&aacute;sico)</option>
                  </select>
                </div>
              </div>
              <div class="admin-sticky-actions">
                <p id="settings-msg" class="admin-inline-msg"></p>
                <button id="btn-save-settings" class="admin-action-btn primary compact" type="button">&#x1F4BE; Guardar</button>
              </div>
            </div>

            <div class="admin-card admin-city-card">
              <div class="admin-section-heading">
                <div>
                  <h3>&#x1F3D9;&#xFE0F; Ciudades registradas</h3>
                  <p>Reordena las ciudades arrastrando. Este orden se aplica en la home y navegaci&oacute;n.</p>
                </div>
                <button type="button" id="btn-add-city" class="admin-action-btn primary compact">&#x2795; A&ntilde;adir ciudad</button>
              </div>
              <div id="cities-sortable-list" class="admin-city-list">
                ${citiesArray.map(city => `
                  <div class="admin-city-row" data-city-id="${city.id}" style="--city-color:${city.color};">
                    <div class="admin-city-main">
                      <span class="admin-city-grip" aria-hidden="true">&#x2630;</span>
                      <div>
                        <div class="admin-city-name">${city.name} ${city.nameJa ? `<span>${city.nameJa}</span>` : ''}</div>
                        <div class="admin-city-meta">ID: ${city.id} &middot; ${formatRecommendedDays(city.recommendedDays)} &middot; ${(city.zones || []).length} zonas</div>
                      </div>
                    </div>
                    <button class="filter-pill btn-edit-city" data-city-id="${city.id}">&#x270F;&#xFE0F; Editar</button>
                  </div>
                `).join('')}
              </div>
            </div>
          `, activeTab)}

          ${renderAdminPanel('datos', 'Datos', 'Importaci&oacute;n y exportaci&oacute;n de actividades y planificaci&oacute;n.', `
            <div class="admin-data-grid">
              <div class="admin-card">
                <div class="admin-section-heading">
                  <div>
                    <h3>&#x1F4E5; Actividades Excel/CSV</h3>
                    <p>Importa o exporta actividades con las cabeceras exactas y validaci&oacute;n por ciudad.</p>
                  </div>
                  <button id="btn-csv-info" class="admin-icon-btn" title="Ver formato de campos" type="button">&#x2139;&#xFE0F;</button>
                </div>
                <p class="admin-muted">IDs de ciudad actuales: ${formatInlineCodeList(getCityIdList(citiesArray))}.</p>
                <p class="admin-code-note"><strong>Columnas:</strong> ${PLACE_IMPORT_EXPORT_FIELDS.join(', ')}</p>
                <div class="admin-action-row">
                  <label class="admin-action-btn secondary">
                    &#x2B06;&#xFE0F; Importar Excel/CSV
                    <input type="file" id="input-csv" accept=".xlsx, .xls, .csv">
                  </label>
                  <button id="btn-export-csv" class="admin-action-btn primary" type="button">&#x2B07;&#xFE0F; Exportar actividades</button>
                </div>
                <p id="csv-msg" class="admin-inline-msg"></p>
              </div>

              <div class="admin-card">
                <div class="admin-section-heading">
                  <div>
                    <h3>&#x1F5D3;&#xFE0F; Planificaci&oacute;n y estado</h3>
                    <p>Exporta o restaura solo el estado del planner sin sustituir la base de actividades.</p>
                  </div>
                </div>
                <p class="admin-muted">Si el archivo contiene actividades inexistentes, se ignorar&aacute;n y se avisar&aacute; al finalizar. El campo <code>cityId</code> se usa como validaci&oacute;n cruzada cuando viene informado.</p>
                <div class="admin-action-group">
                  <span>Exportar</span>
                  <div class="admin-action-row">
                    <button id="btn-export-planner-json" class="admin-action-btn primary" type="button">JSON</button>
                    <button id="btn-export-planner-xlsx" class="admin-action-btn primary" type="button">Excel</button>
                    <button id="btn-export-planner-csv" class="admin-action-btn primary" type="button">CSV</button>
                  </div>
                </div>
                <div class="admin-action-group">
                  <span>Importar</span>
                  <div class="admin-action-row">
                    <label class="admin-action-btn secondary">
                      JSON
                      <input type="file" id="input-planner-restore" accept=".json">
                    </label>
                    <label class="admin-action-btn secondary">
                      Excel/CSV
                      <input type="file" id="input-planner-table-restore" accept=".xlsx, .xls, .csv">
                    </label>
                  </div>
                </div>
                <p id="planner-import-msg" class="admin-inline-msg"></p>
              </div>
            </div>
          `, activeTab)}

          ${renderAdminPanel('mantenimiento', 'Mantenimiento', 'Copias completas, datos de ejemplo y acciones destructivas.', `
            <div class="admin-data-grid">
              <div class="admin-card">
                <div class="admin-section-heading">
                  <div>
                    <h3>&#x1F4BE; Copias de seguridad</h3>
                    <p>Guarda o restaura todos los datos: ciudades, actividades, planificaci&oacute;n y ajustes.</p>
                  </div>
                </div>
                <div class="admin-action-row">
                  <button id="btn-export" class="admin-action-btn primary" type="button">&#x2B07;&#xFE0F; Exportar backup JSON</button>
                  <label class="admin-action-btn secondary">
                    &#x2B06;&#xFE0F; Restaurar backup
                    <input type="file" id="input-restore" accept=".json">
                  </label>
                </div>
                <p id="backup-msg" class="admin-inline-msg"></p>
              </div>

              <div class="admin-card admin-danger-zone">
                <div class="admin-section-heading">
                  <div>
                    <h3>&#x1F9EA; Datos demo y limpieza</h3>
                    <p>Acciones para volver a datos de ejemplo o limpiar datos por alcance.</p>
                  </div>
                </div>
                <div class="admin-action-row">
                  <button id="btn-load-demo-data" class="admin-action-btn primary" type="button">&#x1F504; Cargar datos de ejemplo</button>
                  <button id="btn-clear-planner" class="admin-action-btn secondary" type="button">&#x1F9F9; Limpiar planificador</button>
                  <button id="btn-clear-places" class="admin-action-btn danger" type="button">&#x26A0;&#xFE0F; Limpiar actividades</button>
                </div>
                <p class="admin-danger-note">Cargar datos de ejemplo sustituye ciudades, actividades, planificador y ajustes globales. Limpiar actividades tambi&eacute;n limpia el planificador asociado para evitar referencias rotas.</p>
              </div>
            </div>
          `, activeTab)}
        </div>
      </div>
    </main>
    
    <!-- INFO MODAL -->
    <div class="modal-overlay" id="admin-modal-overlay">
      <div class="modal admin-modal" id="admin-modal"></div>
    </div>
  `;

  attachEvents(citiesArray);
}

function renderAddCityForm() {
  return `
    <div class="modal-scroll admin-city-edit-modal">
      <div class="modal-header admin-city-edit-header">
        <div>
          <span class="admin-modal-kicker">Ciudad</span>
          <h2>&#x2795; A&ntilde;adir nueva ciudad</h2>
        </div>
        <button class="modal-close" id="admin-modal-close" aria-label="Cerrar">&#x2715;</button>
      </div>
      <div class="modal-body admin-city-edit-body">
        <form id="form-add-city" class="admin-form">
          <div class="form-group">
            <label>ID (min&uacute;sculas, sin espacios. Ej: 'kyoto')</label>
            <input type="text" id="city-id" required>
          </div>
          <div class="form-group">
            <label>Nombre p&uacute;blico (Ej: 'Kioto')</label>
            <input type="text" id="city-name" required>
          </div>
          <div class="form-group">
            <label>Nombre japon&eacute;s (Ej: '京都')</label>
            <input type="text" id="city-name-ja">
          </div>
          <div class="form-group">
            <label>Color Principal (Hex)</label>
            <div class="admin-color-field">
              <input type="color" id="city-color" value="#2563eb">
              <span id="color-preview-text">#2563eb</span>
            </div>
          </div>
          <div class="form-group">
            <label>Subt&iacute;tulo (tagline)</label>
            <input type="text" id="city-tagline" required>
          </div>
          <div class="form-group">
            <label>Descripci&oacute;n principal</label>
            <textarea id="city-description" rows="3" required></textarea>
          </div>
          <div class="form-group">
            <label>Experiencia (Summary)</label>
            <textarea id="city-summary" rows="2" required></textarea>
          </div>
          <div class="form-group">
            <label>Ideal para (Ej: 'Cultura, compras')</label>
            <input type="text" id="city-ideal-for" required>
          </div>
          <div class="admin-form-grid compact">
            <div class="form-group">
              <label>D&iacute;as recomendados</label>
              <input type="text" id="city-days" value="3 d&iacute;as" required>
            </div>
            <div class="form-group">
              <label>Zonas (separadas por coma)</label>
              <input type="text" id="city-zones" placeholder="Centro, Afueras" required>
            </div>
          </div>
          <div class="form-group">
            <label>Destacados / Chips (separados por coma)</label>
            <input type="text" id="city-highlights" placeholder="Templo antiguo, Calle principal...">
          </div>
          <div class="form-group">
            <label>Coordenadas Centrales (Lat, Lng separadas por coma)</label>
            <input type="text" id="city-center" placeholder="35.6762, 139.6503" required>
          </div>
          <div class="admin-modal-actions">
            <button type="button" class="filter-pill" id="admin-modal-cancel">Cancelar</button>
            <button type="submit" class="filter-pill active">Guardar ciudad</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

async function handleAddCitySubmit(event, modalOverlay) {
  event.preventDefault();
  const existingCities = sortCities(await getAll('cities'));
  const coordsStr = document.getElementById('city-center').value.split(',');
  const lat = parseFloat(coordsStr[0]);
  const lng = parseFloat(coordsStr[1]);
  const cityId = document.getElementById('city-id').value.trim().toLowerCase();

  if (!CITY_ID_PATTERN.test(cityId)) {
    showAdminToast('El ID de ciudad solo puede contener minusculas, numeros y guiones.', 'error');
    return;
  }

  if (existingCities.some((city) => city.id === cityId)) {
    showAdminToast('Ya existe una ciudad con ese ID.', 'error');
    return;
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    showAdminToast('Las coordenadas centrales deben tener latitud y longitud validas.', 'error');
    return;
  }

  const color = document.getElementById('city-color').value;
  const zonesStr = document.getElementById('city-zones').value;
  const zones = zonesStr.split(',').map(z => z.trim()).filter(z => z);
  const highlightsStr = document.getElementById('city-highlights').value;
  const highlights = highlightsStr.split(',').map(h => h.trim()).filter(h => h);

  const newCity = {
    id: cityId,
    name: document.getElementById('city-name').value.trim(),
    nameJa: document.getElementById('city-name-ja').value.trim(),
    color: color,
    gradient: `linear-gradient(135deg, ${color} 0%, #000 100%)`,
    tagline: document.getElementById('city-tagline').value.trim(),
    description: document.getElementById('city-description').value.trim(),
    summary: document.getElementById('city-summary').value.trim(),
    idealFor: document.getElementById('city-ideal-for').value.trim(),
    recommendedDays: document.getElementById('city-days').value.trim() || '3 días',
    zones: zones.length > 0 ? zones : ["Centro"],
    highlights: highlights,
    center: { lat, lng },
    defaultZoom: 13,
    sortOrder: (existingCities.at(-1)?.sortOrder ?? -1) + 1
  };

  await putAll('cities', [normalizeCityRecord(newCity, newCity.sortOrder)]);
  modalOverlay?.classList.remove('open');
  document.body.style.overflow = '';
  showAdminToast('Ciudad añadida con éxito.');
  render();
}

function openAddCityModal() {
  const modalOverlay = document.getElementById('admin-modal-overlay');
  const modal = document.getElementById('admin-modal');
  if (!modalOverlay || !modal) return;

  modal.innerHTML = renderAddCityForm();
  modalOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  const colorInput = document.getElementById('city-color');
  const colorText = document.getElementById('color-preview-text');
  colorInput?.addEventListener('input', (event) => {
    colorText.textContent = event.target.value;
    colorText.style.color = event.target.value;
  });

  document.getElementById('admin-modal-close')?.addEventListener('click', closeAdminModal);
  document.getElementById('admin-modal-cancel')?.addEventListener('click', closeAdminModal);
  document.getElementById('form-add-city')?.addEventListener('submit', (event) => handleAddCitySubmit(event, modalOverlay));
  window.setTimeout(() => document.getElementById('city-id')?.focus(), 0);
}

function attachEvents(citiesArray = []) {
  document.querySelectorAll('[data-admin-tab]').forEach((button) => {
    button.addEventListener('click', () => setActiveAdminTab(button.dataset.adminTab));
  });

  document.querySelectorAll('[data-admin-tab-jump]').forEach((button) => {
    button.addEventListener('click', () => setActiveAdminTab(button.dataset.adminTabJump));
  });

  document.getElementById('btn-add-city')?.addEventListener('click', openAddCityModal);

  window.removeEventListener('hashchange', syncAdminTabsFromHash);
  window.addEventListener('hashchange', syncAdminTabsFromHash);

  // Color picker preview
  const colorInput = document.getElementById('city-color');
  const colorText = document.getElementById('color-preview-text');
  if (colorInput && colorText) {
    colorInput.addEventListener('input', (e) => {
      colorText.textContent = e.target.value;
      colorText.style.color = e.target.value;
    });
  }

  // Modal Handlers
  const modalOverlay = document.getElementById('admin-modal-overlay');
  const modal = document.getElementById('admin-modal');

  document.getElementById('btn-csv-info').addEventListener('click', () => {
    modal.innerHTML = `
      <div class="modal-header">
        <h2>&#x2139;&#xFE0F; Formato de campos Excel/CSV</h2>
        <button class="modal-close" id="admin-modal-close">&#x2715;</button>
      </div>
      <div class="modal-body" style="font-size:0.9rem; line-height:1.6;">
        <p>Al importar o exportar el Excel/CSV, utiliza estas columnas exactas en la primera fila:</p>
        <ul style="padding-left:20px; margin-top:10px;">
          ${buildPlaceFieldHelp(citiesArray)}
        </ul>
      </div>
    `;
    modalOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    
    document.getElementById('admin-modal-close').addEventListener('click', () => {
      modalOverlay.classList.remove('open');
      document.body.style.overflow = '';
    });
  });

  modalOverlay.addEventListener('click', (e) => {
    if (e.target.id === 'admin-modal-overlay') {
      modalOverlay.classList.remove('open');
      document.body.style.overflow = '';
    }
  });

  // Global Settings Save
  document.getElementById('btn-save-settings').addEventListener('click', async () => {
    const start = document.getElementById('global-start-date').value;
    const end = document.getElementById('global-end-date').value;
    const mapLinkStyle = document.getElementById('global-map-link-style').value;
    clearInlineMessage('settings-msg');

    if (start && end && end < start) {
      showInlineMessage('settings-msg', 'La fecha de fin debe ser posterior o igual a la fecha de inicio.', 'error');
      return;
    }

    await putAll('settings', [{ id: 'global', startDate: start, endDate: end, mapLinkStyle }]);
    showInlineMessage('settings-msg', 'Ajustes actualizados correctamente.');
    setTimeout(() => { clearInlineMessage('settings-msg'); }, 3000);
  });

  // Export JSON
  document.getElementById('btn-export').addEventListener('click', async () => {
    const places = (await getAll('places')).map((place) => normalizePlaceRecord(place));
    const data = {
      cities: sortCities(await getAll('cities')).map((city, index) => normalizeCityRecord(city, index)),
      places: places.map((place) => toImportExportRow(place)),
      planner: buildPlannerExportRows(await getAll('planner'), places),
      settings: await getAll('settings')
    };
    downloadJsonFile(data, `japon2026_backup_${new Date().toISOString().slice(0,10)}.json`);
  });

  // Import JSON
  document.getElementById('input-restore').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (Array.isArray(data.cities) && Array.isArray(data.places)) {
          const importedCities = mergeBaseCities(data.cities);
          const cityIdSet = new Set(importedCities.map((city) => city.id));
          const importedPlaces = [];
          let skippedPlaces = 0;

          data.places.forEach((place) => {
            const fieldNameError = validatePlaceJsonFieldNames(place);
            if (fieldNameError) {
              skippedPlaces += 1;
              return;
            }
            const draft = normalizePlaceImportDraft(place);
            const validationError = validatePlaceImportDraft(draft, cityIdSet);
            if (validationError) {
              skippedPlaces += 1;
              return;
            }
            importedPlaces.push(normalizePlaceRecord(draft));
          });

          const placeById = new Map(importedPlaces.map((place) => [place.id, place]));
          const currentSettings = await getAll('settings');
          const settings = Array.isArray(data.settings)
            ? data.settings.find((setting) => setting.id === 'global')
            : currentSettings.find((setting) => setting.id === 'global');
          const totalTripDays = getTotalTripDays(settings);
          const importedPlanner = [];
          if (Array.isArray(data.planner)) {
            data.planner.forEach((row) => {
              const result = validatePlannerImportRow(row, placeById, totalTripDays);
              if (result.item) importedPlanner.push(result.item);
            });
          }

          await clear('cities');
          await clear('places');
          await clear('planner');
          await putAll('cities', importedCities);
          if (importedPlaces.length) await putAll('places', importedPlaces);
          if (importedPlanner.length) await putAll('planner', importedPlanner);
          if (Array.isArray(data.settings)) {
            await clear('settings');
            if (data.settings.length) await putAll('settings', data.settings);
          }
          await ensureBaseCitiesExist();
          alert(skippedPlaces > 0
            ? `Backup restaurado con éxito. Se han ignorado ${skippedPlaces} actividades con campos, cityId u opciones no válidas. Recargando...`
            : 'Backup restaurado con éxito. Recargando...');
          window.location.reload();
        } else {
          alert('Archivo JSON no valido.');
        }
      } catch (err) {
        alert('Error al leer el JSON: ' + err.message);
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  });

  document.getElementById('btn-export-planner-json')?.addEventListener('click', async () => {
    const plannerData = buildPlannerExportRows(await getAll('planner'), await getAll('places'));
    downloadJsonFile({ planner: plannerData }, `japon2026_planner_${new Date().toISOString().slice(0,10)}.json`);
    showInlineMessage('planner-import-msg', 'Planificacion exportada correctamente.');
    setTimeout(() => { clearInlineMessage('planner-import-msg'); }, 3000);
  });

  document.getElementById('btn-export-planner-xlsx')?.addEventListener('click', async () => {
    const plannerData = buildPlannerExportRows(await getAll('planner'), await getAll('places'));
    if (!plannerData.length) {
      showInlineMessage('planner-import-msg', 'No hay planificacion para exportar.', 'error');
      return;
    }
    const worksheet = XLSX.utils.json_to_sheet(plannerData, { header: PLANNER_IMPORT_EXPORT_FIELDS });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Planificacion');
    XLSX.writeFile(workbook, `japon2026_planner_${new Date().toISOString().slice(0,10)}.xlsx`);
    showInlineMessage('planner-import-msg', 'Planificacion exportada a Excel correctamente.');
    setTimeout(() => { clearInlineMessage('planner-import-msg'); }, 3000);
  });

  document.getElementById('btn-export-planner-csv')?.addEventListener('click', async () => {
    const plannerData = buildPlannerExportRows(await getAll('planner'), await getAll('places'));
    if (!plannerData.length) {
      showInlineMessage('planner-import-msg', 'No hay planificacion para exportar.', 'error');
      return;
    }
    const worksheet = XLSX.utils.json_to_sheet(plannerData, { header: PLANNER_IMPORT_EXPORT_FIELDS });
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    downloadTextFile(csv, `japon2026_planner_${new Date().toISOString().slice(0,10)}.csv`);
    showInlineMessage('planner-import-msg', 'Planificacion exportada a CSV correctamente.');
    setTimeout(() => { clearInlineMessage('planner-import-msg'); }, 3000);
  });

  document.getElementById('input-planner-restore')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        clearInlineMessage('planner-import-msg');
        const payload = JSON.parse(ev.target.result);
        const plannerRows = Array.isArray(payload) ? payload : payload?.planner;
        if (!Array.isArray(plannerRows)) {
          showInlineMessage('planner-import-msg', 'Archivo de planificacion no valido.', 'error');
          return;
        }
        const existingPlaces = (await getAll('places')).map((place) => normalizePlaceRecord(place));
        const placeById = new Map(existingPlaces.map((place) => [place.id, place]));
        const settingsArray = await getAll('settings');
        const globalSettings = settingsArray.find((setting) => setting.id === 'global') || {};
        const totalTripDays = getTotalTripDays(globalSettings);
        const byPlaceId = new Map();
        let skipped = 0;
        plannerRows.forEach((row) => {
          const result = validatePlannerImportRow(row, placeById, totalTripDays);
          if (result.error) {
            skipped += 1;
            return;
          }
          byPlaceId.set(result.item.placeId, result.item);
        });
        await clear('planner');
        const validItems = Array.from(byPlaceId.values());
        if (validItems.length) await putAll('planner', validItems);
        showInlineMessage('planner-import-msg', `Planificacion importada correctamente (${validItems.length} actividades).`);
        if (skipped > 0) {
          showAdminToast(`Se han ignorado ${skipped} actividades porque no existen en la base de datos actual.`, 'error');
        }
      } catch (err) {
        showInlineMessage('planner-import-msg', `Error al leer la planificacion: ${err.message}`, 'error');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  });

  document.getElementById('input-planner-table-restore')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        clearInlineMessage('planner-import-msg');
        const plannerRows = parseWorkbookRows(ev.target.result);
        if (!plannerRows.length) {
          showInlineMessage('planner-import-msg', 'El archivo de planificacion esta vacio.', 'error');
          return;
        }

        const existingPlaces = (await getAll('places')).map((place) => normalizePlaceRecord(place));
        const placeById = new Map(existingPlaces.map((place) => [place.id, place]));
        const settingsArray = await getAll('settings');
        const globalSettings = settingsArray.find((setting) => setting.id === 'global') || {};
        const totalTripDays = getTotalTripDays(globalSettings);
        const byPlaceId = new Map();
        let skipped = 0;

        plannerRows.forEach((row) => {
          const result = validatePlannerImportRow(row, placeById, totalTripDays);
          if (result.error) {
            skipped += 1;
            return;
          }
          byPlaceId.set(result.item.placeId, result.item);
        });

        await clear('planner');
        const validItems = Array.from(byPlaceId.values());
        if (validItems.length) await putAll('planner', validItems);
        showInlineMessage('planner-import-msg', `Planificacion importada correctamente (${validItems.length} actividades).`);
        if (skipped > 0) {
          showAdminToast(`Se han ignorado ${skipped} filas porque la actividad, cityId, status o dia no son validos.`, 'error');
        }
      } catch (err) {
        showInlineMessage('planner-import-msg', `Error al leer la planificacion: ${err.message}`, 'error');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  });

  document.getElementById('btn-load-demo-data')?.addEventListener('click', () => {
    openAdminConfirmModal({
      title: '&#x1F504; Cargar datos de ejemplo',
      message: 'Esto sustituir&aacute; ciudades, actividades, planificador y ajustes globales por el dataset demo actual del proyecto. Es una acci&oacute;n pensada para volver al estado de ejemplo.',
      confirmLabel: 'S&iacute;, cargar demo',
      tone: 'primary',
      onConfirm: async () => {
        const demoDataset = buildDemoDataset();
        await clear('cities');
        await clear('places');
        await clear('planner');
        await clear('settings');
        await putAll('cities', demoDataset.cities);
        await putAll('places', demoDataset.places);
        await putAll('planner', demoDataset.planner);
        await putAll('settings', demoDataset.settings);
        showAdminToast('Datos de ejemplo cargados correctamente.');
        render();
      }
    });
  });

  document.getElementById('btn-clear-planner')?.addEventListener('click', () => {
    openAdminScopedClearModal({
      title: '&#x1F9F9; Limpiar planificador',
      message: 'Selecciona si quieres limpiar el estado del planificador de todas las ciudades o solo de una ciudad concreta. Las ciudades y actividades se mantienen.',
      confirmLabel: 'Limpiar planificador',
      citiesArray,
      onConfirm: async (scope) => {
        const plannerItems = await getAll('planner');
        if (scope === 'all') {
          await clear('planner');
          showAdminToast(`Planificador limpiado correctamente (${plannerItems.length} registros eliminados).`);
          render();
          return;
        }

        const places = (await getAll('places')).map((place) => normalizePlaceRecord(place));
        const targetPlaceIds = new Set(places.filter((place) => place.cityId === scope).map((place) => place.id));
        const remainingPlanner = plannerItems.filter((item) => !targetPlaceIds.has(item.placeId));
        const removedCount = plannerItems.length - remainingPlanner.length;

        await clear('planner');
        if (remainingPlanner.length) await putAll('planner', remainingPlanner.map((item) => normalizePlannerRecord(item)));

        const cityName = citiesArray.find((city) => city.id === scope)?.name || scope;
        showAdminToast(`Planificador de ${cityName} limpiado correctamente (${removedCount} registros eliminados).`);
        render();
      }
    });
  });

  document.getElementById('btn-clear-places')?.addEventListener('click', () => {
    openAdminScopedClearModal({
      title: '&#x26A0;&#xFE0F; Limpiar actividades',
      message: 'Selecciona si quieres eliminar actividades de todas las ciudades o solo de una ciudad concreta. Tambi&eacute;n se eliminar&aacute; la planificaci&oacute;n asociada a esas actividades para evitar referencias rotas.',
      confirmLabel: 'Limpiar actividades',
      citiesArray,
      onConfirm: async (scope) => {
        const places = (await getAll('places')).map((place) => normalizePlaceRecord(place));
        const plannerItems = await getAll('planner');

        if (scope === 'all') {
          await clear('places');
          await clear('planner');
          showAdminToast(`Actividades y planificador limpiados correctamente (${places.length} actividades eliminadas).`);
          render();
          return;
        }

        const targetPlaces = places.filter((place) => place.cityId === scope);
        const targetPlaceIds = new Set(targetPlaces.map((place) => place.id));
        const remainingPlaces = places.filter((place) => place.cityId !== scope);
        const remainingPlanner = plannerItems.filter((item) => !targetPlaceIds.has(item.placeId));
        const removedPlannerCount = plannerItems.length - remainingPlanner.length;

        await clear('places');
        await clear('planner');
        if (remainingPlaces.length) await putAll('places', remainingPlaces);
        if (remainingPlanner.length) await putAll('planner', remainingPlanner.map((item) => normalizePlannerRecord(item)));

        const cityName = citiesArray.find((city) => city.id === scope)?.name || scope;
        showAdminToast(`Actividades de ${cityName} eliminadas (${targetPlaces.length}) y planificador asociado limpiado (${removedPlannerCount}).`);
        render();
      }
    });
  });
  // Import Excel/CSV
  const inputCsv = document.getElementById('input-csv');
  inputCsv.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const rows = parseWorkbookRows(ev.target.result);

        if (rows.length === 0) {
          alert('El archivo está vacío');
          return;
        }

        const headerError = validateExactPlaceWorkbookHeaders(rows);
        if (headerError) {
          alert(headerError);
          return;
        }

        const validPlaces = [];
        const cityIdSet = new Set(getCityIdList(await getAll('cities')));
        let skippedRows = 0;
        
        for (const values of rows) {
          const obj = normalizePlaceImportDraft(values);
          const validationError = validatePlaceImportDraft(obj, cityIdSet);
          if (validationError) {
            skippedRows += 1;
            continue;
          }

          if (!obj.priority) obj.priority = 'optional';
          validPlaces.push(normalizePlaceRecord(obj));
        }

        if (validPlaces.length > 0) {
          await putAll('places', validPlaces);
          document.getElementById('csv-msg').textContent = skippedRows > 0
            ? `✅ Importados ${validPlaces.length} lugares. ${skippedRows} filas ignoradas por validación.`
            : `✅ Importados ${validPlaces.length} lugares desde Excel con éxito.`;
          document.getElementById('csv-msg').style.display = 'block';
          setTimeout(() => {
            document.getElementById('csv-msg').style.display = 'none';
            render();
          }, 3000);
        } else {
          alert('No se encontraron lugares válidos en el archivo.');
        }
      } catch (err) {
        console.error(err);
        alert('Error al parsear el archivo: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  });

  // Export Excel
  document.getElementById('btn-export-csv').addEventListener('click', async () => {
    const places = await getAll('places');
    if (!places.length) {
      alert('No hay lugares para exportar.');
      return;
    }

    const data = places.map((place) => toImportExportRow(place));
    const worksheet = XLSX.utils.json_to_sheet(data, { header: PLACE_IMPORT_EXPORT_FIELDS });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Lugares');
    
    // Generate buffer and download
    XLSX.writeFile(workbook, `japon2026_lugares_${new Date().toISOString().slice(0,10)}.xlsx`);
  });

  // Edit City
  document.querySelectorAll('.btn-edit-city').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const cityId = e.currentTarget.dataset.cityId;
      const city = await getById('cities', cityId);
      if (!city) return;

      const modalOverlay = document.getElementById('admin-modal-overlay');
      const modal = document.getElementById('admin-modal');

      modal.innerHTML = `
        <div class="modal-scroll admin-city-edit-modal">
          <div class="modal-header admin-city-edit-header">
            <div>
              <span class="admin-modal-kicker">Ciudad</span>
              <h2>&#x270F;&#xFE0F; Editar ciudad: ${city.name}</h2>
            </div>
            <button class="modal-close" id="admin-modal-close" aria-label="Cerrar">&#x2715;</button>
          </div>
          <div class="modal-body admin-city-edit-body">
          <form id="form-edit-city" class="admin-form">
            <div class="form-group">
              <label>ID (No editable)</label>
              <input type="text" id="edit-city-id" value="${city.id}" readonly style="background:#eee; cursor:not-allowed;">
            </div>
            <div class="form-group">
              <label>Nombre p&uacute;blico</label>
              <input type="text" id="edit-city-name" value="${city.name}" required>
            </div>
            <div class="form-group">
              <label>Nombre japon&eacute;s</label>
              <input type="text" id="edit-city-name-ja" value="${city.nameJa || ''}">
            </div>
            <div class="form-group">
              <label>Color Principal (Hex)</label>
              <div style="display:flex; align-items:center; gap:10px;">
                <input type="color" id="edit-city-color" value="${city.color}" style="width:50px; height:40px; padding:0; border:none; border-radius:4px; cursor:pointer;">
                <span id="edit-color-preview-text" style="font-family:monospace; padding:5px 10px; background:var(--bg-secondary); border-radius:4px;">${city.color}</span>
              </div>
            </div>
            <div class="form-group">
              <label>Subt&iacute;tulo (tagline)</label>
              <input type="text" id="edit-city-tagline" value="${city.tagline || ''}" required>
            </div>
            <div class="form-group">
              <label>Descripci&oacute;n principal</label>
              <textarea id="edit-city-description" rows="3" required>${city.description || ''}</textarea>
            </div>
            <div class="form-group">
              <label>Experiencia (Summary)</label>
              <textarea id="edit-city-summary" rows="2" required>${city.summary || ''}</textarea>
            </div>
            <div class="form-group">
              <label>Ideal para</label>
              <input type="text" id="edit-city-ideal-for" value="${city.idealFor || ''}" required>
            </div>
            <div class="form-group" style="display:flex; flex-direction:row; gap:10px;">
              <div style="flex:1;">
                <label>D&iacute;as recomendados</label>
                <input type="text" id="edit-city-days" value="${city.recommendedDays || '3 días'}" required style="width:100%;">
              </div>
              <div style="flex:2;">
                <label>Zonas (separadas por coma)</label>
                <input type="text" id="edit-city-zones" value="${(city.zones||[]).join(', ')}" required style="width:100%;">
              </div>
            </div>
            <div class="form-group">
              <label>Destacados / Chips (separados por coma)</label>
              <input type="text" id="edit-city-highlights" value="${(city.highlights||[]).join(', ')}" style="width:100%;">
            </div>
            <div class="form-group">
              <label>Coordenadas Centrales (Lat, Lng separadas por coma)</label>
              <input type="text" id="edit-city-center" value="${Array.isArray(city.center) ? city.center.join(', ') : (city.center ? city.center.lat + ', ' + city.center.lng : '')}" required>
            </div>
            <div class="admin-modal-actions">
              <button type="button" class="filter-pill" id="admin-modal-cancel">Cancelar</button>
              <button type="submit" class="filter-pill active">Guardar Cambios</button>
            </div>
          </form>
          </div>
        </div>
      `;
      modalOverlay.classList.add('open');
      document.body.style.overflow = 'hidden';

      const editColorInput = document.getElementById('edit-city-color');
      const editColorText = document.getElementById('edit-color-preview-text');
      editColorInput.addEventListener('input', (ev) => {
        editColorText.textContent = ev.target.value;
        editColorText.style.color = ev.target.value;
      });

      document.getElementById('admin-modal-close').addEventListener('click', () => {
        modalOverlay.classList.remove('open');
        document.body.style.overflow = '';
      });
      document.getElementById('admin-modal-cancel').addEventListener('click', () => {
        modalOverlay.classList.remove('open');
        document.body.style.overflow = '';
      });

      document.getElementById('form-edit-city').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const coordsStr = document.getElementById('edit-city-center').value.split(',');
        const lat = parseFloat(coordsStr[0]);
        const lng = parseFloat(coordsStr[1]);

        if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          showAdminToast('Las coordenadas centrales deben tener latitud y longitud validas.', 'error');
          return;
        }

        const color = document.getElementById('edit-city-color').value;
        const zonesStr = document.getElementById('edit-city-zones').value;
        const zones = zonesStr.split(',').map(z => z.trim()).filter(z => z);
        const highlightsStr = document.getElementById('edit-city-highlights').value;
        const highlights = highlightsStr.split(',').map(h => h.trim()).filter(h => h);

        const updatedCity = {
          ...city,
          name: document.getElementById('edit-city-name').value.trim(),
          nameJa: document.getElementById('edit-city-name-ja').value.trim(),
          color: color,
          gradient: `linear-gradient(135deg, ${color} 0%, #000 100%)`,
          tagline: document.getElementById('edit-city-tagline').value.trim(),
          description: document.getElementById('edit-city-description').value.trim(),
          summary: document.getElementById('edit-city-summary').value.trim(),
          idealFor: document.getElementById('edit-city-ideal-for').value.trim(),
          recommendedDays: document.getElementById('edit-city-days').value.trim() || '3 días',
          zones: zones.length > 0 ? zones : ["Centro"],
          highlights: highlights,
          center: { lat, lng }
        };

        await putAll('cities', [normalizeCityRecord(updatedCity, city.sortOrder ?? 999)]);
        alert('Ciudad actualizada con éxito');
        modalOverlay.classList.remove('open');
        document.body.style.overflow = '';
        render(); // Re-render the admin list
      });
    });
  });
  const citiesSortableList = document.getElementById('cities-sortable-list');
  if (citiesSortableList) {
    Sortable.create(citiesSortableList, {
      animation: 180,
      ghostClass: 'sortable-ghost',
      handle: '.admin-city-grip',
      onEnd: async () => {
        const currentCities = sortCities(await getAll('cities'));
        const byId = new Map(currentCities.map((city) => [city.id, city]));
        const reordered = Array.from(citiesSortableList.querySelectorAll('.admin-city-row'))
          .map((row, index) => normalizeCityRecord({ ...byId.get(row.dataset.cityId), sortOrder: index }, index))
          .filter((city) => city.id);
        await putAll('cities', reordered);
        showAdminToast('Orden de ciudades actualizado.');
        render();
      }
    });
  }
}

boot();

