import { normalizeBestTimeValue, normalizeScoreValue } from './placeData.js';

export const icons = {
  search: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><circle cx="11" cy="11" r="8"/><path stroke-linecap="round" d="m21 21-4.35-4.35"/></svg>`,
  heart: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"/></svg>`,
  heartFilled: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z"/></svg>`,
  arrowRight: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"/></svg>`,
  arrowLeft: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"/></svg>`,
  chevronDown: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5"/></svg>`,
  chevronUp: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5"/></svg>`,
  mapPin: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0 1 15 0Z"/></svg>`,
  clock: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>`,
  menu: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"/></svg>`,
  close: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>`,
  ticket: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z"/></svg>`,
  map: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z"/></svg>`,
};

export function formatScore(score) {
  const normalized = normalizeScoreValue(score);
  if (normalized == null) return null;
  return `${normalized}/10`;
}

export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}

function normalizeDurationText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replaceAll(',', '.')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ');
}

function convertDurationValueToMinutes(value, unit) {
  if (!Number.isFinite(value)) return null;

  if (unit === 'hours') return value * 60;
  if (unit === 'minutes') return value;
  return null;
}

function normalizeDurationUnit(rawUnit) {
  const unit = String(rawUnit ?? '').trim().toLowerCase();
  if (!unit) return null;

  if (['h', 'hr', 'hrs', 'hora', 'horas', 'hor', 'hour', 'hours'].includes(unit)) return 'hours';
  if (['m', 'min', 'mins', 'minuto', 'minutos', 'minute', 'minutes'].includes(unit)) return 'minutes';
  return null;
}

function parseUnitBasedRange(text) {
  const match = text.match(
    /^\s*(\d+(?:\.\d+)?)\s*(h|hr|hrs|hora|horas|hor|hour|hours|m|min|mins|minuto|minutos|minute|minutes)?\s*-\s*(\d+(?:\.\d+)?)\s*(h|hr|hrs|hora|horas|hor|hour|hours|m|min|mins|minuto|minutos|minute|minutes)?\s*$/
  );
  if (!match) return null;

  const leftValue = Number.parseFloat(match[1]);
  const rightValue = Number.parseFloat(match[3]);
  let leftUnit = normalizeDurationUnit(match[2]);
  let rightUnit = normalizeDurationUnit(match[4]);

  if (!leftUnit && rightUnit) leftUnit = rightUnit;
  if (!rightUnit && leftUnit) rightUnit = leftUnit;

  const leftMinutes = convertDurationValueToMinutes(leftValue, leftUnit);
  const rightMinutes = convertDurationValueToMinutes(rightValue, rightUnit);

  if (!Number.isFinite(leftMinutes) || !Number.isFinite(rightMinutes)) return null;
  return (leftMinutes + rightMinutes) / 2;
}

function parseExplicitDurationTokens(text) {
  const tokenRegex = /(\d+(?:\.\d+)?)\s*(h|hr|hrs|hora|horas|hor|hour|hours|m|min|mins|minuto|minutos|minute|minutes)\b/g;
  let match;
  let totalMinutes = 0;
  let found = false;

  while ((match = tokenRegex.exec(text)) !== null) {
    const value = Number.parseFloat(match[1]);
    const unit = normalizeDurationUnit(match[2]);
    const minutes = convertDurationValueToMinutes(value, unit);
    if (!Number.isFinite(minutes)) continue;
    totalMinutes += minutes;
    found = true;
  }

  return found ? totalMinutes : null;
}

function parseUnitlessDuration(text) {
  const singleMatch = text.match(/^\s*(\d+(?:\.\d+)?)\s*$/);
  if (singleMatch) {
    const minutes = Number.parseFloat(singleMatch[1]);
    if (minutes > 15 && minutes < 600) return minutes;
    return null;
  }

  const rangeMatch = text.match(/^\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*$/);
  if (rangeMatch) {
    const start = Number.parseFloat(rangeMatch[1]);
    const end = Number.parseFloat(rangeMatch[2]);
    if (start > 15 && start < 600 && end > 15 && end < 600) {
      return (start + end) / 2;
    }
  }

  return null;
}

export function parseEstimatedDurationToMinutes(value) {
  const normalized = normalizeDurationText(value);
  if (!normalized) return null;

  const rangeMinutes = parseUnitBasedRange(normalized);
  if (Number.isFinite(rangeMinutes)) return rangeMinutes;

  const tokenMinutes = parseExplicitDurationTokens(normalized);
  if (Number.isFinite(tokenMinutes)) return tokenMinutes;

  const unitlessMinutes = parseUnitlessDuration(normalized);
  if (Number.isFinite(unitlessMinutes)) return unitlessMinutes;

  return null;
}

export function formatDurationMinutes(totalMinutes, options = {}) {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return null;

  const roundedMinutes = options.approximate
    ? Math.max(5, Math.round(totalMinutes / 5) * 5)
    : Math.round(totalMinutes);

  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;

  if (hours > 0 && minutes > 0) return `${hours} h ${minutes} min`;
  if (hours > 0) return `${hours} h`;
  return `${minutes} min`;
}

export function getTimeIcon(timeStr) {
  const normalized = normalizeBestTimeValue(timeStr);
  if (normalized === 'noche') return '\u{1F319}';
  if (normalized === 'tarde') return '\u{1F307}';
  return '\u2600\uFE0F';
}

