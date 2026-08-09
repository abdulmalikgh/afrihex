# AfriHex Mobile API — Request/Response Reference (captured live)

**Audience:** mobile dev team · **Captured:** 2026-08-09 against `https://api.afrihex.com`

Every payload below is a **real response** from the live API (trimmed where noted).
All JSON bodies use `Content-Type: application/json`. Authenticated endpoints send
`X-API-Key: <token>`. Response envelope: `{ success, data, meta }`; errors:
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
{ "query": "Accra Mall", "result_type": "place", "result_ref": "GL1524944",
  "display_name": "Accra Mall, Greater Accra", "lat": 5.6221843, "lng": -0.1729361 }
```

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
  "narration": "both"
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
- `mode`: `driving | foot | bicycle | motor_scooter`. `narration`: `landmark | street | both`.
- `from`/`to` accept `hex` (`{hex: "…"}`), `point`, or both.
- Unauthenticated route: `POST /v2/route/public` with the same body.

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
{ "from_lat": 5.6037, "from_lng": -0.1870, "to_lat": 5.56648, "to_lng": -0.236579 }
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

### 2e. Navigation arrival telemetry (authenticated)

```
POST /v2/navigation/arrival
X-API-Key: <token>
{ "dest_lat": 5.56648, "dest_lng": -0.236579, "final_lat": 5.5663, "final_lng": -0.2365,
  "origin_lat": 5.622195, "origin_lng": -0.172948, "profile": "driving",
  "achieved_duration_s": 1500, "arrived": true }
```

**Response: `204 No Content`** (no body). This feeds the learned-traffic loop.

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

## Common error responses

```json
{ "success": false, "error": { "code": "MISSING_API_KEY", "message": "X-API-Key header is required" } }
{ "success": false, "error": { "code": "INVALID_API_KEY", "message": "the provided API key is not valid" } }
{ "success": false, "error": { "code": "RATE_LIMIT_EXCEEDED", "message": "…" } }
{ "success": false, "error": { "code": "NOT_FOUND", "message": "no locations found" } }
```

**Test key used for capture:** `734ee12998fdca3e2a8fd3e1feed18f4451670a4cc8ee139ab2913a2d8b07dc0`
(tier `team`, expires 2027-05-06).
