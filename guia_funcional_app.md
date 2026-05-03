# Guía Funcional de la Aplicación

## 1. Qué es esta aplicación

Esta aplicación es una **guía de viaje interactiva y un planificador personal de itinerarios** centrado en un viaje a Japón. No es solo una web informativa ni solo una agenda: combina ambas cosas en una única herramienta.

Su propósito principal es ayudarte a:

- descubrir lugares de interés por ciudad
- decidir qué actividades merecen la pena
- filtrar y comparar opciones
- organizar un itinerario día a día
- guardar el estado real de tu planificación
- mantener tus datos actualizados y reutilizables

La aplicación está pensada para un uso muy práctico: consultar, priorizar, planificar, reajustar y conservar el trabajo realizado durante la preparación del viaje.

---

## 2. Qué tipo de app es

Es una **aplicación web de planificación de viaje de uso personal**, con un enfoque híbrido entre:

- guía editorial de destinos
- base de datos de actividades y lugares
- panel de gestión
- planificador visual de itinerario

No depende de una cuenta de usuario ni de un backend clásico para funcionar como experiencia principal. La app guarda la información de trabajo en el propio navegador y permite exportarla/importarla para no perderla.

En términos prácticos, se comporta como una herramienta de viaje personalizada con estas capas:

1. **Capa de descubrimiento**
- ver ciudades
- ver lugares
- leer descripciones, consejos y datos útiles

2. **Capa de evaluación**
- ver prioridad
- ver puntuación
- ver si es apto para lluvia
- ver duración, categoría, zona y mejor momento

3. **Capa de planificación**
- mover actividades a la bandeja
- asignarlas a días concretos
- reordenarlas dentro de cada día
- revisar la ruta en modo calendario o mapa

4. **Capa de administración**
- configurar fechas del viaje
- gestionar ciudades
- crear y editar actividades
- importar y exportar información
- crear copias de seguridad

---

## 3. Para qué sirve realmente

La utilidad real de la aplicación es convertir una lista desordenada de ideas de viaje en un plan accionable.

Sirve para:

- recopilar actividades por ciudad
- consultar rápidamente qué hay en cada zona
- saber qué es imprescindible y qué es opcional
- organizar actividades por días
- separar ideas pendientes de actividades ya decididas
- adaptar el plan según clima, energía o prioridades
- mantener una visión general del viaje
- conservar el trabajo de planificación a lo largo del tiempo

También sirve muy bien para evitar problemas típicos de planificación:

- olvidar sitios interesantes
- repetir búsquedas una y otra vez
- perder el orden del itinerario
- saturar días con demasiadas actividades
- no saber qué hacer si llueve
- no recordar qué actividad iba en qué día
- no tener una forma clara de exportar y recuperar el plan

---

## 4. Público ideal

La aplicación es especialmente útil para:

- personas que preparan un viaje complejo con muchas actividades
- usuarios que quieren comparar opciones antes de decidir
- viajeros que necesitan una planificación flexible
- quienes valoran ver el viaje por ciudad y también como itinerario global
- personas que quieren una herramienta viva, editable y exportable

Encaja especialmente bien cuando:

- el viaje dura varios días
- hay varias ciudades implicadas
- existen muchas actividades posibles
- hay que priorizar
- se quiere combinar inspiración y organización

---

## 5. Estructura general de la app

La aplicación se organiza en varias pantallas principales.

### 5.1 Inicio
La portada resume el viaje y sirve como punto de entrada.

Desde aquí puedes:

- ver el contexto general del viaje
- ver las ciudades disponibles
- acceder a cada ciudad
- acceder al planner
- acceder a administración

La home cumple una función de orientación general. Es el panel de arranque de la app.

### 5.2 Páginas de ciudad
Cada ciudad tiene su propia página de exploración y gestión.

Desde aquí puedes:

- ver todas las actividades/lugares de esa ciudad
- filtrar actividades
- abrir el detalle de cada actividad
- crear nuevas actividades
- editar actividades existentes
- consultar el mapa de la ciudad
- ver el estado de planificación de cada actividad

Es la zona más útil para explorar contenido y enriquecer la base de actividades.

### 5.3 Planner
Es el planificador global del viaje.

Desde aquí puedes:

- ver las actividades organizadas por días
- mantener actividades en bandeja
- arrastrar y soltar entre bandeja y días
- reordenar el contenido de cada día
- ver el estado de cada actividad
- consultar la versión en mapa

