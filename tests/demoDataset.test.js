import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDemoDataset } from '../src/data/demoDataset.js';

test('includes Japan 2026 accommodations and nightly day plans', () => {
  const dataset = buildDemoDataset();
  const locationsById = new Map(dataset.locations.map((location) => [location.id, location]));
  const dayPlansByDay = new Map(dataset.dayPlans.map((dayPlan) => [dayPlan.day, dayPlan]));

  assert.equal(dataset.locations.length, 11);
  assert.equal(dataset.dayPlans.length, 18);
  assert.equal(
    locationsById.get('location-hotel-keihan-tenmabashi-ekimae')?.cityId,
    'osaka'
  );
  assert.equal(
    locationsById.get('location-comfort-hotel-era-kyoto-horikawagojo')?.cityId,
    'kyoto'
  );
  assert.equal(
    locationsById.get('location-iori-stay-lounge-spa')?.subtype,
    'other-accommodation'
  );
  assert.equal(
    locationsById.get('location-shin-osaka-station')?.subtype,
    'train-station'
  );
  assert.equal(
    locationsById.get('location-kyoto-station')?.kind,
    'transport'
  );
  assert.equal(
    locationsById.get('location-ueno-station')?.cityId,
    'tokyo'
  );
  assert.equal(
    locationsById.get('location-takayama-station')?.notes.includes('No Shinkansen stop'),
    true
  );
  assert.equal(
    dayPlansByDay.get(5)?.startLocationId,
    'location-hotel-keihan-tenmabashi-ekimae'
  );
  assert.equal(
    dayPlansByDay.get(5)?.endLocationId,
    'location-comfort-hotel-era-kyoto-horikawagojo'
  );
  assert.equal(
    dayPlansByDay.get(18)?.startLocationId,
    'location-hotel-guest1-ueno-ekimae'
  );
  assert.equal(dayPlansByDay.get(18)?.endLocationId, null);
});
