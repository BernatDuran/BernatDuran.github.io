import { demoSnapshot } from './demoSnapshot.js';
import { PROFESSIONAL_CURATION_VERSION } from './professionalCuration.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

export const DEMO_GLOBAL_SETTINGS = {
  id: 'global',
  startDate: '2026-06-29',
  endDate: '2026-07-16',
  mapLinkStyle: 'smart'
};

export function buildDemoDataset() {
  return {
    cities: clone(demoSnapshot.cities),
    places: clone(demoSnapshot.places),
    planner: clone(demoSnapshot.planner),
    settings: [
      { ...DEMO_GLOBAL_SETTINGS },
      { id: PROFESSIONAL_CURATION_VERSION, appliedAt: new Date().toISOString() }
    ]
  };
}
