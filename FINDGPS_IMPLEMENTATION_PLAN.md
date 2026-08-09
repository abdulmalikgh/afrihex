# FindGPS Mobile Implementation Plan

This plan covers the first feature in `IMPLEMENTATION_PLAN_FROM_WEB.md`:
`## 1. FindGPS (Search & lookup) - the core screen`.

The goal is to mirror the web FindGPS behavior in the Expo SDK 57 React Native app while
staying inside the mobile API scope from `mobile-api.md`.

## Current Repo State

- The app already uses Expo Router through `app/_layout.tsx` and `app/(tabs)/_layout.tsx`.
- The Find tab is wired to `src/features/search/screens/SearchScreen.tsx`, but that screen
  is still a placeholder.
- Shared UI primitives already exist under `src/components/`.
- Auth/session infrastructure already exists in
  `src/features/authentication/context/AuthSessionProvider.tsx`.
- The API client exists in `src/api/client.ts`, but there is no search API module yet.
- `expo-location` and React Query are already installed.

## Product Scope

FindGPS lets a user:

1. Search by place, Ghana GPS code, hex code, or free-text address.
2. See type-ahead suggestions.
3. Resolve a submitted query into one address result.
4. Use current location to reverse lookup the current GPS code.
5. See GPS code, coordinates, locality, quality, and map actions.
6. Explore Nearby and Business around me from the resolved point.
7. Use signed-in frequent/recent searches when authenticated.

The core search flow must work without login.

## Endpoint Summary

| Feature | Endpoint | Auth | Response object documented? |
| --- | --- | --- | --- |
| Autocomplete | `GET /v2/search/autocomplete` | No | Yes |
| Search | `GET /v2/search` | No | Yes |
| Lookup | `GET /v2/lookup` | No | Yes, from `MOBILE_API_EXAMPLES.md` |
| Reverse | `GET /v2/reverse` | No | Yes, same shape as lookup |
| Nearby | `GET /v2/nearby` | No | Yes, from `MOBILE_API_EXAMPLES.md` |
| Address parse | `GET /v2/address/parse` | No | Yes, from `MOBILE_API_EXAMPLES.md` |
| Landmark anchor search | `GET /v2/landmarks/geocode?q=&limit=` | No | Yes, from `MOBILE_API_EXAMPLES.md` |
| Business counts | `GET /v2/landmarks/around` | No | Yes |
| Business list by kind | `GET /v2/landmarks/geocode?near=&kind=&radius=&limit=` | No | Yes |
| Record recent search | `POST /v2/me/recent-searches` | Yes | Request documented in `mobile-api.md`; response not documented |
| List frequent searches | `GET /v2/me/recent-searches` | Yes | Yes |
| Delete recent search | `DELETE /v2/me/recent-searches/{id}` | Yes | Action documented in `mobile-api.md`; response not documented |
| Clear recent searches | `DELETE /v2/me/recent-searches` | Yes | Action documented in `mobile-api.md`; response not documented |

## Remaining Endpoints With Missing Response Objects

These are still missing after checking both `mobile-api.md` and `MOBILE_API_EXAMPLES.md`.
They should be implemented behind narrow parsers in `src/api/search.ts` so only one file
needs to change when the backend response shape is confirmed.

### `POST /v2/me/recent-searches`

Request body is documented. Response body is not.

Implementation guidance:

- Treat the mutation as fire-and-forget after a successful lookup.
- Do not block the result UI on this mutation.
- Invalidate `['search', 'recent']` on success.
- Parse as `void` for now unless the backend contract later documents a payload.

### `DELETE /v2/me/recent-searches/{id}` And `DELETE /v2/me/recent-searches`

These are documented as actions, but response bodies are not documented.

Implementation guidance:

- Parse as `void`.
- Invalidate `['search', 'recent']` on success.
- Surface failures only in the recent-search management UI.

## Known Response Objects

### Autocomplete

`GET /v2/search/autocomplete?q=&limit=&lat=&lng=`

```ts
type AutocompleteResponse = {
  query: string;
  count: number;
  results: Array<{
    name: string;
    display_name: string;
    latitude: number;
    longitude: number;
  }>;
};
```

### Lookup And Reverse

`GET /v2/lookup?address=`

`GET /v2/reverse?lat=&lng=`

`MOBILE_API_EXAMPLES.md` confirms reverse returns the same shape as lookup.

```ts
type LocationLookupResponse = {
  gps_name: string;
  address: string;
  region: string;
  district: string;
  area: string;
  postcode: string;
  street?: string;
  center_latitude: number;
  center_longitude: number;
  north_latitude?: number;
  south_latitude?: number;
  east_longitude?: number;
  west_longitude?: number;
  google_maps_url?: string;
  quality_score: number;
};
```

Mapping rule:

- `gpsCode` = `gps_name`
- `displayName` = `street`, `area`, `district`, `region` joined when available, falling
  back to `address`
