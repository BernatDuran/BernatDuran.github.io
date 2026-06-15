import test from 'node:test';
import assert from 'node:assert/strict';

import { getGoogleMapsRouteUrls } from '../src/utils/maps.js';
import { decodeEncodedPolyline } from '../src/utils/routes/routePolyline.js';
import { getWalkingRoutesForEntries } from '../src/utils/routes/routeService.js';

test('splits long Google Maps itineraries without losing continuity', () => {
  const entries = Array.from({ length: 12 }, (_, index) => ({
    place: {
      id: `place-${index}`,
      lat: 35 + index / 100,
      lng: 139 + index / 100
    }
  }));

  const urls = getGoogleMapsRouteUrls(entries, { maxWaypoints: 8 });
  assert.equal(urls.length, 2);

  const first = new URL(urls[0]);
  const second = new URL(urls[1]);
  assert.equal(first.searchParams.get('destination'), '35.09,139.09');
  assert.equal(second.searchParams.get('origin'), '35.09,139.09');
  assert.equal(second.searchParams.get('destination'), '35.11,139.11');
});

test('represents transport legs without requesting a walking route', async () => {
  const entries = [
    {
      place: { id: 'hotel', lat: 35.68, lng: 139.76 },
      travelModeFromPrevious: null
    },
    {
      place: { id: 'station', lat: 35.69, lng: 139.70 },
      travelModeFromPrevious: 'metro'
    }
  ];

  const results = await getWalkingRoutesForEntries(entries);
  assert.equal(results.length, 1);
  assert.equal(results[0].route.status, 'non-walking');
  assert.equal(results[0].route.mode, 'metro');
});

test('decodes Google encoded polylines locally', () => {
  assert.deepEqual(decodeEncodedPolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@'), [
    [38.5, -120.2],
    [40.7, -120.95],
    [43.252, -126.453]
  ]);
});
