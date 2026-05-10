export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatPlaceScore(place, formatScore) {
  if (typeof formatScore === 'function') return formatScore(place?.score);
  return place?.score == null ? '' : `${place.score}/10`;
}

export function getPlaceCategory(place, categories = []) {
  return categories.find((category) => category.id === place?.category) || null;
}

export function getPlacePriority(place, priorityLabels = {}) {
  return priorityLabels[place?.priority] || null;
}

export function getPlannerStatusConfig(plannerItem) {
  const status = plannerItem?.status || '';
  const day = plannerItem?.assignedDay;
  if (status === 'planned') return { label: day ? `Dia ${day}` : 'Planificada', className: 'is-planned' };
  if (status === 'done') return { label: 'Realizada', className: 'is-done' };
  if (status === 'discarded') return { label: 'Descartada', className: 'is-discarded' };
  if (status === 'in-tray') return { label: 'En bandeja', className: 'is-tray' };
  return null;
}

export function getCityDisplayName(cityId, citiesArray = []) {
  return citiesArray.find((city) => city.id === cityId)?.name || cityId || 'Japon';
}
