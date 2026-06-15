import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createLocationId,
  normalizeDayPlanRecord,
  normalizeLocationRecord,
  normalizePlannerStopRecord,
  normalizeTravelMode,
  validateLocationRecord
} from '../src/utils/locationData.js';

test('normalizes locations and validates coordinate pairs', () => {
  const location = normalizeLocationRecord({
    id: 'hotel-tokyo',
    name: 'Hotel Tokyo',
    kind: 'accommodation',
    subtype: 'hotel',
    lat: '35.6812',
    lng: '139.7671',
    active: 'true'
  });

  assert.equal(location.lat, 35.6812);
  assert.equal(location.lng, 139.7671);
  assert.equal(location.active, true);
  assert.equal(validateLocationRecord(location), null);
  assert.match(
    validateLocationRecord({ id: 'station', name: 'Station', lat: 35 }),
    /juntas/
  );
});

test('normalizes planner location references and travel modes', () => {
  assert.deepEqual(normalizeDayPlanRecord({
    day: '3',
    startLocationId: 'hotel-a',
    endLocationId: 'hotel-b',
    endTravelModeFromPrevious: 'train'
  }), {
    day: 3,
    startLocationId: 'hotel-a',
    endLocationId: 'hotel-b',
    endTravelModeFromPrevious: 'train'
  });

  assert.equal(normalizeTravelMode('spaceship'), 'walking');
  assert.equal(normalizePlannerStopRecord({
    id: 'stop-1',
    locationId: 'station-a',
    assignedDay: '2',
    durationMinutes: '15',
    travelModeFromPrevious: 'metro'
  }).durationMinutes, 15);
});

test('creates stable unique location slugs', () => {
  assert.equal(createLocationId('Hotel Shinjuku'), 'location-hotel-shinjuku');
  assert.equal(
    createLocationId('Hotel Shinjuku', ['location-hotel-shinjuku']),
    'location-hotel-shinjuku-2'
  );
});
