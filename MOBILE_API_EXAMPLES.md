# AfriHex Mobile API — Request/Response Reference (captured live)

**Audience:** mobile dev team · **Captured:** 2026-08-09 · **Contract-verified:** 2026-08-11
against `https://api.afrihex.com` + the Go source + `docs/openapi.yaml`

Every payload below is a **real response** from the live API (trimmed where noted),
unless marked "(shape as defined in code)". All JSON bodies use
`Content-Type: application/json`. Authenticated endpoints send `X-API-Key: <token>`;
**public endpoints take no key.** Response envelope: `{ success, data, meta }`; errors:
`{ success:false, error:{ code, message } }`.

---

## 1. Search & lookup (FindGPS)

### 1a. Type-ahead suggestions

```
GET /v2/search/autocomplete?q=kaneshie market&limit=8
```

```json
{
  "success": true,
  "data": {
    "query": "kaneshie market",
    "count": 8,
    "results": [
      {
        "name": "Kaneshie Market",
        "display_name": "Kaneshie Market, Ablekuma Central Municipal, Greater Accra",
        "latitude": 5.566480000000001,
        "longitude": -0.23657899999999996
      },
      {
        "name": "Kaneshie Station",
        "display_name": "Kaneshie Station, Ayawaso East Municipal, Greater Accra",
        "latitude": 5.5945193,
        "longitude": -0.19750810000000005
      }
    ]
  },
  "meta": { "request_id": "d134037e-2e78-4989-930d-e23e780fed39", "cached": false, "latency": "3.806918ms" }
}
```

### 1b. GPS code lookup

```
GET /v2/lookup?address=GL-152-4944
```

```json
{
  "success": true,
  "data": {
    "gps_name": "GL1524944",
    "address": "GL1524944",
    "region": "Greater Accra",
    "district": "La Dade Kotopon",
    "area": "Shiashie",
    "postcode": "GL152",
    "street": "Spintex Road",
    "center_latitude": 5.622195082163294,
    "center_longitude": -0.1729481500712335,
    "north_latitude": 5.622217568312,
    "south_latitude": 5.62217259601459,
    "east_longitude": -0.172925692189131,
    "west_longitude": -0.172970607953336,
    "google_maps_url": "https://www.google.com/maps/search/?api=1&query=5.622195,-0.172948",
    "quality_score": 1
  },
  "meta": { "request_id": "65858eb1-d03d-4a3f-9597-20f1700b8abd", "cached": true, "latency": "1.461016819s" }
}
```

### 1c. Free-text address parse (libpostal)

```
GET /v2/address/parse?q=adjacent goil station madina
```

```json
{
  "success": true,
  "data": {
    "query": "adjacent goil station madina",
    "is_code": false,
    "parsed": {
      "anchors": [{ "relation": "adjacent", "name": "goil station madina" }]
    }
  },
  "meta": { "request_id": "e7213d11-b5ca-4146-9fde-87ea5812fd44", "cached": false, "latency": "6.135163ms" }
}
```

### 1d. Place search

```
GET /v2/search?q=Accra Mall&limit=1
```

```json
{
  "success": true,
  "data": {
    "query": "Accra Mall",
    "count": 1,
    "results": [
      {
        "type": "place",
        "name": "Accra Mall, Airport Bypass, Accra, Ghana",
        "gps_name": "GL1524944",
        "region": "Greater Accra",
        "district": "La Dade Kotopon",
        "area": "Shiashie",
        "postcode": "GL152",
        "latitude": 5.6221843,
        "longitude": -0.1729361,
        "google_maps_url": "https://www.google.com/maps/search/?api=1&query=5.622184,-0.172936"
      }
    ]
  },
  "meta": { "request_id": "f76b1432-463e-4001-a027-8f3a86dd040a", "cached": false, "latency": "648.380168ms" }
}
```

### 1e. Reverse geocode (coords → GPS code)

```
GET /v2/reverse?lat=5.622195&lng=-0.172948
```

Response is identical in shape to the lookup result in **1b** (`gps_name`, `region`,
`district`, `area`, `postcode`, `street`, center bounds, `google_maps_url`,
`quality_score`).

### 1f. Landmark geocode (free text)

```
GET /v2/landmarks/geocode?q=kaneshie market&limit=3
```

