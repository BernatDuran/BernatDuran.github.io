# Guía técnica de desarrollo de la APP

## 1. Propósito de este documento

Este documento describe la aplicación desde un punto de vista técnico de desarrollo. Su objetivo es que cualquier persona que entre al proyecto pueda entender con rapidez:

- qué tipo de arquitectura utiliza la aplicación
- cómo se organiza el código
- cómo fluye la información entre pantallas
- dónde viven los datos persistentes
- cómo se implementan las funcionalidades principales
- qué decisiones estructurales conviene respetar al ampliar la app
- qué zonas son más sensibles y requieren especial cuidado

No es un manual de usuario final. Es una guía para desarrollar, mantener, ampliar y depurar la aplicación con criterio.

---

## 2. Visión técnica general

La aplicación es una web multipágina construida con JavaScript nativo sobre Vite, sin framework SPA como React o Vue. Se apoya en una arquitectura sencilla pero bastante modular, basada en:

- páginas independientes (`index.html`, `city.html`, `planner.html`, `admin.html`, `tools.html`)
- puntos de entrada JavaScript separados por pantalla
- utilidades compartidas en `src/utils`
- datos semilla en `src/data`
- persistencia local en `IndexedDB`
- soporte PWA mediante `vite-plugin-pwa`
- mapas con Leaflet
- drag and drop con SortableJS
- importación/exportación de actividades mediante JSON y Excel/CSV usando `xlsx`

La filosofía general del proyecto es clara:

1. La aplicación debe poder funcionar en local y en estático.
2. No depende de backend remoto.
3. El navegador del usuario es la fuente de verdad de los datos persistidos durante el uso.
4. Los datos semilla solo sirven como arranque inicial o como referencia para migraciones.
5. La lógica está repartida por pantalla, pero las reglas de normalización y persistencia importantes están centralizadas en utilidades.

---

## 3. Stack tecnológico

## 3.1 Base de ejecución

- JavaScript ES Modules
- HTML multipágina
- CSS propio
- Vite como bundler y entorno de desarrollo

## 3.2 Persistencia y datos

- `IndexedDB` como almacenamiento principal del lado cliente
- `localStorage` solo para arrastre de compatibilidad histórica muy concreta

## 3.3 Librerías principales

- `sortablejs`: reordenación drag and drop, sobre todo en planner y orden de ciudades en admin
- `xlsx`: importación/exportación de actividades en Excel/CSV
- `vite-plugin-pwa`: capacidad PWA y registro de service worker
- Leaflet: representación de mapas

## 3.4 Build y dev server

El proyecto usa scripts simples definidos en [package.json](/C:/Users/bernat.duran/Documents/Bernat/17.%20IA/11.%20Projects%20IA/Web_Japó/V0/package.json):

- `npm run dev`
- `npm run build`
- `npm run preview`

El servidor de desarrollo trabaja sobre `http://localhost:5173`.

---

## 4. Estructura del proyecto

## 4.1 Páginas HTML raíz

En la raíz existen varias páginas independientes:

- [index.html](/C:/Users/bernat.duran/Documents/Bernat/17.%20IA/11.%20Projects%20IA/Web_Japó/V0/index.html): portada/home
- [city.html](/C:/Users/bernat.duran/Documents/Bernat/17.%20IA/11.%20Projects%20IA/Web_Japó/V0/city.html): vista de una ciudad concreta
- [planner.html](/C:/Users/bernat.duran/Documents/Bernat/17.%20IA/11.%20Projects%20IA/Web_Japó/V0/planner.html): planificador general
- [admin.html](/C:/Users/bernat.duran/Documents/Bernat/17.%20IA/11.%20Projects%20IA/Web_Japó/V0/admin.html): administración y mantenimiento de datos
- [tools.html](/C:/Users/bernat.duran/Documents/Bernat/17.%20IA/11.%20Projects%20IA/Web_Japó/V0/tools.html): utilidades complementarias

## 4.2 Puntos de entrada JavaScript

Cada pantalla tiene su propio módulo principal en `src`:

- [src/home.js](/C:/Users/bernat.duran/Documents/Bernat/17.%20IA/11.%20Projects%20IA/Web_Japó/V0/src/home.js)
- [src/city.js](/C:/Users/bernat.duran/Documents/Bernat/17.%20IA/11.%20Projects%20IA/Web_Japó/V0/src/city.js)
- [src/planner.js](/C:/Users/bernat.duran/Documents/Bernat/17.%20IA/11.%20Projects%20IA/Web_Japó/V0/src/planner.js)
- [src/admin.js](/C:/Users/bernat.duran/Documents/Bernat/17.%20IA/11.%20Projects%20IA/Web_Japó/V0/src/admin.js)
- [src/tools.js](/C:/Users/bernat.duran/Documents/Bernat/17.%20IA/11.%20Projects%20IA/Web_Japó/V0/src/tools.js)

Además existen `src/tokyo.js`, `src/kyoto.js` y `src/osaka.js`, pero la fuente funcional consolidada actual para datos y lógica se apoya sobre todo en `city.html?id=...` y el acceso a `IndexedDB`.

## 4.3 Utilidades compartidas

La carpeta `src/utils` concentra la parte más importante de la lógica transversal:

- [src/utils/db.js](/C:/Users/bernat.duran/Documents/Bernat/17.%20IA/11.%20Projects%20IA/Web_Japó/V0/src/utils/db.js): capa mínima de acceso a IndexedDB
- [src/utils/dataMigration.js](/C:/Users/bernat.duran/Documents/Bernat/17.%20IA/11.%20Projects%20IA/Web_Japó/V0/src/utils/dataMigration.js): migraciones y normalización inicial/continuada
- [src/utils/placeData.js](/C:/Users/bernat.duran/Documents/Bernat/17.%20IA/11.%20Projects%20IA/Web_Japó/V0/src/utils/placeData.js): normalización de actividades y conversión para import/export
- [src/utils/cityData.js](/C:/Users/bernat.duran/Documents/Bernat/17.%20IA/11.%20Projects%20IA/Web_Japó/V0/src/utils/cityData.js): normalización y ordenación de ciudades
- [src/utils/filters.js](/C:/Users/bernat.duran/Documents/Bernat/17.%20IA/11.%20Projects%20IA/Web_Japó/V0/src/utils/filters.js): lógica de filtrado
- [src/utils/helpers.js](/C:/Users/bernat.duran/Documents/Bernat/17.%20IA/11.%20Projects%20IA/Web_Japó/V0/src/utils/helpers.js): iconos, helpers visuales y formateos compartidos
- [src/utils/maps.js](/C:/Users/bernat.duran/Documents/Bernat/17.%20IA/11.%20Projects%20IA/Web_Japó/V0/src/utils/maps.js): funciones auxiliares de mapas
- [src/utils/nav.js](/C:/Users/bernat.duran/Documents/Bernat/17.%20IA/11.%20Projects%20IA/Web_Japó/V0/src/utils/nav.js): navegación móvil compartida

## 4.4 Datos semilla

Los datos iniciales viven en:

- [src/data/cities.js](/C:/Users/bernat.duran/Documents/Bernat/17.%20IA/11.%20Projects%20IA/Web_Japó/V0/src/data/cities.js)
- [src/data/tokyo.js](/C:/Users/bernat.duran/Documents/Bernat/17.%20IA/11.%20Projects%20IA/Web_Japó/V0/src/data/tokyo.js)
- [src/data/kyoto.js](/C:/Users/bernat.duran/Documents/Bernat/17.%20IA/11.%20Projects%20IA/Web_Japó/V0/src/data/kyoto.js)
- [src/data/osaka.js](/C:/Users/bernat.duran/Documents/Bernat/17.%20IA/11.%20Projects%20IA/Web_Japó/V0/src/data/osaka.js)

Estos archivos no deben entenderse como una base de datos viva una vez la app está en uso. Son el punto de partida que se migra a `IndexedDB`.

## 4.5 Estilos

La app reparte estilos en tres archivos principales:

- [src/styles/main.css](/C:/Users/bernat.duran/Documents/Bernat/17.%20IA/11.%20Projects%20IA/Web_Japó/V0/src/styles/main.css)
- [src/styles/components.css](/C:/Users/bernat.duran/Documents/Bernat/17.%20IA/11.%20Projects%20IA/Web_Japó/V0/src/styles/components.css)
- [src/styles/pages.css](/C:/Users/bernat.duran/Documents/Bernat/17.%20IA/11.%20Projects%20IA/Web_Japó/V0/src/styles/pages.css)

La mayor parte de componentes compartidos, filtros, tarjetas, modales y navegación vive en `components.css`.

---

## 5. Modelo de arquitectura

La aplicación sigue un modelo de arquitectura pragmático, no formalizado como MVC estricto, pero sí con una separación razonable entre:

