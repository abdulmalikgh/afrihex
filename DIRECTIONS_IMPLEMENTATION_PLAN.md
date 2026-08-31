# Directions Mobile Implementation Plan

This plan covers the second feature in `IMPLEMENTATION_PLAN_FROM_WEB.md`:
`## 2. Directions (routing, traffic, transit, navigation)`, cross-checked against
`MOBILE_IMPLEMENTATION_PLAN.md` Phase 4, `mobile-api.md`'s Navigation section, and the
live-captured payloads in `MOBILE_API_EXAMPLES.md` §2 and §4.

The goal is to mirror the web Directions behavior (screenshot: web `Directions` tab —
Route/Isochrone/Map Match/Optimise sub-tabs, From/To inputs, mode row, narration/avoid
toggles, avoid-locations pin, "Get Directions") while adapting it to mobile-native
patterns, and to go further where the API supports more than the web UI currently
exposes.

## Current Repo State

- `app/(tabs)/directions.tsx` already routes to
  `src/features/navigation/screens/DirectionsScreen.tsx`, which is a `PlaceholderScreen`.
- `src/features/navigation/{api,components,hooks,schemas,types,utils}/` exist but are
  empty (`.gitkeep` only).
- No `src/api/route.ts` yet — `src/api/search.ts` and `src/api/auth.ts` are the patterns
  to follow (typed request/response, narrow runtime parsers, `apiRequest`/`buildApiPath`
  from `src/api/client.ts`).
- `src/api/client.ts` already returns `parseData(undefined)` for a `204` (empty body)
  response, so `POST /v2/navigation/arrival` needs no special-casing.
- FindGPS (`src/features/search/`) is the reference implementation for: resolver hooks,
  React Query key conventions, offline-cache deferral, and screen composition. Reuse its
  patterns rather than inventing new ones.
- `react-native-maps` is already the map library in use (`SearchScreen.tsx`'s
  `InteractiveMap`), not MapLibre. Follow that convention for Directions too — per
  AGENTS.md, existing repo conventions win over the skill's generic MapLibre default.
  Introduce MapLibre only if a concrete `react-native-maps` limitation (route-line
  performance, offline tiles) shows up.
- `src/utils/landmarkKinds.ts` (`getKindIcon`, `formatKind`, `formatDistance`) and
  `src/utils/haptics.ts` (`hapticLight/Success/Warning/Selection`) already exist and
  should be reused for POI icons and turn/arrival feedback instead of re-implementing
  them under `src/features/navigation/`.
- No local KV/SQLite dependency is installed yet (`package.json` has none). The offline
  caching described in `IMPLEMENTATION_PLAN_FROM_WEB.md` §5 must stay a deferred
  follow-up, same call FindGPS made — do not add a storage library speculatively.

## Product Scope

Directions lets a user:

1. Set a From and a To point — searched via the same resolvers FindGPS uses (place name,
   GPS code, hex code, or free text), tapped on the map, or set to current location.
2. Pick a travel mode: Drive, Okada, Walk, Bike — or switch to Transit (trotro/bus).
3. Toggle narration style and flood-zone avoidance, and add avoid-locations.
4. Get a route: distance, ETA, traffic note, warnings, unpaved/flood badges, alternatives.
5. See the route line on a map, colour-tinted per segment by traffic.
6. See a turn-by-turn steps list.
7. See a live traffic panel (signed-in only, fails open/hidden otherwise).
8. See transit itineraries (signed-in only) when Transit mode is picked.
9. Start navigation and, on arrival or give-up, send arrival telemetry — this is public,
   fire-and-forget, and feeds the learned-traffic loop regardless of auth state.

The route-planning and result flow must work fully signed-out (`/v2/route/public`).
Traffic and transit are signed-in upgrades that degrade silently, never as errors.

### Where this can beat the web UI

- The web's narration control is a single "Landmark narration" boolean. The API's
  `narration` field is a 3-way enum (`landmark | street | both`) — use a 3-way
  `SegmentedControl` instead of a checkbox; it is strictly more capable for the same
  request shape, and `SegmentedControl` already exists as a shared component.
