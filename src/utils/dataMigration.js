import { PROFESSIONAL_CURATION_VERSION } from '../data/professionalCuration.js';
import { buildDemoDataset } from '../data/demoDataset.js';
import { getAll, putAll, getById } from './db.js';
import { getPlaceLatLng, normalizePlaceRecord } from './placeData.js';
import { normalizeCityRecord } from './cityData.js';

export async function runDataMigration() {
  const existingCities = await getAll('cities');
  const existingPlaces = await getAll('places');
  
  // If DB already has cities, we don't migrate (assume user data is there)
  // But for development, we might want to force update.
  // We'll check if the DB is empty.
  if (existingCities.length === 0) {
    console.log('Running initial data migration to IndexedDB...');

    const demoDataset = buildDemoDataset();
    const favorites = JSON.parse(localStorage.getItem('japan_favorites') || '[]');
    const favoriteIds = new Set(favorites);
    const demoPlanner = demoDataset.planner.map((item) => ({
      ...item,
      favorite: favoriteIds.has(item.placeId) || item.favorite
    }));

    await putAll('cities', demoDataset.cities);
    await putAll('places', demoDataset.places);
    await putAll('planner', demoPlanner);
    await putAll('settings', demoDataset.settings);
    
    console.log('Migration complete!');
  }

  if (existingPlaces.length > 0) {
    const normalizedPlaces = existingPlaces.map((place) => normalizePlaceRecord(place));
    const needsNormalization = normalizedPlaces.some((place, index) => {
      const current = existingPlaces[index];
      const currentScore = current?.score;
      const hasLegacyScore = currentScore && typeof currentScore === 'object';
      const currentLatLng = getPlaceLatLng(current);
      const latMismatch = (currentLatLng?.lat ?? null) !== (place.lat ?? null);
      const lngMismatch = (currentLatLng?.lng ?? null) !== (place.lng ?? null);
      const bestTimeMismatch = current?.bestTime !== place.bestTime;
      const hasLegacySource = Object.prototype.hasOwnProperty.call(current || {}, 'source');
      const hasLegacyCoordinates = Object.prototype.hasOwnProperty.call(current || {}, 'coordinates');
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
        || hasLegacyCoordinates
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

  await ensureBaseCitiesExist();
  await applyProfessionalCuration();
}

export async function ensureBaseCitiesExist() {
  const demoDataset = buildDemoDataset();
  const existingCities = await getAll('cities');
  const existingIds = new Set(existingCities.map((city) => city.id));
  const maxSortOrder = existingCities.reduce((max, city, index) => {
    const parsed = Number.parseInt(city?.sortOrder, 10);
    return Math.max(max, Number.isFinite(parsed) ? parsed : index);
  }, -1);

  const missingCities = demoDataset.cities
    .filter((city) => !existingIds.has(city.id))
    .map((city, index) => normalizeCityRecord({
      ...city,
      sortOrder: maxSortOrder + index + 1
    }, maxSortOrder + index + 1));

  if (missingCities.length) {
    await putAll('cities', missingCities);
  }
}

async function applyProfessionalCuration() {
  const alreadyApplied = await getById('settings', PROFESSIONAL_CURATION_VERSION);
  if (alreadyApplied) return;

  const demoDataset = buildDemoDataset();
  const demoPlaceById = new Map(demoDataset.places.map((place) => [place.id, place]));
  const places = (await getAll('places')).map((place) => normalizePlaceRecord(place));
  if (!places.length) return;
  const existingPlannerItems = await getAll('planner');
  const favoriteByPlaceId = new Map(
    existingPlannerItems.map((item) => [item.placeId, Boolean(item.favorite)])
  );
  const existingPlaceById = new Map(places.map((place) => [place.id, place]));

  const curatedPlaces = [
    ...demoDataset.places.map((demoPlace) => ({
      ...(existingPlaceById.get(demoPlace.id) || {}),
      ...demoPlace
    })),
    ...places.filter((place) => !demoPlaceById.has(place.id))
  ];
  const existingIds = new Set(curatedPlaces.map((place) => place.id));
  const planner = demoDataset.planner
    .filter((item) => existingIds.has(item.placeId))
    .map((item) => ({
      ...item,
      favorite: favoriteByPlaceId.get(item.placeId) || false
    }));
  const plannedDemoIds = new Set(planner.map((item) => item.placeId));
  const customPlanner = existingPlannerItems
    .filter((item) => existingIds.has(item.placeId) && !plannedDemoIds.has(item.placeId))
    .map((item) => ({
      placeId: item.placeId,
      favorite: Boolean(item.favorite),
      status: item.status || 'in-tray',
      assignedDay: item.status === 'planned' ? item.assignedDay : null,
      order: item.order || 0
    }));
  const currentGlobalSettings = await getById('settings', 'global');
  const nextGlobalSettings = {
    ...demoDataset.settings.find((setting) => setting.id === 'global'),
    mapLinkStyle: currentGlobalSettings?.mapLinkStyle || 'smart'
  };

  await putAll('cities', demoDataset.cities.map((city, index) => normalizeCityRecord(city, index)));
  await putAll('places', curatedPlaces);
  await putAll('planner', [...planner, ...customPlanner]);
  await putAll('settings', [
    nextGlobalSettings,
    { id: PROFESSIONAL_CURATION_VERSION, appliedAt: new Date().toISOString() }
  ]);
}
