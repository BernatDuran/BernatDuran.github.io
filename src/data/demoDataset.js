import { demoSnapshot } from './demoSnapshot.js';
import { PROFESSIONAL_CURATION_VERSION } from './professionalCuration.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

export const DEMO_GLOBAL_SETTINGS = {
  id: 'global',
  startDate: '2026-06-29',
  endDate: '2026-07-16',
  mapLinkStyle: 'smart'
};

const HOTEL_KEIHAN_TENMABASHI_ID = 'location-hotel-keihan-tenmabashi-ekimae';
const COMFORT_KYOTO_HORIKAWAGOJO_ID = 'location-comfort-hotel-era-kyoto-horikawagojo';
const HOTEL_GIFT_TAKAYAMA_ID = 'location-hotel-and-spa-gift-takayama';
const IORI_STAY_LOUNGE_SPA_ID = 'location-iori-stay-lounge-spa';
const HOTEL_GUEST1_UENO_ID = 'location-hotel-guest1-ueno-ekimae';
const SHIN_OSAKA_STATION_ID = 'location-shin-osaka-station';
const KYOTO_STATION_ID = 'location-kyoto-station';
const TOKYO_STATION_ID = 'location-tokyo-station';
const SHINAGAWA_STATION_ID = 'location-shinagawa-station';
const UENO_STATION_ID = 'location-ueno-station';
const TAKAYAMA_STATION_ID = 'location-takayama-station';

const JAPAN_2026_ACCOMMODATIONS = [
  {
    id: HOTEL_KEIHAN_TENMABASHI_ID,
    name: 'Hotel Keihan Tenmabashi Ekimae',
    kind: 'accommodation',
    subtype: 'hotel',
    cityId: 'osaka',
    address: '2-13 Tenmabashikyomachi, Chuo-ku, Osaka 540-0032, Japan',
    lat: 34.6896197,
    lng: 135.5162672,
    notes: 'Fuente: https://tenmabashi-ekimae.hotelkeihan.co.jp/location/. Fechas extraidas de la guia de Osaka.',
    active: true
  },
  {
    id: COMFORT_KYOTO_HORIKAWAGOJO_ID,
    name: 'Comfort Hotel ERA Kyoto Horikawagojo',
    kind: 'accommodation',
    subtype: 'hotel',
    cityId: 'kyoto',
    address: '134-32 Sensui-cho, Gojo-sagaru, Horikawa-dori, Shimogyo-ku, Kyoto 600-8338, Japan',
    lat: 34.9957343,
    lng: 135.7528027,
    notes: 'Fuente: https://www.choicehotels.com/en-it/japan/kyoto/comfort-inn-hotels/jp105. Nombre actualizado por cambio a Comfort Hotel ERA Kyoto Horikawagojo indicado para el 22/06/2026.',
    active: true
  },
  {
    id: HOTEL_GIFT_TAKAYAMA_ID,
    name: 'Hotel and Spa Gift TAKAYAMA',
    kind: 'accommodation',
    subtype: 'hotel',
    cityId: 'takayama',
    address: '6-22 Tenmanmachi, Takayama, Gifu 506-0025, Japan',
    lat: 36.142124,
    lng: 137.253408,
    notes: 'Fuente: https://gift-takayama.com/en/. Asignacion inferida para las noches de Takayama.',
    active: true
  },
  {
    id: IORI_STAY_LOUNGE_SPA_ID,
    name: 'IORI STAY \u2013 LOUNGE & SPA \u2013',
    kind: 'accommodation',
    subtype: 'other-accommodation',
    cityId: 'takayama',
    address: '5-5-5 Tenmanmachi, Takayama, Gifu 506-0025, Japan',
    lat: 36.1413732,
    lng: 137.2539736,
    notes: 'Fuente: https://iori-stay.com/. Noche especial en alojamiento tradicional.',
    active: true
  },
  {
    id: HOTEL_GUEST1_UENO_ID,
    name: 'HOTEL Guest1 Ueno Ekimae',
    kind: 'accommodation',
    subtype: 'hotel',
    cityId: 'tokyo',
    address: '2-18-18 Higashi-Ueno, Taito-ku, Tokyo 110-0015, Japan',
    lat: 35.7105109,
    lng: 139.7772478,
    notes: 'Fuente: https://www.hotel-guest1.com/eng/access.php.',
    active: true
  }
];