- render de interfaz por pantalla
- persistencia de datos
- normalización de datos
- utilidades compartidas
- datos semilla

La forma mental correcta de entender el proyecto es esta:

1. Cada pantalla tiene un módulo principal que actúa como coordinador.
2. Ese módulo carga datos desde `IndexedDB`.
3. Antes de trabajar con ellos, la aplicación migra o normaliza si hace falta.
4. La pantalla construye su estado local en memoria.
5. La interfaz se renderiza en bloque o por secciones.
6. Los eventos del usuario actualizan el estado persistido y se re-renderiza la vista.

No hay framework reactivo. La reactividad se consigue con:

- estado en variables del módulo
- funciones de render
- listeners delegados o registrados tras render
- persistencia explícita con `put` o `putAll`

Esto hace la app bastante accesible para mantenimiento, pero obliga a ser disciplinado con el ciclo `leer -> normalizar -> persistir -> renderizar -> reenganchar eventos`.

---

## 6. Persistencia de datos

## 6.1 Fuente de verdad

La fuente de verdad del uso real de la app es `IndexedDB`, gestionada desde [src/utils/db.js](/C:/Users/bernat.duran/Documents/Bernat/17.%20IA/11.%20Projects%20IA/Web_Japó/V0/src/utils/db.js).

## 6.2 Stores actuales

La base `japanGuideDB` usa hoy cuatro object stores:

- `cities`
- `places`
- `planner`
- `settings`

### `cities`
Contiene la información editable de ciudades:
- `id`
- nombre y metadatos
- `recommendedDays`
- `sortOrder`
- otros campos descriptivos

### `places`
Contiene cada actividad/lugar. Es una de las piezas más sensibles de la app.

### `planner`
Contiene el estado transversal del planificador por actividad, desacoplado del registro base de `places`.

### `settings`
Contiene configuración global del viaje y opciones generales.

## 6.3 Filosofía de diseño de datos

Hay una decisión estructural importante en la app:

- `places` describe qué es una actividad
- `planner` describe cómo está siendo utilizada esa actividad dentro de la planificación

Ese desacoplamiento es bueno y conviene mantenerlo. Evita contaminar la actividad base con estado operativo temporal.

---

## 7. Flujo de migración y normalización

## 7.1 Función crítica

La función clave es `runDataMigration()` en [src/utils/dataMigration.js](/C:/Users/bernat.duran/Documents/Bernat/17.%20IA/11.%20Projects%20IA/Web_Japó/V0/src/utils/dataMigration.js).

## 7.2 Qué hace

Tiene dos papeles distintos:

1. **Bootstrap inicial**
- Si no existen ciudades en la base, carga ciudades y actividades semilla en `IndexedDB`.
- También migra favoritos antiguos desde `localStorage` si existieran.

2. **Normalización evolutiva**
- Revisa registros ya existentes.
- Detecta formatos antiguos o inconsistentes.
- Reescribe solo si hace falta.

## 7.3 Por qué es importante

Esta utilidad es crítica porque el proyecto ha ido evolucionando y ha cambiado varios contratos funcionales con el tiempo:

- `score` pasó de objeto a número único
- `bestTime` pasó a ser un conjunto de opciones cerradas
- `source` dejó de formar parte del modelo funcional
- `lat/lng` se consolidaron como campos explícitos junto a `coordinates`
- `recommendedDays` pasó a ser texto configurable
- algunos textos debían repararse por mojibake

Si se tocan estructuras de datos sin actualizar esta migración, la app puede parecer correcta en instalaciones nuevas pero romperse con datos ya existentes en navegadores reales.

---

## 8. Normalización de actividades

## 8.1 Centro de verdad del modelo

El archivo clave es [src/utils/placeData.js](/C:/Users/bernat.duran/Documents/Bernat/17.%20IA/11.%20Projects%20IA/Web_Japó/V0/src/utils/placeData.js).

## 8.2 Qué resuelve

Concentra la definición práctica del modelo de actividad, aunque no exista un esquema formal con tipos TypeScript.

Entre sus responsabilidades:

- lista oficial de campos importables/exportables
- normalización de `score`
- normalización de `bestTime`
- normalización de booleanos
- reconstrucción de coordenadas
- saneo de texto corrupto
- conversión del registro interno a fila de import/export

## 8.3 Aspectos especialmente importantes

### a. `score`
El modelo vigente es `number | null`.

