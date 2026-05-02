# BernatDuran.github.io

Web multipagina construida con Vite para organizar un viaje a Japon con vistas por ciudad, herramientas de apoyo y un planificador de itinerario.

## Paginas principales

- `index.html`: portada
- `city.html`: vista de ciudad
- `planner.html`: planificador de itinerario
- `admin.html`: administracion y configuracion
- `tools.html`: utilidades del proyecto

## Desarrollo local

Instalar dependencias:

```bash
npm install
```

Arrancar en local:

```bash
npm run dev
```

Abrir:

- `http://localhost:5173/`
- `http://localhost:5173/planner.html`

## Build

```bash
npm run build
```

La salida se genera en `dist/`.

## Despliegue

Este repositorio esta preparado para desplegarse con GitHub Pages mediante GitHub Actions.

La guia paso a paso esta en:

- [github_deployment_guide.md](./github_deployment_guide.md)