Es la pantalla más importante para construir el itinerario real.

### 5.4 Administración
Es el panel de control.

Desde aquí puedes:

- configurar el viaje
- editar ciudades
- añadir nuevas ciudades
- importar y exportar actividades
- importar y exportar planificación
- restaurar backups completos

Es la parte donde se gobierna la información de la app.

---

## 6. Cómo usar la aplicación de forma recomendada

La mejor forma de aprovecharla no es empezar directamente por el planner, sino seguir este flujo:

1. revisar el viaje desde Inicio
2. entrar a cada ciudad y explorar actividades
3. usar filtros para localizar lo más relevante
4. depurar qué es imprescindible, recomendable u opcional
5. asignar actividades a bandeja o a días
6. entrar al planner y ordenar el viaje completo
7. revisar el mapa del planner
8. ajustar según tiempo, prioridades y carga diaria
9. exportar o guardar copia de seguridad

Este flujo reduce mucho la sensación de caos y ayuda a que la planificación tenga sentido.

---

## 7. La Home: qué muestra y cómo interpretarla

La pantalla de inicio es la visión general del viaje.

### Qué suele mostrar

- identidad del viaje
- navegación a ciudades
- acceso a planner
- acceso a administración
- resumen temporal del viaje
- tarjetas de ciudades
- información general útil

### Para qué sirve funcionalmente

- ubicarte en el proyecto
- recordar el conjunto del viaje
- saltar rápidamente a la ciudad que quieres trabajar
- validar de un vistazo la duración y la estructura general

### Tarjetas de ciudad
Cada tarjeta resume una ciudad concreta.

Suelen mostrar:

- nombre de la ciudad
- carácter o tagline
- breve descripción
- número de lugares
- número de imprescindibles
- días recomendados
- destacados

Su objetivo es que puedas comparar ciudades a alto nivel antes de entrar en detalle.

---

## 8. Páginas de ciudad: núcleo de exploración

Cada página de ciudad es el espacio para entender y gestionar las actividades de ese destino.

## 8.1 Qué contiene una página de ciudad

Normalmente incluye:

- navegación superior
- cabecera de ciudad
- resumen general
- botón de nueva actividad
- bloque de filtros
- grid de actividades
- mapa interactivo
- propuestas de itinerario orientativas

## 8.2 Qué representa cada actividad

Cada actividad es una ficha que puede representar:

- un templo
- un barrio
- un paseo
- una experiencia
- un mirador
- un restaurante
- una zona comercial
- un parque
- un museo

Cada una tiene suficiente información para evaluarla y decidir si entra o no en el viaje.

---

## 9. Tarjetas de actividad: cómo leerlas

Las tarjetas de actividad están pensadas para darte mucha información sin necesidad de abrir el detalle.

### Qué muestran normalmente

- nombre
- tipo
- breve descripción
- estado de planificación
- prioridad
- zona
- duración estimada
- puntuación
- apto o no para lluvia
- acceso al mapa

### Cómo interpretarlas

#### Prioridad
Ayuda a decidir el peso de una actividad dentro del viaje.

Valores habituales:

- **Imprescindible**
- **Recomendable**
- **Opcional**

#### Zona
Te ayuda a agrupar mentalmente actividades cercanas.

Es útil para:

- diseñar días coherentes
- evitar desplazamientos innecesarios
- entender cómo se distribuye la ciudad

#### Duración
Sirve para estimar carga diaria y encaje en el planner.

#### Puntuación
Sirve como referencia de valor relativo.

No sustituye al criterio personal, pero ayuda a priorizar.

#### Lluvia
Indica si una actividad es buena candidata para días con mal tiempo.

#### Estado de planificación
Indica si la actividad:

- aún no está planificada
- está en bandeja
- ya está asignada a un día
- está realizada
- ha sido descartada

---

## 10. Filtros en las páginas de ciudad

Los filtros son una de las piezas más útiles de la app. No solo sirven para encontrar cosas, sino para pensar mejor el viaje.

## 10.1 Buscador

Permite buscar por texto libre.

Suele servir para encontrar coincidencias en:

- nombre
- descripción
- zona
- tipo

Es especialmente útil cuando ya sabes más o menos qué quieres encontrar.

