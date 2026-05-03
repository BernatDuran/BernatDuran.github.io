import { cities } from '../data/cities.js';
import { tokyoPlaces } from '../data/tokyo.js';
import { kyotoPlaces } from '../data/kyoto.js';
import { osakaPlaces } from '../data/osaka.js';
import { getAll, putAll, getById } from './db.js';
import { normalizePlaceRecord } from './placeData.js';
import { normalizeCityRecord } from './cityData.js';

export async function runDataMigration() {
  const existingCities = await getAll('cities');
  const existingPlaces = await getAll('places');
  
  // If DB already has cities, we don't migrate (assume user data is there)
  // But for development, we might want to force update.
  // We'll check if the DB is empty.
  if (existingCities.length === 0) {
    console.log('Running initial data migration to IndexedDB...');
    
    // Convert cities object to array
    const citiesArray = Object.values(cities).map((city, index) => normalizeCityRecord(city, index));
    await putAll('cities', citiesArray);
    
    // Unify all places, adding cityId
    const allPlaces = [
      ...tokyoPlaces.map((p) => normalizePlaceRecord({ ...p, cityId: 'tokyo' })),
      ...kyotoPlaces.map((p) => normalizePlaceRecord({ ...p, cityId: 'kyoto' })),
      ...osakaPlaces.map((p) => normalizePlaceRecord({ ...p, cityId: 'osaka' }))
    ];
    await putAll('places', allPlaces);
    
    // Migrate favorites to planner store
    const favorites = JSON.parse(localStorage.getItem('japan_favorites') || '[]');
    const plannerItems = favorites.map(id => ({
      placeId: id,
      favorite: true,
      status: null,
      assignedDay: null
    }));
    if (plannerItems.length > 0) {
      await putAll('planner', plannerItems);
    }
    
    console.log('Migration complete!');
  }

  if (existingPlaces.length > 0) {
    const normalizedPlaces = existingPlaces.map((place) => normalizePlaceRecord(place));
    const needsNormalization = normalizedPlaces.some((place, index) => {
      const current = existingPlaces[index];
      const currentScore = current?.score;
      const hasLegacyScore = currentScore && typeof currentScore === 'object';
      const latMismatch = (current?.coordinates?.lat ?? null) !== (place.coordinates?.lat ?? null);
      const lngMismatch = (current?.coordinates?.lng ?? null) !== (place.coordinates?.lng ?? null);
      const bestTimeMismatch = current?.bestTime !== place.bestTime;
      const hasLegacySource = Object.prototype.hasOwnProperty.call(current || {}, 'source');
      const textMismatch = current?.name !== place.name
        || current?.type !== place.type
        || current?.zone !== place.zone
        || current?.description !== place.description
        || (current?.address ?? null) !== place.address
        || (current?.estimatedDuration ?? null) !== place.estimatedDuration
        || (current?.ticketInfo ?? null) !== place.ticketInfo
        || (current?.tips ?? null) !== place.tips
        || (current?.comment ?? null) !== place.comment;
      return hasLegacyScore
        || current?.score !== place.score
        || current?.rainyFriendly !== place.rainyFriendly
        || current?.requiresTicket !== place.requiresTicket
        || bestTimeMismatch
        || hasLegacySource
        || textMismatch
        || latMismatch
        || lngMismatch;
    });

    if (needsNormalization) {
      await putAll('places', normalizedPlaces);
    }
  }

  if (existingCities.length > 0) {
    const normalizedCities = existingCities.map((city, index) => normalizeCityRecord(city, index));
    const needsCityNormalization = normalizedCities.some((city, index) => {
      const current = existingCities[index];
      return current?.sortOrder !== city.sortOrder
        || current?.recommendedDays !== city.recommendedDays;
    });

    if (needsCityNormalization) {
      await putAll('cities', normalizedCities);
    }
  }
}