Compatibilidad heredada:
- si entra un objeto legacy con forma `{ chat, laura }`, la app usa `chat`
- si el valor es inválido o sale del rango 1-10, se normaliza a `null`

### b. `bestTime`
Se ha cerrado a cuatro opciones oficiales:
- `mañana`
- `tarde`
- `noche`
- `cualquier-momento`

Aunque internamente se admiten variantes heredadas al importar, la persistencia final se normaliza a ese conjunto.

### c. Mojibake
Se ha incorporado lógica explícita para intentar reparar texto corrupto.

Esto es muy relevante porque el proyecto ya sufrió problemas reales de codificación. A nivel de mantenimiento, conviene asumir que:

- no basta con confiar en que el archivo fuente esté bien
- también hay que limpiar registros antiguos ya persistidos

### d. Coordenadas
Internamente la actividad puede acabar con:
- `lat`
- `lng`
- `coordinates: { lat, lng }`

La exportación/importación trabaja de cara al usuario con `lat` y `lng` por separado, pero la app mantiene además `coordinates` cuando ambas existen.

---

## 9. Normalización de ciudades

El archivo [src/utils/cityData.js](/C:/Users/bernat.duran/Documents/Bernat/17.%20IA/11.%20Projects%20IA/Web_Japó/V0/src/utils/cityData.js) resuelve dos cuestiones clave:

- normalización de `recommendedDays`
- orden de ciudades mediante `sortOrder`

## 9.1 `recommendedDays`
La app ya no trata este valor como entero rígido. Ahora es texto editable.

Ejemplos válidos:
- `4-5 días`
- `6 días`
- `3 días`

Esto aporta flexibilidad editorial, pero implica que todo código que lo use debe tratarlo como texto y no como número.

## 9.2 `sortOrder`
Es la base de ordenación manual de ciudades desde `admin`.

La regla de arquitectura aquí es importante:
- el orden de ciudades no debe inferirse por nombre ni por semilla
- debe leerse desde `sortOrder`

La utilidad `sortCities()` concentra esa regla y debería seguir siendo la forma recomendada de ordenar ciudades en toda la app.

---

## 10. Páginas principales y responsabilidad de cada una

## 10.1 Home

[src/home.js](/C:/Users/bernat.duran/Documents/Bernat/17.%20IA/11.%20Projects%20IA/Web_Japó/V0/src/home.js) actúa como portada editorial de la aplicación.

Responsabilidades principales:

- cargar ciudades y configuración global
- mostrar resumen del viaje
- representar tarjetas de ciudades
- reutilizar el orden manual de ciudades
- enlazar con las demás secciones
- mostrar navegación general

Es una página muy orientada a presentación, no a edición profunda.

## 10.2 City

[src/city.js](/C:/Users/bernat.duran/Documents/Bernat/17.%20IA/11.%20Projects%20IA/Web_Japó/V0/src/city.js) es uno de los módulos más complejos.

Responsabilidades principales:

- resolver la ciudad activa por query param
- cargar actividades de esa ciudad
- aplicar filtros de búsqueda y clasificación
- mostrar tarjetas de actividad
- abrir detalle de actividad
- permitir crear actividad nueva
- permitir editar actividad existente
- sincronizar el estado planner de cada actividad para chips y contexto
- renderizar mapa de ciudad cuando corresponda

Es una pantalla híbrida: mezcla consumo de información, administración ligera de contenido y cambios de estado operativos.

## 10.3 Planner

[src/planner.js](/C:/Users/bernat.duran/Documents/Bernat/17.%20IA/11.%20Projects%20IA/Web_Japó/V0/src/planner.js) es probablemente el módulo más delicado funcionalmente.

Responsabilidades:

- cargar actividades y estado planner
- construir el agrupado por bandeja, días y estados
- permitir drag and drop entre bandeja y días
- mantener orden dentro de cada día
- reflejar cambios en mapa o calendario
- aplicar filtros globales del planner
- mantener feedback visual mediante toasts
- pintar la vista mapa con el alcance adecuado

Es la pieza donde más se nota la combinación entre estado en memoria, persistencia y UI reactiva manual.

## 10.4 Admin

[src/admin.js](/C:/Users/bernat.duran/Documents/Bernat/17.%20IA/11.%20Projects%20IA/Web_Japó/V0/src/admin.js) concentra operaciones de mantenimiento del sistema.

Responsabilidades:

- configurar parámetros globales del viaje
- gestionar ciudades
- ordenar ciudades
- importar/exportar actividades
- importar/exportar planificación
- hacer backup y restauración JSON general
- validar entradas delicadas antes de persistir