## 10.2 Filtros de prioridad

Permiten centrarse solo en:

- imprescindibles
- recomendables
- opcionales

Son ideales cuando quieres:

- construir un día con solo lo mejor
- reducir el volumen de opciones
- revisar si tienes demasiadas actividades secundarias

## 10.3 Solo lluvia

Filtra las actividades aptas para mal tiempo.

Muy útil para:

- diseñar plan B
- decidir qué mover si el clima cambia
- construir un día cubierto o flexible

## 10.4 Categoría

Permite restringir la ciudad a un tipo de actividad concreto.

Ejemplos:

- templos
- barrios
- comida
- compras
- naturaleza
- miradores
- experiencias

## 10.5 Zona

Ayuda a ver solo un barrio o área concreta de la ciudad.

Es especialmente útil para:

- montar días geográficamente coherentes
- analizar un sector concreto
- evitar mezclar zonas muy alejadas

## 10.6 Mejor momento

Permite filtrar por:

- mañana
- tarde
- noche
- cualquier momento

Ayuda a diseñar mejor el encaje temporal del día.

## 10.7 Puntuación

La app permite filtrar por puntuación con bandas prácticas, no por valores exactos absurdamente precisos.

Actualmente se plantea para poder revisar:

- tramos bajos
- tramos medios
- tramos altos
- actividades top

Esto es muy útil para:

- quedarte solo con lo más fuerte
- limpiar ruido
- revisar qué actividades merecen entrar sí o sí

## 10.8 Estado de planificación

Permite ver actividades según su situación en el planner.

Por ejemplo:

- no asignadas
- en bandeja
- planeadas
- realizadas
- descartadas

## 10.9 Día

Permite ver qué actividades pertenecen a un día concreto del viaje.

Es útil para revisar si la ciudad tiene demasiado peso en un día específico o si quieres reequilibrar.

---

## 11. Crear actividades nuevas

La creación de actividades se hace desde las páginas de ciudad, no desde el planner.

Esto tiene mucho sentido funcional:

- primero se crea o enriquece el contenido en su ciudad natural
- después se planifica globalmente

## 11.1 Qué permite el formulario

El formulario permite introducir todos los campos relevantes de una actividad.

Entre ellos:

- nombre
- categoría
- tipo
- prioridad
- zona
- descripción
- dirección
- latitud y longitud
- duración estimada
- mejor momento
- apto para lluvia
- puntuación
- si requiere entrada
- información de entrada
- consejos
- comentario

## 11.2 Cómo funciona el ID

El identificador se genera automáticamente de forma segura.

Eso evita:

- errores de formato
- caracteres raros
- duplicidades manuales innecesarias

## 11.3 Cuándo conviene crear una actividad

Conviene hacerlo cuando:

- aparece una nueva idea de visita
- quieres guardar un restaurante o experiencia nueva
- detectas una actividad que faltaba
- quieres personalizar completamente el viaje con tus propios descubrimientos

---

## 12. Editar actividades

Las actividades existentes pueden editarse desde la ciudad.

Esto sirve para:

- corregir descripciones
- actualizar prioridad
- ajustar duración
- cambiar mejor momento
- completar dirección o coordenadas
- marcar si es apta para lluvia
- añadir comentarios o consejos

Editar una actividad no es solo corregir datos: también es afinar la calidad de tu planificación.

---

## 13. Vista de detalle de actividad

Al abrir una actividad se accede a una ficha ampliada con más contexto.

### Qué suele mostrar

- nombre y tipo
- estado de planificación
- prioridad
- lluvia
- acceso al mapa
- descripción larga
- consejos prácticos
- información útil
- dirección
- mapa de la actividad

### Información útil

Aquí se concentra lo más operativo:

- zona
- categoría
- duración estimada
- mejor momento
- puntuación
- entrada

Esta ficha es ideal para decidir si una actividad:

- entra en el itinerario
- merece una mañana o una tarde
- debe estar en plan principal o secundario

---

## 14. Estado de planificación de actividades

Cada actividad puede tener un estado dentro del sistema de planificación.

## 14.1 Estados habituales

### Sin asignar
La actividad existe en la base de datos, pero todavía no has decidido qué hacer con ella.

### En bandeja
La actividad ya ha pasado el primer filtro y quieres mantenerla disponible para planificarla más adelante.

### Planeada
Ya está asignada a un día concreto.

