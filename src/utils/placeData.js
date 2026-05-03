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
  if (raw.includes('mañana') || raw.includes('maã±ana') || normalized.includes('manana') || normalized.includes('madrugada')) return 'mañana';
  if (raw.includes('atardecer') || raw.includes('tarde') || raw.includes('almuerzo') || normalized.includes('atardecer') || normalized.includes('tarde') || normalized.includes('almuerzo')) return 'tarde';
  if (raw.includes('noche') || raw.includes('nocturno') || raw.includes('cena') || normalized.includes('noche') || normalized.includes('nocturno') || normalized.includes('cena')) return 'noche';
  if (raw.includes('cualquier') || raw.includes('todo el d') || normalized.includes('cualquier') || normalized.includes('todo el dia')) return 'cualquier-momento';
  return 'cualquier-momento';
}

export function formatBestTimeLabel(value) {
  return BEST_TIME_LABELS[normalizeBestTimeValue(value)] || 'Cualquier momento';
}

export function normalizePlaceRecord(place) {
  const { source: _legacySource, ...rest } = place || {};
  const latSource = rest?.lat ?? rest?.coordinates?.lat;
  const lngSource = rest?.lng ?? rest?.coordinates?.lng;
  const lat = latSource === '' || latSource == null ? null : Number.parseFloat(latSource);
  const lng = lngSource === '' || lngSource == null ? null : Number.parseFloat(lngSource);
  const rainyFriendly = normalizeBoolean(rest?.rainyFriendly);
  const requiresTicket = normalizeBoolean(rest?.requiresTicket);

  return {
    ...rest,
    priority: rest?.priority || 'optional',
    score: normalizeScoreValue(rest?.score),
    rainyFriendly: rainyFriendly ?? false,
    requiresTicket: requiresTicket ?? false,
    address: rest?.address || null,
    estimatedDuration: rest?.estimatedDuration || null,
    bestTime: normalizeBestTimeValue(rest?.bestTime),
    ticketInfo: rest?.ticketInfo || null,
    tips: rest?.tips || null,
    comment: rest?.comment || null,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    coordinates: Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
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
