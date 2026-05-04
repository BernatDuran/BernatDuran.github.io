# Informe de revisión: actividades vs Excel vs JSON

## Objetivo

> Actualización tras refactor de geodatos: `lat` y `lng` pasan a ser la fuente canónica. `coordinates` queda solo como formato legado aceptado en lectura/importación para no romper backups o datos antiguos.

Este documento revisa de forma exhaustiva la coherencia entre:

- el modelo real de datos de las actividades dentro de la aplicación
- los formularios de creación y edición
- la importación/exportación por Excel
- el backup JSON general
- el JSON específico de planificación

Además, detecta:

- diferencias funcionales entre formatos
- riesgos de pérdida o inconsistencia de datos
- campos redundantes, infrautilizados o prescindibles

---

## 1. Modelo real de actividad en la app

La fuente más clara del modelo actual está en [placeData.js](</C:/Users/bernat.duran/Documents/Bernat/17.IA/11. Projects IA/Web_Japón/V0/src/utils/placeData.js>), especialmente en `normalizePlaceRecord(...)`.

### Campos funcionales de actividad actualmente soportados

| Campo | Tipo funcional | Uso principal en la app |
|---|---|---|
| `id` | texto | Identificador único interno |
| `name` | texto | Nombre visible |
| `cityId` | texto | Relación con ciudad |
| `category` | texto | Categoría funcional para filtros y agrupación visual |
| `type` | texto | Tipo descriptivo visible en tarjeta y detalle |
| `priority` | texto | Prioridad de visita |
| `zone` | texto | Zona o barrio |
| `description` | texto | Descripción principal |
| `address` | texto o `null` | Dirección visible y enlace contextual |
| `lat` | número o `null` | Coordenada plana |
| `lng` | número o `null` | Coordenada plana |
| `coordinates` | legado/compatibilidad | Se acepta al leer/importar datos antiguos, pero ya no es el formato canónico |
| `estimatedDuration` | texto o `null` | Duración visible y usada para sumatorios del planner |
| `bestTime` | opción | Momento recomendado |
| `rainyFriendly` | booleano | Lluvia: filtro, icono y decisiones de planificación |
| `score` | número o `null` | Puntuación única |
| `requiresTicket` | booleano | Si requiere entrada/reserva |
| `ticketInfo` | texto o `null` | Detalle de entrada |
| `tips` | texto o `null` | Consejos prácticos |
| `comment` | texto o `null` | Nota personal |

### Campo legado detectado

| Campo | Estado |
|---|---|
| `source` | legado, eliminado del modelo funcional actual y descartado en `normalizePlaceRecord(...)` |

### Observaciones clave del modelo

- El modelo oficial actual de actividad **ya no usa** `source`.
- `score` ya es **numérico único**, no objeto.
- `bestTime` ya está normalizado a un set cerrado:
  - `mañana`
  - `tarde`
  - `noche`
  - `cualquier-momento`
- El modelo normalizado prioriza `lat` y `lng`. `coordinates` se mantiene solo como compatibilidad de entrada para datos antiguos.

---

## 2. Qué campos aparecen en formularios de creación/edición

La creación y edición de actividades vive en [city.js](</C:/Users/bernat.duran/Documents/Bernat/17.IA/11. Projects IA/Web_Japón/V0/src/city.js>) dentro de `renderPlaceForm(...)` y `openPlaceForm(...)`.

### Campos visibles en formulario

| Campo | Está en formulario | Comentario |
|---|---|---|
| `id` | sí, pero oculto | se genera automáticamente |
| `cityId` | sí, oculto/fijado | se fija a la ciudad actual |
| `name` | sí | editable |
| `category` | sí | editable |
| `type` | sí | editable |
| `priority` | sí | editable |
| `zone` | sí | editable |
| `description` | sí | editable |
| `address` | sí | editable |
| `lat` | sí | editable |
| `lng` | sí | editable |
| `estimatedDuration` | sí | editable |
| `bestTime` | sí | editable como select |
| `rainyFriendly` | sí | editable |
| `score` | sí | editable |
| `requiresTicket` | sí | editable |
| `ticketInfo` | sí | editable |
| `tips` | sí | editable |
| `comment` | sí | editable |
| `coordinates` | no | se acepta solo al leer/importar datos antiguos |
| `source` | no | ya no existe funcionalmente |

### Conclusión de formularios

El formulario está bastante alineado con el modelo real.

Las únicas excepciones son:

- `coordinates`, que no se edita directamente porque queda como compatibilidad de entrada
- `source`, que ya no forma parte del sistema funcional

