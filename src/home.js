import { registerSW } from 'virtual:pwa-register';
import './styles/main.css';
import './styles/components.css';
import './styles/pages.css';
import { tripInfo } from './data/cities.js';
import { icons } from './utils/helpers.js';
import { runDataMigration } from './utils/dataMigration.js';
import { getAll } from './utils/db.js';
import { bindMobileNav, renderMobileMenu } from './utils/nav.js';
import { formatRecommendedDays, sortCities } from './utils/cityData.js';

const app = document.getElementById('app');

async function init() {
  await runDataMigration();
  const dbCities = sortCities(await getAll('cities'));
  const dbPlaces = await getAll('places');
  const settingsArray = await getAll('settings') || [];
  const globalSettings = settingsArray.find(s => s.id === 'global') || {};
  render(dbCities, dbPlaces, globalSettings);
}

function render(citiesArray, allPlaces, globalSettings) {
  const totalPlaces = allPlaces.length;
  const plannerLink = `<a href="/planner.html" style="color:var(--accent); font-weight:bold;">&#x1F5D3;&#xFE0F; Planner</a>`;
  const cityLinks = citiesArray.map(city => `<a href="/city.html?id=${city.id}">${city.name}</a>`).join('');

  const startDateStr = globalSettings?.startDate || '2026-06-30';
  const endDateStr = globalSettings?.endDate || '2026-07-16';
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  const totalDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
  const formattedStart = startDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
  const formattedEnd = endDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  const datesFormatted = `${formattedStart} — ${formattedEnd}`;

  app.innerHTML = `
    <nav class="nav" id="main-nav">
      <div class="nav-inner">
        <a href="/" class="nav-logo">🇯🇵 Japón 2026 <span class="ja">日本</span></a>
        <div class="nav-links">
          <a href="/" class="active">Inicio</a>
          <span class="nav-separator" aria-hidden="true">|</span>
          ${cityLinks}
          <span class="nav-separator" aria-hidden="true">|</span>
          ${plannerLink}
          <div class="nav-tools">
            <a href="/admin.html" class="nav-tool-btn" title="Administración">⚙️</a>
          </div>
        </div>
        <div class="nav-mobile-tools">
          <a href="/admin.html" class="nav-tool-btn" title="Admin">⚙️</a>
          ${renderMobileMenu('mobile-toggle', 'mobile-menu', `
            <a href="/" class="active">Inicio</a>
            ${citiesArray.map(city => `<a href="/city.html?id=${city.id}">${city.name} ${city.nameJa || ''}</a>`).join('')}
            ${plannerLink}
          `)}
        </div>
      </div>
    </nav>

    <section class="home-hero">
      <span class="deco deco-1">⛩️</span>
      <span class="deco deco-2">🌸</span>
      <span class="deco deco-3">🗾</span>
      <span class="deco deco-4">🏯</span>
      <div class="home-hero-content animate-fade-in-up">
        <div class="home-hero-badge">✈️ Viaje planificado</div>
        <h1>${tripInfo.title}<span class="ja">日本の旅</span></h1>
        <p class="home-hero-subtitle">${tripInfo.description}</p>
        <div class="home-hero-dates">
          <span>📅 ${datesFormatted}</span>
          <span class="divider"></span>
          <span>${totalDays} días</span>
        </div>
      </div>
      <div class="home-hero-scroll">${icons.chevronDown}</div>
    </section>

    <section style="padding: 2rem 0 1rem 0;">
      <div class="container">
        <!-- Countdown -->
        <div id="countdown-wrapper" style="text-align: center; margin-bottom: 2rem;" class="animate-fade-in-up">
          <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">Comienza la aventura en</div>
          <div id="countdown-timer" style="display: flex; justify-content: center; gap: 12px; font-family: monospace; font-size: 2.5rem; font-weight: bold; color: var(--accent); line-height: 1;">
            <div style="display:flex; flex-direction:column; align-items:center;"><span id="cd-d">--</span><span style="font-size:0.7rem; font-family:var(--font-sans); color:var(--text-tertiary); margin-top:4px;">DÍAS</span></div>
            <span>:</span>
            <div style="display:flex; flex-direction:column; align-items:center;"><span id="cd-h">--</span><span style="font-size:0.7rem; font-family:var(--font-sans); color:var(--text-tertiary); margin-top:4px;">HRS</span></div>
            <span>:</span>
            <div style="display:flex; flex-direction:column; align-items:center;"><span id="cd-m">--</span><span style="font-size:0.7rem; font-family:var(--font-sans); color:var(--text-tertiary); margin-top:4px;">MIN</span></div>
            <span>:</span>
            <div style="display:flex; flex-direction:column; align-items:center;"><span id="cd-s">--</span><span style="font-size:0.7rem; font-family:var(--font-sans); color:var(--text-tertiary); margin-top:4px;">SEG</span></div>
          </div>
        </div>

        <div class="home-stats">
          <div class="home-stat animate-fade-in-up stagger-1"><div class="home-stat-number">${tripInfo.totalCities}</div><div class="home-stat-label">Ciudades</div></div>
          <div class="home-stat animate-fade-in-up stagger-2"><div class="home-stat-number">${totalPlaces}</div><div class="home-stat-label">Lugares</div></div>
          <div class="home-stat animate-fade-in-up stagger-3"><div class="home-stat-number">${totalDays}</div><div class="home-stat-label">Días</div></div>
          <div class="home-stat animate-fade-in-up stagger-4"><div class="home-stat-number">∞</div><div class="home-stat-label">Experiencias</div></div>
        </div>
      </div>
    </section>

    <section style="padding: 1rem 0 4rem 0;">
      <div class="container">
        <div class="home-section-title">
          <h2>Explora las ciudades</h2>
          <p>Tres ciudades, tres personalidades, una aventura inolvidable</p>
        </div>
        <div class="city-cards">
          ${citiesArray.map(city => renderCityCard(city, allPlaces)).join('')}
        </div>
      </div>
    </section>

    <section class="section-sm" style="background: var(--bg-secondary);">
      <div class="container">
        <div class="home-section-title">
          <h2>🗾 Información general</h2>
          <p>Lo que necesitas saber antes de viajar a Japón</p>
        </div>
        <div class="tips-grid">
          <div class="tip-card"><div class="tip-card-icon">🌡️</div><h4>Clima en julio</h4><p>Julio es caluroso y húmedo (30-35°C). Lleva ropa ligera, protector solar y botella de agua. Los konbini tienen aire acondicionado para refugiarte.</p></div>
          <div class="tip-card"><div class="tip-card-icon">💴</div><h4>Dinero</h4><p>Japón usa mucho efectivo. Saca yenes en cajeros 7-Eleven o Family Mart. La mayoría aceptan tarjetas extranjeras.</p></div>
          <div class="tip-card"><div class="tip-card-icon">📱</div><h4>Internet</h4><p>Compra una eSIM o alquila pocket WiFi antes de llegar. Google Maps y Google Translate serán tus mejores amigos.</p></div>
          <div class="tip-card"><div class="tip-card-icon">🏮</div><h4>Costumbres</h4><p>Quítate los zapatos al entrar a casas y templos. No des propina. No hables por teléfono en el tren. Haz fila siempre.</p></div>
          <div class="tip-card"><div class="tip-card-icon">🍱</div><h4>Comida</h4><p>Los konbini (7-Eleven, Lawson, Family Mart) tienen comida deliciosa y barata. Los ekiben (bento de estación) son una experiencia.</p></div>
        </div>
      </div>
    </section>

    <footer class="footer">
      <div class="container">
        <p>Japón 2026 · ${datesFormatted} · Hecho con <span class="heart">❤️</span></p>
      </div>
    </footer>
  `;

  // Events
  bindMobileNav('mobile-toggle', 'mobile-menu');
  window.addEventListener('scroll', () => {
    document.getElementById('main-nav')?.classList.toggle('scrolled', window.scrollY > 10);
  });

  // Observer for animations
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) e.target.style.animationPlayState = 'running'; });
  }, { threshold: 0.1 });
  document.querySelectorAll('.animate-fade-in-up').forEach(el => observer.observe(el));

  // Countdown Logic
  const targetDate = new Date(2026, 5, 28, 22, 35, 0).getTime(); // June 28, 2026 22:35:00
  
  function updateCountdown() {
    const now = new Date().getTime();
    const distance = targetDate - now;

    if (distance < 0) {
      const wrapper = document.getElementById('countdown-wrapper');
      if (wrapper) wrapper.innerHTML = '<div style="font-size: 1.5rem; font-weight: bold; color: var(--accent);">¡El viaje ha comenzado! ✈️🇯🇵</div>';
      return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    const elD = document.getElementById('cd-d');
    const elH = document.getElementById('cd-h');
    const elM = document.getElementById('cd-m');
    const elS = document.getElementById('cd-s');

    if (elD) elD.textContent = String(days).padStart(2, '0');
    if (elH) elH.textContent = String(hours).padStart(2, '0');
    if (elM) elM.textContent = String(minutes).padStart(2, '0');
    if (elS) elS.textContent = String(seconds).padStart(2, '0');
  }

  updateCountdown();
  setInterval(updateCountdown, 1000);

  // Register PWA Service Worker
  if ('serviceWorker' in navigator) {
    registerSW({ immediate: true });
  }
}