### Realizada
Se usa para dejar constancia de que esa actividad ya está hecha o confirmada como completada.

### Descartada
La actividad no entra en el plan actual, pero no necesariamente quieres borrarla.

Este sistema es muy valioso porque evita decisiones binarias del tipo “todo o nada”.

---

## 15. Planner: el corazón operativo del viaje

El planner transforma la colección de actividades en un itinerario real.

## 15.1 Qué ofrece

- vista calendario
- vista mapa
- bandeja de actividades pendientes
- columnas o bloques por día
- reordenación por drag & drop
- cambio rápido de estado
- detalle de cada actividad

## 15.2 Para qué sirve

Sirve para responder preguntas como:

- ¿qué hago cada día?
- ¿qué aún no he ubicado?
- ¿hay demasiada carga en un día?
- ¿qué actividades están en el mismo día?
- ¿el orden del recorrido tiene sentido?
- ¿hay actividades sin asignar que deberían entrar?

---

## 16. Bandeja del planner

La bandeja actúa como zona intermedia entre “idea válida” y “actividad ya asignada”.

Es una herramienta extremadamente útil porque evita que tengas que decidir el día exacto en el mismo momento en que decides que una actividad te interesa.

La bandeja sirve para:

- guardar actividades pendientes de ubicar
- comparar antes de asignar
- evitar saturar días prematuramente
- mantener visibles opciones candidatas

---

## 17. Días del viaje en el planner

Cada día representa una unidad de planificación.

Dentro de un día puedes:

- añadir actividades
- cambiar su orden
- quitar actividades
- revisar si el conjunto tiene sentido

La app no solo te permite asignar actividades, sino **ordenarlas**, y eso es clave para que el planner sea realmente útil.

No es lo mismo “tener tres actividades en un día” que “tener tres actividades en un orden lógico”.

---

## 18. Drag & drop

Una de las funciones más importantes del planner es el arrastrar y soltar.

Permite:

- mover de bandeja a día
- mover de un día a otro
- devolver a bandeja
- cambiar el orden dentro del mismo día

Esta interacción hace que la planificación sea rápida, visual y flexible.

La ventaja principal es que puedes iterar sin miedo:

- pruebas una actividad en un día
- ves si encaja
- si no, la mueves
- si sobra, vuelve a bandeja

---

## 19. Vista mapa del planner

Además de la vista calendario, existe una vista mapa.

### Para qué sirve

No sustituye al calendario, sino que lo complementa.

Sirve para:

- validar coherencia geográfica
- ver si el día tiene sentido espacial
- detectar desplazamientos poco eficientes
- revisar rutas por día

### Modos de consulta

Normalmente permite:

- ver un día concreto
- ver todos los días

Cuando se ven todos los días a la vez, el objetivo es comparar el reparto global del viaje.

Cuando se ve un solo día, el objetivo es estudiar la lógica de esa jornada.

---

## 20. Filtros en el planner

El planner también tiene sus propios filtros.

Su función es distinta a la de la ciudad: aquí sirven para trabajar el itinerario, no tanto para descubrir contenido.

### Filtros habituales

- buscador
- ciudad
- prioridad
- puntuación

### Para qué ayudan

- ver solo actividades de una ciudad concreta
- centrarte solo en imprescindibles
- revisar solo actividades bien puntuadas
- localizar rápidamente una actividad concreta

Esto es muy útil cuando el planner crece y ya contiene muchas actividades.

---

## 21. Modo mapa vs modo calendario

Las dos vistas del planner no compiten entre sí. Cada una resuelve un problema distinto.

### Calendario
Útil para:

- decidir reparto por días
- mover actividades
- equilibrar carga
- ver el itinerario como agenda

### Mapa
Útil para:

- validar proximidad
- detectar incoherencias geográficas
- revisar si el orden del día es razonable

La combinación de ambas es uno de los mayores valores de la aplicación.

---

## 22. Administración: para qué sirve

La administración es la zona de mantenimiento y control.

No está pensada para consultar el viaje como turista, sino para gestionar el sistema.

Sus funciones principales son:

- configurar el marco del viaje
- mantener la base de datos de ciudades
- mantener la base de datos de actividades
- mover información dentro y fuera de la app
- proteger el trabajo realizado mediante backup

---

## 23. Configuración del viaje

