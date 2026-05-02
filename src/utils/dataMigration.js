import { cities } from '../data/cities.js';
import { tokyoPlaces } from '../data/tokyo.js';
import { kyotoPlaces } from '../data/kyoto.js';
import { osakaPlaces } from '../data/osaka.js';
import { getAll, putAll, getById } from './db.js';

export async function runDataMigration() {
  const existingCities = await getAll('cities');
  
  // If DB already has cities, we don't migrate (assume user data is there)
  // But for development, we might want to force update.
  // We'll check if the DB is empty.
  if (existingCities.length === 0) {
    console.log('Running initial data migration to IndexedDB...');
    
    // Convert cities object to array
    const citiesArray = Object.values(cities);
    await putAll('cities', citiesArray);
    
    // Unify all places, adding cityId
    const allPlaces = [
      ...tokyoPlaces.map(p => ({ ...p, cityId: 'tokyo', rainyFriendly: !!p.rainyFriendly })),
      ...kyotoPlaces.map(p => ({ ...p, cityId: 'kyoto', rainyFriendly: !!p.rainyFriendly })),
      ...osakaPlaces.map(p => ({ ...p, cityId: 'osaka', rainyFriendly: !!p.rainyFriendly }))
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
}
