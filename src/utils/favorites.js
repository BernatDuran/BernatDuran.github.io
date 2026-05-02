const STORAGE_KEY = 'japan-guide-favorites';

export function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch { return {}; }
}

export function toggleFavorite(placeId) {
  const favs = getFavorites();
  if (favs[placeId]) { delete favs[placeId]; }
  else { favs[placeId] = true; }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
  return !!favs[placeId];
}

export function isFavorite(placeId) {
  return !!getFavorites()[placeId];
}

export function getFavoriteCount(places) {
  const favs = getFavorites();
  return places.filter(p => favs[p.id]).length;
}