```json
{
  "success": true,
  "data": {
    "query": "kaneshie market",
    "count": 3,
    "matches": [
      {
        "id": 47375,
        "slug": "wikidata-q6362038",
        "name": "Kaneshie Market",
        "kind": "market",
        "region_code": "GH-AA",
        "source": "wikidata",
        "confidence": 88,
        "centroid": { "lng": -0.23657899999999996, "lat": 5.566480000000001 },
        "score": 1,
        "street": "Mantse Akramah Street",
        "postcode": "GA313"
      }
    ]
  }
}
```

Landmarks with a resolved photo also return `photo_url` (Wikimedia thumbnail) — useful for
map pins/tooltips.

### 1g. Nearby places (results are `locations`, each wrapping a `location`)

```
GET /v2/nearby?lat=5.622195&lng=-0.172948&radius=0.5&limit=5
```

```json
{
  "success": true,
  "data": {
    "origin": {
      "gps_name": "GL1524944", "address": "GL1524944", "region": "Greater Accra",
      "district": "La Dade Kotopon", "area": "Shiashie", "postcode": "GL152",
      "street": "Spintex Road", "center_latitude": 5.622195082163294,
      "center_longitude": -0.1729481500712335,
      "google_maps_url": "https://www.google.com/maps/search/?api=1&query=5.622195,-0.172948",
      "quality_score": 1
    },
    "radius_km": 0.5,
    "count": 0,
    "has_more": false,
    "locations": []
  }
}
```

> **Field note:** the key is **`locations`** (not `results`), and each entry is
> `{ "location": {…full Location…}, "distance_km": number }`. The web app previously read
> `results` — that was a bug and is fixed; the mobile app should read `data.locations`.

### 1h. Business around me (grouped counts)

```
GET /v2/landmarks/around?lat=5.622195&lng=-0.172948&radius=2000
```

```json
{
  "success": true,
  "data": {
    "lat": 5.622195,
    "lng": -0.172948,
    "radius": 2000,
    "count": 404,
    "by_kind": [
      { "kind": "hotel", "count": 84 },
      { "kind": "restaurant", "count": 71 },
      { "kind": "landmark", "count": 57 },
      { "kind": "hospital", "count": 26 },
      { "kind": "government", "count": 23 },
      { "kind": "school", "count": 22 },
      { "kind": "heritage", "count": 18 },
      { "kind": "mall", "count": 15 },
      { "kind": "bank", "count": 12 }
    ]
  }
}
```

Tap a kind → list the POIs with `GET /v2/landmarks/geocode?near=5.622195,-0.172948&kind=market&radius=2000&limit=25`
(same match shape as 1f, but with `distance_m` instead of `score`).

### 1i. Recent / frequent searches (authenticated)

```
GET /v2/me/recent-searches?limit=5        (X-API-Key: <token>)
```

```json
{
  "success": true,
  "data": {
    "count": 5,
    "searches": [
      {
        "id": 9,
        "query": "GD-192-0070",
        "result_type": "gps",
        "result_ref": "GD1920070",
        "display_name": "Otanor, Adentan, Greater Accra",
        "lat": 5.654843250092005,
        "lng": -0.12125010547131451,
        "last_searched_at": "2026-08-09T16:35:05Z",
        "search_count": 3
      }
    ]
  }
}
```

```
POST /v2/me/recent-searches
X-API-Key: <token>
{ "query": "Accra Mall", "result_type": "place", "result_ref": "GL1524944",
  "display_name": "Accra Mall, Greater Accra", "lat": 5.6221843, "lng": -0.1729361 }
```

```json
{ "success": true, "data": { "saved": true } }
```

```
DELETE /v2/me/recent-searches/{id}
X-API-Key: <token>
```

```json
{ "success": true, "data": { "deleted": true } }
```

Delete a search that isn't yours / doesn't exist:
```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "search not found" } }
```

```
DELETE /v2/me/recent-searches        (no body — clears the whole list)
X-API-Key: <token>
```

```json
{ "success": true, "data": { "cleared": true } }
```

> **Notes:** POST returns `{ saved:true }` and is idempotent per query (re-searching the same
> query bumps `search_count` rather than creating a duplicate row). `result_type` is one of
> `gps | place | landmark | poi`. DELETE-by-id returns `NOT_FOUND` for a missing/foreign id;
> the no-body DELETE clears the user's entire recent list.

### 1j. Hex code resolve (authenticated) — the precise pin