Es una pantalla técnica desde el punto de vista funcional, aunque siga pensada para uso interno más que para desarrolladores.

## 10.5 Tools

[src/tools.js](/C:/Users/bernat.duran/Documents/Bernat/17.%20IA/11.%20Projects%20IA/Web_Japó/V0/src/tools.js) agrupa utilidades secundarias o instrumentales. No es el núcleo del producto, pero conviene mantener consistencia con la navegación y settings globales.

---

## 11. Navegación compartida

La utilidad [src/utils/nav.js](/C:/Users/bernat.duran/Documents/Bernat/17.%20IA/11.%20Projects%20IA/Web_Japó/V0/src/utils/nav.js) se encarga del menú móvil compartido.

### Qué aporta

- render reutilizable del toggle móvil
- overlay de fondo
- cierre por botón, click fuera, enlace pulsado y tecla `Escape`
- actualización del icono abierto/cerrado
- control de `aria-*`

### Por qué es importante

Antes de centralizar esta parte, la navegación móvil era propensa a incoherencias entre pantallas. Este módulo reduce duplicación y mejora uniformidad.

### Regla práctica

Si se toca la navegación global, conviene revisar simultáneamente:
- desktop nav de cada pantalla
- markup del menú móvil
- estilos de navegación en `components.css`
- lógica de `bindMobileNav()`

---

## 12. Sistema de filtros

## 12.1 Filtros en ciudad

La ciudad soporta un sistema rico de filtrado:

- búsqueda libre
- prioridad
- categoría
- zona
- mejor momento
- puntuación
- estados planner
- día asignado
- lluvia

La lógica base vive en [src/utils/filters.js](/C:/Users/bernat.duran/Documents/Bernat/17.%20IA/11.%20Projects%20IA/Web_Japó/V0/src/utils/filters.js), pero parte del ensamblado final también sucede en `city.js`.

## 12.2 Filtros en planner

Planner implementa una variante específica:

- buscador
- ciudad
- prioridad
- puntuación
- y filtros propios de la vista planificadora

La idea técnica importante aquí es que en planner el filtrado se aplica de forma global sobre el conjunto del planificador, no solo sobre bandeja. Esa decisión da coherencia al comportamiento visual, especialmente cuando se alterna entre calendario y mapa.

## 12.3 Score multiselect

Se ha incorporado un patrón más sofisticado para la puntuación:

- dropdown multiselección con checkboxes
- persistencia del estado abierto durante selección múltiple
- cierre automático al pulsar fuera

Esto existe tanto en `city` como en `planner` y es una buena referencia para futuros filtros más complejos.

---

## 13. Modelo de actividad y campos actuales

Sin entrar en un contrato de tipos formal, el modelo funcional actual de una actividad incluye al menos:

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
- `coordinates`
- `estimatedDuration`
- `bestTime`
- `rainyFriendly`
- `score`
- `requiresTicket`
- `ticketInfo`
- `tips`
- `comment`

Campo retirado del modelo funcional actual:
- `source`

## 13.1 Qué implica esto

Cuando se añada, elimine o transforme un campo de actividad, no basta con tocar una sola zona. Hay que revisar sistemáticamente:

1. datos semilla
2. normalización en `placeData`
3. migración de datos existentes
4. formularios de creación/edición
5. tarjeta resumen
6. modal detalle
7. filtros
8. import/export JSON
9. import/export Excel/CSV
10. planner y mapa si el campo influye en esas vistas

Esta es una de las trampas más frecuentes del proyecto: pensar que un campo vive solo en una pantalla cuando en realidad atraviesa casi toda la aplicación.

---

## 14. CRUD de actividades

## 14.1 Dónde vive

La creación y edición de actividades vive en `city.js`, no en `planner.js`.

Esa decisión es correcta desde un punto de vista de diseño:
- `city` administra contenido
- `planner` administra planificación

## 14.2 Reglas actuales

- Crear actividad nueva desde una ciudad asigna por defecto el `cityId` de esa ciudad.
- El ID se genera automáticamente a partir del nombre, pero no se muestra visualmente en el formulario.
- El formulario trabaja con placeholders y validaciones para reducir errores.
- La puntuación está restringida al rango `1-10`.
- `bestTime` se representa como selección cerrada, no como texto libre.

## 14.3 Consideración arquitectónica

