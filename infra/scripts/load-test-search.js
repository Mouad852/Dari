// Load test for the search path (TODO.md Priority 1: "run realistic search load
// tests and record acceptance thresholds"). Exercises GET /listings, /listings/count,
// /listings/map and /listings/featured -- "the busiest and most complex query in the
// system" per ListingController's own comment -- under a realistic mix of filters,
// not just the unfiltered default.
//
// Requires infra/scripts/seed-load-test-data.sql already applied (50,000 listings
// across the four launch cities), and the API running with a raised search rate
// limit -- the default 120/minute exists to stop abuse, not to cap a deliberate
// benchmark of the query/app path itself, which is a different concern already
// covered by RateLimitInterceptorTest. Example:
//
//   DARI_RATE_LIMIT_SEARCH_MAX=1000000 API_PORT=8090 \
//     FIREBASE_CREDENTIALS_PATH=/absolute/path/to/service-account.json \
//     ./apps/api/mvnw -f apps/api/pom.xml spring-boot:run -Dspring-boot.run.profiles=local
//
//   k6 run infra/scripts/load-test-search.js
//
// Override the target with BASE_URL (default matches the command above).
import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8090/api/v1';
const CITIES = ['Rabat', 'Casablanca', 'Marrakech', 'Tanger'];
const CITY_CENTERS = {
  Rabat: [33.9716, -6.8498],
  Casablanca: [33.5731, -7.5898],
  Marrakech: [31.6295, -7.9811],
  Tanger: [35.7595, -5.834],
};
const PROPERTY_TYPES = ['APARTMENT', 'HOUSE', 'STUDIO'];
const ROOM_TYPES = ['PRIVATE', 'SHARED'];
const AMENITIES = ['wifi', 'parking', 'balcony', 'kitchen', 'furnished'];
const SORTS = ['recommended', 'priceAsc', 'priceDesc', 'updated'];

export const options = {
  scenarios: {
    search_mix: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },
        { duration: '2m', target: 50 },
        { duration: '15s', target: 0 },
      ],
      exec: 'searchMix',
    },
  },
  thresholds: {
    // Recorded thresholds live in docs/PRODUCTION_OPERATIONS.md alongside the
    // measured numbers this run produced -- these are deliberately loose so the
    // script itself keeps working as a regression check without needing to be
    // hand-tuned every time the dataset or hardware changes.
    http_req_failed: ['rate<0.01'],
    'http_req_duration{endpoint:search}': ['p(95)<500'],
    'http_req_duration{endpoint:count}': ['p(95)<800'],
    'http_req_duration{endpoint:map}': ['p(95)<500'],
    'http_req_duration{endpoint:radius}': ['p(95)<500'],
  },
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function get(path, tag) {
  const res = http.get(`${BASE_URL}${path}`, { tags: { endpoint: tag } });
  check(res, { 'status is 200': (r) => r.status === 200 });
  return res;
}

export function searchMix() {
  const city = pick(CITIES);
  const roll = Math.random();

  if (roll < 0.4) {
    // Plain city browse -- the most common real query, page one, default sort.
    get(`/listings?city=${city}`, 'search');
  } else if (roll < 0.6) {
    // Price-filtered browse.
    const min = 1500 + Math.floor(Math.random() * 2000);
    const max = min + 1000 + Math.floor(Math.random() * 2000);
    get(`/listings?city=${city}&priceMin=${min}&priceMax=${max}&sort=${pick(SORTS)}`, 'search');
  } else if (roll < 0.75) {
    // Property/room type filter.
    get(`/listings?city=${city}&propertyType=${pick(PROPERTY_TYPES)}&roomType=${pick(ROOM_TYPES)}`, 'search');
  } else if (roll < 0.85) {
    // Amenity AND-filter -- the path phase 07 specifically rewrote for scale.
    const a1 = pick(AMENITIES);
    let a2 = pick(AMENITIES);
    while (a2 === a1) a2 = pick(AMENITIES);
    get(`/listings?city=${city}&amenities=${a1}&amenities=${a2}`, 'search');
  } else if (roll < 0.95) {
    // Radius search around the city centre, closest-first.
    const [lat, lng] = CITY_CENTERS[city];
    get(`/listings?lat=${lat}&lng=${lng}&radiusM=5000&sort=closest`, 'radius');
  } else {
    // Count and map, asked once per filter change rather than per page.
    get(`/listings/count?city=${city}`, 'count');
    get(`/listings/map?city=${city}`, 'map');
  }
}
