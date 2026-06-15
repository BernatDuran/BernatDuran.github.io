import { getPlaceLatLng, repairMojibakeText } from './placeData.js';

export const LOCATION_KINDS = [
  { id: 'accommodation', label: 'Alojamiento', icon: '\u{1F3E8}' },
  { id: 'transport', label: 'Transporte', icon: '\u{1F689}' }
];

export const LOCATION_SUBTYPES = {
  accommodation: [
    { id: 'hotel', label: 'Hotel' },
    { id: 'ryokan', label: 'Ryokan' },
    { id: 'apartment', label: 'Apartamento' },
    { id: 'hostel', label: 'Hostal' },
    { id: 'other-accommodation', label: 'Otro alojamiento' }
  ],
  transport: [
    { id: 'train-station', label: 'Estacion de tren' },
    { id: 'metro-station', label: 'Estacion de metro' },
    { id: 'bus-station', label: 'Estacion de autobus' },
    { id: 'airport', label: 'Aeropuerto' },
    { id: 'ferry-terminal', label: 'Terminal de ferry' },
    { id: 'other-transport', label: 'Otro transporte' }
  ]
};

export const TRAVEL_MODES = [
  { id: 'walking', label: 'A pie', icon: '\u{1F6B6}' },
  { id: 'metro', label: 'Metro', icon: '\u{1F687}' },
  { id: 'train', label: 'Tren', icon: '\u{1F686}' },
  { id: 'bus', label: 'Autobus', icon: '\u{1F68C}' },
  { id: 'taxi', label: 'Taxi', icon: '\u{1F695}' },
  { id: 'car', label: 'Coche', icon: '\u{1F697}' },
  { id: 'other', label: 'Otro', icon: '\u{1F500}' }
];

const LOCATION_KIND_IDS = new Set(LOCATION_KINDS.map((kind) => kind.id));
const TRAVEL_MODE_IDS = new Set(TRAVEL_MODES.map((mode) => mode.id));

function parseNullableInteger(value) {
  if (value === '' || value == null) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeTravelMode(value) {
  const normalized = String(value || 'walking').trim().toLowerCase();
  return TRAVEL_MODE_IDS.has(normalized) ? normalized : 'walking';
}

export function getTravelModeConfig(value) {
  const mode = normalizeTravelMode(value);
  return TRAVEL_MODES.find((entry) => entry.id === mode) || TRAVEL_MODES[0];
}

export function getLocationKindConfig(value) {
  return LOCATION_KINDS.find((entry) => entry.id === value) || LOCATION_KINDS[0];
}

export function getLocationSubtypeLabel(kind, subtype) {
  return LOCATION_SUBTYPES[kind]?.find((entry) => entry.id === subtype)?.label
    || String(subtype || '').trim()
    || getLocationKindConfig(kind).label;
}

export function normalizeLocationRecord(location = {}) {
  const kind = LOCATION_KIND_IDS.has(location.kind) ? location.kind : 'accommodation';
  const latLng = getPlaceLatLng(location);
  const active = location.active !== false && String(location.active).toLowerCase() !== 'false';

  return {
    id: String(location.id || '').trim(),
    name: repairMojibakeText(String(location.name || '').trim()),
    kind,
    subtype: String(location.subtype || LOCATION_SUBTYPES[kind]?.[0]?.id || '').trim(),
    cityId: String(location.cityId || '').trim() || null,
    address: repairMojibakeText(String(location.address || '').trim()) || null,
    lat: latLng?.lat ?? null,
    lng: latLng?.lng ?? null,
    notes: repairMojibakeText(String(location.notes || '').trim()) || null,
    active
  };
}

export function normalizeDayPlanRecord(dayPlan = {}) {
  return {
    day: Number.parseInt(dayPlan.day, 10),
    startLocationId: String(dayPlan.startLocationId || '').trim() || null,
    endLocationId: String(dayPlan.endLocationId || '').trim() || null,
    endTravelModeFromPrevious: normalizeTravelMode(dayPlan.endTravelModeFromPrevious)
  };
}

export function normalizePlannerStopRecord(stop = {}) {
  return {
    id: String(stop.id || '').trim(),
    locationId: String(stop.locationId || '').trim(),
    assignedDay: Number.parseInt(stop.assignedDay, 10),
    order: Number.isFinite(Number(stop.order)) ? Number(stop.order) : 0,
    purpose: repairMojibakeText(String(stop.purpose || '').trim()) || null,
    note: repairMojibakeText(String(stop.note || '').trim()) || null,
    durationMinutes: parseNullableInteger(stop.durationMinutes),
    travelModeFromPrevious: normalizeTravelMode(stop.travelModeFromPrevious)
  };
}

export function createPlannerStopId() {
  if (globalThis.crypto?.randomUUID) return `stop-${globalThis.crypto.randomUUID()}`;
  return `stop-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createLocationId(name, existingIds = []) {
  const base = String(name || 'ubicacion')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'ubicacion';
  const used = new Set(existingIds);
  let candidate = `location-${base}`;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `location-${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export function locationToPlace(location = {}) {
  const normalized = normalizeLocationRecord(location);
  const kindConfig = getLocationKindConfig(normalized.kind);
  return {
    id: `location:${normalized.id}`,
    sourceLocationId: normalized.id,
    entityType: 'location',
    plannerKind: normalized.kind,
    name: normalized.name,
    cityId: normalized.cityId,
    category: null,
    type: getLocationSubtypeLabel(normalized.kind, normalized.subtype),
    priority: 'optional',
    zone: kindConfig.label,
    description: normalized.notes || '',
    address: normalized.address,
    lat: normalized.lat,
    lng: normalized.lng,
    estimatedDuration: null,
    bestTime: 'cualquier-momento',
    rainyFriendly: true,
    score: null,
    requiresTicket: false,
    ticketInfo: null,
    tips: null,
    comment: normalized.notes
  };
}

export function validateLocationRecord(location = {}) {
  const rawHasLat = location.lat !== '' && location.lat != null;
  const rawHasLng = location.lng !== '' && location.lng != null;
  if (rawHasLat !== rawHasLng) return 'Latitud y longitud deben informarse juntas.';

  const normalized = normalizeLocationRecord(location);
  if (!normalized.id || !normalized.name) return 'El ID y el nombre son obligatorios.';
  const hasLat = normalized.lat != null;
  const hasLng = normalized.lng != null;
  if (hasLat && (normalized.lat < -90 || normalized.lat > 90)) return 'La latitud debe estar entre -90 y 90.';
  if (hasLng && (normalized.lng < -180 || normalized.lng > 180)) return 'La longitud debe estar entre -180 y 180.';
  return null;
}
