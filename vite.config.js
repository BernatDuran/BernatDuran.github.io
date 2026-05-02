import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { VitePWA } from 'vite-plugin-pwa';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(rootDir, 'index.html'),
        city: resolve(rootDir, 'city.html'),
        tools: resolve(rootDir, 'tools.html'),
        admin: resolve(rootDir, 'admin.html'),
        planner: resolve(rootDir, 'planner.html'),
      },
    },
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true
      },
      manifest: {
        name: 'Guía Japón 2026',
        short_name: 'Japón 2026',
        description: 'Guía de viaje offline para Tokio, Kioto y Osaka',
        theme_color: '#fafaf7',
        background_color: '#fafaf7',
        display: 'standalone',
        icons: [
          {
            src: 'icon.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml'
          }
        ]
      }
    })
  ]
});