- The web's hex heat-grid overlay (AQI / flood-risk cells across all of Ghana) is
  desktop analysis tooling. `IMPLEMENTATION_PLAN_FROM_WEB.md` §3 already deprioritizes a
  general hex/grid explorer for mobile — don't rebuild it. Instead surface the same
  hazard data (`route/flood-zones`, `weather/alerts`) as an optional toggleable overlay
  scoped to the current route/viewport, and lean on the route response's own
  `warnings` / `flood_crossings` / `flood_avoidance_failed` fields (already computed
  server-side per request) for the primary hazard signal shown on the result card.
- "Avoid locations" on the web is a "+Pin" button that presumably opens a picker. On
  mobile, drop a pin by long-pressing the map (consistent with FindGPS's tap-to-pick
  pattern) — no separate picker screen needed.
- Add a one-tap From/To swap button (the web has a plain down-arrow divider with no
  described swap behavior).
- Use `hapticWarning()` (already in `src/utils/haptics.ts`) for reroute/give-up and
  `hapticSuccess()` on arrival telemetry send, and use `getKindIcon`/`formatKind` for
  `landmarks_passed` and along-route POIs instead of new icon mapping.
- Badge `recommended` alternatives and `flood_avoidance_failed` routes explicitly — the
  API marks these but a literal web-layout mirror wouldn't surface them.

## Endpoint Summary

| Feature | Endpoint | Auth | Response documented? |
| --- | --- | --- | --- |
| Resolve From/To (GPS code) | `GET /v2/lookup` | No | Yes — reuse `src/api/search.ts` |
| Resolve From/To (free text / hex) | `GET /v2/address/parse`, `GET /v2/search`, `GET /v2/reverse`, `GET /v2/address/resolve` | No | Yes (parse/search/reverse reuse search.ts; `address/resolve` documented in `mobile-api.md`, no example in `MOBILE_API_EXAMPLES.md`) |
| Route (signed in) | `POST /v2/route` | Yes | Yes, `MOBILE_API_EXAMPLES.md` §2a (full) |
| Route (anonymous) | `POST /v2/route/public` | No | Confirmed identical to `/route` — same handler, same response type, same envelope; only difference is middleware (IP-throttled 30 concurrent, no metered quota) |
| Traffic panel | `GET /v2/route/traffic` | Yes (fail-open) | Yes, §2b — **not present in `mobile-api.md` at all** |
| Transit itineraries | `POST /v2/route/transit` | Yes | Yes, §2c — **not present in `mobile-api.md` at all** |
| Landmarks along route | `POST /v2/route/along` | Yes | Yes, §2d (full example); `mobile-api.md` only name-drops it (line 391) |
| Navigation arrival telemetry | `POST /v2/navigation/arrival` | No (public, throttled) | Yes, §2e — `204 No Content` |
| Static route image | `GET /v2/route/static` | No | Yes, §2f — see contract gap below |
| Flood-prone zones (overlay) | `GET /v2/route/flood-zones` | No | Yes, §4a |
| GMet weather alerts (overlay) | `GET /v2/weather/alerts` | No | Yes, §4b |
| Rain-ahead forecast (overlay) | `GET /v2/precipitation-forecast` | No | Yes, §4c |

## Contract Gaps To Confirm With Backend

These surfaced while cross-checking `mobile-api.md` (the authoritative contract per
AGENTS.md) against `MOBILE_API_EXAMPLES.md` (the backend-provided fill-in for payloads
missing from the contract). Build against `MOBILE_API_EXAMPLES.md` where they conflict,
since it's captured live, but get these confirmed/fixed upstream before shipping:

1. **`route/traffic` and `route/transit` are entirely absent from `mobile-api.md`.**
   `grep -i "traffic\|transit" mobile-api.md` matches nothing except the `traffic_note`
   field. They're real (captured, working examples exist), so `mobile-api.md` is just
   stale — flag it, don't block on it.
2. **`route/static` width/height contradiction.** `mobile-api.md:213` says query params
   include `width`/`height`. `MOBILE_API_EXAMPLES.md:539` (captured live) says the
   opposite: *"`width`/`height` are **not** accepted — the size is fixed"* at a fixed
   800×500. Build to the fixed-size behavior; don't expose a size control in the UI.
