# BernatDuran.github.io

Aplicacion web multipagina construida con Vite para preparar y gestionar un viaje a Japon. La app combina una portada informativa, vistas por ciudad, un panel de administracion y un planificador de itinerario con vista calendario y mapa.

## Funcionalidades actuales

- Guia de viaje multipagina para Tokio, Kioto y Osaka
- Portada con resumen del viaje, cuenta atras y acceso a las ciudades
- Vistas por ciudad con filtros, tarjetas de actividades, mapa interactivo y modal de detalle
- Estado de planificacion por actividad: sin asignar, en bandeja, planificada, realizada o descartada
- Planificador global con drag and drop entre bandeja y dias
- Vista mapa del planner con alcance `Todos` o `Dia N`, marcadores y rutas por dia
- Panel de administracion para configurar fechas del viaje y activar el planner
- Importacion y exportacion de datos y backups desde administracion
- Persistencia local en `IndexedDB`
- PWA con service worker para uso tipo app

## Paginas principales

- `index.html`: portada y resumen general del viaje
- `city.html`: experiencia por ciudad con filtros, mapa y detalle de lugares
- `planner.html`: planificador de itinerario con vista calendario y mapa
- `admin.html`: administracion, configuracion global, backups e importacion/exportacion
- `tools.html`: pagina reservada para herramientas futuras

## Stack tecnico

- `Vite`
- `Vanilla JavaScript`
- `Leaflet` para mapas
- `SortableJS` para drag and drop en el planner
- `IndexedDB` como almacenamiento local
- `vite-plugin-pwa` para capacidades PWA

## Estructura del proyecto

```text
src/
  admin.js
  city.js
  home.js
  planner.js
  tools.js
  data/
  styles/
  utils/
public/
.github/workflows/
index.html
city.html
planner.html
admin.html
tools.html
```

## Desarrollo local

Instalar dependencias:

```bash
npm install
```

Arrancar el servidor local:

```bash
npm run dev
```

Abrir en navegador:

- `http://localhost:5173/`
- `http://localhost:5173/planner.html`
- `http://localhost:5173/admin.html`

## Build de produccion

```bash
npm run build
```

La salida se genera en `dist/`.

## Datos y administracion

La aplicacion carga y guarda informacion en `IndexedDB`. Desde `admin.html` se puede:

- definir fechas globales del viaje
- activar o desactivar el planner
- importar lugares desde Excel o CSV
- exportar lugares
- crear y restaurar backups JSON

## Despliegue

El repositorio esta preparado para desplegarse en GitHub Pages mediante GitHub Actions.

Workflow principal:

- `.github/workflows/deploy.yml`

Guia paso a paso de GitHub y despliegue:

- [github_deployment_guide.md](./github_deployment_guide.md)

## Estado actual del producto

Hoy la app esta orientada a un caso de uso muy concreto: organizar un viaje a Japon 2026 con contenido editorial, gestion de lugares y planificacion diaria. No es una plantilla generica todavia, sino una aplicacion personalizada sobre ese viaje.