function renderCityCard(city, allPlaces) {
  const cityPlaces = allPlaces.filter(p => p.cityId === city.id);
  const count = cityPlaces.length;
  const mustSee = cityPlaces.filter(p => p.priority === 'must-see').length;
  return `<a href="/city.html?id=${city.id}" class="city-card animate-fade-in-up" style="--city-color: ${city.color}">
    <div class="city-card-hero" style="background: ${city.gradient};">
      <div class="city-card-hero-content">
        <h3>${city.name}</h3>
        <span class="ja">${city.nameJa}</span>
      </div>
    </div>
    <div class="city-card-body">
      <div class="city-card-tagline">${city.tagline}</div>
      <p class="city-card-desc">${city.summary}</p>
      <div class="city-card-stats">
        <div class="city-card-stat">📍 <strong>${count}</strong> lugares</div>
        <div class="city-card-stat">🔥 <strong>${mustSee}</strong> imprescindibles</div>
        <div class="city-card-stat">📅 <strong>${formatRecommendedDays(city.recommendedDays)}</strong></div>
      </div>
      <div class="city-card-highlights">
        ${(city.highlights || []).map(h => `<span>${h}</span>`).join('')}
      </div>
      <div class="city-card-cta" style="color: ${city.color};">
        Explorar ${city.name} ${icons.arrowRight}
      </div>
    </div>
  </a>`;
}

init();
