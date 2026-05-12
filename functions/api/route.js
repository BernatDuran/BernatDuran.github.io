const ROUTES_API_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const FIELD_MASK = 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline';
const WALKING_MODE = 'walking';

function base64UrlToBytes(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function decodeJwtPart(value) {
  const text = new TextDecoder().decode(base64UrlToBytes(value));
  return JSON.parse(text);
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=UTF-8'
    }
  });
}

function normalizeTeamDomain(teamDomain) {
  return String(teamDomain || '').replace(/\/+$/, '');
}

function parseAllowedEmails(value) {
  return String(value || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function shouldValidateAccess(env) {
  return Boolean(env.ACCESS_TEAM_DOMAIN || env.ACCESS_AUD || env.ALLOWED_EMAILS);
}

function getAccessConfig(env) {
  if (!shouldValidateAccess(env)) {
    return { enabled: false };
  }

  const teamDomain = normalizeTeamDomain(env.ACCESS_TEAM_DOMAIN);
  const audience = String(env.ACCESS_AUD || '').trim();
  const allowedEmails = parseAllowedEmails(env.ALLOWED_EMAILS);

  if (!teamDomain || !audience || allowedEmails.length === 0) {
    return { error: 'Configuracion de Cloudflare Access incompleta.' };
  }

  return {
    enabled: true,
    teamDomain,
    audience,
    allowedEmails
  };
}

function hasAudience(payloadAudience, expectedAudience) {
  if (Array.isArray(payloadAudience)) return payloadAudience.includes(expectedAudience);
  return payloadAudience === expectedAudience;
}

function isJwtTimeValid(payload, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (Number.isFinite(payload.exp) && nowSeconds >= payload.exp) return false;
  if (Number.isFinite(payload.nbf) && nowSeconds < payload.nbf) return false;
  return true;
}

async function verifyAccessJwtSignature(token, config) {
  const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    return { error: 'JWT de Cloudflare Access mal formado.' };
  }

  const header = decodeJwtPart(encodedHeader);
  const payload = decodeJwtPart(encodedPayload);
  if (header.alg !== 'RS256' || !header.kid) {
    return { error: 'JWT de Cloudflare Access con algoritmo no admitido.' };
  }

  const certsResponse = await fetch(`${config.teamDomain}/cdn-cgi/access/certs`);
  if (!certsResponse.ok) {
    return { error: 'No se han podido obtener las claves publicas de Cloudflare Access.' };
  }

  const certs = await certsResponse.json();
  const key = certs.keys?.find((candidate) => candidate.kid === header.kid);
  if (!key) {
    return { error: 'No se ha encontrado la clave publica del JWT de Cloudflare Access.' };
  }

  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    key,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const data = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
  const signature = base64UrlToBytes(encodedSignature);
  const isValid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, signature, data);
  if (!isValid) {
    return { error: 'Firma del JWT de Cloudflare Access no valida.' };
  }

  return { payload };
}

async function validateAccessRequest(request, env) {
  const config = getAccessConfig(env);
  if (!config.enabled && !config.error) return null;
  if (config.error) return jsonResponse({ error: config.error }, 500);

  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token) {
    return jsonResponse({ error: 'Falta el JWT de Cloudflare Access.' }, 401);
  }

  try {
    const verified = await verifyAccessJwtSignature(token, config);
    if (verified.error) return jsonResponse({ error: verified.error }, 403);

    const payload = verified.payload;
    const email = String(payload.email || '').toLowerCase();
    if (payload.iss !== config.teamDomain || !hasAudience(payload.aud, config.audience) || !isJwtTimeValid(payload)) {
      return jsonResponse({ error: 'JWT de Cloudflare Access no autorizado.' }, 403);
    }

    if (!email || !config.allowedEmails.includes(email)) {
      return jsonResponse({ error: 'Email no autorizado para calcular rutas.' }, 403);
    }
  } catch {
    return jsonResponse({ error: 'No se ha podido validar Cloudflare Access.' }, 403);
  }

  return null;
}

function parseCoordinate(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return { error: `El parametro ${label} debe ser numerico.` };
  }

  return { value: parsed };
}