En esta parte puedes definir parámetros globales del viaje.

### Ejemplos

- fecha de inicio
- fecha de fin
- estilo de enlaces de mapa

### Para qué influye

Estas fechas afectan a:

- el número total de días
- la estructura del planner
- algunos resúmenes y cálculos del viaje

La aplicación valida que la fecha de fin no sea anterior a la de inicio.

---

## 24. Gestión de ciudades

Desde administración puedes editar ciudades existentes y añadir nuevas.

## 24.1 Qué se puede configurar

- ID
- nombre público
- nombre japonés
- color principal
- subtítulo
- descripción
- resumen
- ideal para
- días recomendados
- zonas
- destacados
- centro geográfico

## 24.2 Reordenación de ciudades

La app permite ordenar manualmente las ciudades.

Ese orden se reutiliza en:

- home
- navegación
- listados asociados

Es muy útil si quieres que la app refleje el orden real del viaje o tu prioridad narrativa.

---

## 25. Importación y exportación de actividades

La app permite mover datos de actividades dentro y fuera del sistema.

## 25.1 Excel / CSV

Pensado para trabajo masivo.

Útil para:

- editar muchas actividades fuera de la app
- importar un bloque inicial
- revisar datos de forma tabular

### Qué suele incluir

- identificación
- ciudad
- categoría
- tipo
- prioridad
- zona
- descripción
- dirección
- latitud
- longitud
- duración
- mejor momento
- lluvia
- puntuación
- entrada
- consejos
- comentarios

## 25.2 JSON general

Pensado para copias más completas y fiables.

Sirve para:

- backup integral
- restauración
- traslado de la base de datos a otro entorno

---

## 26. Importación y exportación de planificación

Además del backup general, la app distingue la planificación en sí misma.

Esto es muy importante porque permite mover el estado del planner sin tocar necesariamente toda la base de actividades.

### Qué conserva

- estado de cada actividad
- si está en bandeja
- si está planeada
- el día asignado
- el orden dentro del día

### Comportamiento ante inconsistencias

Si un archivo de planificación hace referencia a actividades que no existen en la base actual:

- esas actividades se ignoran
- la app informa de cuántas no se han importado

Eso es una buena práctica porque evita corromper la planificación o introducir registros sin sentido.

---

## 27. Backups

La app permite guardar y restaurar copias de seguridad.

### Para qué sirven

- no perder trabajo
- duplicar el estado del proyecto
- restaurar si se rompe algo
- experimentar con seguridad

Si vas a hacer cambios importantes en datos, estructura o importaciones, el backup es una práctica muy recomendable.

---

## 28. Uso recomendado por escenarios

## 28.1 Si estás empezando desde cero

1. revisa ciudades en Inicio
2. entra en cada ciudad
3. limpia prioridades
4. asigna algunas actividades a bandeja
5. entra al planner
6. construye los días

## 28.2 Si ya tienes mucha información pero poco orden

1. usa filtros por prioridad y puntuación
2. manda a bandeja solo lo que realmente compite por entrar
3. descarta lo secundario
4. ordena por días
5. usa la vista mapa para corregir incoherencias

## 28.3 Si quieres revisar el viaje por clima

1. entra en una ciudad
2. filtra `Solo lluvia`
3. identifica actividades de reserva
4. llévalas a bandeja o a días más vulnerables

## 28.4 Si quieres rehacer el planner sin perder datos

1. exporta planificación
2. modifica actividades o estados
3. vuelve a importar si lo necesitas
4. restaura backup completo si hiciera falta

---

## 29. Buenas prácticas de uso

Para sacarle el máximo partido a la aplicación, conviene usarla con un poco de método.

### Recomendaciones

- no planifiques todo el mismo día desde el principio
- usa la bandeja como espacio intermedio
- prioriza primero, ordena después
- usa zona y mejor momento antes de decidir el día final
- deja actividades opcionales fuera del núcleo principal
- usa puntuación como apoyo, no como única verdad
- aprovecha el filtro de lluvia para crear planes alternativos
- exporta cuando tengas una versión estable del trabajo

---

## 30. Qué hace especialmente valiosa esta app

Lo más potente no es una sola función aislada, sino la combinación de varias:

- base de datos editable
- filtros prácticos
- estados de planificación
- planner visual
- mapa del planner
- import/export
- administración centralizada

