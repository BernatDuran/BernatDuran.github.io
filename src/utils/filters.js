export function filterPlaces(places, { search = '', category = '', priority = '', zone = '', timeOfDay = '', favoritesOnly = false, favorites = {}, rainyFriendly = false }) {
  return places.filter((p) => {
    if (search) {
      const q = search.toLowerCase();
      const match = p.name.toLowerCase().includes(q)
        || p.description.toLowerCase().includes(q)
        || p.zone.toLowerCase().includes(q)
        || p.type.toLowerCase().includes(q)
        || p.category.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (category && p.category !== category) return false;
    if (priority && p.priority !== priority) return false;
    if (zone && p.zone !== zone) return false;
    if (timeOfDay && timeOfDay !== 'cualquier-momento') {
      if ((p.bestTime || 'cualquier-momento') !== timeOfDay) return false;
    }
    if (favoritesOnly && !favorites[p.id]) return false;
    if (rainyFriendly && !p.rainyFriendly) return false;
    return true;
  });
}

export function groupByZone(places) {
  const groups = {};
  places.forEach((p) => {
    if (!groups[p.zone]) groups[p.zone] = [];
    groups[p.zone].push(p);
  });
  return groups;
}

export function getZones(places) {
  return [...new Set(places.map((p) => p.zone))];
}

export function getCategoryCounts(places) {
  const counts = {};
  places.forEach((p) => {
    counts[p.category] = (counts[p.category] || 0) + 1;
  });
  return counts;
}

export function getPriorityCount(places, priority) {
  return places.filter((p) => p.priority === priority).length;
}

