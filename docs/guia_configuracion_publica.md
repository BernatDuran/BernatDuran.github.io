# Guía de configuración pública

Esta guía explica cómo clonar, ejecutar y desplegar esta aplicación sin usar claves privadas de otra persona y sin publicar secretos en GitHub.

El proyecto está pensado para funcionar de dos formas:

- Como demo pública sin API real en GitHub Pages.
- Como app privada con rutas reales a pie usando Cloudflare Pages, Cloudflare Access y Google Routes API.

## 1. Requisitos

Antes de empezar, necesitas:

- Cuenta de GitHub.
- Node.js instalado.
- Cuenta de Cloudflare.
- Cuenta de Google Cloud si quieres activar rutas reales.
- Un navegador moderno.

No necesitas ninguna clave privada del autor original del repositorio. Cada persona debe crear sus propias credenciales.

## 2. Clonar el repositorio

```bash
git clone https://github.com/BernatDuran/BernatDuran.github.io.git
cd BernatDuran.github.io
```

Instala dependencias:

```bash
npm install
```

Ejecuta la app localmente:

```bash
npm run dev
```

Abre:

```txt
http://localhost:5173/
http://localhost:5173/planner.html
http://localhost:5173/admin.html
```

## 3. Funcionamiento sin rutas reales

La aplicación puede usarse sin configurar Google Routes API.

En ese caso:

- La app carga normalmente.
- El planner sigue funcionando.
- Los datos se guardan localmente en el navegador.
- Las rutas reales a pie no se calcularán.
- Pueden aparecer tramos pendientes o estimaciones lineales.

Esta modalidad es suficiente para probar la app, revisar la estructura y preparar un itinerario básico sin coste API.

## 4. Rutas reales a pie

La app privada calcula rutas a pie mediante:

```txt
/api/route
```

Ese endpoint vive en:

```txt
functions/api/route.js
```

La API key de Google no se incluye en el navegador ni en el repositorio. Debe configurarse como secreto en Cloudflare Pages.

## 5. Configurar Google Cloud

Solo necesitas esta parte si quieres calcular rutas reales.

Pasos recomendados:

1. Crear un proyecto en Google Cloud.
2. Activar Google Routes API.
3. Crear una API key específica para este proyecto.
4. Restringir la API key para que solo pueda usar Google Routes API.
5. No copiar la API key en archivos del repositorio.
6. No publicarla en GitHub, issues, capturas ni mensajes.
7. Activar alertas de presupuesto o consumo si tu cuenta lo permite.

Buenas prácticas importantes:

- No incluir API keys en código cliente.
- No commitear API keys.
- No pasar la key a Google APIs como query parameter.
- Usar la cabecera `x-goog-api-key`, como hace este proyecto desde la Function.
- Rotar la key si se sospecha que se ha expuesto.

## 6. Configurar Cloudflare Pages

Cloudflare Pages será el entorno recomendado para la app privada.

Configuración esperada:

| Campo | Valor |
|---|---|
| Repository | Tu fork o clon del repositorio |
| Production branch | `main` |
| Build command | `npm run build` |
| Build output directory | `dist` |

Cloudflare Pages puede conectarse a GitHub y desplegar automáticamente cuando se empuja una rama configurada.

## 7. Variables y secretos en Cloudflare Pages

En Cloudflare:

```txt
Workers & Pages -> Tu proyecto -> Settings -> Variables and Secrets
```

Configura estas variables para producción:

| Nombre | Tipo recomendado | Ejemplo |
|---|---|---|
| `GOOGLE_ROUTES_API_KEY` | Secret | Tu API key de Google Routes |
| `DEFAULT_ROUTE_MODE` | Variable | `walking` |
| `DEFAULT_LANGUAGE` | Variable | `es` |
| `DEFAULT_UNITS` | Variable | `METRIC` |
| `ACCESS_TEAM_DOMAIN` | Variable | `https://<team>.cloudflareaccess.com` |
| `ACCESS_AUD` | Variable | Application Audience Tag de Access |
| `ALLOWED_EMAILS` | Variable | `email1@gmail.com,email2@gmail.com` |

`GOOGLE_ROUTES_API_KEY` debe guardarse como secreto cifrado.

El resto de valores no son claves privadas, pero conviene tratarlos como configuración de servidor y no depender de valores hardcodeados en cliente.

## 8. Configurar Cloudflare Access

Cloudflare Access protege la app privada con login.

Configuración recomendada:

| Campo | Valor |
|---|---|
| Tipo de aplicación | Self-hosted |
| Dominio | Tu dominio de Cloudflare Pages |
| Identity provider | Google |
| Política | Allow |
| Include | Emails exactos |
| Restricción por país/IP | No recomendada para viajes |

Usa emails exactos, no dominios completos como `@gmail.com`.

Ejemplo:

```txt
persona1@gmail.com
persona2@gmail.com
```