```
GET /v2/address/resolve?hex=AF-GH-7-0GXTJJB0ZZZZZ      (X-API-Key: <token>)
```

```json
{
  "success": true,
  "data": {
    "hex": "AF-GH-7-0GXTJJB0ZZZZZ",
    "point": { "lng": -0.1867, "lat": 5.604 },
    "precision": "structure",
    "confidence": 85,
    "label": "main gate",
    "last_seen_at": "2026-08-01T10:00:00Z"
  },
  "meta": { "request_id": "c86825f0-…", "cached": false, "latency": "1.8s" }
}
```

- **There is no `pin` field** — the pin is `data.point.{lng,lat}`; trustworthiness is
  `data.precision` + `data.confidence`.
- `precision`: `structure` (verified gate/door; carries `label` + `last_seen_at`) |
  `building_edge` (road-facing edge of the nearest footprint) | `hex_centroid` (fallback).
- `confidence`: 75–90 `structure` · 65 `building_edge` · 50 `hex_centroid`.
- Errors: `400 MISSING_PARAM` (no `hex`), `400 INVALID_HEX` (bad code), `503`, `500`.

---

## 2. Directions (routing)

### 2a. Route (authenticated)

```
POST /v2/route
X-API-Key: <token>
{
  "from": { "point": { "lat": 5.622195, "lng": -0.172948 } },
  "to":   { "point": { "lat": 5.56648,  "lng": -0.236579 } },
  "mode": "driving",
  "narration": "both",
  "language": "en-US",
  "avoid_locations": [ { "lat": 5.603, "lng": -0.187 } ],
  "avoid_flood_zones": true,
  "lite": false
}
```

```json
{
  "success": true,
  "data": {
    "distance_m": 15876,
    "duration_s": 1039.779,
    "eta_s": 1493.1930999999997,
    "traffic_note": "evening rush",
    "has_highway": true,
    "coordinates": [ [-0.172746, 5.621981], [-0.172768, 5.62196] ],
    "flood_crossings": 2,
    "steps": [
      {
        "instruction": "Drive south.",
        "verbal_instruction": "Drive south. Then Turn right.",
        "verbal_post": "Continue for 30 meters.",
        "instruction_landmark": "Continue past City Galleria, on your right",
        "near_landmark": "Accra Mall",
        "distance_m": 27,
        "duration_s": 3.342,
        "coordinates": [ [-0.172746, 5.621981], [-0.172768, 5.62196] ],
        "surface": "paved",
        "surface_color": "#4CAF50",
        "bearing_before": 226,
        "bearing_after": 226,
        "turn_angle": 0,
        "turn_class": "straight",
        "traffic_factor": 1.75,
        "traffic_severity": "moderate",
        "traffic_color": "#f9a825"
      }
    ],
    "landmarks_passed": [
      { "slug": "city-galleria-8e69b4", "name": "City Galleria", "side": "right",
        "at_step": 0, "centroid": { "lng": -0.1725531983427407, "lat": 5.6212355558648595 } }
    ]
  }
}
```

- `coordinates` is `[lng, lat]` pairs (GeoJSON order); step `coordinates` too.
- `mode`: `driving | foot | bicycle | motor_scooter | okada` — omitting `mode` (or passing `""`) also defaults to `driving`. `motor_scooter` and `okada` are aliases.
- `narration`: `landmark | street | both`. `from`/`to` accept `hex` (`{hex: "…"}`), `point`, or both.
- **`avoid_locations` is supported** — an array of `{ lat, lng }` points the route must avoid (snapped to the nearest road). `avoid_polygons` takes closed exterior rings of `[lng, lat]` pairs. `avoid_flood_zones` merges the curated flood zones.
- `lite: true` returns only polyline + distance/duration/ETA — no steps, landmarks, or alternatives.
- **Guaranteed vs optional fields on `data`:** only `distance_m`, `duration_s`, `eta_s`, `traffic_note`, `coordinates`, `steps`, `landmarks_passed` are always present. Everything below is **optional/conditional** (absent on the wire when empty/zero — code defensively):

