# Fase 2,5 - Consolidar el trabajo antes de actualizar `main`

## Objetivo

Convertir el trabajo actual de desarrollo en una base Git real, estable y verificable antes de tocar `main`.

Ahora mismo el repo tiene una situacion importante:

- `main` y `feature/walking-real-routes` apuntan al mismo commit en Git.
- Las mejoras reales viven sobre todo en cambios locales sin commitear.
- `beta-public` ya esta separada y congelada para GitHub Pages.

Eso significa que **todavia no existe una rama de desarrollo consolidada** que pueda fusionarse con seguridad en `main`.

La mision de esta fase es cerrar ese hueco.

## Resultado esperado

Al terminar esta fase, deberia cumplirse todo esto:

| Elemento | Estado esperado |
|---|---|
| `beta-public` | Sigue congelada e intacta |
| Rama de desarrollo | Contiene commits reales, ordenados y comprensibles |
| Build local | Compila correctamente |
| Riesgos tecnicos | Identificados y contenidos |
| Seguridad | No se publica ninguna clave ni endpoint privado por error |
| `main` | Sigue estable y sin cambios hasta validar la consolidacion |

---

# 2.5.1. Principio rector

No pasar nada a `main` mientras el trabajo actual no exista de forma limpia en Git.

La Fase 3 solo tiene sentido cuando estas tres condiciones se cumplan:

1. Los cambios actuales ya estan guardados en commits reales.
2. El conjunto compila y se puede revisar con criterio.
3. Se sabe exactamente que parte es funcionalidad de producto y que parte es preparacion para seguridad/despliegue.

---

# 2.5.2. Estado actual del proyecto

## Foto realista

Situacion actual del repo:

- `main` no contiene la nueva capa de rutas reales.
- `feature/walking-real-routes` tampoco la contiene en Git como historial consolidado.
- El trabajo avanzado existe en el working tree local.
- Hay archivos nuevos y cambios grandes en planner, city, mapas, estilos, rutas y worker.
- `beta-public` ya esta separada y no debe tocarse durante esta fase.

## Implicacion importante

Hacer ahora un merge directo de `feature/walking-real-routes` sobre `main` seria engañoso, porque en Git puro esa rama no aporta realmente los cambios locales actuales.

Por tanto, esta fase no es opcional. Es la preparacion minima necesaria para que la Fase 3 tenga sentido tecnico.

---

# 2.5.3. Alcance de consolidacion

Esta fase debe consolidar, como minimo, estas areas:

- Mejoras de UX/UI en `/city` y comportamiento mapa/actividades.
- Mejoras del planner.
- Soporte de rutas walking reales.
- Modal de mapa diario y validacion de rutas.
- Cambios de estilos asociados.
- Utilidades nuevas en `src/utils/routes/`.
- Worker actual de rutas.
- Documentacion necesaria para entender la pieza.

Esta fase **no** deberia hacer todavia:

- Despliegue privado definitivo con Cloudflare Access.
- Cierre completo de seguridad de produccion.
- Publicacion de secretos o configuraciones reales.
- Refactors grandes no relacionados.

---

# 2.5.4. Estrategia recomendada

## Idea central

En lugar de mezclar consolidacion, limpieza, merge y despliegue a la vez, se debe trabajar por capas:

1. Proteger el trabajo actual.
2. Convertirlo en commits claros.
3. Validarlo.
4. Revisar riesgos.
5. Solo entonces preparar la actualizacion de `main`.

## Criterio de buenas practicas

- No usar `git reset --hard`.
- No usar `git stash` como solucion principal si el trabajo es importante.
- No mezclar en un mismo commit cambios de producto, estilos, worker, docs y seguridad si se pueden separar.
- No empujar a `main` hasta tener un build verde y una lectura clara del diff.

---

# 2.5.5. Bloque 1 - Proteger el estado actual

## Objetivo

Evitar perder el trabajo actual antes de empezar a ordenarlo.

## Pasos

### 1. Confirmar rama actual y cambios pendientes

Ejecutar:

```bash
git branch --all
git status
```

Validar:

- Que estas trabajando sobre `feature/walking-real-routes` o una rama equivalente.
- Que se ve claramente la lista de archivos modificados y nuevos.

### 2. Crear una rama de consolidacion desde el estado actual

Recomendacion:

```bash
git checkout -b feature/walking-real-routes-consolidated
```

Objetivo:

- No seguir consolidando directamente sobre una rama ambigua.
- Crear una rama con intencion clara para ordenar el trabajo real.

### 3. Crear una copia de seguridad adicional si se quiere maxima tranquilidad

Opciones recomendadas:

```bash
git branch backup/pre-consolidation-local
```

o bien una worktree aparte.

Objetivo:

- Tener una red de seguridad antes de tocar staging, commits o reorganizacion.

## Criterio de salida

- El trabajo actual esta protegido por una rama de consolidacion.
- Existe una referencia adicional de backup si se desea.