Con esta configuración, la app puede usarse desde móvil, portátil, Barcelona, Japón, hoteles, eSIM o WiFi público sin depender de IPs fijas.

## 9. Validación de `/api/route`

El endpoint `/api/route` valida Cloudflare Access si detecta estas variables:

```txt
ACCESS_TEAM_DOMAIN
ACCESS_AUD
ALLOWED_EMAILS
```

Si se configura cualquiera de ellas, deben configurarse todas.

La Function valida:

- JWT de Cloudflare Access.
- Firma del token.
- Issuer.
- Audience.
- Caducidad.
- Email permitido.

Solo después de esa validación llama a Google Routes API.

## 10. Desarrollo local con rutas reales

Para desarrollo local avanzado con Pages Functions, puedes usar Wrangler.

Los secretos locales deben vivir en archivos ignorados por Git:

```txt
.dev.vars
.env.local
```

No se deben commitear.

Ejemplo orientativo:

```txt
GOOGLE_ROUTES_API_KEY=tu_clave_local
DEFAULT_ROUTE_MODE=walking
DEFAULT_LANGUAGE=es
DEFAULT_UNITS=METRIC
```

Para desarrollo local sin Access, puedes omitir:

```txt
ACCESS_TEAM_DOMAIN
ACCESS_AUD
ALLOWED_EMAILS
```

En producción privada, si quieres defensa adicional del endpoint, sí deben configurarse.

## 11. GitHub Pages y beta pública

Este repositorio separa dos usos:

| Entorno | Rama | Uso |
|---|---|---|
| GitHub Pages | `beta-public` | Demo pública congelada |
| Cloudflare Pages | `main` | App privada real |

GitHub Pages no debe usarse para la app privada con API real.

La beta pública sirve para compartir una vista estable del proyecto sin exponer claves ni endpoints privados.

## 12. Seguridad antes de publicar

Antes de hacer público un fork o compartir un repositorio:

```bash
git status
rg -n "AIza|GOOGLE_ROUTES_API_KEY|ACCESS_AUD|ACCESS_TEAM_DOMAIN|ALLOWED_EMAILS|API_KEY|SECRET|TOKEN" .
```

Comprueba:

- No hay archivos `.env` versionados.
- No hay archivos `.dev.vars` versionados.
- No hay API keys en código.
- No hay tokens en documentación.
- No hay secretos en issues o capturas.
- La key de Google está restringida a la API necesaria.

## 13. Despliegue recomendado

Secuencia recomendada:

1. Clonar o hacer fork del repositorio.
2. Ejecutar localmente con `npm install` y `npm run dev`.
3. Crear proyecto propio en Google Cloud si se quieren rutas reales.
4. Crear y restringir API key.
5. Crear proyecto en Cloudflare Pages.
6. Configurar variables y secretos.
7. Configurar Cloudflare Access con emails exactos.
8. Desplegar desde `main`.
9. Probar acceso con email permitido.
10. Probar acceso con email no permitido.
11. Confirmar que `/api/route` no funciona sin login válido.

## 14. Problemas frecuentes

| Problema | Posible causa | Solución |
|---|---|---|
| La app carga pero no calcula rutas | Falta `GOOGLE_ROUTES_API_KEY` | Configurar secreto en Cloudflare Pages |
| `/api/route` devuelve 401 | Falta JWT de Access | Entrar por la URL protegida de Cloudflare |
| `/api/route` devuelve 403 | Email no permitido o Access mal configurado | Revisar `ALLOWED_EMAILS`, `ACCESS_AUD` y Access policy |
| Google devuelve error | API no habilitada o key sin permisos | Revisar Google Routes API y restricciones |
| En GitHub Pages se ve una versión inesperada | Caché o workflow de Pages | Probar incógnito y revisar GitHub Actions |
| Los datos no aparecen en otro navegador | IndexedDB es local | Exportar/importar backup desde la app |

## 15. Coste y responsabilidad

Cada persona que despliegue la app con rutas reales debe usar su propia cuenta de Google Cloud y su propia API key.

El autor original del repositorio no proporciona claves ni asume consumo API de terceros.

Si se habilitan rutas reales:

- Revisa facturación.
- Activa alertas de presupuesto cuando sea posible.
- Mantén la API key restringida.
- No compartas el entorno privado sin Access.
- Evita endpoints públicos sin autenticación.

## 16. Referencias oficiales

- Cloudflare Pages, GitHub integration: https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/
- Cloudflare Pages, build configuration: https://developers.cloudflare.com/pages/configuration/build-configuration/
- Cloudflare Pages Functions, variables y secrets: https://developers.cloudflare.com/pages/functions/bindings/
- Cloudflare Access policies: https://developers.cloudflare.com/cloudflare-one/policies/access/
- Google Cloud, API key best practices: https://cloud.google.com/docs/authentication/api-keys-best-practices
