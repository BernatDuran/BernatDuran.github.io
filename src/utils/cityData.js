export function normalizeCityRecord(city, fallbackOrder = 999) {
  const parsedOrder = Number.parseInt(city?.sortOrder, 10);
  const sortOrder = Number.isFinite(parsedOrder) ? parsedOrder : fallbackOrder;

  return {
    ...city,
    sortOrder
  };
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