---

# 2.5.6. Bloque 2 - Auditar y clasificar los cambios

## Objetivo

Entender exactamente que hay antes de commitear.

## Pasos

### 1. Obtener una vista completa del diff

Ejecutar:

```bash
git diff --stat
git diff --name-status
```

### 2. Clasificar los cambios por categorias

Separar mentalmente o en una nota temporal:

- Producto UX/UI.
- Planner y logica de negocio.
- Rutas reales walking.
- Infraestructura `worker/`.
- Dependencias `package.json` y `package-lock.json`.
- Documentacion.

### 3. Identificar piezas sensibles

Revisar especificamente:

- `.env.local`
- referencias a `VITE_ROUTES_PROXY_URL`
- referencias a `GOOGLE_ROUTES_API_KEY`
- configuraciones de `worker/`
- cualquier URL privada, secreto o token

### 4. Detectar cambios que no deberian entrar todavia

Ejemplos:

- experimentos a medio hacer;
- logs de debug;
- ajustes visuales temporales;
- ideas de seguridad no terminadas;
- artefactos locales.

## Criterio de salida

- Sabes que entra en consolidacion y que se pospone.
- El alcance queda acotado antes de empezar a commitear.

---

# 2.5.7. Bloque 3 - Separar funcionalidad de infraestructura

## Objetivo

No mezclar valor de producto con despliegue o seguridad a medio cocinar.

## Recomendacion

Separar los cambios en dos grupos:

### Grupo A - Funcionalidad visible de la app

Incluye:

- planner mejorado;
- walking routes;
- modal de mapa diario;
- validacion de rutas;
- mejoras de scroll y vistas;
- ajustes de botones, layout y UX;
- mejoras de PDF y formato.

### Grupo B - Infraestructura y preparacion de backend

Incluye:

- `worker/`;
- nueva configuracion de entorno;
- documentacion de seguridad;
- piezas ligadas a Cloudflare o proxy de rutas.

## Opinion practica

Si el Worker actual todavia no representa la arquitectura final recomendada para produccion privada, conviene consolidarlo igualmente, pero dejando claro que es una pieza transitoria y no la solucion final de seguridad.

## Criterio de salida

- Puedes revisar el trabajo en bloques con sentido.
- Si algo falla, sera mas facil localizar si el problema es de producto o de infraestructura.

---

# 2.5.8. Bloque 4 - Crear commits limpios

## Objetivo

Transformar el trabajo local en historial Git legible.

## Estrategia de commits recomendada

No hace falta hacer muchos commits pequeños si eso complica la vida, pero si conviene evitar un unico commit gigante y opaco.

Secuencia sugerida:

### Commit 1 - UX y comportamiento en `/city`

Contenido esperado:

- cambios de scroll;
- separacion actividades/mapa;
- ajuste de toggle;
- centrado de mapa;
- comportamiento de filtros.

### Commit 2 - Mejoras del planner y walking routes

Contenido esperado:

- validacion de ruta;
- calculo de walking;
- modal de mapa diario;
- mejoras de botones;
- expandir/contraer;
- mensajes y estados del planner;
- formato de distancias.

### Commit 3 - Infraestructura de rutas

Contenido esperado:

- `src/utils/routes/`;
- `worker/`;
- dependencia nueva de polyline;
- ajustes tecnicos asociados.

### Commit 4 - Documentacion y limpieza

Contenido esperado:

- docs nuevas;
- ajustes de README si aplica;
- `.gitignore` si procede;
- notas para siguiente fase.

## Importante

No fuerces esta estructura si el codigo ya esta fuertemente entrelazado. En ese caso, prioriza:

- un commit funcional coherente;
- un commit de infraestructura;
- un commit de documentacion.

## Criterio de salida

- El historial ya cuenta una historia legible.
- Otra persona puede revisar que se cambio y por que.

---

# 2.5.9. Bloque 5 - Validacion tecnica minima

## Objetivo

No consolidar una rama que aun no se sostiene.

## Pasos

### 1. Instalar dependencias si hace falta

```bash
npm install
```

### 2. Ejecutar build

```bash
npm run build
```

### 3. Validar manualmente los flujos principales

Como minimo:

- home carga;
- `/city` funciona;
- planner carga;
- mapa diario abre;
- rutas walking no rompen el frontend;
- PDF sigue funcionando;
- no aparecen errores obvios en consola;
- si falta configuracion de rutas, la app degrada con dignidad.

### 4. Revisar que la beta publica no se toca

Confirmar:

- `beta-public` sigue aislada;
- `main` no ha cambiado;
- nada del proceso de consolidacion afecta a GitHub Pages.

## Criterio de salida

- La rama consolidada compila.
- El flujo principal de la app no esta roto.

---

# 2.5.10. Bloque 6 - Revision de seguridad y publicabilidad

## Objetivo

Asegurar que consolidar el trabajo no equivale a exponer riesgo.

## Revisiones obligatorias

