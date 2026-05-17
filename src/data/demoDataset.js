import { cities } from './cities.js';
import { tokyoPlaces } from './tokyo.js';
import { kyotoPlaces } from './kyoto.js';
import { osakaPlaces } from './osaka.js';
import { takayamaPlaces } from './takayama.js';
import {
  PROFESSIONAL_CURATION_VERSION,
  SCORE_OVERRIDES,
  RAINY_FRIENDLY_IDS,
  PLANNED_DAY_IDS,
  DISCARDED_PLACE_IDS
} from './professionalCuration.js';
import { normalizeCityRecord } from '../utils/cityData.js';
import { normalizePlaceRecord } from '../utils/placeData.js';

export const DEMO_GLOBAL_SETTINGS = {
  id: 'global',
  startDate: '2026-06-29',
  endDate: '2026-07-16',
  mapLinkStyle: 'smart'
};

export function buildDemoDataset() {
  const citiesArray = Object.values(cities).map((city, index) => normalizeCityRecord(city, index));
  const basePlaces = [
    ...tokyoPlaces.map((place) => normalizePlaceRecord({ ...place, cityId: 'tokyo' })),
    ...kyotoPlaces.map((place) => normalizePlaceRecord({ ...place, cityId: 'kyoto' })),
    ...osakaPlaces.map((place) => normalizePlaceRecord({ ...place, cityId: 'osaka' })),
    ...takayamaPlaces.map((place) => normalizePlaceRecord({ ...place, cityId: 'takayama' }))
  ];

  const rainyFriendlySet = new Set(RAINY_FRIENDLY_IDS);
  const places = basePlaces.map((place) => ({
    ...place,
    rainyFriendly: rainyFriendlySet.has(place.id),
    score: place.score == null && Object.prototype.hasOwnProperty.call(SCORE_OVERRIDES, place.id)
      ? SCORE_OVERRIDES[place.id]
      : place.score
  }));

  const discardedSet = new Set(DISCARDED_PLACE_IDS);
  const plannedIds = new Set();
  const planner = [];

  Object.entries(PLANNED_DAY_IDS).forEach(([day, placeIds]) => {
    placeIds.forEach((placeId, order) => {
      planner.push({
        placeId,
        favorite: false,
        status: 'planned',
        assignedDay: Number.parseInt(day, 10),
        order
      });
      plannedIds.add(placeId);
    });
  });

  places
    .map((place) => place.id)
    .filter((placeId) => !plannedIds.has(placeId) && !discardedSet.has(placeId))
    .forEach((placeId, order) => {
      planner.push({
        placeId,
        favorite: false,
        status: 'in-tray',
        assignedDay: null,
        order
      });
    });

  Array.from(discardedSet).forEach((placeId, order) => {
    planner.push({
      placeId,
      favorite: false,
      status: 'discarded',
      assignedDay: null,
      order
    });
  });

  return {
    cities: citiesArray,
    places,
    planner,
    settings: [
      { ...DEMO_GLOBAL_SETTINGS },
      { id: PROFESSIONAL_CURATION_VERSION, appliedAt: new Date().toISOString() }
    ]
  };
}