---

## 3. Excel de importación/exportación

La definición de columnas está centralizada en [placeData.js](</C:/Users/bernat.duran/Documents/Bernat/17.IA/11. Projects IA/Web_Japón/V0/src/utils/placeData.js>) mediante `PLACE_IMPORT_EXPORT_FIELDS`, y el flujo está implementado en [admin.js](</C:/Users/bernat.duran/Documents/Bernat/17.IA/11. Projects IA/Web_Japón/V0/src/admin.js>).

### Columnas exportadas/importadas por Excel

| Campo | Excel |
|---|---|
| `id` | sí |
| `name` | sí |
| `cityId` | sí |
| `category` | sí |
| `type` | sí |
| `priority` | sí |
| `zone` | sí |
| `description` | sí |
| `address` | sí |
| `lat` | sí |
| `lng` | sí |
| `estimatedDuration` | sí |
| `bestTime` | sí |
| `rainyFriendly` | sí |
| `score` | sí |
| `requiresTicket` | sí |
| `ticketInfo` | sí |
| `tips` | sí |
| `comment` | sí |
| `coordinates` | no |
| `source` | no |

### Nivel de alineación con el modelo real

La exportación/importación Excel está **muy bien alineada** con el modelo funcional actual de actividad.

### Diferencias respecto al modelo real

| Diferencia | Impacto |
|---|---|
| `coordinates` no se exporta | correcto, porque `lat/lng` son el contrato canónico |
| `source` no se exporta | correcto, porque es un campo legado ya no usado |

### Observaciones relevantes de la importación Excel

- La importación solo exige como mínimos:
  - `id`
  - `cityId`
  - `name`
- Si faltan otros campos, el registro sigue entrando.
- `priority` se autocompleta a `optional` si no viene.
- `score`, booleanos, `bestTime`, `lat/lng` y textos pasan por normalización.
- Si el Excel trae `lat/lng`, la app los normaliza como coordenadas canónicas.

### Riesgos detectados en Excel

#### 1. Validación de negocio más laxa que el formulario

El formulario exige más estructura funcional que el Excel. En Excel pueden entrar actividades con:

- `category` vacía
- `type` vacío
- `zone` vacía
- `description` vacía

No rompe necesariamente la app, pero sí puede degradar UX y consistencia.

#### 2. Importación tolera strings JSON embebidos

Si una celda contiene algo con formato `{...}` o `[...]`, se intenta hacer `JSON.parse(...)`. Es flexible, pero puede introducir comportamientos no evidentes para quien importa.

#### 3. No exporta campos de planner

Esto no es un problema si el objetivo es exportar actividades puras, pero sí significa que el Excel **no sirve** para reconstruir el estado de planificación.

---

## 4. Backup JSON general

El backup general se exporta desde [admin.js](</C:/Users/bernat.duran/Documents/Bernat/17.IA/11. Projects IA/Web_Japón/V0/src/admin.js>) con este shape:

```json
{
  "cities": [...],
  "places": [...],
  "planner": [...]
}
```

### Qué incluye en `places`

Se exporta `normalizePlaceRecord(place)`, por lo que el backup general de actividades incluye:

| Campo | Backup JSON general |
|---|---|
| `id` | sí |
| `name` | sí |
| `cityId` | sí |
| `category` | sí |
| `type` | sí |
| `priority` | sí |
| `zone` | sí |
| `description` | sí |
| `address` | sí |
| `lat` | sí |
| `lng` | sí |
| `coordinates` | no |
| `estimatedDuration` | sí |
| `bestTime` | sí |
| `rainyFriendly` | sí |
| `score` | sí |
| `requiresTicket` | sí |
| `ticketInfo` | sí |
| `tips` | sí |
| `comment` | sí |
| `source` | no |

### Diferencias respecto al Excel

| Campo | Excel | Backup JSON general |
|---|---|---|
| `address` | sí | sí |
| `lat` | sí | sí |
| `lng` | sí | sí |
| `coordinates` | no | no |
| planner (`status`, `assignedDay`, etc.) | no | sí, pero fuera de `places` |

### Observaciones clave

#### 1. El JSON general queda alineado con el Excel en coordenadas

Exporta la capa plana geográfica (`lat/lng`) como contrato principal.

#### 2. El JSON general separa contrato funcional y compatibilidad

Desde un punto de vista de producto, el usuario trabaja con `lat/lng`, no con `coordinates`.

Por tanto:

- `lat/lng` son datos funcionales de intercambio
- `coordinates` queda como detalle legado de importación, no como campo exportado normal.

