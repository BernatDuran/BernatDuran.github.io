const ROUTES_API_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const FIELD_MASK = 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline';
const WALKING_MODE = 'walking';

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=UTF-8'
    }
  });
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
