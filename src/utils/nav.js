import { icons } from './helpers.js';

export function renderMobileMenu(toggleId, menuId, linksHtml) {
  return `
    <button class="nav-mobile-toggle" id="${toggleId}" type="button" aria-expanded="false" aria-controls="${menuId}" aria-label="Abrir menu de navegacion">
      <span class="nav-mobile-toggle-icon">${icons.menu}</span>
    </button>
    <div class="nav-mobile-backdrop" id="${menuId}-backdrop" hidden></div>
    <div class="nav-mobile-menu" id="${menuId}" aria-hidden="true">
      <div class="nav-mobile-menu-header">
        <span class="nav-mobile-menu-title">Navegacion</span>
        <button class="nav-mobile-close" id="${menuId}-close" type="button" aria-label="Cerrar menu">
          ${icons.close}
        </button>
      </div>
      <div class="nav-mobile-menu-links">
        ${linksHtml}
      </div>
    </div>
  `;
}

export function bindMobileNav(toggleId = 'mobile-toggle', menuId = 'mobile-menu') {
  const toggle = document.getElementById(toggleId);
  const menu = document.getElementById(menuId);
  const backdrop = document.getElementById(`${menuId}-backdrop`);
  const closeBtn = document.getElementById(`${menuId}-close`);

  if (!toggle || !menu || toggle.dataset.navBound === 'true') return;
  toggle.dataset.navBound = 'true';

  const setOpen = (open) => {
    menu.classList.toggle('open', open);
    menu.setAttribute('aria-hidden', String(!open));
    toggle.setAttribute('aria-expanded', String(open));
    backdrop?.toggleAttribute('hidden', !open);
    document.body.classList.toggle('nav-mobile-open', open);
    const iconHost = toggle.querySelector('.nav-mobile-toggle-icon');
    if (iconHost) iconHost.innerHTML = open ? icons.close : icons.menu;
  };

  toggle.addEventListener('click', () => {
    setOpen(!menu.classList.contains('open'));
  });

  closeBtn?.addEventListener('click', () => setOpen(false));
  backdrop?.addEventListener('click', () => setOpen(false));

  menu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => setOpen(false));
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 768 && menu.classList.contains('open')) {
      setOpen(false);
    }
  });

  if (!document.body.dataset.navEscapeBound) {
    document.body.dataset.navEscapeBound = 'true';
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        document.querySelectorAll('.nav-mobile-menu.open').forEach((openMenu) => {
          openMenu.classList.remove('open');
          openMenu.setAttribute('aria-hidden', 'true');
        });
        document.querySelectorAll('.nav-mobile-toggle[aria-expanded=\"true\"]').forEach((openToggle) => {
          openToggle.setAttribute('aria-expanded', 'false');
          const iconHost = openToggle.querySelector('.nav-mobile-toggle-icon');
          if (iconHost) iconHost.innerHTML = icons.menu;
        });
        document.querySelectorAll('.nav-mobile-backdrop').forEach((openBackdrop) => {
          openBackdrop.toggleAttribute('hidden', true);
        });
        document.body.classList.remove('nav-mobile-open');
      }
    });
  }
}