const JAPAN_2026_TRANSPORT_LOCATIONS = [
  {
    id: SHIN_OSAKA_STATION_ID,
    name: 'Shin-Osaka Station',
    kind: 'transport',
    subtype: 'train-station',
    cityId: 'osaka',
    address: '5 Nishinakajima, Yodogawa-ku, Osaka, Japan',
    lat: 34.73348,
    lng: 135.500109,
    notes: 'Shinkansen: Tokaido and Sanyo. Principal high-speed rail stop for Osaka.',
    active: true
  },
  {
    id: KYOTO_STATION_ID,
    name: 'Kyoto Station',
    kind: 'transport',
    subtype: 'train-station',
    cityId: 'kyoto',
    address: 'Higashishiokoji Kamadonocho, Shimogyo-ku, Kyoto 600-8216, Japan',
    lat: 34.985849,
    lng: 135.758767,
    notes: 'Shinkansen: Tokaido. Principal high-speed rail stop for Kyoto.',
    active: true
  },
  {
    id: TOKYO_STATION_ID,
    name: 'Tokyo Station',
    kind: 'transport',
    subtype: 'train-station',
    cityId: 'tokyo',
    address: '1 Marunouchi, Chiyoda-ku, Tokyo 100-0005, Japan',
    lat: 35.681236,
    lng: 139.767125,
    notes: 'Shinkansen: Tokaido, Tohoku, Joetsu, Hokuriku and through services. Main intercity rail hub in Tokyo.',
    active: true
  },
  {
    id: SHINAGAWA_STATION_ID,
    name: 'Shinagawa Station',
    kind: 'transport',
    subtype: 'train-station',
    cityId: 'tokyo',
    address: '3 Takanawa, Minato-ku, Tokyo 108-0074, Japan',
    lat: 35.628471,
    lng: 139.73876,
    notes: 'Shinkansen: Tokaido. Useful Tokyo stop for trips westbound toward Kyoto and Osaka.',
    active: true
  },
  {
    id: UENO_STATION_ID,
    name: 'Ueno Station',
    kind: 'transport',
    subtype: 'train-station',
    cityId: 'tokyo',
    address: '7 Ueno, Taito-ku, Tokyo 110-0005, Japan',
    lat: 35.713768,
    lng: 139.777254,
    notes: 'Shinkansen: Tohoku, Joetsu, Hokuriku and through services. Useful Tokyo stop near the Ueno accommodation.',
    active: true
  },
  {
    id: TAKAYAMA_STATION_ID,
    name: 'Takayama Station',
    kind: 'transport',
    subtype: 'train-station',
    cityId: 'takayama',
    address: '1-22-2 Showamachi, Takayama, Gifu 506-0053, Japan',
    lat: 36.141053,
    lng: 137.251252,
    notes: 'JR Takayama Main Line. No Shinkansen stop; railway access point for Takayama.',
    active: true
  }
];

