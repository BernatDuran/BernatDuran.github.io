import { registerSW } from 'virtual:pwa-register';

async function unregisterDevServiceWorkers() {
  if (!('serviceWorker' in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
  return registrations.length;
}

async function clearDevCaches() {
  if (!('caches' in window)) return 0;
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
  return cacheNames.length;
}

export function setupPwa() {
  if (!('serviceWorker' in navigator)) return;

  if (import.meta.env.DEV) {
    const hadController = Boolean(navigator.serviceWorker.controller);
    Promise.all([unregisterDevServiceWorkers(), clearDevCaches()]).then(([registrationCount = 0, cacheCount = 0]) => {
      const reloadKey = 'japan_dev_sw_cleanup_reloaded';
      const cleanedStaleRuntime = hadController || registrationCount > 0 || cacheCount > 0;
      if (cleanedStaleRuntime && sessionStorage.getItem(reloadKey) !== 'true') {
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
