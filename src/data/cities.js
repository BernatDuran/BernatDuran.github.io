export const cities = {
  tokyo: {
    id: 'tokyo',
    sortOrder: 0,
    name: 'Tokio',
    nameJa: '東京',
    slug: 'tokyo',
    tagline: 'La metrópolis que nunca duerme',
    color: '#3b82f6',
    colorLight: '#dbeafe',
    colorDark: '#1e3a5f',
    gradient: 'linear-gradient(135deg, #1e3a5f 0%, #3b82f6 100%)',
    description: 'Capital del país y una de las ciudades más fascinantes del mundo. Tokio combina rascacielos futuristas con templos ancestrales, barrios de neón con jardines zen, y la cultura pop más loca con tradiciones milenarias.',
    summary: 'Una ciudad de contrastes donde lo ultra-moderno convive con lo tradicional. Desde el cruce de Shibuya hasta los templos de Asakusa, desde la electrónica de Akihabara hasta la serenidad de Meiji Jingu.',
    idealFor: 'Amantes de la tecnología, la cultura pop, la gastronomía urbana y las vistas panorámicas',
    recommendedDays: '4-5 días',
    zones: ['Asakusa', 'Shibuya & Harajuku', 'Shinjuku', 'Akihabara', 'Otros Barrios'],
    highlights: ['Cruce de Shibuya', 'teamLab', 'Golden Gai', 'Senso-ji', 'Shibuya Sky'],
    heroImage: null,
    tripDates: 'Primeros días del viaje',
    center: { lat: 35.6895, lng: 139.6917 },
    defaultZoom: 12
  },
  kyoto: {
    id: 'kyoto',
    sortOrder: 1,
    name: 'Kioto',
    nameJa: '京都',
    slug: 'kyoto',
    tagline: 'El alma tradicional de Japón',
    color: '#d97706',
    colorLight: '#fef3c7',
    colorDark: '#78350f',
    gradient: 'linear-gradient(135deg, #78350f 0%, #d97706 100%)',
    description: 'Antigua capital imperial y corazón cultural de Japón. Kioto alberga más de 2.000 templos y santuarios, jardines zen perfectos, geishas en Gion y el icónico bosque de bambú de Arashiyama.',
    summary: 'La ciudad más espiritual y estética de Japón. Cada rincón respira historia, desde los torii rojos de Fushimi Inari hasta el dorado Kinkaku-ji. Perfecta para quien busca la esencia de la cultura japonesa.',
    idealFor: 'Amantes de la cultura, la espiritualidad, la naturaleza y la fotografía',
    recommendedDays: '3-4 días',
    zones: ['Higashiyama & Gion', 'Centro', 'Norte & Filosofía', 'Arashiyama', 'Fushimi & Sur'],
    highlights: ['Fushimi Inari', 'Kinkaku-ji', 'Bosque de Bambú', 'Gion', 'Kiyomizu-dera'],
    heroImage: null,
    tripDates: 'Días centrales del viaje',
    center: { lat: 35.0116, lng: 135.7681 },
    defaultZoom: 13
  },
  osaka: {
    id: 'osaka',
    sortOrder: 2,
    name: 'Osaka',
    nameJa: '大阪',
    slug: 'osaka',
    tagline: 'La capital gastronómica de Japón',
    color: '#ef4444',
    colorLight: '#fee2e2',
    colorDark: '#7f1d1d',
    gradient: 'linear-gradient(135deg, #7f1d1d 0%, #ef4444 100%)',
    description: 'Conocida como "la cocina de Japón", Osaka es la ciudad más divertida y desenfadada del país. Street food increíble, neones vibrantes en Dotonbori, el castillo histórico y el imprescindible Universal Studios Japan.',
    summary: 'La ciudad más extrovertida de Japón. Famosa por su gastronomía callejera (takoyaki, okonomiyaki, kushikatsu), su ambiente nocturno vibrante y la calidez de su gente. Menos formal que Tokio, más divertida que Kioto.',
    idealFor: 'Amantes de la comida callejera, la diversión, las experiencias nocturnas y los parques temáticos',
    recommendedDays: '3-4 días',
    zones: ['Namba / Minami', 'Umeda / Kita', 'Shinsekai / Tennoji', 'Castillo & Bahía', 'Otros Barrios'],
    highlights: ['Dotonbori', 'Universal Studios', 'Castillo de Osaka', 'Umeda Sky', 'Shinsekai'],
    heroImage: null,
    tripDates: 'Últimos días del viaje',
    center: { lat: 34.6937, lng: 135.5023 },
    defaultZoom: 13
  }
};

export const tripInfo = {
  title: 'Japón 2026',
  subtitle: 'La aventura definitiva',
  dates: { start: '2026-06-30', end: '2026-07-16' },
  datesFormatted: '30 junio — 16 julio 2026',
  totalDays: 17,
  totalCities: 3,
  description: '17 días descubriendo la esencia de Japón: desde los rascacielos de Tokio hasta los templos de Kioto, pasando por la gastronomía de Osaka.'
};

export const categories = [
  { id: 'templos', label: 'Templos y Santuarios', icon: '⛩️' },
  { id: 'barrios', label: 'Barrios', icon: '🏘️' },
  { id: 'comida', label: 'Comida', icon: '🍜' },
  { id: 'compras', label: 'Compras', icon: '🛍️' },
  { id: 'naturaleza', label: 'Naturaleza', icon: '🌿' },
  { id: 'cultura', label: 'Cultura', icon: '🎭' },
  { id: 'experiencias', label: 'Experiencias', icon: '✨' },
  { id: 'miradores', label: 'Miradores', icon: '🏙️' },
  { id: 'nocturno', label: 'Nocturno', icon: '🌙' }
];

export const priorityLabels = {
  'must-see': { label: 'Imprescindible', icon: '🔥', class: 'priority-must-see' },
  recommended: { label: 'Recomendable', icon: '👍', class: 'priority-recommended' },
  optional: { label: 'Opcional', icon: '💡', class: 'priority-optional' }
};