- `latitude` = `center_latitude`
- `longitude` = `center_longitude`
- `qualityScore` = `quality_score`

### Address Parse

`GET /v2/address/parse?q=`

```ts
type AddressParseResponse = {
  query: string;
  is_code: boolean;
  parsed: {
    anchors?: Array<{
      relation?: string;
      name: string;
    }>;
    // Keep this parser narrow but tolerant because examples only show anchors.
    [key: string]: unknown;
  };
};
```

The live example confirms `is_code` and `parsed.anchors`. It does not show the extracted
code field or `geocode_query`, so the resolver should prefer those only when present and
fall back to the original query.

### Search

`GET /v2/search?q=&limit=&offset=`

```ts
type SearchResponse = {
  query: string;
  count: number;
  results: Array<{
    type: string;
    name: string;
    gps_name?: string;
    region?: string;
    district?: string;
    area?: string;
    postcode?: string;
    latitude: number;
    longitude: number;
    google_maps_url?: string;
  }>;
  did_you_mean?: string;
};
```

`did_you_mean` is mentioned in `IMPLEMENTATION_PLAN_FROM_WEB.md`, but not included in the
`mobile-api.md` search example. Treat it as optional.

### Landmark Geocode

`GET /v2/landmarks/geocode?q=&limit=`

`GET /v2/landmarks/geocode?near=<lat>,<lng>&kind=<kind>&radius=2000&limit=25`

The free-text and nearby-kind forms both return `matches`. Free-text examples include
`score`; nearby-kind examples include `distance_m`.

```ts
type LandmarkGeocodeResponse = {
  query?: string;
  count?: number;
  matches: Array<{
    id: number;
    slug: string;
    name: string;
    kind: string;
    region_code: string;
    source?: string;
    confidence: number;
    centroid: {
      lng: number;
      lat: number;
    };
    score?: number;
    distance_m?: number;
    street?: string;
    postcode?: string;
    photo_url?: string;
  }>;
};
```

Landmarks with resolved photos can return `photo_url`.

### Nearby

`GET /v2/nearby?lat=&lng=&radius=&limit=`

Important: the result array key is `locations`, not `results`.

```ts
type NearbyResponse = {
  origin: LocationLookupResponse;
  radius_km: number;
  count: number;
  has_more: boolean;
  next_cursor?: string;
  locations: Array<{
    location: LocationLookupResponse;
    distance_km: number;
  }>;
};
```

### Business Counts

`GET /v2/landmarks/around?lat=&lng=&radius=`

```ts
type LandmarkAroundResponse = {
  lat: number;
  lng: number;
  radius: number;
  count: number;
  by_kind: Array<{
    kind: string;
    count: number;
  }>;
};
```

### Recent Search List

`GET /v2/me/recent-searches?limit=20`

```ts
type RecentSearchesResponse = {
  count: number;
  searches: Array<{
    id: number;
    query: string;
    result_type: 'gps' | 'place' | 'landmark' | 'poi';
    result_ref?: string;
    display_name?: string;
    lat?: number;
    lng?: number;
    search_count: number;
    last_searched_at: string;
  }>;
};
```

## Domain Model For The Screen

Normalize successful lookup, search, and reverse responses into one UI type.

```ts
type ResolvedFindGpsResult = {
  gpsCode: string;
  displayName: string;
  latitude: number;
  longitude: number;
  region?: string;
  district?: string;
  area?: string;
  postcode?: string;
  qualityScore?: number;
  googleMapsUrl?: string;
  source: 'lookup' | 'search' | 'reverse';
};
```

This keeps the screen stable even if endpoint DTOs differ.

## API Implementation

Create `src/api/search.ts`.

Functions:

```ts
autocompleteSearch(params)
searchPlaces(params)
lookupAddress(address)
reverseLookup(params)
parseAddress(query)
getNearbyPlaces(params)
getLandmarkAround(params)
geocodeLandmarks(params)
recordRecentSearch(body)
getRecentSearches(limit)
deleteRecentSearch(id)
clearRecentSearches()
```

Add a query-string helper to `src/api/client.ts`:

```ts
buildApiPath('/v2/search/autocomplete', {
  q,
  limit,
  lat,
  lng,
});
```

Rules:

- Public endpoints must not send `X-API-Key`.
- Recent-search endpoints must use `authenticated: true`.
- Request-affecting params must be included in React Query keys.
- Stale autocomplete requests should not overwrite newer UI state.
- All endpoint parsing should live in `src/api/search.ts`, not inside React components.

## Resolver Flow

Create `src/features/search/hooks/useFindGpsSearch.ts`.

Flow:

1. Trim the submitted query.
2. If it is GPS-code-shaped or hex-code-shaped, call `lookupAddress(query)`.
3. Otherwise call `parseAddress(query)`.
4. If parse says the query is a code and exposes an extracted code, call
   `lookupAddress(extractedCode)`.
