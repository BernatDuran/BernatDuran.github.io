import { registerSW } from 'virtual:pwa-register';
import './styles/main.css';
import './styles/components.css';
import './styles/pages.css';
import { icons } from './utils/helpers.js';
import { getAll } from './utils/db.js';

function renderNav(globalSettings) {
  const plannerLink = globalSettings?.plannerEnabled ? `<a href="/planner.html" style="color:var(--accent); font-weight:bold;">🗓️ Planner</a>` : '';
  return `<nav class="nav" id="main-nav">
    <div class="nav-inner">
      <a href="/" class="nav-logo">🇯🇵 Japón 2026 <span class="ja">日本</span></a>
      <div class="nav-links">
        <a href="/">Inicio</a>
        <a href="/city.html?id=tokyo">Tokio</a>
        <a href="/city.html?id=kyoto">Kioto</a>
        <a href="/city.html?id=osaka">Osaka</a>
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
      <a href="/city.html?id=tokyo">Tokio 東京</a>
      <a href="/city.html?id=kyoto">Kioto 京都</a>
      <a href="/city.html?id=osaka">Osaka 大阪</a>
      ${plannerLink}
    </div>
  </nav>`;
}

function render(globalSettings) {
  const app = document.getElementById('app');
  app.innerHTML = `
    ${renderNav(globalSettings)}
    <section class="section" style="min-height: 80vh;">
      <div class="container container-narrow">
        <div class="home-section-title">
          <h2>🧰 Herramientas Útiles</h2>
          <p>Próximamente disponibles</p>
        </div>
        <div style="text-align:center; padding: var(--space-2xl); color: var(--text-tertiary); font-size:0.9rem;">
          ⚙️ Las herramientas están temporalmente deshabilitadas.
        </div>
      </div>
    </section>
  `;

  // Events
  document.getElementById('mobile-toggle')?.addEventListener('click', () => {
    document.getElementById('mobile-menu')?.classList.toggle('open');
  });
  window.addEventListener('scroll', () => {
    document.getElementById('main-nav')?.classList.toggle('scrolled', window.scrollY > 10);
  });


  if (window.location.hash) {
    setTimeout(() => {
      const el = document.querySelector(window.location.hash);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  // Register PWA Service Worker
  if ('serviceWorker' in navigator) {
    registerSW({ immediate: true });
  }
}

async function boot() {
  const settingsArray = await getAll('settings') || [];
  const globalSettings = settingsArray.find(s => s.id === 'global') || {};
  render(globalSettings);
}

boot();
