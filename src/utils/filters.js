function matchesSingleScoreBand(score, scoreBand) {
  if (!scoreBand) return true;
  if (scoreBand === 'all') return true;
  if (scoreBand === '0-4') {
    if (score == null) return false;
    const numericScore = Number(score);
    return Number.isFinite(numericScore) && numericScore >= 0 && numericScore <= 4;
  }
  if (scoreBand === '5-6') {
    if (score == null) return false;
    const numericScore = Number(score);
    return Number.isFinite(numericScore) && numericScore >= 5 && numericScore <= 6;
  }
  if (scoreBand === '7-8') {
    if (score == null) return false;
    const numericScore = Number(score);
    return Number.isFinite(numericScore) && numericScore >= 7 && numericScore <= 8;
  }
  if (scoreBand === '9') {
    if (score == null) return false;
    return Number(score) === 9;
  }
  if (scoreBand === '10') {
    if (score == null) return false;
    return Number(score) === 10;
  }

  if (score == null) return false;

  const numericScore = Number(score);
  if (!Number.isFinite(numericScore)) return false;

  return true;
}

export function filterPlaces(
  places,
  {
    search = '',
    category = '',
    priority = '',
    zone = '',
    timeOfDay = '',
    scoreBands = [],
    favoritesOnly = false,
    favorites = {},
    rainyFriendly = false
  }
) {
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
    if (Array.isArray(scoreBands) && scoreBands.length > 0 && !scoreBands.includes('all')) {
      if (!scoreBands.some((band) => matchesSingleScoreBand(p.score, band))) return false;
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
