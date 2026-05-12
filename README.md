# JP Japón 2026

Aplicación web local-first para preparar, organizar y llevar durante el viaje un itinerario por Japón. El proyecto combina guía de actividades, planificación diaria, vista mapa, administración de datos e importación/exportación para mantener el viaje bajo control sin depender de un backend.

La app está pensada actualmente para un viaje concreto a Japón 2026, con tres ciudades principales: Tokio, Kioto y Osaka. Aun así, la estructura ya permite mantener actividades, ciudades, planificación y backups de forma bastante flexible.

## Enlace

Versión publicada en GitHub Pages:

https://bernatduran.github.io/

## Qué permite hacer

- Consultar una portada general del viaje con resumen, fechas, ciudades y accesos principales.
- Explorar actividades por ciudad con filtros por búsqueda, categoría, zona, momento, estado, día, lluvia, prioridad y puntuación.
- Ver tarjetas de actividad con prioridad, zona, duración, puntuación, lluvia, ubicación y estado de planificación.
- Abrir el detalle de cada actividad con descripción, consejos prácticos, comentarios, dirección, mapa y datos útiles.
- Crear y editar actividades desde las páginas de ciudad.
- Gestionar el estado de cada actividad: sin asignar, en bandeja, planificada, realizada o descartada.
- Planificar el viaje desde `/planner` arrastrando actividades entre bandeja y días.
- Usar una vista de calendario y una vista de mapa dentro del planner.
- Ver rutas por día con marcadores numerados, leyenda, actividades omitidas por falta de coordenadas y tramos en línea recta.
- Calcular distancia lineal entre actividades consecutivas y resumen diario de tramos.
- Exportar el itinerario visual en PDF detallado o resumido.
- Importar y exportar actividades mediante Excel/CSV.
- Exportar y restaurar backup JSON general.
- Exportar e importar JSON específico de planificación y estados.
- Ordenar ciudades desde administración para controlar su aparición en home y navegación.
- Cargar datos de ejemplo, limpiar planificador y limpiar actividades desde administración.
- Funcionar como PWA y guardar datos localmente en IndexedDB.

## Páginas principales

- `index.html`: portada general del viaje, ciudades, resumen y accesos.
- `city.html?id=tokyo`: vista de ciudad con actividades, filtros, mapa y edición.
- `city.html?id=kyoto`: vista de Kioto.
- `city.html?id=osaka`: vista de Osaka.
- `planner.html`: planificación diaria, bandeja, calendario, mapa y exportación PDF.
- `admin.html`: configuración, datos, importación/exportación, orden de ciudades y acciones de mantenimiento.
- `tools.html`: página auxiliar para herramientas del proyecto.

## Planner

El planner es el centro operativo del viaje. Permite trabajar con todas las actividades de todas las ciudades y decidir qué se hace cada día.

Funcionalidades destacadas:

- Bandeja de actividades pendientes.
- Columnas por día del viaje.
- Drag and drop para asignar, mover y reordenar actividades.
- Resumen diario con número de actividades y duración aproximada.
- Vista mapa por día o para todo el viaje.
- Marcadores numerados según el orden real de cada día.
- Polilíneas directas entre actividades, sin routing real por calles.
- Distancias lineales por tramo y total del día.
- Avisos si faltan coordenadas.
- Exportación de itinerario a PDF en modo detallado o resumen.

La distancia mostrada en la app es siempre distancia lineal o en línea recta. No representa tiempo andando, transporte público ni ruta real por calles.

## Gestión de actividades

Cada actividad puede contener:

- `id`
- `name`
- `cityId`
- `category`
- `type`
- `priority`
- `zone`
- `description`
- `address`
- `lat`
- `lng`
- `estimatedDuration`
- `bestTime`
- `rainyFriendly`
- `score`
- `requiresTicket`
- `ticketInfo`
- `tips`
- `comment`

Las actividades se crean y editan desde la página de ciudad correspondiente. El planner permite consultar y cambiar estado, pero no crear actividades nuevas.

## Importación y exportación

La administración incluye varios flujos de datos:

- Exportación/importación de actividades en Excel/CSV.
- Backup JSON general de la app.
- Restauración de backup JSON.
- Exportación/importación JSON específica de planificación.
- Validación de actividades existentes al importar planificación.

Los campos de ubicación se manejan de forma separada con `address`, `lat` y `lng`.

## Datos locales

La app usa IndexedDB como almacenamiento principal. Esto significa que:

- Los datos se guardan en el navegador del usuario.
- No hay servidor ni base de datos remota.
- El contenido puede diferir entre navegadores o dispositivos.
- Los backups JSON son importantes para mover o restaurar información.

Desde `/admin` se pueden cargar datos de ejemplo o limpiar datos operativos cuando se quiera reiniciar la demo.

## Stack técnico

- Vite
- JavaScript nativo
- IndexedDB
- Leaflet
- SortableJS
- XLSX
- jsPDF/html2canvas para exportación visual
- vite-plugin-pwa
- Cloudflare Pages Functions para rutas a pie reales en `/api/route`
- GitHub Actions
- GitHub Pages

## Estructura del proyecto

```text
.
├── index.html
├── city.html
├── planner.html
├── admin.html
├── tools.html
├── public/
├── src/
│   ├── admin.js
│   ├── city.js
│   ├── home.js
│   ├── planner.js
│   ├── tools.js
│   ├── data/
│   ├── styles/
│   └── utils/
└── .github/workflows/
```

## Desarrollo local

Instalar dependencias:

```bash
npm install
```

Arrancar servidor local:

```bash
npm run dev
```

Abrir:

```text
http://localhost:5173/
http://localhost:5173/planner.html
http://localhost:5173/admin.html
```

## Build

Generar versión de producción:

```bash
npm run build
```

Previsualizar build:

```bash
npm run preview
```

La salida de producción se genera en `dist/`.

## Rutas a pie reales

La app privada usa una Cloudflare Pages Function en `functions/api/route.js` para calcular rutas a pie con Google Routes API sin exponer la API key en el navegador.

Configuración necesaria en Cloudflare Pages:

- `GOOGLE_ROUTES_API_KEY`: secreto con la API key de Google Routes.
- `DEFAULT_ROUTE_MODE`: `walking`.
- `DEFAULT_LANGUAGE`: `es`.
- `DEFAULT_UNITS`: `METRIC`.

El frontend llama por defecto al endpoint same-origin `/api/route`. Para pruebas avanzadas se puede sobrescribir con `VITE_ROUTES_PROXY_URL`, pero producción debería usar `/api`.

## CI/CD y despliegue

El repositorio usa GitHub Actions:

- `.github/workflows/ci.yml`: validación de build.
- `.github/workflows/deploy.yml`: despliegue a GitHub Pages.

Cada cambio subido a `main` puede generar una nueva versión publicada en:

https://bernatduran.github.io/

## Estado del proyecto

El proyecto está en evolución activa. Ahora mismo funciona como una app personalizada para organizar un viaje a Japón, pero varias piezas ya están pensadas para crecer: modelo de actividades, backups, planificación, exportación PDF, datos demo y administración.

## Licencia

MIT.