3. **No documented `language` values.** The web screenshot has a "Twi instructions"
   toggle. Neither doc lists accepted `language` codes (only `"en"` / `"en-US"` appear in
   examples) or confirms Twi narration exists server-side. Treat this as **unconfirmed —
   do not build the toggle** until backend confirms a language code; guessing a value
   like `"tw"` would be guessing the backend contract, which AGENTS.md explicitly
   prohibits.
4. ~~`route/public` has no dedicated captured example~~ — **resolved**: backend confirmed
   `/route` and `/route/public` share the exact same handler, response type, and `meta`
   envelope; only the middleware differs (IP throttle vs metered quota). One parser for
   both is correct, no anonymous-response edge case to guard for.
5. **`POST /v2/address/resolve`** (needed for hex-code From/To input, per
   `IMPLEMENTATION_PLAN_FROM_WEB.md` §3) is documented in `mobile-api.md` but has no
   captured example in `MOBILE_API_EXAMPLES.md`. Reuse whatever shape FindGPS's hex
   handling already assumes; if FindGPS hasn't implemented hex input yet either, this is
   a shared gap, not new to Directions.
6. **`src/api/client.ts`'s `ApiMeta.latency` is typed `number`, but a real captured
   response returns it as a string** (`"6.687291393s"` — Go's `time.Duration.String()`
   output, not seconds-as-float). Harmless today since `apiRequest` discards `meta`
   entirely and no feature code reads `latency` — but don't trust the existing type if a
   future feature (e.g. a debug/perf overlay) starts reading it; fix the type then,
   since it's unrelated to Directions work.

## Known Response/Request Objects

### Route request (shared by `/route` and `/route/public`)

```ts
type RoutePoint = { lat: number; lng: number };
type RouteEndpoint =
  | { point: RoutePoint }
  | { hex: string }
  | { gps_code: string };

type RouteMode = 'driving' | 'foot' | 'bicycle' | 'motor_scooter';
type RouteNarration = 'landmark' | 'street' | 'both';

type RouteRequest = {
  from: RouteEndpoint;
  to: RouteEndpoint;
  mode?: RouteMode; // omitted/'' defaults to 'driving'; 'okada' is an alias for motor_scooter
  narration?: RouteNarration;
  language?: string; // only 'en' / 'en-US' confirmed — see gap #3
  avoid_locations?: RoutePoint[];
  avoid_polygons?: Array<Array<[number, number]>>; // [lng, lat] rings — not built for v1, see below
  avoid_flood_zones?: boolean;
  lite?: boolean; // true = polyline + distance/duration/ETA only
};
```

### Route response

Only `distance_m`, `duration_s`, `eta_s`, `traffic_note`, `coordinates`, `steps`,
`landmarks_passed` are guaranteed. Everything else is `omitempty` server-side — absent
whenever that route didn't trigger it (e.g. a route with no flood crossings simply omits
`flood_crossings`/`rain_note`/`warnings`/`alternatives` entirely, not `null`/`0`/`[]`).
**Parse them all as optional and code defensively**, per `MOBILE_API_EXAMPLES.md:395-406`.
`steps` and `landmarks_passed` themselves are always arrays (`[]` when empty), never
`null` — the parser doesn't need a null-guard on those two specifically, only on the
`omitempty` scalars/objects around them:

```ts
type RouteStep = {
  instruction: string;
  verbal_instruction?: string;
  verbal_post?: string;
  verbal_alert?: string; // per-step, present only when the maneuver has a voice alert
  instruction_landmark?: string;
  near_landmark?: string;
  distance_m: number;
  duration_s: number;
  coordinates: Array<[number, number]>; // [lng, lat]
  surface?: string;
  surface_color?: string;
  bearing_before?: number;
  bearing_after?: number;
  turn_angle?: number;
  turn_class?: string;
  traffic_factor?: number;
  traffic_severity?: string;
  traffic_color?: string; // use to tint the polyline segment
};

type LandmarkPassed = {
  slug: string;
  name: string;
  side?: string;
  at_step: number;
  centroid: { lng: number; lat: number };
};

type RouteAlternative = {
  distance_m: number;
  duration_s: number;
  eta_s: number;
  coordinates: Array<[number, number]>;
  recommended?: boolean;
  recommend_reason?: string;
  rain_note?: string;
  rain_eta_penalty_s?: number;
  flood_crossings?: number;
  has_unpaved?: boolean; // absent = all paved OR not resolved — treat as "unknown", not "false"
  unpaved_distance_m?: number; // 0 is omitted; present only alongside has_unpaved
};

type RouteResponse = {
  distance_m: number;
  duration_s: number;
  eta_s: number;
  traffic_note: string;
  coordinates: Array<[number, number]>;
  steps: RouteStep[];
  landmarks_passed: LandmarkPassed[];
  has_highway?: boolean;
  warnings?: string[];
  flood_avoidance_failed?: boolean; // badge as unsafe; never present as flood-avoiding
  alternatives?: RouteAlternative[]; // up to 2, never in lite mode
  recommended?: boolean;
  recommend_reason?: string;
  rain_note?: string;
  rain_eta_penalty_s?: number;
  flood_crossings?: number;
  has_unpaved?: boolean;
  unpaved_distance_m?: number;
};
```

### Traffic feed

`GET /v2/route/traffic` (auth) — no query params, hide the panel on `401` (fail-open,
never an error state):

```ts
type TrafficCell = {
  road_class: string;
  factor: number;
  severity: string;
  color: string;
  source: string;
};

type TrafficResponse = {
  traffic: {
    time_bucket: string;
    note: string;
    cells: TrafficCell[];
  };
};
```

Note this response has no top-level `success`/`data` envelope wrapper documented in the
example (`{ success, traffic }`, not `{ success, data }`) — the existing `apiRequest`
helper assumes `data`. This endpoint needs its own thin fetch/parse, not a call through
`apiRequest`'s `parseData(responseBody.data)` path — verify against a live call before
wiring, since a mismatch here would silently return `undefined`.

### Transit

```ts
type TransitRequest = {
  from_lat: number;
  from_lng: number;
  to_lat: number;
  to_lng: number;
  date?: string; // YYYY-MM-DD, default now
  time?: string; // HH:MM, default now
  modes?: string; // case-insensitive substring test, not an enum
};

type TransitLeg = {
  mode: 'WALK' | 'BUS';
  start_time: number;
  end_time: number;
  duration_s: number;
  distance_m: number;
  from_name: string;
  from_lat: number;
  from_lng: number;
  to_name: string;
  to_lng: number;
  to_lat: number;
  route_short_name?: string;
  route_long_name?: string;
  geometry?: Array<[number, number]>; // fall back to a straight from/to line when absent
  stops?: Array<{ name: string; lat: number; lng: number }>;
};

type TransitItinerary = {
  start_time: number;
  end_time: number;
  duration_s: number;
  walk_distance_m: number;
  transfers: number;
  legs: TransitLeg[];
};

type TransitResponse = {
  count: number;
  itineraries: TransitItinerary[];
};
```

`max_walk_m` is accepted but currently ignored server-side — don't build a walk-distance
slider that implies it works.

### Landmarks along route (optional, build last)

```ts
type RouteAlongRequest = {
  coordinates: Array<[number, number]>; // [lng, lat] — reuse the resolved route's coordinates
  kinds?: string[];
  buffer_m?: number;
};

type RouteAlongResponse = {
  count: number;
  landmarks: Array<{
    id: number;
    slug: string;
    name: string;
    kind: string;
    confidence: number;
    centroid: { lng: number; lat: number };
    distance_m: number;
  }>;
};
```

### Navigation arrival telemetry

```ts
type ArrivalTelemetryRequest = {
  dest_lat?: number;
  dest_lng?: number;
  final_lat?: number;
  final_lng?: number;
  profile?: 'driving' | 'foot' | 'bicycle'; // anything else normalizes to 'driving' server-side
  route_distance_m?: number;
  route_duration_s?: number;
  rerouted?: boolean;
  arrived?: boolean; // defaults to true server-side when omitted; false = give-up
  origin_lat?: number;
  origin_lng?: number;
  started_at?: string;
  arrived_at?: string;
  achieved_duration_s?: number; // preferred over started_at/arrived_at when present
  shape?: string; // encoded polyline6, optional
};
```

