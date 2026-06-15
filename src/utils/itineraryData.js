import {
  locationToPlace,
  normalizeDayPlanRecord,
  normalizePlannerStopRecord,
  normalizeTravelMode
} from './locationData.js';

const CONFIGURABLE_TRAVEL_MODE_KINDS = new Set(['accommodation', 'transport']);

function getLocationById(locations, locationId) {
  if (!locationId) return null;
  return locations.find((location) => location.id === locationId) || null;
}

function getEntryLocationKind(entry = {}) {
  return entry.location?.kind || entry.place?.plannerKind || entry.place?.kind || null;
}

export function canConfigureEntryTravelMode(entry = {}) {
  if (entry.entryType === 'day-start') return false;
  return CONFIGURABLE_TRAVEL_MODE_KINDS.has(getEntryLocationKind(entry));
}

export function composeDayItinerary({
  day,
  activityEntries = [],
  locations = [],
  dayPlans = [],
  plannerStops = []
} = {}) {
  const dayPlan = normalizeDayPlanRecord(
    dayPlans.find((candidate) => Number(candidate.day) === Number(day)) || { day }
  );
  const startLocation = getLocationById(locations, dayPlan.startLocationId);
  const endLocation = getLocationById(locations, dayPlan.endLocationId);

  const activities = activityEntries.map((entry) => {
    const nextEntry = {
      ...entry,
      entryType: 'activity',
      entryId: `activity:${entry.place.id}`,
      sortable: true
    };
    return {
      ...nextEntry,
      travelModeFromPrevious: canConfigureEntryTravelMode(nextEntry)
        ? normalizeTravelMode(entry.item?.travelModeFromPrevious)
        : 'walking'
    };
  });

  const stops = plannerStops
    .map(normalizePlannerStopRecord)
    .filter((stop) => stop.assignedDay === Number(day))
    .map((stop) => {
      const location = getLocationById(locations, stop.locationId);
      if (!location) return null;
      return {
        place: locationToPlace(location),
        item: stop,
        stop,
        location,
        entryType: 'location-stop',
        entryId: `stop:${stop.id}`,
        travelModeFromPrevious: normalizeTravelMode(stop.travelModeFromPrevious),
        sortable: true
      };
    })
    .filter(Boolean);

  const middleEntries = [...activities, ...stops]
    .sort((a, b) => {
      const orderDiff = (Number(a.item?.order) || 0) - (Number(b.item?.order) || 0);
      if (orderDiff !== 0) return orderDiff;
      return a.entryId.localeCompare(b.entryId);
    });

  const result = [];
  if (startLocation) {
    result.push({
      place: locationToPlace(startLocation),
      item: dayPlan,
      location: startLocation,
      entryType: 'day-start',
      entryId: `day:${day}:start`,
      travelModeFromPrevious: null,
      sortable: false
    });
  }

  result.push(...middleEntries);

  if (endLocation) {
    result.push({
      place: locationToPlace(endLocation),
      item: dayPlan,
      location: endLocation,
      entryType: 'day-end',
      entryId: `day:${day}:end`,
      travelModeFromPrevious: normalizeTravelMode(dayPlan.endTravelModeFromPrevious),
      sortable: false
    });
  }

  return result.map((entry, index) => ({
    ...entry,
    day: Number(day),
    exportOrder: index + 1
  }));
}

export function getEntryTravelMode(entry) {
  if (!canConfigureEntryTravelMode(entry)) return 'walking';
  return normalizeTravelMode(entry?.travelModeFromPrevious || entry?.item?.travelModeFromPrevious);
}

export function splitItineraryEntries(entries = []) {
  return {
    activities: entries.filter((entry) => entry.entryType === 'activity'),
    stops: entries.filter((entry) => entry.entryType === 'location-stop'),
    anchors: entries.filter((entry) => entry.entryType === 'day-start' || entry.entryType === 'day-end')
  };
}
