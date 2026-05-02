import './styles/main.css';
import './styles/components.css';
import './styles/pages.css';
import { getAll, getById, putAll, clear } from './utils/db.js';
import { icons } from './utils/helpers.js';
import { runDataMigration } from './utils/dataMigration.js';
import * as XLSX from 'xlsx';

const app = document.getElementById('app');

async function boot() {
  await runDataMigration();
  render();
}

async function render() {
  const citiesArray = await getAll('cities');
  const placesArray = await getAll('places');
  const settingsArray = await getAll('settings');
  const globalSettings = settingsArray.find(s => s.id === 'global') || {};

  app.innerHTML = `
    <nav class="nav" id="main-nav">
      <div class="nav-inner">
        <a href="/" class="nav-logo">🇯🇵 Japón 2026 <span class="ja">Admin</span></a>
        <div class="nav-links">
          <a href="/">Volver al Inicio</a>
          ${globalSettings.plannerEnabled ? `<a href="/planner.html" style="color:var(--accent); font-weight:bold;">🗓️ Planner</a>` : ''}
        </div>
      </div>
    </nav>
    <div class="container" style="padding-top: calc(var(--nav-height) + var(--space-xl)); padding-bottom: var(--space-xl);">
      <div class="home-section-title">
        <h2>⚙️ Panel de Administración</h2>
        <p>Configuración avanzada, importación y copias de seguridad.</p>
      </div>

      <!-- GLOBAL SETTINGS SECTION -->
      <div class="admin-card" style="margin-bottom: 20px;">
        <h3>🌍 Configuración del Viaje</h3>
        <p style="color: var(--text-secondary); margin-bottom: 15px;">Establece las fechas globales de tu viaje para el Planificador ("Mi Ruta").</p>
        <div style="display:flex; gap:10px; flex-wrap: wrap; align-items:flex-end;">
          <div class="form-group" style="margin:0;">
            <label>Fecha de inicio</label>
            <input type="date" id="global-start-date" value="${globalSettings.startDate || ''}" style="padding:8px; border-radius:4px; border:1px solid var(--border);">
          </div>
          <div class="form-group" style="margin:0;">
            <label>Fecha de fin</label>
            <input type="date" id="global-end-date" value="${globalSettings.endDate || ''}" style="padding:8px; border-radius:4px; border:1px solid var(--border);">
          </div>
          <div class="form-group" style="margin:0; display:flex; align-items:center; gap:8px; padding-top:25px; margin-right: 15px;">
            <input type="checkbox" id="global-planner-enabled" ${globalSettings.plannerEnabled ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer;">
            <label for="global-planner-enabled" style="margin:0; font-weight:600; cursor:pointer;">Planificador activado</label>
          </div>
          <div class="form-group" style="margin:0; min-width: 200px;">
            <label>Estilo de enlaces de Mapa</label>
            <select id="global-map-link-style" style="padding:8px; border-radius:4px; border:1px solid var(--border); width: 100%;">
              <option value="smart" ${globalSettings.mapLinkStyle === 'smart' || !globalSettings.mapLinkStyle ? 'selected' : ''}>Inteligente (App Nativa / Ficha Google)</option>
              <option value="coords" ${globalSettings.mapLinkStyle === 'coords' ? 'selected' : ''}>Solo Coordenadas (Modo Clásico)</option>
            </select>
          </div>
          <button id="btn-save-settings" class="maps-link-btn" style="background:var(--accent); border:none; cursor:pointer;">💾 Guardar Ajustes</button>
        </div>
        <p id="settings-msg" style="margin-top:10px; font-weight:bold; color:var(--accent); display:none;"></p>
      </div>

      <!-- BACKUP SECTION -->
      <div class="admin-card">
        <h3>💾 Copias de Seguridad</h3>
        <p style="color: var(--text-secondary); margin-bottom: 15px;">Guarda una copia de todos tus datos (ciudades, lugares y planificación) en un archivo JSON.</p>
        <div style="display:flex; gap:10px; flex-wrap: wrap;">
          <button id="btn-export" class="maps-link-btn" style="background:var(--accent);">⬇️ Exportar Backup (JSON)</button>
          
          <label class="maps-link-btn" style="background:var(--bg-secondary); color:var(--text-primary); cursor:pointer;">
            ⬆️ Restaurar Backup
            <input type="file" id="input-restore" accept=".json" style="display:none;">
          </label>
        </div>
        <p id="backup-msg" style="margin-top:10px; font-weight:bold; color:var(--accent); display:none;"></p>
      </div>

      <!-- CITIES LIST SECTION -->
      <div class="admin-card" style="margin-top: 20px;">
        <h3>🏙️ Ciudades Registradas</h3>
        <p style="color: var(--text-secondary); margin-bottom: 15px;">Gestiona las ciudades existentes. Haz click en Editar para modificar sus detalles.</p>
        <div style="display:flex; flex-direction:column; gap:10px;">
          ${citiesArray.map(city => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border:1px solid var(--border-light); border-left: 5px solid ${city.color}; border-radius:var(--radius-md); background:var(--bg-primary);">
              <div>
                <div style="font-weight:bold;">${city.name} ${city.nameJa ? `<span style="font-size:0.85em; color:var(--text-secondary);">${city.nameJa}</span>` : ''}</div>
                <div style="font-size:0.85rem; color:var(--text-secondary);">ID: ${city.id} · ${city.recommendedDays} días · ${city.zones.length} zonas</div>
              </div>
              <button class="filter-pill btn-edit-city" data-city-id="${city.id}">✏️ Editar</button>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- ADD CITY SECTION -->
      <div class="admin-card" style="margin-top: 20px;">
        <h3>🏙️ Añadir Nueva Ciudad</h3>
        <form id="form-add-city" class="admin-form">
          <div class="form-group">
            <label>ID (minúsculas, sin espacios. Ej: 'kyoto')</label>
            <input type="text" id="city-id" required>
          </div>
          <div class="form-group">
            <label>Nombre Público (Ej: 'Kioto')</label>
            <input type="text" id="city-name" required>
          </div>
          <div class="form-group">
            <label>Nombre Japonés (Ej: '京都')</label>
            <input type="text" id="city-name-ja">
          </div>
          <div class="form-group">
            <label>Color Principal (Hex)</label>
            <div style="display:flex; align-items:center; gap:10px;">
              <input type="color" id="city-color" value="#2563eb" style="width:50px; height:40px; padding:0; border:none; border-radius:4px; cursor:pointer;">
              <span id="color-preview-text" style="font-family:monospace; padding:5px 10px; background:var(--bg-secondary); border-radius:4px;">#2563eb</span>
            </div>
          </div>
          <div class="form-group">
            <label>Subtítulo (Tagline)</label>
            <input type="text" id="city-tagline" required>
          </div>
          <div class="form-group">
            <label>Descripción Principal</label>
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
          <div class="form-group" style="display:flex; flex-direction:row; gap:10px;">
            <div style="flex:1;">
              <label>Días recomendados</label>
              <input type="number" id="city-days" min="1" value="3" required style="width:100%;">
            </div>
            <div style="flex:2;">
              <label>Zonas (separadas por coma)</label>
              <input type="text" id="city-zones" placeholder="Centro, Afueras" required style="width:100%;">
            </div>
          </div>
          <div class="form-group">
            <label>Destacados / Chips (separados por coma)</label>
            <input type="text" id="city-highlights" placeholder="Templo antiguo, Calle principal..." style="width:100%;">
          </div>
          <div class="form-group">
            <label>Coordenadas Centrales (Lat, Lng separadas por coma)</label>
            <input type="text" id="city-center" placeholder="35.6762, 139.6503" required>
          </div>
          <button type="submit" class="filter-pill active">Guardar Ciudad</button>
        </form>
      </div>

      <!-- IMPORT CSV SECTION -->
      <div class="admin-card" style="margin-top: 20px;">
        <h3 style="display:flex; align-items:center; gap:10px;">
          📥 Importación/Exportación Masiva (Excel)
          <button id="btn-csv-info" style="background:none;border:none;cursor:pointer;font-size:1.2rem;" title="Ver formato de campos">ℹ️</button>
        </h3>
        <p style="color: var(--text-secondary); margin-bottom: 15px;">Importa actividades desde un archivo Excel (.xlsx) o CSV. Debe incluir cabeceras en la primera fila.</p>
        <p style="font-size: 0.8rem; background: var(--bg-secondary); padding: 10px; border-radius: 5px; margin-bottom: 15px;">
          <strong>Cabeceras obligatorias:</strong> id, name, cityId, category, type, lat, lng<br>
          <strong>Cabeceras opcionales:</strong> priority, zone, description, estimatedDuration, bestTime, rainyFriendly, score, ticketInfo
        </p>
        <div style="display:flex; gap:10px; flex-wrap: wrap;">
          <label class="maps-link-btn" style="background:var(--bg-secondary); color:var(--text-primary); cursor:pointer;">
            ⬆️ Importar Excel/CSV
            <input type="file" id="input-csv" accept=".xlsx, .xls, .csv" style="display:none;">
          </label>
          <button id="btn-export-csv" class="maps-link-btn" style="background:var(--accent);">⬇️ Exportar Lugares (Excel)</button>
        </div>
        <p id="csv-msg" style="margin-top:10px; font-weight:bold; color:var(--accent); display:none;"></p>
      </div>
      
      <!-- STATS -->
      <div style="margin-top: 30px; font-size: 0.9rem; color: var(--text-tertiary);">
        Estado de la BD: ${citiesArray.length} ciudades registradas, ${placesArray.length} lugares en total.
      </div>
    </div>
    
    <!-- INFO MODAL -->
    <div class="modal-overlay" id="admin-modal-overlay">
      <div class="modal" id="admin-modal"></div>
    </div>
  `;

  attachEvents();
}