#### 3. La importación general restaura correctamente `address` + `lat/lng`

Además:

- soporta formato nuevo
- soporta datos antiguos con `coordinates`
- soporta `score` legado como objeto

Esto está bien resuelto.

---

## 5. JSON específico de planificación

También en [admin.js](</C:/Users/bernat.duran/Documents/Bernat/17.IA/11. Projects IA/Web_Japón/V0/src/admin.js>) existe una exportación/importación específica del planner.

### Shape actual

```json
{
  "planner": [
    {
      "placeId": "...",
      "favorite": false,
      "status": "planned",
      "assignedDay": 3,
      "order": 2
    }
  ]
}
```

### Comparativa con actividades

Este JSON **no exporta actividades**, sino solo el estado del planner.

| Campo de actividad | JSON planificación |
|---|---|
| `id` | no |
| `name` | no |
| `cityId` | no |
| `category` | no |
| `type` | no |
| `priority` | no |
| `zone` | no |
| `description` | no |
| `address` | no |
| `lat/lng` | no |
| `coordinates` | no |
| `estimatedDuration` | no |
| `bestTime` | no |
| `rainyFriendly` | no |
| `score` | no |
| `requiresTicket` | no |
| `ticketInfo` | no |
| `tips` | no |
| `comment` | no |

### Campos que sí incluye

| Campo planner | JSON planificación |
|---|---|
| `placeId` | sí |
| `favorite` | sí |
| `status` | sí |
| `assignedDay` | sí |
| `order` | sí |

### Observaciones clave

#### 1. Contrato correcto para su propósito

Sirve para:

- reconstruir bandeja
- reconstruir días asignados
- reconstruir orden
- restaurar descartadas y hechas

#### 2. No es autosuficiente

Depende de que las actividades existan previamente en `places`.

Esto está previsto y la importación:

- valida existencia por `placeId`
- ignora las que no existan
- avisa si se saltan registros

#### 3. Es mucho más limpio que el JSON general

Como contrato, este JSON es claro y acotado.

---

## 6. Comparativa global resumida

### Actividad vs Excel vs backup JSON general

| Campo | Modelo actividad | Excel | Backup JSON general |
|---|---|---|---|
| `id` | sí | sí | sí |
| `name` | sí | sí | sí |
| `cityId` | sí | sí | sí |
| `category` | sí | sí | sí |
| `type` | sí | sí | sí |
| `priority` | sí | sí | sí |
| `zone` | sí | sí | sí |
| `description` | sí | sí | sí |
| `address` | sí | sí | sí |
| `lat` | sí | sí | sí |
| `lng` | sí | sí | sí |
| `coordinates` | legado | no | no |
| `estimatedDuration` | sí | sí | sí |
| `bestTime` | sí | sí | sí |
| `rainyFriendly` | sí | sí | sí |
| `score` | sí | sí | sí |
| `requiresTicket` | sí | sí | sí |
| `ticketInfo` | sí | sí | sí |
| `tips` | sí | sí | sí |
| `comment` | sí | sí | sí |
| `source` | no funcional | no | no |

### Actividad vs JSON planificación

| Campo | Modelo actividad | JSON planificación |
|---|---|---|
| datos de actividad | sí | no |
| datos de planner | no | sí |

---

## 7. Campos poco usados, redundantes o prescindibles

### A. `coordinates`

Estado:

- útil técnicamente como compatibilidad
- redundante funcionalmente

Motivo:

- la app ya guarda `lat` y `lng`
- en la capa de intercambio no es necesario
- ya no debe exportarse ni persistirse como campo normalizado

Conclusión:

- **no es inútil**, pero sí **redundante**
- el canon elegido pasa a ser `lat/lng`
- `coordinates` queda solo para compatibilidad hacia atrás

### B. `source`

Estado:

- legado
- no funcional
- ya descartado por la normalización

Conclusión:

- **inútil en el sistema actual**
- solo tiene sentido como compatibilidad histórica en importaciones antiguas

### C. `favorite` dentro del planner

Estado:

- no pertenece al modelo de actividad
- vive en `planner`

Conclusión:

- no es inútil
- pero conceptualmente mezcla “preferencia” con “estado de planificación”
- a futuro podría merecer store propio o una semántica mejor definida

### D. `ticketInfo` cuando `requiresTicket = false`

Estado:

- funcional, pero dependiente de `requiresTicket`

Conclusión:

- no es inútil
- pero hay riesgo de incoherencia si queda texto en `ticketInfo` mientras `requiresTicket` es `false`

### E. `type` y `category`

Estado:

- ambos se usan
- ambos aportan valor

Diferencia:

- `category` sirve para agrupar/filtrar funcionalmente
- `type` sirve para describir el sitio con más naturalidad

Conclusión:

- no sobran
- pero conviene vigilar su consistencia porque se pueden solapar semánticamente

---

## 8. Diferencias y riesgos detectados

### 1. El Excel está mejor alineado de lo que parecía

Hoy por hoy, el Excel cubre prácticamente todo el modelo funcional real de actividad.

Esto es positivo.

### 2. El backup JSON general queda alineado con el Excel en geodatos

El backup JSON general ya no necesita exportar `coordinates` si exporta `lat/lng`.

### 3. La validación de importación Excel es más débil que la validación del formulario

Esto puede permitir entradas válidas técnicamente pero pobres funcionalmente.

Ejemplos:

- actividad sin `category`
- actividad sin `type`
- actividad sin `description`
- actividad sin `zone`

### 4. El JSON general no filtra campos extra ajenos al modelo

`normalizePlaceRecord(...)` hace `...rest`, así que si un objeto trae propiedades extra, podrían sobrevivir en el backup/restore.

Esto es flexible, pero abre la puerta a “basura estructural” si algún día entran campos espurios.

### 5. La dualidad `lat/lng` + `coordinates` queda resuelta como compatibilidad

El contrato principal queda en `lat/lng`; `coordinates` solo se acepta al importar o leer datos antiguos.

---

## 9. Conclusiones

### Conclusión general

El sistema actual está bastante bien encaminado:

- el formulario de actividades está alineado con el modelo
- el Excel está muy bien cubierto
- el backup JSON general restaura correctamente
- el JSON de planificación está bien diseñado para su función

No hay una ruptura grave entre formatos.

### Puntos más sílidos

- `address` y `lat/lng` están correctamente cubiertos en Excel y JSON general
- `score` ya está unificado
- `bestTime` ya está controlado como opción
- el JSON de planificación es limpio y útil

### Puntos más mejorables

- mantener compatibilidad con datos antiguos que traigan `coordinates`
- validación laxa en Excel
- backup JSON general debe mantener limpio el contrato funcional
- presencia implícita de posibles campos extra no controlados

---

## 10. Propuestas de mejora

### Prioridad alta

#### 1. Mantener `lat/lng` como única fuente de verdad geográfica

Recomendado:

- persistir `lat/lng`
- exportar `lat/lng`
- aceptar `coordinates` solo como formato legado de entrada
- evitar volver a introducir `coordinates` en nuevos flujos

#### 2. Endurecer la validación del Excel importado

Recomendado exigir al menos:

- `id`
- `cityId`
- `name`
- `category`
- `type`
- `priority`
- `zone`
- `description`

No hace falta bloquear por todos, pero sí al menos por los estructurales.

#### 3. Normalizar el backup JSON general a contrato “externo”

Recomendación:

- exportar `lat/lng`
- no exportar `coordinates`

Importación:

- seguir aceptando ambos formatos por compatibilidad

Esto dejaría el contrato más limpio sin romper nada antiguo.

### Prioridad media

#### 4. Blindar campos extra en importación JSON general

En vez de propagar `...rest` sin límites, convendría construir el objeto solo con claves permitidas.

Así se evita basura silenciosa en la BD.

#### 5. Hacer explícita la diferencia entre “modelo de actividad” y “modelo de planner”

Hoy está razonablemente claro en código, pero un pequeño documento de contrato ayudaría bastante.

#### 6. Revisar `ticketInfo` cuando `requiresTicket` sea `false`

Se puede limpiar automáticamente o al menos avisar.

### Prioridad baja

#### 7. Valorar si `favorite` debe seguir viviendo en `planner`

No es un fallo, pero conceptualmente podría estar mejor separado.

#### 8. Añadir una exportación JSON “solo actividadesí

Actualmente existe:

- backup total
- JSON de planner

Podría ser útil una tercera opción:

- JSON solo de actividades

Más simple que el backup completo y más rico que el Excel.

---

## 11. Veredicto final

Si la pregunta es si hoy existe incoherencia grave entre actividades, Excel y JSON, la respuesta es:

**no, no hay una incoherencia grave.**

Si la pregunta es si hay margen claro de mejora de contrato y limpieza de datos, la respuesta es:

**sí, sobre todo en geodatos, validación Excel y limpieza del backup JSON general.**

El campo claramente prescindible es:

- `source`

El campo más claramente redundante es:

- `coordinates`, que queda relegado a compatibilidad con datos antiguos