### 1. Secretos

Comprobar que no se commitea:

- `.env.local`
- claves de Google
- tokens
- valores reales de Cloudflare

### 2. Frontera cliente-servidor

Confirmar que:

- la API key no esta en el frontend;
- el frontend no embebe secretos;
- el worker no contiene claves hardcodeadas.

### 3. Estado del Worker

Preguntas que deben quedar respondidas:

- ¿Es util para desarrollo y pruebas actuales?
- ¿Es transitorio hasta moverlo a Pages Functions same-origin?
- ¿Se documenta claramente esa situacion?

### 4. Riesgo de consumo API

Documentar si la rama consolidada:

- usa cache local;
- puede recalcular rutas;
- necesita confirmacion antes de repetir llamadas;
- todavia no esta protegida para produccion abierta.

## Criterio de salida

- La rama consolidada puede subirse sin exponer secretos.
- Sigue quedando claro que falta la capa de seguridad de produccion.

---

# 2.5.11. Bloque 7 - Documentacion minima obligatoria

## Objetivo

No dejar una rama tecnicamente funcional pero dificil de entender.

## Documentos recomendados

### 1. Nota breve de consolidacion

Explicar:

- que se ha consolidado;
- que queda pendiente;
- que no debe fusionarse aun a `main` sin revisar seguridad.

### 2. Nota de arquitectura temporal

Explicar:

- como funciona el flujo actual de rutas;
- que papel tiene el Worker;
- que la arquitectura recomendada final sigue siendo Cloudflare Pages + Access + endpoint protegido.

### 3. Estado para la siguiente fase

Dejar claro:

- si la rama esta lista para Fase 3;
- o si antes necesita una mini-fase extra de limpieza.

## Criterio de salida

- La fase siguiente no empieza a ciegas.

---

# 2.5.12. Bloque 8 - Decision de readiness para Fase 3

## Objetivo

Tomar una decision consciente, no automatica.

## Preguntas de control

Responder si/no:

- ¿Los cambios actuales ya estan todos protegidos en commits?
- ¿La rama consolidada compila?
- ¿Los flujos principales se pueden probar sin rotura obvia?
- ¿No hay secretos commiteados?
- ¿El diff total se entiende?
- ¿Sabemos que parte es producto y que parte es infraestructura?
- ¿Tenemos claro que faltara hacer en Cloudflare y seguridad?

## Regla de decision

### Si la mayoria es "si"

La rama queda preparada para ejecutar la Fase 3.

### Si hay varios "no"

No se pasa a `main` todavia.

Primero se hace una micro-ronda de correccion.

---

# 2.5.13. Flujo recomendado realista

Secuencia recomendada completa:

```bash
git status
git checkout -b feature/walking-real-routes-consolidated
git diff --stat
git add <bloque-1>
git commit -m "Refine city map toggle and scroll behavior"
git add <bloque-2>
git commit -m "Enhance planner with walking route workflow"
git add <bloque-3>
git commit -m "Add walking routes infrastructure worker"
npm run build
git status
```

Si todo esta correcto:

```bash
git push -u origin feature/walking-real-routes-consolidated
```

Despues:

- revisar la rama consolidada;
- decidir si se hace merge a `main`;
- preparar la Fase 3 de verdad.

---

# 2.5.14. Lo que no recomiendo

- Hacer `git merge feature/walking-real-routes` en `main` mientras los cambios siguen solo en local.
- Usar `git stash` como estrategia principal de conservacion.
- Subir un commit gigante sin saber exactamente que contiene.
- Mezclar consolidacion y despliegue privado en el mismo movimiento.
- Dar por hecho que Cloudflare Pages ya esta listo solo porque `main` tenga mas codigo.

---

# 2.5.15. Checklist final

| Validacion | Estado |
|---|---|
| Existe rama de consolidacion real | Pendiente / OK |
| El trabajo local esta protegido | Pendiente / OK |
| Los cambios estan clasificados | Pendiente / OK |
| Hay commits legibles | Pendiente / OK |
| `npm run build` funciona | Pendiente / OK |
| No hay secretos commiteados | Pendiente / OK |
| Se entiende el papel del Worker actual | Pendiente / OK |
| `beta-public` sigue intacta | Pendiente / OK |
| `main` sigue sin tocar hasta validar | Pendiente / OK |
| La rama esta lista para decidir Fase 3 | Pendiente / OK |

---

# Decision final

La Fase 2,5 no es un tramite, sino la fase que convierte trabajo local fragil en una base de producto real.

Si se hace bien:

- reduces riesgo tecnico;
- facilitas el merge a `main`;
- mejoras la revisabilidad;
- evitas publicar cosas a medias;
- dejas la seguridad y Cloudflare para el momento correcto.

Si se salta:

- la Fase 3 se vuelve confusa;
- el merge a `main` pierde fiabilidad;
- y el despliegue privado puede arrancar sobre una base mal consolidada.