Esta separación conviene mantenerla. Llevar creación de actividades a planner mezclaría capas conceptuales y aumentaría complejidad innecesaria.

---

## 15. Planner: arquitectura funcional interna

## 15.1 Stores implicados

Planner no trabaja solo con `planner`. Necesita fusionar:

- `places`
- `planner`
- `settings` en algunos contextos

## 15.2 Estado por actividad

Cada actividad puede pasar por estados como:

- bandeja
- planificada en un día concreto
- realizada
- descartada

Además, el orden dentro de un día es importante y persistente.

## 15.3 Drag and drop

Planner usa `SortableJS` para mover actividades:

- de bandeja a un día
- entre días
- de un día a bandeja
- reordenación dentro de un mismo contenedor

Tras cada movimiento:
- se recalculan órdenes
- se persiste el nuevo estado
- se re-renderiza
- se actualiza feedback visual
- la vista mapa debe reflejar el nuevo orden

## 15.4 Vista mapa

La vista mapa del planner es una segunda lectura del mismo estado, no una fuente de verdad distinta.

Lo importante aquí es recordar que:
- no calcula routing real por calles
- usa líneas directas
- depende del orden de actividades del planner
- filtra por alcance (`Todos` o día concreto)
- omite actividades sin coordenadas

## 15.5 Toasts y feedback

Planner incorpora feedback tipo toast para movimientos y cambios de estado. Esto es especialmente útil porque los re-renders son frecuentes y el usuario necesita confirmación clara.

---

## 16. Importación y exportación

## 16.1 Actividades: JSON y Excel/CSV

El proyecto soporta import/export de actividades en dos grandes formatos:

- JSON
- Excel/CSV

La lista de columnas oficiales de actividades está centralizada en `PLACE_IMPORT_EXPORT_FIELDS` dentro de [src/utils/placeData.js](/C:/Users/bernat.duran/Documents/Bernat/17.%20IA/11.%20Projects%20IA/Web_Japó/V0/src/utils/placeData.js).

Esto es una muy buena decisión estructural y debería mantenerse.

## 16.2 Regla importante

`lat`, `lng` y `address` deben existir como campos separados en import/export.

Aunque internamente exista `coordinates`, de cara a interoperabilidad y edición externa es mucho mejor mantener `lat` y `lng` planos.

## 16.3 Import/export de planificación

Además del backup general, existe un flujo específico para exportar e importar planificación.

Su finalidad es trasladar únicamente el estado operativo del planner:
- qué actividad está en qué estado
- qué día tiene asignado
- qué orden ocupa
- qué metadatos funcionales del planner requiere la app

Esto permite sincronizar la planificación sin reescribir toda la base de actividades.

## 16.4 Compatibilidad hacia atrás

El proyecto intenta aceptar formatos antiguos razonables y normalizarlos al importar. Esa filosofía conviene mantenerla, sobre todo mientras el modelo siga evolucionando.

---

## 17. Backup general y restauración

Admin soporta backup general del conjunto de la app.

Normalmente incluye al menos:
- ciudades
- actividades
- planner
- settings

La idea aquí es importante desde mantenimiento:
- el backup general sirve como foto integral del estado
- la importación de planificación es una herramienta más específica y quirúrgica

No conviene mezclar ambos conceptos ni degradarlos en una única opción porque cubren necesidades distintas.

---

## 18. PWA y build multipágina

La configuración principal está en [vite.config.js](/C:/Users/bernat.duran/Documents/Bernat/17.%20IA/11.%20Projects%20IA/Web_Japó/V0/vite.config.js).

## 18.1 Build multipágina

La app define entradas explícitas para:
- `main`
- `city`
- `tools`
- `admin`
- `planner`

Esto es importante porque no estamos ante una SPA única. Cada HTML es una entrada real del build.

## 18.2 PWA

La app usa `vite-plugin-pwa` con:
- `registerType: autoUpdate`
- manifest propio
- `navigateFallback: null`

La decisión de desactivar fallback a `index.html` es importante porque la aplicación trabaja con páginas independientes como archivos separados. Un fallback tipo SPA rompería o distorsionaría el comportamiento esperado de páginas como `city.html` o `planner.html`.

## 18.3 Observación técnica actual

En `vite.config.js` todavía hay restos de texto con mojibake en comentarios y manifest (`Guia Japon 2026`, comentarios con acentos dañados). No es crítico para la arquitectura, pero conviene mantenerlo vigilado porque el proyecto ya ha tenido incidencias reales de codificación.