| Field | Where | Present when |
|---|---|---|
| `warnings` | top-level | endpoint inside an unavoidable flood zone, a zone that could not be excluded, flood avoidance abandoned entirely, or a GMet alert covers the route |
| `flood_avoidance_failed` | top-level | `avoid_flood_zones` was requested but **no** route avoids the zones — the route returned ignores them and may flood. See the note below |
| `alternatives` | top-level | up to 2 (never in `lite` mode) |
| `recommended` / `recommend_reason` | top-level + each alternative | a non-fastest option wins (flood/rain) |
| `rain_note` / `rain_eta_penalty_s` / `flood_crossings` | top-level + each alternative | rain/flood intelligence applied |
| `has_unpaved` | top-level + each alternative | surface enrichment ran **and** the route has unpaved segments. **Absent = all paved OR not resolved — treat as "unknown"** |
| `unpaved_distance_m` | top-level + each alternative | 0 is omitted; present only alongside `has_unpaved` |
| `verbal_alert` | **per step** (`steps[].verbal_alert`), not top-level | the maneuver has a voice alert |

- Unauthenticated route: `POST /v2/route/public` with the same body.

**`avoid_flood_zones` is best-effort, not a guarantee.** Excluding every nearby
zone can leave no legal path — across Accra the Odaw basin polygons cover most
cross-town arteries. Rather than return `404 NO_ROUTE`, the API retries without
the zones and returns the route with `flood_avoidance_failed: true` plus a
warning. Badge that route as unsafe; do not present it as flood-avoiding. A
caller's own `avoid_polygons` / `avoid_locations` are never dropped by this
retry, so those can still legitimately produce `404 NO_ROUTE`.

### 2b. Traffic feed (authenticated, fail-open)

```
GET /v2/route/traffic        (X-API-Key: <token>)
```

```json
{
  "success": true,
  "traffic": {
    "time_bucket": "evening",
    "note": "evening rush",
    "cells": [
      { "road_class": "motorway",   "factor": 1.25, "severity": "light",    "color": "#66bb6a", "source": "static" },
      { "road_class": "primary",    "factor": 1.4,  "severity": "moderate", "color": "#f9a825", "source": "static" },
      { "road_class": "secondary",  "factor": 1.55, "severity": "moderate", "color": "#f9a825", "source": "static" },
      { "road_class": "residential","factor": 1.75, "severity": "moderate", "color": "#f9a825", "source": "static" }
    ]
  }
}
```

### 2c. Transit (trotro/bus) — authenticated

```
POST /v2/route/transit
X-API-Key: <token>
{ "from_lat": 5.6037, "from_lng": -0.1870, "to_lat": 5.56648, "to_lng": -0.236579,
  "date": "2026-08-08", "time": "12:00", "modes": "TRANSIT,WALK" }
```

```json
{
  "success": true,
  "data": {
    "count": 2,
    "itineraries": [
      {
        "start_time": 1786298580,
        "end_time": 1786304958,
        "duration_s": 6378,
        "walk_distance_m": 8337.34,
        "transfers": 0,
        "legs": [
          { "mode": "WALK", "start_time": 1786298580, "end_time": 1786304958,
            "duration_s": 6378, "distance_m": 8337.34,
            "from_name": "Origin", "from_lat": 5.6037, "from_lng": -0.187,
            "to_name": "Destination", "to_lat": 5.56648, "to_lng": -0.236579 }
        ]
      }
    ]
  }
}
```

- `legs` are `WALK` and `BUS`; bus legs carry `route_short_name` / `route_long_name`
  (e.g. `222B · Maamobi-Nima Terminal to Lido Terminal`).
- **`geometry` + `stops` on bus legs** (for drawing the route on a map): `geometry` is the
  decoded leg path as `[lng, lat]` pairs; `stops` is the intermediate stops as
  `{ name, lat, lng }`. Both are optional — fall back to a straight line between
  `from_*`/`to_*` when `geometry` is absent.
- **`modes`** is a case-insensitive substring test, not an enum: empty or containing
  `"transit"` → transit routing (default); anything else (e.g. `"WALK"`) → walk-only plan.
- `max_walk_m` is **accepted but currently ignored** — do not rely on it to bound walking.
- If every itinerary is walk-only, show "a bus route doesn't beat walking here".
- Optional `date` (`YYYY-MM-DD`) + `time` (`HH:MM`); default = now.

### 2d. Landmarks along a route (optional)

```
POST /v2/route/along
X-API-Key: <token>
{ "coordinates": [[-0.172948, 5.622195], [-0.236579, 5.56648]],
  "kinds": ["hospital", "school"], "buffer_m": 200 }
```