Esa combinación permite que la app acompañe todo el ciclo de preparación del viaje:

- descubrir
- evaluar
- decidir
- ordenar
- revisar
- conservar

---

## 31. Limitaciones funcionales actuales

Aunque la app es muy útil, conviene entender sus límites actuales.

### Algunas limitaciones razonables hoy

- está orientada a un viaje concreto, no a un producto genérico multiusuario
- la persistencia principal vive en el navegador
- no está pensada como red social ni colaboración en tiempo real
- no usa rutas de transporte reales en el planner
- la lógica es de planificación personal, no de reserva o compra integrada

Esto no es un defecto en sí mismo: forma parte de su enfoque.

---

## 32. Sugerencias de mejora y nuevas funcionalidades

A continuación se listan posibles mejoras futuras, clasificadas por prioridad funcional.

## Prioridad alta

### 1. Ordenación de actividades por criterio
Permitir ordenar temporalmente por:

- prioridad
- puntuación
- duración
- zona

Valor:
- ayuda a revisar grandes volúmenes de actividades más rápido

### 2. Toasts y confirmaciones más transversales
Más feedback breve y claro en acciones de administración, importación y edición.

Valor:
- mejora confianza del usuario
- reduce dudas sobre si una acción se ha guardado

### 3. Mejor resumen diario en el planner
Mostrar por día:

- número de actividades
- duración aproximada total
- porcentaje de actividades imprescindibles

Valor:
- ayuda a equilibrar la carga del día

### 4. Vista de conflicto o saturación
Avisar si un día parece demasiado cargado o mezcla zonas excesivamente dispersas.

Valor:
- aporta ayuda real a la calidad del itinerario

### 5. Mejora del sistema de importación con validaciones más visibles
Mostrar errores concretos por fila o registro en vez de solo avisos generales.

Valor:
- ahorra tiempo al corregir datos

## Prioridad media

### 6. Ordenación guardable por usuario o sesión
Guardar preferencias de orden en vistas de ciudad o planner.

Valor:
- hace la exploración más cómoda cuando hay mucha información

### 7. Etiquetas personalizadas
Permitir crear tags propios como:

- “romántico”
- “para cenar”
- “si sobra tiempo”
- “ideal atardecer”

Valor:
- añade una capa muy personal y muy útil

### 8. Vista de “plan B por lluvia”
Pantalla dedicada que recopile automáticamente actividades aptas para lluvia por ciudad o por día.

Valor:
- reduce muchísimo la fricción cuando cambia el clima

### 9. Historial ligero de cambios
Registrar cambios recientes en planner o actividades.

Valor:
- ayuda a deshacer mentalmente decisiones
- da trazabilidad

### 10. Mejoras de compartición
Exportar itinerario en formato más visual o resumido para compartir.

Valor:
- útil para enviarlo a otras personas

## Prioridad baja

### 11. Modo comparativo entre ciudades
Comparar dos ciudades por:

- número de actividades
- imprescindibles
- actividades de lluvia
- carga prevista

### 12. Favoritos explícitos separados del planner
Tener un estado o colección de favoritos más independiente del flujo de bandeja.

### 13. Estadísticas globales del viaje
Panel con métricas agregadas:

- porcentaje planificado
- actividades por ciudad
- tipos predominantes
- media de puntuación

### 14. Temas o personalización visual
Cambios de estética sin tocar datos.

### 15. Preparación para multiusuario o colaboración
Solo tendría sentido si el proyecto evoluciona hacia uso compartido.

---

## 33. Conclusión

Esta aplicación sirve para **transformar la preparación de un viaje complejo en un sistema ordenado, visual y editable**.

No se limita a listar lugares: permite tomar decisiones, estructurar días, conservar trabajo y mejorar el plan iterativamente.

Su mayor valor está en unir:

- contenido útil
- filtros prácticos
- planificación visual
- administración de datos

Usada correctamente, permite pasar de “tengo muchas ideas sueltas” a “tengo un itinerario claro, flexible y reutilizable”.

Si alguien lee esta guía y usa la app siguiendo el flujo recomendado, debería poder:

- entender para qué sirve cada pantalla
- saber cómo registrar y mantener actividades
- organizar un itinerario completo
- adaptar el viaje a prioridades o clima
- exportar y proteger su trabajo

En otras palabras: debería poder sacar utilidad completa a la aplicación.