5. Otherwise call `searchPlaces({ q: geocodeQuery || query, limit: 1 })`. If
   `geocodeQuery` is absent, use the original query.
6. If the first search result has `gps_name`, call `lookupAddress(gps_name)`.
7. If the first search result only has coordinates, call `reverseLookup({ lat, lng })`.
8. If search returned no usable result and `did_you_mean` exists, show a suggestion CTA.
9. If no fallback resolves a result, show an empty state.
10. After success, cache the lookup locally and record recent search if authenticated.

Hook state:

```ts
type FindGpsState =
  | { status: 'idle' }
  | { status: 'loading'; query: string }
  | { status: 'success'; query: string; result: ResolvedFindGpsResult }
  | { status: 'empty'; query: string; didYouMean?: string }
  | { status: 'error'; query: string; message: string };
```

## Screen Implementation

Replace `src/features/search/screens/SearchScreen.tsx`.

Use:

- `Screen`
- `AppText`
- `SearchBar`
- `AppButton`
- `ResultCard`
- `CodeChip`
- `LoadingState`
- `EmptyState`
- `ErrorBanner`
- `SegmentedControl`

Layout:

1. Title: `Your address, one code.`
2. Subtitle: `Search a place, GPS code, address, or use your location.`
3. Search row with input, microphone icon button, and Search button.
4. Autocomplete suggestion list below the input.
5. Map preview area with selected pin/result state.
6. Floating current-location button.
7. Recent/frequent search chips.
8. Result card.
9. Tabs under result: `Nearby` and `Business around me`.

The microphone button can be present as a disabled or no-op UI affordance until voice input
is explicitly implemented.

## Current Location Flow

Use `expo-location`.

1. User taps the current-location button.
2. Request foreground permission.
3. If denied, show a non-blocking message and keep manual search available.
4. If granted, read current coordinates.
5. Call `GET /v2/reverse?lat=&lng=`.
6. Normalize and show the result.

Before implementing this code, read the exact Expo SDK 57 Location docs.

## Nearby Tab

Enabled only after a resolved result exists.

Call:

```txt
GET /v2/nearby?lat=<result.latitude>&lng=<result.longitude>&radius=0.5&limit=5
```

States:

- Loading: compact loading row.
- Empty: `No nearby places found.`
- Error: inline retry.
- Success: list nearby places.

Read `data.locations`, not `data.results`. Each item wraps a full `location` object and a
`distance_km` number.

## Business Around Me Tab

Enabled only after a resolved result exists.

Counts:

```txt
GET /v2/landmarks/around?lat=<result.latitude>&lng=<result.longitude>&radius=2000
```

Render `by_kind` as chips.

List by kind:

```txt
GET /v2/landmarks/geocode?near=<lat>,<lng>&kind=<kind>&radius=2000&limit=25
```

Render each POI with:

- Name
- Kind
- Street when present
- Distance
- Confidence

Tapping a POI should open a detail state and prepare route data for the Directions feature.

## Frequent And Recent Searches

Use `useAuthSession()`.

Authenticated:

- Load `GET /v2/me/recent-searches?limit=10`.
- Render as tappable chips.
- After a successful resolved search, fire `POST /v2/me/recent-searches`.
- Do not block result UI on the record mutation.

Anonymous:

- Do not call authenticated endpoints.
- Show locally cached recent lookups when local persistence exists.

## Local Cache

Implement as a small follow-up if the first pass needs to avoid adding a storage dependency.

Target behavior:

- Cache every successful resolved lookup.
- Dedupe by GPS code or normalized query.
- Cap recent lookups to 20.
- On offline lookup failure, show cached result when available.
- Cache failures must never crash or block search.

## Accessibility

- Search input needs a clear placeholder and label.
- Icon-only microphone/current-location/copy/share buttons need `accessibilityLabel`.
- Use `Pressable` for interactive rows/chips.
- Loading buttons must expose busy state.
- Do not rely on color alone for quality or error states.
- Avoid fixed-height text containers for address strings.

## Validation

Run after implementation:

```bash
npx tsc --noEmit
```

If a test runner is added, cover:

- Search API parsers.
- Resolver fallbacks.
- GPS/hex short-circuit to lookup.
- `did_you_mean` empty-state behavior.
- Current-location permission denial.
- Recent-search mutation only when authenticated.

## Build Order

1. Add query-param helper to `src/api/client.ts`.
2. Add typed `src/api/search.ts`.
3. Add `ResolvedFindGpsResult` and mapper helpers.
4. Add `useFindGpsSearch`.
5. Replace the placeholder `SearchScreen`.
6. Add autocomplete.
7. Add current-location reverse lookup.
8. Add result card.
9. Add Nearby tab.
10. Add Business around me tab.
11. Add authenticated recent/frequent searches.
12. Add local/offline recent lookup persistence.