const JAPAN_2026_DAY_PLANS = [
  { day: 1, startLocationId: HOTEL_KEIHAN_TENMABASHI_ID, endLocationId: HOTEL_KEIHAN_TENMABASHI_ID, endTravelModeFromPrevious: 'walking' },
  { day: 2, startLocationId: HOTEL_KEIHAN_TENMABASHI_ID, endLocationId: HOTEL_KEIHAN_TENMABASHI_ID, endTravelModeFromPrevious: 'walking' },
  { day: 3, startLocationId: HOTEL_KEIHAN_TENMABASHI_ID, endLocationId: HOTEL_KEIHAN_TENMABASHI_ID, endTravelModeFromPrevious: 'walking' },
  { day: 4, startLocationId: HOTEL_KEIHAN_TENMABASHI_ID, endLocationId: HOTEL_KEIHAN_TENMABASHI_ID, endTravelModeFromPrevious: 'walking' },
  { day: 5, startLocationId: HOTEL_KEIHAN_TENMABASHI_ID, endLocationId: COMFORT_KYOTO_HORIKAWAGOJO_ID, endTravelModeFromPrevious: 'walking' },
  { day: 6, startLocationId: COMFORT_KYOTO_HORIKAWAGOJO_ID, endLocationId: COMFORT_KYOTO_HORIKAWAGOJO_ID, endTravelModeFromPrevious: 'walking' },
  { day: 7, startLocationId: COMFORT_KYOTO_HORIKAWAGOJO_ID, endLocationId: COMFORT_KYOTO_HORIKAWAGOJO_ID, endTravelModeFromPrevious: 'walking' },
  { day: 8, startLocationId: COMFORT_KYOTO_HORIKAWAGOJO_ID, endLocationId: COMFORT_KYOTO_HORIKAWAGOJO_ID, endTravelModeFromPrevious: 'walking' },
  { day: 9, startLocationId: COMFORT_KYOTO_HORIKAWAGOJO_ID, endLocationId: HOTEL_GIFT_TAKAYAMA_ID, endTravelModeFromPrevious: 'walking' },
  { day: 10, startLocationId: HOTEL_GIFT_TAKAYAMA_ID, endLocationId: HOTEL_GIFT_TAKAYAMA_ID, endTravelModeFromPrevious: 'walking' },
  { day: 11, startLocationId: HOTEL_GIFT_TAKAYAMA_ID, endLocationId: IORI_STAY_LOUNGE_SPA_ID, endTravelModeFromPrevious: 'walking' },
  { day: 12, startLocationId: IORI_STAY_LOUNGE_SPA_ID, endLocationId: HOTEL_GUEST1_UENO_ID, endTravelModeFromPrevious: 'walking' },
  { day: 13, startLocationId: HOTEL_GUEST1_UENO_ID, endLocationId: HOTEL_GUEST1_UENO_ID, endTravelModeFromPrevious: 'walking' },
  { day: 14, startLocationId: HOTEL_GUEST1_UENO_ID, endLocationId: HOTEL_GUEST1_UENO_ID, endTravelModeFromPrevious: 'walking' },
  { day: 15, startLocationId: HOTEL_GUEST1_UENO_ID, endLocationId: HOTEL_GUEST1_UENO_ID, endTravelModeFromPrevious: 'walking' },
  { day: 16, startLocationId: HOTEL_GUEST1_UENO_ID, endLocationId: HOTEL_GUEST1_UENO_ID, endTravelModeFromPrevious: 'walking' },
  { day: 17, startLocationId: HOTEL_GUEST1_UENO_ID, endLocationId: HOTEL_GUEST1_UENO_ID, endTravelModeFromPrevious: 'walking' },
  { day: 18, startLocationId: HOTEL_GUEST1_UENO_ID, endLocationId: null, endTravelModeFromPrevious: 'walking' }
];

export function buildDemoDataset() {
  return {
    cities: clone(demoSnapshot.cities),
    places: clone(demoSnapshot.places),
    planner: clone(demoSnapshot.planner),
    locations: clone([
      ...JAPAN_2026_ACCOMMODATIONS,
      ...JAPAN_2026_TRANSPORT_LOCATIONS
    ]),
    dayPlans: clone(JAPAN_2026_DAY_PLANS),
    plannerStops: [],
    settings: [
      { ...DEMO_GLOBAL_SETTINGS },
      { id: PROFESSIONAL_CURATION_VERSION, appliedAt: new Date().toISOString() }
    ]
  };
}
