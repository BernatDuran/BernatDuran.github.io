export const PLACE_IMPORT_EXPORT_FIELDS = [
  'id',
  'name',
  'cityId',
  'category',
  'type',
  'priority',
  'zone',
  'description',
  'address',
  'lat',
  'lng',
  'estimatedDuration',
  'bestTime',
  'rainyFriendly',
  'score',
  'requiresTicket',
  'ticketInfo',
  'tips',
  'comment'
];

export const BEST_TIME_OPTIONS = [
  { value: 'mañana', label: 'Mañana' },
  { value: 'tarde', label: 'Tarde' },
  { value: 'noche', label: 'Noche' },
  { value: 'cualquier-momento', label: 'Cualquier momento' }
];

const BEST_TIME_LABELS = Object.fromEntries(BEST_TIME_OPTIONS.map((option) => [option.value, option.label]));
const SUSPICIOUS_MOJIBAKE_PATTERN = /[\u00c3\u00c2\u00c5\u00c6\u00e6\u00f0]/;
const LEGACY_MOJIBAKE_MORNING = 'ma\u00e3\u00b1ana';
const REPLACEMENT_CHARACTER = '\uFFFD';

export function repairMojibakeText(value) {
  if (typeof value !== 'string') return value;
  if (!SUSPICIOUS_MOJIBAKE_PATTERN.test(value)) return value;

  try {
    const bytes = Uint8Array.from(Array.from(value, (char) => char.charCodeAt(0) & 0xff));
    const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    if (!decoded) return value;
    if (decoded.includes(REPLACEMENT_CHARACTER) && !value.includes(REPLACEMENT_CHARACTER)) return value;
    return decoded;
  } catch {
    return value;
  }
}

function normalizeBoolean(value) {
  if (value === '' || value == null) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;

  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'si', 'yes'].includes(normalized)) return true;
  if (['false', '0', 'no'].includes(normalized)) return false;
  return null;
}

export function normalizeScoreValue(score) {
  const clampScore = (value) => (Number.isFinite(value) && value >= 1 && value <= 10 ? value : null);

  if (score == null || score === '') return null;

  if (typeof score === 'number') {
    return clampScore(score);
  }

  if (typeof score === 'string') {
    const trimmed = score.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return normalizeScoreValue(JSON.parse(trimmed));
      } catch {
        return null;
      }
    }

    const parsed = Number.parseFloat(trimmed.replace(',', '.'));
    return clampScore(parsed);
  }

  if (typeof score === 'object') {
    if ('chat' in score) return normalizeScoreValue(score.chat);
    return null;
  }

  return null;
}

export function normalizeBestTimeValue(value) {
  if (value == null || value === '') return 'cualquier-momento';

  const raw = String(value).trim().toLowerCase();
  const normalized = raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (!normalized) return 'cualquier-momento';
  if (raw.includes('mañana') || raw.includes(LEGACY_MOJIBAKE_MORNING) || normalized.includes('manana') || normalized.includes('madrugada')) return 'mañana';
  if (raw.includes('atardecer') || raw.includes('tarde') || raw.includes('almuerzo') || normalized.includes('atardecer') || normalized.includes('tarde') || normalized.includes('almuerzo')) return 'tarde';
  if (raw.includes('noche') || raw.includes('nocturno') || raw.includes('cena') || normalized.includes('noche') || normalized.includes('nocturno') || normalized.includes('cena')) return 'noche';
  if (raw.includes('cualquier') || raw.includes('todo el d') || normalized.includes('cualquier') || normalized.includes('todo el dia')) return 'cualquier-momento';
  return 'cualquier-momento';
}

export function formatBestTimeLabel(value) {
  return BEST_TIME_LABELS[normalizeBestTimeValue(value)] || 'Cualquier momento';
}

export function getPlaceLatLng(place) {
  const parseCoordinate = (value) => (value === '' || value == null ? null : Number.parseFloat(value));
  const lat = parseCoordinate(place?.lat);
  const lng = parseCoordinate(place?.lng);

  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };

  const legacyLat = parseCoordinate(place?.coordinates?.lat);
  const legacyLng = parseCoordinate(place?.coordinates?.lng);

  return Number.isFinite(legacyLat) && Number.isFinite(legacyLng) ? { lat: legacyLat, lng: legacyLng } : null;
}

export function normalizePlaceRecord(place) {
  const { source: _legacySource, coordinates: _legacyCoordinates, ...rest } = place || {};
  const latLng = getPlaceLatLng(place);
  const rainyFriendly = normalizeBoolean(rest?.rainyFriendly);
  const requiresTicket = normalizeBoolean(rest?.requiresTicket);

  return {
    ...rest,
    name: repairMojibakeText(rest?.name || ''),
    type: repairMojibakeText(rest?.type || ''),
    priority: rest?.priority || 'optional',
    score: normalizeScoreValue(rest?.score),
    rainyFriendly: rainyFriendly ?? false,
    requiresTicket: requiresTicket ?? false,
    zone: repairMojibakeText(rest?.zone || ''),
    description: repairMojibakeText(rest?.description || ''),
    address: repairMojibakeText(rest?.address || '') || null,
    estimatedDuration: repairMojibakeText(rest?.estimatedDuration || '') || null,
    bestTime: normalizeBestTimeValue(rest?.bestTime),
    ticketInfo: repairMojibakeText(rest?.ticketInfo || '') || null,
    tips: repairMojibakeText(rest?.tips || '') || null,
    comment: repairMojibakeText(rest?.comment || '') || null,
    lat: latLng?.lat ?? null,
    lng: latLng?.lng ?? null
  };
}

export function toImportExportRow(place) {
  const normalized = normalizePlaceRecord(place);
  return {
    id: normalized.id || '',
    name: normalized.name || '',
    cityId: normalized.cityId || '',
    category: normalized.category || '',
    type: normalized.type || '',
    priority: normalized.priority || '',
    zone: normalized.zone || '',
    description: normalized.description || '',
    address: normalized.address || '',
    lat: normalized.lat ?? '',
    lng: normalized.lng ?? '',
    estimatedDuration: normalized.estimatedDuration || '',
    bestTime: normalized.bestTime || 'cualquier-momento',
    rainyFriendly: normalized.rainyFriendly ? 'true' : 'false',
    score: normalized.score ?? '',
    requiresTicket: normalized.requiresTicket ? 'true' : 'false',
    ticketInfo: normalized.ticketInfo || '',
    tips: normalized.tips || '',
    comment: normalized.comment || ''
  };
}
