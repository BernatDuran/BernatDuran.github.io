import { registerSW } from 'virtual:pwa-register';

async function unregisterDevServiceWorkers() {
  if (!('serviceWorker' in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
}

export function setupPwa() {
  if (!('serviceWorker' in navigator)) return;

  if (import.meta.env.DEV) {
    const hadController = Boolean(navigator.serviceWorker.controller);
    unregisterDevServiceWorkers().then(() => {
      const reloadKey = 'japan_dev_sw_cleanup_reloaded';
      if (hadController && sessionStorage.getItem(reloadKey) !== 'true') {
        sessionStorage.setItem(reloadKey, 'true');
        window.location.reload();
      }
    }).catch((error) => {
      console.warn('No se pudo limpiar el service worker de desarrollo.', error);
    });
    return;
  }

  registerSW({ immediate: true });
}