```json
{
  "success": true,
  "data": {
    "count": 25,
    "landmarks": [
      { "id": 161, "slug": "kotobabi-3-junior-high-school-fd6c90",
        "name": "Kotobabi 3 Junior High School", "kind": "school", "confidence": 90,
        "centroid": { "lng": -0.20242854999999993, "lat": 5.596525449999999 },
        "distance_m": 12 }
    ]
  }
}
```

### 2e. Navigation arrival telemetry (PUBLIC — no API key)

```
POST /v2/navigation/arrival
{ "dest_lat": 5.56648, "dest_lng": -0.236579, "final_lat": 5.5663, "final_lng": -0.2365,
  "profile": "driving", "route_distance_m": 5210, "route_duration_s": 900,
  "rerouted": false, "arrived": true,
  "origin_lat": 5.622195, "origin_lng": -0.172948,
  "started_at": "2026-08-11T09:00:00Z", "arrived_at": "2026-08-11T09:15:00Z",
  "achieved_duration_s": 1180, "shape": "<polyline6>" }
```

**Response: `204 No Content`** (no body). This feeds the learned-traffic loop.

- **Public** — no `X-API-Key`; throttled to 30 concurrent; body cap 1 MB.
- **All fields optional (fail-open):** missing/zero coordinates are silently dropped with
  204, never a 400 (malformed JSON is the only 400). Send them anyway.
- `profile`: `driving | foot | bicycle` — anything else normalizes to `driving`.
- `arrived`: boolean, **defaults to `true`** when omitted (`false` = give-up).
- `achieved_duration_s` is preferred over `started_at`/`arrived_at` when present.
- Possible non-204: `503 DB_UNAVAILABLE`, `503 SERVER_BUSY` (throttle).

### 2f. Static route map image (PUBLIC)

```
GET /v2/route/static?from=5.6037,-0.1870&to=5.5665,-0.2366&mode=driving
```

**Response:** `Content-Type: image/png`, `Cache-Control: public, max-age=3600`, body = a
fixed **800×500 PNG** (Geoapify osm-bright) with the blue route line, green start pin, red
end flag, numbered amber landmark pins and a small legend. `width`/`height` are **not**
accepted — the size is fixed.

Errors: `400 INVALID_PARAM` (from/to missing, malformed, or outside Ghana),
`502 ROUTE_FAILED` / `502 MAP_FAILED`, `503 SERVICE_UNAVAILABLE` / `SERVER_BUSY`.

---

## 3. Account & auth

### 3a. Login (email/password)

```
POST /v2/auth/login
{ "email": "user@example.com", "password": "…" }
```

```json
{
  "success": true,
  "data": {
    "token": "<64-hex api key>",
    "user": {
      "id": 1, "name": "Dominic Yeboah", "email": "yeboahd24@gmail.com",
      "plan": "team", "daily_limit": 10000, "usage_today": 0,
      "expires_at": "2027-05-06T11:31:44Z", "api_key": "734ee129...",
      "is_admin": true
    }
  }
}
```

Bad credentials:
```json
{ "success": false, "error": { "code": "INVALID_CREDENTIALS", "message": "invalid email or password" } }
```

### 3b. Google sign-in (mobile-native)

```
POST /v2/auth/google/mobile
{ "id_token": "<google id token>" }
```

Success returns the same `{ token, user }` shape as login. The token's `aud` must be the
web client id or `GOOGLE_MOBILE_CLIENT_ID` (see `docs/mobile-api.md`). Failure examples:

```json
{ "success": false, "error": { "code": "INVALID_GOOGLE_TOKEN", "message": "invalid Google ID token" } }
```

### 3c. Forgot / reset password

```
POST /v2/auth/forgot-password
{ "email": "user@example.com" }
```

```json
{ "success": true, "message": "if that email exists, a reset link has been sent" }
```

(The same generic response is returned whether or not the email exists. The emailed link is
`{RESET_LINK_BASE_URL}/reset-password?token=…`, a Universal Link that can open the app.)

```
POST /v2/auth/reset-password
{ "token": "<from email>", "new_password": "new-password-123" }
```

```json
{ "success": true }
```

### 3d. Current user + plan (authenticated)

```
GET /v2/me        (X-API-Key: <token>)
```

```json
{
  "success": true,
  "data": {
    "active": true,
    "created_at": "2026-04-04T13:29:05Z",
    "daily_limit": 10000,
    "email": "yeboahd24@gmail.com",
    "expires_at": "2027-05-06T11:31:44Z",
    "key_prefix": "734ee129...",
    "name": "Dominic Yeboah",
    "tier": "team"
  }
}
```

