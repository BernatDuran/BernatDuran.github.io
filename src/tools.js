import { registerSW } from 'virtual:pwa-register';
import './styles/main.css';
import './styles/components.css';
import './styles/pages.css';
import { getAll } from './utils/db.js';
import { bindMobileNav, renderMobileMenu } from './utils/nav.js';
import { sortCities } from './utils/cityData.js';

function renderNav(citiesArray) {
  const plannerLink = `<a href="/planner.html" style="color:var(--accent); font-weight:bold;">&#x1F5D3;&#xFE0F; Planner</a>`;
  return `<nav class="nav" id="main-nav">
    <div class="nav-inner">
      <a href="/" class="nav-logo">&#x1F1EF;&#x1F1F5; Jap&oacute;n 2026 <span class="ja">&#x65E5;&#x672C;</span></a>
      <div class="nav-links">
        <a href="/">Inicio</a>
        <span class="nav-separator" aria-hidden="true">|</span>
        ${citiesArray.map(city => `<a href="/city.html?id=${city.id}">${city.name}</a>`).join('')}
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
          ${citiesArray.map(city => `<a href="/city.html?id=${city.id}">${city.name} ${city.nameJa || ''}</a>`).join('')}
          ${plannerLink}
        `)}
      </div>
    </div>
  </nav>`;
}

function render(citiesArray) {
  const app = document.getElementById('app');
  app.innerHTML = `
    ${renderNav(citiesArray)}
    <section class="section" style="min-height: 80vh;">
      <div class="container container-narrow">
        <div class="home-section-title">
          <h2>&#x1F9F0; Herramientas Utiles</h2>
          <p>Proximamente disponibles</p>
        </div>
        <div style="text-align:center; padding: var(--space-2xl); color: var(--text-tertiary); font-size:0.9rem;">
          &#x2699;&#xFE0F; Las herramientas estan temporalmente deshabilitadas.
        </div>
      </div>
    </section>
  `;

  bindMobileNav('mobile-toggle', 'mobile-menu');
  window.addEventListener('scroll', () => {
    document.getElementById('main-nav')?.classList.toggle('scrolled', window.scrollY > 10);
  });

  if (window.location.hash) {
    setTimeout(() => {
      const el = document.querySelector(window.location.hash);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  if ('serviceWorker' in navigator) {
    registerSW({ immediate: true });
  }
}

async function boot() {
  const citiesArray = sortCities(await getAll('cities'));
  render(citiesArray);
}

boot();