---

## 19. Problemas históricos y decisiones defensivas del proyecto

## 19.1 Mojibake

Uno de los problemas más reales del proyecto ha sido la corrupción de caracteres especiales.

Esto ha obligado a introducir dos líneas de defensa:

1. corregir archivos fuente cuando se detectan literales dañados
2. normalizar y reparar datos ya persistidos en navegador

Conclusión técnica:
- no basta con \"guardar el archivo en UTF-8\" si ya hay datos corruptos persistidos
- la app debe seguir teniendo una estrategia de saneo

## 19.2 Evolución del modelo de actividad

El modelo de actividad ha cambiado bastante durante el desarrollo. Por eso hoy son tan importantes las utilidades de normalización.

Cuando se amplíe la app, conviene no volver a dispersar reglas de transformación por muchas pantallas distintas.

## 19.3 Estado UI y re-renders manuales

Como no existe framework reactivo, algunas experiencias UX delicadas requieren ingeniería adicional:

- mantener foco del buscador tras render
- mantener abierto un dropdown de multiselección
- cerrar dropdown al hacer click fuera
- preservar estado visual de mapa o planner sin fugas

Esto significa que cualquier cambio de render debe pensar no solo en el HTML final, sino en la continuidad de la interacción.

---

## 20. Zonas de especial sensibilidad

Estas son las zonas donde un cambio pequeño puede tener impacto transversal.

## 20.1 `placeData.js`
Si se cambia aquí, se toca el contrato efectivo del modelo de actividad.

## 20.2 `dataMigration.js`
Si se olvida actualizar migración, la app puede funcionar en instalación limpia pero fallar con datos reales preexistentes.

## 20.3 `planner.js`
Es uno de los módulos con más estado, más vistas y más interacciones cruzadas.

## 20.4 `admin.js`
Cualquier error aquí puede afectar a import/export, backups, ciudades o settings globales.

## 20.5 Navegación común
Las incoherencias entre páginas suelen aparecer aquí si se toca solo una variante.

---

## 21. Convenciones y criterios que conviene mantener

## 21.1 Mantener la normalización centralizada

Siempre que un campo o estructura cambie, la primera pregunta debe ser:
- ¿esto se normaliza en un único sitio o se está empezando a repartir por pantallas?

La respuesta correcta casi siempre debería ser centralizarlo.

## 21.2 Distinguir contenido base de estado operativo

- `places`: contenido
- `planner`: estado operativo

No mezclar ambos sin necesidad.

## 21.3 Evitar texto libre cuando ya existe un conjunto cerrado

Casos como `bestTime` muestran una lección clara:
- si un campo se usa en filtros, en UI y en import/export, conviene que sea una opción cerrada
- los textos libres generan ambigüedad, deuda de normalización y filtros inestables

## 21.4 Mantener una fuente única de verdad para columnas import/export

La estrategia actual con `PLACE_IMPORT_EXPORT_FIELDS` es correcta y debe conservarse.

## 21.5 Tratar la codificación como riesgo real

En este proyecto no es una paranoia teórica. Ya ha ocurrido. Por tanto:
- vigilar textos raros en archivos fuente
- vigilar importaciones externas
- mantener normalización defensiva

---

## 22. Cómo ampliar la app sin romperla

## 22.1 Si se añade un nuevo campo a actividades

Secuencia recomendada:

1. añadirlo al modelo semilla si aplica
2. actualizar `normalizePlaceRecord()`
3. actualizar migración si hace falta transformar históricos
4. decidir si entra en import/export JSON
5. decidir si entra en Excel/CSV
6. revisar formularios
7. revisar tarjeta y detalle
8. revisar si afecta a filtros o planner

## 22.2 Si se añade un nuevo filtro

Secuencia recomendada:

1. definir si es cerrado o libre
2. decidir si afecta solo a `city` o también a `planner`
3. implementar la lógica en `filters.js` o en helper común equivalente
4. resolver UX de persistencia del foco o estado abierto si usa dropdown complejo
5. validar accesibilidad básica y responsive

## 22.3 Si se añade una nueva página

Secuencia recomendada:

1. crear HTML raíz nuevo
2. añadir entrada en `vite.config.js`
3. crear módulo JS específico
4. integrar navegación desktop y móvil
5. revisar PWA y assets

## 22.4 Si se cambia el modelo de planner

Cualquier cambio aquí debería revisar:
- store `planner`
- render agrupado
- drag and drop
- mapa
- import/export específico de planificación
- filtros y toasts

