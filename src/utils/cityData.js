function normalizeRecommendedDaysValue(value) {
  const stringValue = String(value ?? '').trim();
  if (!stringValue) return '3 días';
  return stringValue;
}

export function normalizeCityRecord(city, fallbackOrder = 999) {
  const parsedOrder = Number.parseInt(city?.sortOrder, 10);
  const sortOrder = Number.isFinite(parsedOrder) ? parsedOrder : fallbackOrder;

  return {
    ...city,
    recommendedDays: normalizeRecommendedDaysValue(city?.recommendedDays),
    sortOrder
  };
}

export function formatRecommendedDays(value) {
  const normalized = normalizeRecommendedDaysValue(value);
  return /\bd[ií]a/.test(normalized.toLowerCase()) ? normalized : `${normalized} días`;
}

export function sortCities(cities = []) {
  return cities
    .map((city, index) => normalizeCityRecord(city, index))
    .sort((a, b) => {
      const orderDiff = (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
      if (orderDiff !== 0) return orderDiff;
      return String(a.name || '').localeCompare(String(b.name || ''), 'es');
    });
}