> `expires_at` is subscription expiry, not the session — never force-logout on it.

### 3e. Usage / limits (authenticated)

```
GET /v2/usage        (X-API-Key: <token>)
```

```json
{
  "success": true,
  "data": {
    "active": true,
    "bulk_today": 0,
    "daily_limit": 10000,
    "days_until_expiry": 269,
    "email": "yeboahd24@gmail.com",
    "expired": false,
    "expires_at": "2027-05-06T11:31:44Z",
    "name": "Dominic Yeboah",
    "tier": "team",
    "top_endpoints": [
      { "Endpoint": "/v2/nearby", "Count": 83 },
      { "Endpoint": "/v2/search", "Count": 80 }
    ]
  }
}
```

### 3f. Rotate API key / set password (authenticated)

```
POST /v2/me/rotate          → { success, data: { token, user } } (new key, old revoked)
POST /v2/me/password        → attach/change password: { "current_password"?, "new_password" }
```

---

## 4. Map layers & weather (all PUBLIC — no API key)

These power map overlays and rain/flood warnings. All return `application/json`, all are
GeoJSON, and none require auth. (Content-Type is `application/json` — not
`application/geo+json`.)

### 4a. Flood-prone zones — always 200

```
GET /v2/route/flood-zones
```

```json
{
  "type": "FeatureCollection",
  "features": [{
    "type": "Feature",
    "properties": { "name": "Kaneshie First Light / Graphic Road", "severity": "high", "status": "active" },
    "geometry": { "type": "Polygon", "coordinates": [[[-0.243, 5.553], [-0.227, 5.553], [-0.227, 5.567], [-0.243, 5.567], [-0.243, 5.553]]] }
  }]
}
```

- `severity`/`status` are hardcoded `high`/`active` by default; `?scope=all` returns the real
  DB values (`low|medium|high`, `active|possible`).
- No `id` / `activation_mode` — those are admin-only.
- `Cache-Control: public, max-age=600`.

### 4b. Official GMet weather alerts — always 200

```
GET /v2/weather/alerts
```

```json
{
  "type": "FeatureCollection",
  "features": [{
    "type": "Feature",
    "properties": {
      "event": "Rain/Wet Spell", "severity": "Moderate", "urgency": "Immediate",
      "certainty": "Observed", "headline": "Weather Alert: Continuous Rain Over Southern Ghana",
      "instruction": "Carry umbrellas. Localised flash floods are anticipated.",
      "areas": ["Greater Accra"], "source": "GMet", "expires_at": "2026-06-21T15:00:00Z"
    },
    "geometry": { "type": "MultiPolygon", "coordinates": [[[[-0.3, 5.5], [-0.1, 5.5], [-0.1, 5.7], [-0.3, 5.7], [-0.3, 5.5]]]] }
  }]
}
```

- No `id`, no `effective` timestamp — only `expires_at` (optional). `areas` can be `null`.
- `Cache-Control: public, max-age=300`. Empty `features` when none in effect.

### 4c. Rain-ahead precipitation forecast — always 200 (even on DB failure → empty)

```
GET /v2/precipitation-forecast
```

```json
{
  "type": "FeatureCollection",
  "features": [{
    "type": "Feature",
    "geometry": { "type": "Point", "coordinates": [-0.2, 5.6] },
    "properties": { "name": "Greater Accra", "probability": 98, "amount_mm": 1.2 }
  }]
}
```

- Point cloud (~165 points, 0.5° grid over Ghana), next-6h window, ordered by `probability`
  descending. Only three properties per point — no timestamps.
- `Cache-Control: public, max-age=600`.

---

## Common error responses

```json
{ "success": false, "error": { "code": "MISSING_API_KEY", "message": "X-API-Key header is required" } }
{ "success": false, "error": { "code": "INVALID_API_KEY", "message": "the provided API key is not valid" } }
{ "success": false, "error": { "code": "RATE_LIMIT_EXCEEDED", "message": "…" } }
{ "success": false, "error": { "code": "NOT_FOUND", "message": "no locations found" } }
```

**Test key used for capture:** `734ee12998fdca3e2a8fd3e1feed18f4451670a4cc8ee139ab2913a2d8b07dc0`
(tier `team`, expires 2027-05-06).