---

## 23. Calidad, testing y validación práctica

El proyecto no está montado sobre una suite formal de tests automatizados de frontend, así que buena parte de la validación práctica sigue siendo:

- `node --check` en los módulos JS tocados
- `npm run build`
- revisión visual en `localhost`
- comprobación manual de flujos clave
- verificación de despliegue en GitHub Pages

## 23.1 Flujos manuales mínimos tras cambios importantes

Cuando se toca la base funcional, conviene validar al menos:

1. home carga
2. una ciudad carga bien
3. filtros de ciudad responden bien
4. crear y editar actividad funciona
5. planner abre
6. drag and drop sigue persistiendo
7. vista mapa del planner sigue pintando
8. admin importa/exporta correctamente
9. un backup/restauración básico sigue funcionando

---

## 24. CI/CD y despliegue

El repositorio ya está preparado para GitHub y GitHub Pages.

A nivel conceptual:
- `CI` valida build
- `Deploy static content to Pages` publica la aplicación

La app encaja especialmente bien en GitHub Pages porque es estática y no depende de servidor backend.

### Consideración de mantenimiento

Conviene mantener los workflows actualizados porque GitHub ya ha avisado de deprecaciones sobre ciertas acciones antiguas. No es urgente funcionalmente, pero sí recomendable a medio plazo.

---

## 25. Deuda técnica actual percibida

Sin entrar en una crítica dura, estas son las principales áreas que aún pueden mejorarse técnicamente:

1. ausencia de tipado fuerte
2. mucho estado manual por módulo, especialmente en `city` y `planner`
3. posibilidad de duplicación de patrones de render y evento entre pantallas
4. riesgo persistente de mojibake en algunos archivos heredados
5. validación todavía muy dependiente de pruebas manuales
6. crecimiento progresivo de `city.js`, `planner.js` y `admin.js` como módulos grandes

Nada de esto invalida la arquitectura actual, pero sí marca el siguiente escalón de madurez si el proyecto sigue creciendo.

---

## 26. Recomendaciones técnicas de evolución futura

## Prioridad alta

### 1. Consolidar un esquema explícito del modelo de datos
Formalizar, aunque sea en documentación interna o pseudo-tipado JSDoc, los contratos de:
- ciudad
- actividad
- planner item
- settings

### 2. Segmentar módulos muy grandes
Dividir gradualmente:
- `city.js`
- `planner.js`
- `admin.js`

en submódulos por responsabilidad.

### 3. Blindar más la codificación
Revisar archivos heredados donde todavía puedan quedar textos problemáticos y establecer una rutina de saneo antes de cada release importante.

## Prioridad media

### 4. Añadir tests de utilidades críticas
Especialmente para:
- normalización de score
- normalización de bestTime
- reparación de mojibake
- import/export de actividades
- import/export de planificación

### 5. Extraer componentes de UI repetidos
Por ejemplo:
- dropdowns complejos
- toasts
- filtros compartidos
- chips de estado
- tarjetas de resumen

### 6. Centralizar más la navegación
Seguir reduciendo duplicación entre home, city, planner, tools y admin.

## Prioridad baja

### 7. Añadir tipado progresivo
No necesariamente migrar todo a TypeScript de golpe, pero sí explorar:
- JSDoc con tipos
- o migración incremental de utilidades críticas

### 8. Mejorar observabilidad de errores
Añadir mensajes de diagnóstico más consistentes para operaciones sensibles como importaciones, migraciones o restauraciones.

---

## 27. Conclusión

Técnicamente, la aplicación está construida sobre una base sencilla pero bastante capaz:

- multipágina
- sin backend
- con persistencia local real
- con planner operativo
- con administración de datos
- con import/export útil
- con migraciones defensivas para evolución del modelo

Su mayor fortaleza es que ya resuelve bastantes necesidades reales sin una infraestructura compleja.

Su principal reto de futuro no es tanto “hacer que funcione”, porque ya funciona, sino **seguir ampliándola sin perder coherencia interna**.

La clave para lograrlo está en respetar cuatro principios:

1. centralizar normalización y contratos de datos
2. separar contenido base de estado de planificación
3. pensar cada cambio de campo de forma transversal
4. tratar UX de re-render y codificación como problemas de primer nivel, no detalles secundarios

Si se mantiene esa disciplina, la app puede seguir creciendo de forma bastante sólida sin necesidad de reescribirla desde cero.