function attachEvents() {
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
        <h2>ℹ️ Formato de Campos CSV</h2>
        <button class="modal-close" id="admin-modal-close">✕</button>
      </div>
      <div class="modal-body" style="font-size:0.9rem; line-height:1.6;">
        <p>Al importar o exportar el CSV, asegúrate de utilizar estas columnas exactas en la primera fila:</p>
        <ul style="padding-left:20px; margin-top:10px;">
          <li><strong>id</strong>: (Texto) Identificador único en minúsculas sin espacios (ej: 'tokyo-tower'). Si lo dejas vacío, se autogenerará.</li>
          <li><strong>name</strong>: (Texto) Nombre del lugar.</li>
          <li><strong>cityId</strong>: (Texto) ID de la ciudad a la que pertenece (ej: 'tokyo', 'kyoto').</li>
          <li><strong>category</strong>: (Opciones exactas) 'cultura', 'comida', 'ocio', 'compras'.</li>
          <li><strong>type</strong>: (Texto) Tipo descriptivo (ej: 'Templo', 'Mirador', 'Restaurante').</li>
          <li><strong>priority</strong>: (Opciones exactas) 'must-see' (Imprescindible), 'recommended' (Recomendado), 'optional' (Opcional).</li>
          <li><strong>zone</strong>: (Texto) Nombre del barrio o zona (ej: 'Shibuya', 'Gion').</li>
          <li><strong>description</strong>: (Texto) Descripción larga. Evita usar comillas dobles internas si no controlas bien el CSV.</li>
          <li><strong>lat / lng</strong>: (Números) Coordenadas decimales usando punto (ej: 35.6585).</li>
          <li><strong>estimatedDuration</strong>: (Texto) Tiempo que suele llevar la visita (ej: '1h 30m').</li>
          <li><strong>bestTime</strong>: (Opciones exactas) 'mañana', 'tarde', 'noche' o dejar vacío para 'Cualquier momento'.</li>
          <li><strong>rainyFriendly</strong>: (Booleano) 'true' o '1' si se puede visitar lloviendo, 'false' o '0' si no.</li>
          <li><strong>score</strong>: (Número) Puntuación del 0.0 al 10.0 usando punto (ej: 9.5).</li>
          <li><strong>ticketInfo</strong>: (Texto) Precio o texto informativo (ej: '1200¥', 'Gratis').</li>
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
    const plannerEnabled = document.getElementById('global-planner-enabled').checked;
    const mapLinkStyle = document.getElementById('global-map-link-style').value;
    await putAll('settings', [{ id: 'global', startDate: start, endDate: end, plannerEnabled, mapLinkStyle }]);
    
    const msg = document.getElementById('settings-msg');
    msg.textContent = '✅ Ajustes actualizados correctamente.';
    msg.style.display = 'block';
    setTimeout(() => { msg.style.display = 'none'; }, 3000);
  });

  // Export JSON
  document.getElementById('btn-export').addEventListener('click', async () => {
    const data = {
      cities: await getAll('cities'),
      places: await getAll('places'),
      planner: await getAll('planner')
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `japon2026_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  });

  // Import JSON
  document.getElementById('input-restore').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.cities && data.places) {
          await clear('cities');
          await clear('places');
          await clear('planner');
          
          await putAll('cities', data.cities);
          await putAll('places', data.places);
          if (data.planner) await putAll('planner', data.planner);
          
          alert('Backup restaurado con éxito. Recargando...');
          window.location.reload();
        } else {
          alert('Archivo JSON no válido.');
        }
      } catch (err) {
        alert('Error al leer el JSON: ' + err.message);
      }
    };
    reader.readAsText(file);
  });

  // Add City
  document.getElementById('form-add-city').addEventListener('submit', async (e) => {
    e.preventDefault();
    const coordsStr = document.getElementById('city-center').value.split(',');
    const lat = parseFloat(coordsStr[0]);
    const lng = parseFloat(coordsStr[1]);

    const color = document.getElementById('city-color').value;
    const zonesStr = document.getElementById('city-zones').value;
    const zones = zonesStr.split(',').map(z => z.trim()).filter(z => z);
    const highlightsStr = document.getElementById('city-highlights').value;
    const highlights = highlightsStr.split(',').map(h => h.trim()).filter(h => h);
    
    const newCity = {
      id: document.getElementById('city-id').value.trim().toLowerCase(),
      name: document.getElementById('city-name').value.trim(),
      nameJa: document.getElementById('city-name-ja').value.trim(),
      color: color,
      gradient: `linear-gradient(135deg, ${color} 0%, #000 100%)`,
      tagline: document.getElementById('city-tagline').value.trim(),
      description: document.getElementById('city-description').value.trim(),
      summary: document.getElementById('city-summary').value.trim(),
      idealFor: document.getElementById('city-ideal-for').value.trim(),
      recommendedDays: parseInt(document.getElementById('city-days').value) || 3,
      zones: zones.length > 0 ? zones : ["Centro"],
      highlights: highlights,
      center: [lat || 0, lng || 0],
      defaultZoom: 13
    };

    await putAll('cities', [newCity]);
    alert('Ciudad añadida con éxito');
    render();
  });

  // Import Excel/CSV
  const inputCsv = document.getElementById('input-csv');
  inputCsv.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = new Uint8Array(ev.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (rows.length === 0) {
          alert('El archivo está vacío');
          return;
        }

        const validPlaces = [];
        
        for (const values of rows) {
          const obj = {};
          
          Object.keys(values).forEach(h => {
            let val = values[h];
            if (val === "") return;
            
            // Attempt to parse objects/arrays back
            if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
              try { val = JSON.parse(val); } catch(e) {}
            }

            // Convert specific types
            if (h === 'lat' || h === 'lng') val = parseFloat(val);
            if (h === 'score' && typeof val !== 'object') val = parseFloat(val);
            if (h === 'rainyFriendly') val = val === 'true' || val === 'TRUE' || val === 1 || val === true;
            if (h === 'priority' && !val) val = 'optional';
            
            obj[h] = val;
          });

          if (obj.id && obj.cityId) {
            validPlaces.push(obj);
          }
        }

        if (validPlaces.length > 0) {
          await putAll('places', validPlaces);
          document.getElementById('csv-msg').textContent = `✅ Importados ${validPlaces.length} lugares desde Excel con éxito.`;
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

    const headers = [
      'id', 'name', 'cityId', 'category', 'type', 'priority', 'zone', 
      'description', 'lat', 'lng', 'estimatedDuration', 'bestTime', 
      'rainyFriendly', 'score', 'ticketInfo'
    ];

    const data = places.map(place => {
      const row = {};
      headers.forEach(h => {
        let val = place[h];
        if (typeof val === 'object' && val !== null) {
          val = JSON.stringify(val);
        }
        row[h] = val;
      });
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(data, { header: headers });
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
        <div class="modal-header">
          <h2>✏️ Editar Ciudad: ${city.name}</h2>
          <button class="modal-close" id="admin-modal-close">✕</button>
        </div>
        <div class="modal-body">
          <form id="form-edit-city" class="admin-form">
            <div class="form-group">
              <label>ID (No editable)</label>
              <input type="text" id="edit-city-id" value="${city.id}" readonly style="background:#eee; cursor:not-allowed;">
            </div>
            <div class="form-group">
              <label>Nombre Público</label>
              <input type="text" id="edit-city-name" value="${city.name}" required>
            </div>
            <div class="form-group">
              <label>Nombre Japonés</label>
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
              <label>Subtítulo (Tagline)</label>
              <input type="text" id="edit-city-tagline" value="${city.tagline || ''}" required>
            </div>
            <div class="form-group">
              <label>Descripción Principal</label>
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
                <label>Días recomendados</label>
                <input type="number" id="edit-city-days" min="1" value="${parseInt(city.recommendedDays) || 3}" required style="width:100%;">
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
            <button type="submit" class="filter-pill active" style="margin-top:10px;">Guardar Cambios</button>
          </form>
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

      document.getElementById('form-edit-city').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const coordsStr = document.getElementById('edit-city-center').value.split(',');
        const lat = parseFloat(coordsStr[0]);
        const lng = parseFloat(coordsStr[1]);
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
          recommendedDays: parseInt(document.getElementById('edit-city-days').value) || 3,
          zones: zones.length > 0 ? zones : ["Centro"],
          highlights: highlights,
          center: [lat || 0, lng || 0]
        };

        await putAll('cities', [updatedCity]);
        alert('Ciudad actualizada con éxito');
        modalOverlay.classList.remove('open');
        document.body.style.overflow = '';
        render(); // Re-render the admin list
      });
    });
  });
}

 boot();
