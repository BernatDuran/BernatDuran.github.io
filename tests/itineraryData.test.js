import test from 'node:test';
import assert from 'node:assert/strict';

import {
  composeDayItinerary,
  getEntryTravelMode,
  splitItineraryEntries
} from '../src/utils/itineraryData.js';

const locations = [
  {
    id: 'hotel-a',
    name: 'Hotel A',
    kind: 'accommodation',
    subtype: 'hotel',
    lat: 35.68,
    lng: 139.76
  },
  {
    id: 'station-a',
    name: 'Tokyo Station',
    kind: 'transport',
    subtype: 'train-station',
    lat: 35.6812,
    lng: 139.7671
  }
];

test('composes fixed day anchors around sortable activities and stops', () => {
  const entries = composeDayItinerary({
    day: 1,
    locations,
    dayPlans: [{
      day: 1,
      startLocationId: 'hotel-a',
      endLocationId: 'hotel-a',
      endTravelModeFromPrevious: 'metro'
    }],
    activityEntries: [{
      place: { id: 'activity-a', name: 'Museum' },
      item: { placeId: 'activity-a', order: 20, travelModeFromPrevious: 'walking' }
    }],
    plannerStops: [{
      id: 'stop-station',
      locationId: 'station-a',
      assignedDay: 1,
      order: 10,
      purpose: 'Coger el tren',
      travelModeFromPrevious: 'train'
    }]
  });

  assert.deepEqual(entries.map((entry) => entry.entryType), [
    'day-start',
    'location-stop',
    'activity',
    'day-end'
  ]);
  assert.deepEqual(entries.map((entry) => entry.exportOrder), [1, 2, 3, 4]);
  assert.equal(entries[0].sortable, false);
  assert.equal(entries[1].sortable, true);
  assert.equal(getEntryTravelMode(entries[1]), 'train');
  assert.equal(getEntryTravelMode(entries[3]), 'metro');
});

test('allows the same accommodation at start, middle and end without collisions', () => {
  const entries = composeDayItinerary({
    day: 2,
    locations,
    dayPlans: [{
      day: 2,
      startLocationId: 'hotel-a',
      endLocationId: 'hotel-a'
    }],
    plannerStops: [{
      id: 'stop-hotel',
      locationId: 'hotel-a',
      assignedDay: 2,
      order: 0,
      purpose: 'Dejar mochilas'
    }]
  });

  assert.equal(entries.length, 3);
  assert.equal(new Set(entries.map((entry) => entry.entryId)).size, 3);
  assert.deepEqual(splitItineraryEntries(entries), {
    activities: [],
    stops: [entries[1]],
    anchors: [entries[0], entries[2]]
  });
});

test('ignores stops that reference missing locations', () => {
  const entries = composeDayItinerary({
    day: 1,
    locations,
    plannerStops: [{
      id: 'orphan-stop',
      locationId: 'missing',
      assignedDay: 1,
      order: 0
    }]
  });

  assert.deepEqual(entries, []);
});

test('forces ordinary activity travel modes to walking', () => {
  const entries = composeDayItinerary({
    day: 3,
    locations,
    activityEntries: [{
      place: { id: 'activity-train', name: 'Museum' },
      item: { placeId: 'activity-train', order: 0, travelModeFromPrevious: 'train' }
    }],
    plannerStops: [{
      id: 'stop-station',
      locationId: 'station-a',
      assignedDay: 3,
      order: 1,
      travelModeFromPrevious: 'train'
    }]
  });

  assert.equal(getEntryTravelMode(entries[0]), 'walking');
  assert.equal(getEntryTravelMode(entries[1]), 'train');
});
