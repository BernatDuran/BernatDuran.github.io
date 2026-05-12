# Fase 3 — Actualizar `main` con la rama de desarrollo y continuar la app real

## Objetivo

Llevar las mejoras desarrolladas en la rama de trabajo a `main`, de forma que Cloudflare Pages pueda desplegar la nueva app real en:

```txt
https://bernatduran-github-io.pages.dev
```

GitHub Pages no se verá afectado porque ya debe estar publicando desde `beta-public`.

---

# Resultado esperado

| Elemento | Estado esperado |
|---|---|
| Rama `beta-public` | Mantiene la beta pública congelada |
| Rama `main` | Recibe la versión nueva de la app |
| Cloudflare Pages | Despliega desde `main` |
| GitHub Pages | No cambia, porque apunta a `beta-public` |

---

# 3.1. Comprobar el estado actual del repositorio

Entrar en el proyecto:

```bash
cd ruta/del/proyecto/BernatDuran.github.io
```

Ver ramas locales y remotas:

```bash
git branch -a
```

Ver estado actual:

```bash
git status
```

Si hay cambios sin commitear, antes de continuar hay que decidir si se guardan o se descartan.

## Si quieres guardar los cambios actuales

```bash
git add .
git commit -m "Save current work before merging into main"
```

## Si quieres apartarlos temporalmente

```bash
git stash
```

---

# 3.2. Identificar la rama de desarrollo

Según la conversación, la rama candidata es:

```txt
feature/walking-real-routes
```

Comprobar que existe:

```bash
git branch -a | grep walking
```

Si la rama existe en remoto pero no en local:

```bash
git fetch origin
```

Crear la rama local desde remoto si hace falta:

```bash
git checkout -b feature/walking-real-routes origin/feature/walking-real-routes
```

---

# 3.3. Probar la rama de desarrollo antes de fusionar

Cambiar a la rama de desarrollo:

```bash
git checkout feature/walking-real-routes
```

Actualizarla:

```bash
git pull origin feature/walking-real-routes
```

Instalar dependencias:

```bash
npm install
```

Compilar:

```bash
npm run build
```

Si el build falla, no fusionar todavía. Primero hay que corregir el error en la rama de desarrollo.

---

# 3.4. Fusionar la rama de desarrollo en `main`

Cambiar a `main`:

```bash
git checkout main
```

Actualizar `main`:

```bash
git pull origin main
```

Fusionar la rama de desarrollo:

```bash
git merge feature/walking-real-routes
```

---

# 3.5. Resolver conflictos si aparecen

Si Git muestra conflictos, ver los archivos afectados:

```bash
git status
```

Abrir los archivos con conflicto y resolver manualmente las zonas marcadas:

```txt
<<<<<<< HEAD
Código actual de main
=======
Código de feature/walking-real-routes
>>>>>>> feature/walking-real-routes
```

Después de resolver:

```bash
git add .
git commit
```

Si el merge no genera conflictos, Git puede crear el commit automáticamente o dejarlo listo según el caso.

---

# 3.6. Validar que `main` compila correctamente

Ejecutar:

```bash
npm install
npm run build
```

Opcionalmente, levantar entorno local:

```bash
npm run dev
```

Validar manualmente:

- La app carga.
- No hay errores visibles en consola.
- Las rutas principales funcionan.
- La integración prevista para Cloudflare no rompe el frontend.
- No se han subido claves al frontend.

---

# 3.7. Subir `main` actualizado a GitHub

```bash
git push origin main
```

A partir de este momento, Cloudflare Pages debería detectar el cambio y lanzar un nuevo despliegue de producción si está configurado para seguir `main`.

---

# 3.8. Validar despliegue en Cloudflare Pages

Entrar en Cloudflare:

```txt
Cloudflare Dashboard → Workers & Pages → bernatduran-github-io → Deployments
```

Comprobar:

| Validación | Estado |
|---|---|
| Se ha creado un nuevo deployment | Pendiente / OK |
| El deployment ha terminado correctamente | Pendiente / OK |
| La URL `pages.dev` carga | Pendiente / OK |
| La app muestra la versión nueva | Pendiente / OK |
| GitHub Pages sigue mostrando la beta | Pendiente / OK |

URL final:

```txt
https://bernatduran-github-io.pages.dev
```

---

# 3.9. Recomendación de ramas a partir de ahora

Estructura recomendada:

```txt
main
 └─ versión real / producción privada / Cloudflare Pages

beta-public
 └─ demo pública congelada / GitHub Pages

feature/*
 └─ nuevas funcionalidades
```

Flujo recomendado:

```bash
git checkout main
git pull origin main
git checkout -b feature/nueva-funcionalidad
```

Trabajar en la feature:

```bash
git add .
git commit -m "Add nueva funcionalidad"
git push -u origin feature/nueva-funcionalidad
```

Cuando esté validada:

```bash
git checkout main
git pull origin main
git merge feature/nueva-funcionalidad
npm run build
git push origin main
```

---

# Checklist final de Fase 3

| Validación | Estado |
|---|---|
| Rama de desarrollo identificada | Pendiente / OK |
| Rama de desarrollo compila | Pendiente / OK |
| `main` actualizado | Pendiente / OK |
| Merge realizado | Pendiente / OK |
| Conflictos resueltos, si existían | Pendiente / OK |
| `npm run build` correcto en `main` | Pendiente / OK |
| Push a `origin/main` realizado | Pendiente / OK |
| Cloudflare Pages despliega desde `main` | Pendiente / OK |
| GitHub Pages sigue intacto desde `beta-public` | Pendiente / OK |

## Decisión final

La rama `main` pasa a ser la base de la app real privada. La beta pública queda aislada en `beta-public` y no bloquea la evolución del producto.

## Actualizacion aplicada

La rama consolidada ya se ha fusionado en `main` mediante fast-forward.

Ademas, la integracion de rutas reales se ha movido al endpoint same-origin de Cloudflare Pages:

```txt
/api/route
```

Esto sustituye al Worker separado como arquitectura recomendada. La API key de Google debe configurarse como secreto de Cloudflare Pages (`GOOGLE_ROUTES_API_KEY`) y la app privada debe protegerse con Cloudflare Access.