function validateLatLng(lat, lng, latLabel, lngLabel) {
  if (lat < -90 || lat > 90) {
    return `El parametro ${latLabel} debe estar entre -90 y 90.`;
  }

  if (lng < -180 || lng > 180) {
    return `El parametro ${lngLabel} debe estar entre -180 y 180.`;
  }

  return null;
}

function parseDurationSeconds(duration) {
  if (typeof duration !== 'string') return null;
  const match = duration.match(/^([0-9]+(?:\.[0-9]+)?)s$/);
  if (!match) return null;
  return Math.round(Number.parseFloat(match[1]));
}

function getValidatedParams(url, env) {
  const mode = (url.searchParams.get('mode') || env.DEFAULT_ROUTE_MODE || WALKING_MODE).toLowerCase();
  if (mode !== WALKING_MODE) {
    return { error: 'Solo se admite mode=walking.' };
  }

  const fromLatResult = parseCoordinate(url.searchParams.get('fromLat'), 'fromLat');
  if (fromLatResult.error) return { error: fromLatResult.error };

  const fromLngResult = parseCoordinate(url.searchParams.get('fromLng'), 'fromLng');
  if (fromLngResult.error) return { error: fromLngResult.error };

  const toLatResult = parseCoordinate(url.searchParams.get('toLat'), 'toLat');
  if (toLatResult.error) return { error: toLatResult.error };

  const toLngResult = parseCoordinate(url.searchParams.get('toLng'), 'toLng');
  if (toLngResult.error) return { error: toLngResult.error };

  const rangeError = validateLatLng(fromLatResult.value, fromLngResult.value, 'fromLat', 'fromLng')
    || validateLatLng(toLatResult.value, toLngResult.value, 'toLat', 'toLng');

  if (rangeError) {
    return { error: rangeError };
  }

  return {
    value: {
      mode,
      fromLat: fromLatResult.value,
      fromLng: fromLngResult.value,
      toLat: toLatResult.value,
      toLng: toLngResult.value
    }
  };
}

function buildGoogleRequestBody(params, env) {
  return {
    origin: {
      location: {
        latLng: {
          latitude: params.fromLat,
          longitude: params.fromLng
        }
      }
    },
    destination: {
      location: {
        latLng: {
          latitude: params.toLat,
          longitude: params.toLng
        }
      }
    },
    travelMode: 'WALK',
    languageCode: env.DEFAULT_LANGUAGE || 'es',
    units: env.DEFAULT_UNITS || 'METRIC'
  };
}

async function handleRouteRequest(request, env) {
  const accessError = await validateAccessRequest(request, env);
  if (accessError) return accessError;

  if (!env.GOOGLE_ROUTES_API_KEY) {
    return jsonResponse({ error: 'Cloudflare Pages no tiene configurada la API key de Google Routes.' }, 500);
  }

  const url = new URL(request.url);
  const validated = getValidatedParams(url, env);
  if (validated.error) {
    return jsonResponse({ error: validated.error }, 400);
  }

  const upstreamResponse = await fetch(ROUTES_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': env.GOOGLE_ROUTES_API_KEY,
      'x-goog-fieldmask': FIELD_MASK
    },
    body: JSON.stringify(buildGoogleRequestBody(validated.value, env))
  });

  if (!upstreamResponse.ok) {
    return jsonResponse(
      { error: 'Google Routes no ha podido calcular la ruta.' },
      upstreamResponse.status >= 400 && upstreamResponse.status < 500 ? 502 : 500
    );
  }

  const data = await upstreamResponse.json();
  const route = data?.routes?.[0];
  const durationSeconds = parseDurationSeconds(route?.duration);
  const distanceMeters = Number.isFinite(route?.distanceMeters) ? route.distanceMeters : null;
  const encodedPolyline = route?.polyline?.encodedPolyline || null;

  if (!route || durationSeconds == null || distanceMeters == null || !encodedPolyline) {
    return jsonResponse({ error: 'La respuesta de Google Routes no contiene todos los campos esperados.' }, 502);
  }

  return jsonResponse({
    mode: WALKING_MODE,
    durationSeconds,
    distanceMeters,
    encodedPolyline
  });
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Metodo no permitido.' }, 405);
  }

  try {
    return await handleRouteRequest(request, env);
  } catch {
    return jsonResponse({ error: 'Error interno al calcular la ruta.' }, 500);
  }
}
