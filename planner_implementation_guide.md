# Guía Técnica de Implementación: Planificador Global (`planner.html`)

## Contexto Actual
Hasta ahora hemos logrado estabilizar y pulir la **Fase de Exploración y Selección**:
1.  **UI/UX en tarjetas:** Refinamiento visual de los estados de la actividad ("En bandeja", "Día X", "Realizada", "Descartada") usando un componente *Chip* unificado, responsivo y de tamaño fijo.
2.  **Manejo de Eventos:** Se refactorizó la arquitectura a un modelo de delegación de eventos globales para solucionar conflictos de *z-index*, superposiciones con filtros *sticky* y alineaciones de menús desplegables.
3.  **Indicadores Visuales y Filtros:** Implementación del sistema de "Aptitud para Lluvia" (icono de paraguas interactivo) sincronizado de forma bidireccional con el filtro global de la interfaz y la base de datos `IndexedDB`.

El objetivo central ahora es capitalizar esta base de datos local sólida, creando la **vista maestra del itinerario** donde todas estas selecciones cobran vida táctica.

---

## 🚀 Próximos Pasos (Roadmap Funcional y Técnico)

### Fase 1: Arquitectura de Datos y Estado (`planner.js`)
~~El primer paso es inicializar la página del planificador leyendo, cruzando y formateando las entidades almacenadas en IndexedDB.~~
*   ~~**Recolección:** Obtener los datos cruzados de `places` (toda la información del punto de interés), `planner` (estado de selección y día asignado por el usuario) y `settings` (duración total y fechas del viaje configuradas en administración).~~
*   ~~**Transformación de Estructura:** Construir un gestor de estado (State Manager) que agrupe las actividades de forma eficiente para su renderizado:~~

### Fase 2: Interfaz Visual (Layout y Grilla)
~~Diseñar la pantalla base donde el usuario orquestará su viaje completo.~~
*   ~~**Columna Central (Días):** Una lista vertical secuencial con "tarjetas contenedoras" (Día 1, Día 2, Día 3...) generadas dinámicamente según la cantidad de días configurados en el sistema.~~
*   ~~**Sidebar de Bandeja de Entrada:** Un panel lateral dedicado exclusivamente a mostrar las actividades guardadas "En bandeja" esperando ser ubicadas.~~
*   ~~**Micro-tarjetas (Mini-Cards):** Rediseñar el componente de lugar para esta vista. Las actividades dentro del planificador deben ser compactas y modulares mostrando exclusivamente: Nombre, Icono de Categoría, Zona, y la Duración Estimada.~~

### Fase 3: Motor Drag & Drop (Interactividad Principal) ✅
~~La asignación y reasignación de días debe ser visual, fluida y táctil.~~
*   ~~**Tecnología:** Implementar una librería ligera y robusta de arrastrar y soltar (*Sortable.js*).~~
*   ~~**Mecánica Base:** Permitir arrastrar una actividad de la "Bandeja" a un bloque de "Día", o mover actividades entre días diferentes.~~
*   ~~**Mecánica de Ordenación:** Permitir cambiar el orden secuencial de las actividades dentro de un mismo bloque de día. El atributo `order` (entero) se inyecta en cada objeto del store `planner` en IndexedDB.~~
*   ~~**Persistencia Inmediata:** Al interceptar el evento *drop*, se recalculan los índices y se lanza `putAll()` a IndexedDB sin recargar el navegador.~~

**Detalles de implementación Phase 3:**

- **Librería:** Sortable.js v1.15.7, importada en `src/planner.js` línea 8: `import Sortable from 'sortablejs'`
- **Contenedores Sortable:** Bandeja (`.planner-tray-cards`) + cada día (`.planner-day-block[data-day="X"] .planner-day-cards`) usan `group: { name: 'planner-shared', pull: true, put: true }` para permitir movimiento bidireccional entre cualquier contenedor
- **`pull: true`** (no `clone`): la tarjeta se mueve físicamente entre contenedores, no se clona. Esto es crítico para que la reordenación funcione correctamente.
- **`put: true`**: todos los contenedores aceptan items de cualquier otro contenedor del mismo grupo
- **`filter: '.planner-chip-trigger, .planner-card-discarded'`**: impide arrastrar tarjetas descartadas y permite hacer click en el chip de estado sin iniciar drag
- **Atributo `data-id`** en cada `.planner-mini-card` para identificar el `placeId` del elemento arrastrado
- **`handleDropEnd`**: al soltar, detecta zona origen/destino, actualiza `item.status` (`in-tray` / `planned`) y `item.assignedDay`, recalcula `order` de todos los items visibles en DOM, y hace `putAll('planner', allUpdates)` con el estado completo de todos los items (no solo los del contenedor destino)
- **`buildGroupedData()`**: ahora incluye `.sort(sortByOrder)` para cada grupo (bandeja, días, unassigned), ordenando por `item.order ?? 999`
- **CSS para drag visual:** `.planning-ghost`, `.planning-chosen`, `.planning-drag` definidos en `src/styles/pages.css`
- **`initSortable()`**: llamada al final de `renderPlannerPage()` tras cada re-renderizado. Destruye instancias previas antes de crear nuevas para evitar fugas de memoria

### Fase 4: Mapa Táctico de Rutas por Día
Funcionalidad de altísimo valor para certificar que el día planificado tiene sentido geográfico.
*   **Integración UI:** Añadir un botón flotante o toggle superior para cambiar entre "Vista Calendario/Bandeja" y "Vista Mapa".
*   **Filtro Dinámico:** En la vista de mapa, un selector horizontal para escoger qué "Día" visualizar (ej. Día 3). El mapa renderizará exclusivamente las ubicaciones (`lat`, `lng`) asignadas a ese día.
*   **Conexiones Geográficas:** Se trazarán líneas (Polylines de Leaflet) entre los puntos de interés para visualizar la ruta del día según el orden establecido en la Fase 3, ayudando a identificar ineficiencias en transporte.

### Fase 5: Estabilización de Estados Cruzados
*   ~~**Consistencia Global:** Asegurar que si el usuario reasigna masivamente actividades en el `planner.html` y luego vuelve a navegar a `city.html`, todos los chips de estado de las tarjetas reflejen instantáneamente los últimos cambios.~~
*   **Feedback de Sistema:** Implementar notificaciones tipo *Toast* ("Actividad movida al Día 2", "Ruta actualizada") para reafirmar al usuario el éxito de sus operaciones en la interfaz de arrastrar y soltar.