Response is `204 No Content`. All fields are optional and fail-open (malformed JSON is
the only 400) — send whatever is known, never block on missing GPS fix data.

### Hazard overlays (map layers, all public GeoJSON)

`route/flood-zones`, `weather/alerts`, `precipitation-forecast` are standard
`FeatureCollection`s (`Polygon`/`MultiPolygon`/`Point` geometries) — see
`MOBILE_API_EXAMPLES.md` §4a–4c for exact `properties` shapes. These render as optional
`react-native-maps` `Polygon`/`Circle`/`Marker` overlays.

**Confirmed: zone geometry never comes from the route response.** `RouteResponse`
carries only scalars/text about hazards (`flood_crossings` — a count, `warnings`,
`rain_note`, `rain_eta_penalty_s`) — no polygons. The three overlay endpoints are the
only source of drawable geometry and are a genuinely separate fetch, not something
derivable from `planRoute`'s result.

**Payload sizes make this a deliberate, opt-in fetch, not an always-on layer:**

| Endpoint | Payload |
| --- | --- |
| `GET /v2/route/flood-zones` | ~3.97 MB GeoJSON (gzipped in transit, still large) |
| `GET /v2/weather/alerts` | ~487 KB GeoJSON |
| `GET /v2/precipitation-forecast` | ~15 KB GeoJSON |

- Fetch `flood-zones` and `weather/alerts` only when the user explicitly toggles the
  hazard-overlay layer on — never on screen mount, and never per-route-request.
- Cache `flood-zones` client-side once fetched (it changes rarely) instead of refetching
  it every time the layer is toggled or a new route is planned; ~4 MB per route would be
  a real cost on cellular. `precipitation-forecast` is small enough and time-sensitive
  enough (next-6h window) to refetch more freely.
- `Cache-Control` headers are already sane server-side (`max-age=600`/`300`/`600` per
  §4a–4c) — a simple React Query `staleTime` matching those windows is enough; no need
  for a custom disk cache beyond what Phase 5 polish requires.

## Domain Model For The Screen

Reuse `ResolvedFindGpsResult` (from `src/features/search/hooks/useFindGpsSearch.ts`) as
the shape for a resolved From/To point instead of inventing a parallel type — Directions
needs exactly the same `{ gpsCode, displayName, latitude, longitude, ... }` fields FindGPS
already resolves to.

```ts
type RouteEndpointInput =
  | { kind: 'resolved'; result: ResolvedFindGpsResult }
  | { kind: 'currentLocation' };

type PlannedRoute = {
  distanceM: number;
  durationS: number;
  etaS: number;
  trafficNote: string;
  coordinates: Array<[number, number]>;
  steps: RouteStep[];
  landmarksPassed: LandmarkPassed[];
  warnings: string[];
  floodAvoidanceFailed: boolean;
  alternatives: RouteAlternative[];
  hasUnpaved: 'yes' | 'no' | 'unknown';
  unpavedDistanceM?: number;
  floodCrossings?: number;
  recommended: boolean;
  recommendReason?: string;
  raw: RouteResponse; // keep the raw response for step-detail rendering
};

type DirectionsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; route: PlannedRoute }
  | { status: 'noRoute'; message: string } // 404 NO_ROUTE
  | { status: 'error'; message: string }
  | { status: 'offline'; route: PlannedRoute; cachedAt: string }; // see Offline section
```

## API Implementation

Create `src/api/route.ts` following `src/api/search.ts`'s pattern exactly: typed request
params, one exported function per endpoint, one `parse*` function per response shape,
`isObject`/`getOptionalString`/`getOptionalNumber` reused from `client.ts` where
possible (consider promoting those three helpers out of `search.ts` into `client.ts` if
`route.ts` needs them too, rather than duplicating them).

Functions:

```ts
planRoute(body: RouteRequest, isAuthenticated: boolean): Promise<RouteResponse>
// picks POST /v2/route vs /v2/route/public based on isAuthenticated; both share a parser

getTrafficFeed(): Promise<TrafficResponse>
// separate fetch path — see the traffic response-envelope note above

getTransitItineraries(body: TransitRequest): Promise<TransitResponse>

getLandmarksAlongRoute(body: RouteAlongRequest): Promise<RouteAlongResponse>

sendArrivalTelemetry(body: ArrivalTelemetryRequest): Promise<void>
// authenticated: false always — this endpoint takes no X-API-Key

getStaticRouteImageUrl(params): string
// builds the GET /v2/route/static URL string for an <Image> fallback; no auth, no
// width/height params (gap #2)

getFloodZones(): Promise<GeoJSON.FeatureCollection>
getWeatherAlerts(): Promise<GeoJSON.FeatureCollection>
getPrecipitationForecast(): Promise<GeoJSON.FeatureCollection>
```

Rules:

- `planRoute`'s `mode` parameter must literally omit the key when unset rather than send
  `""`, matching `buildApiPath`'s existing convention of dropping empty values (already
  true for query strings; for a POST JSON body, apply the same rule manually — drop keys
  with `undefined`, don't send empty strings).
- `avoid_flood_zones`, `avoid_locations` must only be included in the request body when
  the user actually set them — don't send `avoid_locations: []`.
- Traffic/transit/along calls must use `authenticated: true`; route/static and hazard
  overlays must not send `X-API-Key` at all (mobile-api.md explicitly marks them public).

## From/To Resolver

Do not build a second, parallel resolver. Directions needs the exact same GPS-code /
hex-code / free-text / current-location resolution FindGPS already implements in
`useFindGpsSearch`. Two options, in order of preference:

1. **Extract the fallback-chain logic** (`lookupAddress` → `parseAddress` →
   `searchPlaces` → `reverseLookup`) out of `useFindGpsSearch` into a shared
   `resolveAddressQuery(query)` helper both features call, and give Directions its own
   thin hook (`useRouteEndpoint`) that wraps it twice (once per From/To field) instead of
   once.
2. If extraction is too large a refactor for this pass, duplicate only the minimal
   resolve call sequence into `src/features/navigation/hooks/useRouteEndpointSearch.ts`,
   and leave a comment pointing at `useFindGpsSearch` as the source of truth — but prefer
   option 1, since two independently-maintained copies of the same fallback chain is
   exactly the kind of duplication AGENTS.md's "Never Do This" section warns about.

Additional Directions-only behavior:

- **Current location as origin**: reuse `SearchScreen.tsx`'s permission-request +
  `getLastKnownPositionAsync`/`getCurrentPositionAsync` sequence (don't reinvent it);
  wire it to the From field specifically, defaulting From to current location when the
  screen opens if permission is already granted.
- **Tap-to-pick on map**: long-press on the route-planning map sets whichever of
  From/To was last focused, using `reverseLookup({ lat, lng })` to get a display label.
- **Hex code input**: short-circuit straight to `lookupAddress`/`address/resolve` the
  same way FindGPS treats GPS-code-shaped input, per the `IMPLEMENTATION_PLAN_FROM_WEB.md`
  §3 "must keep" rule.
- **Swap button**: swaps the two resolved endpoints and re-triggers a route request if a
  route is already showing.

## Screen Implementation

Replace `src/features/navigation/screens/DirectionsScreen.tsx`. Reuse shared components:
`Screen`, `AppText`, `AppButton`, `AppInput`/`SearchBar`, `SegmentedControl`,
`BottomSheet`, `ResultCard`, `LoadingState`, `EmptyState`, `ErrorBanner`, `CodeChip`,
`Toast`, `Skeleton`/`SkeletonCardList`.

Layout (mobile-adapted from the web screenshot):

1. Map fills the screen (mirrors `SearchScreen`'s `InteractiveMap`/`MapFallback`
   pattern — same web-fallback treatment for `Platform.OS === 'web'`).
2. Floating From/To card pinned to the top: two inputs (From defaults to current
   location when available), a swap button between them, and a leading dot/pin icon per
   row (matches the web's green/red endpoint dots).
3. Mode row directly under the From/To card: `SegmentedControl` for
   Drive/Okada/Walk/Bike, plus a separate "Transit" toggle button (transit is a distinct
   request path, not a `SegmentedControl` option, since it hits a different endpoint with
   a different request/response shape).
4. An options row/sheet: narration (`SegmentedControl`: Street/Landmark/Both), "Avoid
   flood-prone roads" toggle, "Avoid locations" (chips + long-press-to-add, per the
   Product Scope section above). No Twi toggle until gap #3 is resolved.
5. "Get Directions" primary `AppButton`, disabled until both From and To resolve.
6. Result `BottomSheet` (reuse the existing component, don't build a new sheet): collapsed
   peek shows distance/ETA/traffic note; medium snap shows warnings/badges + alternatives;
   expanded snap shows the full steps list.
7. Route polyline + per-segment traffic tint + `landmarks_passed` pins on the map,
   rendered with `react-native-maps`'s `Polyline`/`Marker`, matching `SearchScreen`'s
   marker-bubble visual style for consistency.
8. "Start navigation" action inside the result sheet (see Navigation Mode below).

## Build Order (mirrors the web-mirror plan's own suggested sequence)

`IMPLEMENTATION_PLAN_FROM_WEB.md` line 206 already specifies this order — follow it
rather than building everything at once:

### Phase 1 — Route + steps (core, ships first)

1. Add `src/api/route.ts` with `planRoute` + parsers (guaranteed + optional fields).
2. Extract or wrap the From/To resolver (see above).
3. Build the From/To card, mode row, narration/flood/avoid-locations options, and "Get
   Directions" submission wired to `planRoute` (`/route` vs `/route/public` by auth
   state).
4. Render the result sheet: distance/ETA/traffic note, warnings, `flood_avoidance_failed`
   badge, `has_unpaved`/`unpaved_distance_m` (treating absence as "unknown", not "no"),
   alternatives list with `recommended` badge.
5. Render the polyline + traffic-tinted segments + `landmarks_passed` pins.
6. Handle `404 NO_ROUTE` distinctly from generic errors (`noRoute` state, not `error`).

### Phase 2 — Traffic panel

7. Add `getTrafficFeed` with its own response-envelope handling (see the gap noted
   above).
8. Render as a collapsible panel inside the result sheet, signed-in only, hidden (not
   an error banner) on `401` or when anonymous.

### Phase 3 — Transit

9. Add "Transit" as an alternate submission path (`getTransitItineraries`), signed-in
   only.
10. Render itineraries: walk legs vs bus legs (`route_short_name`/`route_long_name`),
    `geometry`/`stops` on the map with straight-line fallback when absent.
11. Show "a bus route doesn't beat walking here" when every itinerary is walk-only.

### Phase 4 — Navigation + arrival telemetry

12. "Start navigation" enters a lightweight in-progress state: track current position
    with `expo-location` foreground watch, keep the destination pinned, and expose
    "Arrived" / "Give up" actions.
13. On either action (or an automatic arrival geofence check within a small radius of
    the destination), call `sendArrivalTelemetry` with `origin_lat/lng` (route start),
    `dest_lat/lng` (route end), `final_lat/lng` (last known position),
    `achieved_duration_s` (elapsed since start), and `arrived` (`true`/`false`
    accordingly). Fire-and-forget; a failed send must never block the UI.
14. Full turn-by-turn voice guidance (reading `verbal_instruction`/`verbal_alert` aloud,
    live rerouting) is a larger follow-on scope — track it separately rather than
    folding it into this pass; the static steps list + manual arrival/give-up flow above
    already satisfies the "send telemetry on arrive/give-up" requirement without it.

### Phase 5 — Optional polish (build only if time remains)

15. `getLandmarksAlongRoute` (`route/along`) — POIs along the confirmed route,
    reusing `getKindIcon`/`formatKind`/`formatDistance`.
16. Hazard overlay toggle on the map (`route/flood-zones`, `weather/alerts`,
    `precipitation-forecast`) as `Polygon`/`Marker` layers — user-triggered fetch only,
    given the ~4 MB flood-zones payload; cache it client-side once loaded (see the
    Hazard overlays note above).
17. `avoid_polygons` UI (draw-a-no-go-zone) — the API supports it but no web reference
    UI exists for it; skip unless explicitly requested.
18. `GET /v2/route/static` as an `<Image>` fallback for `Platform.OS === 'web'` (parallel
    to `SearchScreen`'s `MapFallback`), since native maps already work in this repo — this
    is a nice-to-have parity item, not a blocker.

## Offline

Mirrors `IMPLEMENTATION_PLAN_FROM_WEB.md` §5. Defer actual persistence exactly like the
FindGPS plan did, for the same reason (no storage dependency justified yet) — but design
for it now so Phase 1's code doesn't need reshaping later:

- Normalize a trip key as `from|to|profile`, case/whitespace-insensitive (trim, collapse
  spaces, uppercase), matching the FindGPS `normalizeQuery` helper already in
  `SearchScreen.tsx` — reuse that function rather than writing a second normalizer.
- On every successful `planRoute` call, the intended cache write is "remember this route
  under its trip key," capped at 10 entries, evicting oldest first.
- On a `planRoute` failure, the intended read is "look up the cached route for this exact
  trip key and show it with an `offline — showing your last saved route` banner" — this
  is the `offline` `DirectionsState` variant above.
- Traffic and transit stay hidden (not error states) when offline, consistent with them
  already being fail-open when unauthenticated.
- A cache write/read failure must never crash or block route planning — same rule as
  FindGPS's local cache.
- Implement the actual storage layer as a follow-up once a KV dependency is justified
  across both features (FindGPS recent lookups + Directions recent routes), rather than
  picking one now for Directions alone.

## Accessibility

- From/To inputs need clear labels distinguishing "from"/"to" for screen readers, not
  just placeholder text.
- Mode `SegmentedControl` and the Transit toggle need `accessibilityRole="tab"`/`"button"`
  with state (`SegmentedControl` already sets `accessibilityState={{ selected }}`).
- Icon-only swap/current-location/long-press-to-add-avoid-location affordances need
  `accessibilityLabel`.
- Traffic severity and flood-risk badges must not rely on color alone — pair
  `traffic_color`/flood badges with text (`severity`, "Flood risk" label), consistent
  with AGENTS.md's accessibility rules.
- "Start navigation" / "Arrived" / "Give up" buttons must expose busy state while a
  location fix or telemetry send is in flight.
- Steps list rows must not use fixed heights — `instruction`/`instruction_landmark` text
  length varies.

## Validation

Run after implementation:

```bash
npx tsc --noEmit
```

If a test runner is added, cover (per `AGENTS.md`'s Testing section):

- Route request body construction — mode/narration/avoid_flood_zones/avoid_locations
  presence, and specifically the `[lng, lat]` coordinate order end-to-end (request
  points are `{lat, lng}`, but response `coordinates` are `[lng, lat]` — an easy swap
  bug).
- Auth branching: `/route` vs `/route/public` selection.
- Optional-field handling on `RouteResponse` (absent `has_unpaved` treated as
  "unknown", not `false`).
- `404 NO_ROUTE` handled as a distinct state from generic errors.
- Traffic panel hidden (not errored) on `401`/anonymous.
- Arrival telemetry fires exactly once per arrive/give-up and never blocks the UI on
  failure.

## Build Order Summary

1. `src/api/route.ts` (Phase 1 endpoints + parsers).
2. Extract/share the From/To resolver with FindGPS.
3. Replace `DirectionsScreen` placeholder with the From/To + mode + options UI.
4. Wire `planRoute`, result sheet, polyline rendering, `404 NO_ROUTE` handling.
5. Add the traffic panel (Phase 2).
6. Add Transit mode (Phase 3).
7. Add navigation-in-progress state + arrival telemetry (Phase 4).
8. Add landmarks-along-route, hazard overlays, static-image web fallback (Phase 5,
   time-permitting).
9. Defer offline persistence until a shared KV dependency is justified for both FindGPS
   and Directions.

Keep this plan, `mobile-api.md`, and `MOBILE_API_EXAMPLES.md` in sync as the backend
contract gaps above get resolved.
