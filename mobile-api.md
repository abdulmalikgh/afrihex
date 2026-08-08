# AfriHex Mobile API

Reference for the **mobile** application (iOS/Android). Covers the three investor-priority
feature areas — **Search**, **Certificates**, and **Navigation** — plus the auth the app
needs for accounts.

Use this together with the full OpenAPI spec: [`docs/openapi.yaml`](./openapi.yaml) and
the readable UI at `https://api.afrihex.com/docs/`.

---

## Base & conventions

| Item | Value |
| --- | --- |
| Base URL | `https://api.afrihex.com` |
| Auth header | `X-API-Key: <token>` |
| Content type | `application/json` |
| Common response | `{ "success": true, "data": {...}, "meta": { "request_id", "cached", "latency" } }` |
| Rows | `cross-origin` handled server-side; CORS is enabled for the mobile origins you configure. |
| Limits | Public endpoints are IP-throttled (~30 req/min, 100/day without a key). Authenticated users get per-plan daily limits. |

**Error shape:** non-2xx returns `{ "success": false, "error": { "code", "message" } }`.
Common codes: `MISSING_API_KEY`, `INVALID_API_KEY`, `RATE_LIMIT_EXCEEDED`, `KEY_EXPIRED`.

**Co-ordinate conventions:** coordinates are `[lng, lat]` in route geometry and GeoJSON
behind the scenes, but every *point* parameter and result lat/lng uses plain
`latitude`/`longitude` numbers. `RouteResponse.coordinates` and `RouteStep.coordinates`
are `[lng, lat]` pairs.

---

## 🔐 Auth

Accounts are optional for the core features, but required for subscriptions, usage,
and the full route response.

### Login — `POST /v2/auth/login`

No auth.

```json
{ "email": "user@example.com", "password": "secret" }
```

**Response `data`:**

```json
{
  "token": "<64-hex api key>",
  "user": {
    "id": 1, "name": "Ama", "email": "user@example.com",
    "plan": "free", "daily_limit": 20, "usage_today": 0,
    "expires_at": null, "api_key": "abcd1234...", "is_admin": false
  }
}
```

Store `data.token` and send it as `X-API-Key` on every authenticated call.

### Register — `POST /v2/auth/register`

No auth. Body: `{ "name", "email", "password" }`. Returns the same shape as login.

### Google sign-in

`GET /v2/auth/google` → redirects to Google. On callback the app receives a one-time
`code`; exchange it at `POST /v2/auth/google/exchange` `{ "code" }` → same token/user shape.

### Current user / usage

| Endpoint | Method | Auth | Purpose |
| --- | --- | --- | --- |
| `/v2/me` | GET | 🔑 | Current user + plan |
| `/v2/usage` | GET | 🔑 | Daily limits, history, expiry |
| `/v2/me/rotate` | POST | 🔑 | Rotate API key |

> **Session note:** `user.expires_at` is the *subscription* expiry, not the session. A
> lapsed subscription keeps the user authenticated (tier degrades to free) so they can
> renew — never force-logout based on `expires_at`. The API returns 401 only when the
> token itself is invalid.

---

## 🔍 Search

All **public** (no key). This is what makes search usable without an account.

### Autocomplete — `GET /v2/search/autocomplete?q=&limit=&lat=&lng=`

Type-ahead for a mobile search bar. Bias toward the device location with `lat`/`lng`.

```
GET /v2/search/autocomplete?q=accra+mall&limit=8&lat=5.6037&lng=-0.1870
```

**`data`:**

```json
{
  "query": "accra mall",
  "count": 8,
  "results": [
    { "name": "Accra Mall", "display_name": "Accra Mall, Spintex Rd, Accra", "latitude": 5.6560, "longitude": -0.1680 }
  ]
}
```

### Search — `GET /v2/search?q=&limit=&offset=`

Full-text search (min 2 chars).

```
GET /v2/search?q=kwame+nkrumah&limit=10
```

**`data`:**

```json
{
  "query": "kwame nkrumah",
  "count": 1,
  "results": [
    {
      "type": "landmark", "name": "Kwame Nkrumah Memorial Park",
      "gps_name": "GL-0563-7842", "region": "Greater Accra", "district": "Osu Klottey",
      "area": "Independence Square", "postcode": "GL-0563", "latitude": 5.5474, "longitude": -0.1890,
      "google_maps_url": "https://maps.google.com/?q=5.5474,-0.1890"
    }
  ]
}
```

### Lookup — `GET /v2/lookup?address=`

Turn an address / GPS name into a structured result.

### Reverse (GPS button) — `GET /v2/reverse?lat=&lng=`

Coordinates → GPS name + hex + locality. **The core "where am I" call.**

### Nearby — `GET /v2/nearby?lat=&lng=&radius=&limit=`

Places within `radius` (km). Supports a `next_cursor` for pagination.

### Address parse — `GET /v2/address/parse?q=`

Split a free-text Ghanaian address into structured components + landmark anchors.

---

## 🧭 Navigation

### Public A→B route — `POST /v2/route/public`

**No auth** (IP throttled ~30/min). Same engine as the QR-code navigation flow.

```json
{
  "from": { "hex": "AF-GH-7-0GXTQD5RFZZZZ" },
  "to":   { "point": { "lat": 5.6037, "lng": -0.1870 } },
  "mode": "driving",
  "narration": "both",
  "language": "en",
  "avoid_flood_zones": true
}
```

Endpoints accept `hex` or `point` (or `gps_code`). `mode`: `driving | foot | bicycle |
motor_scooter`. `narration`: `landmark | street | both`. `lite: true` returns polyline +
ETA only (~80–90% smaller — good for slow connections).

### Full route — `POST /v2/route`

🔑 Same body as above; adds steps, per-step voice prompts, alternatives, hazard notes.

**`data` (shape shared by `/route` and `/route/public`):**

```json
{
  "distance_m": 5210,
  "duration_s": 900,
  "eta_s": 1230,
  "traffic_note": "Light traffic",
  "coordinates": [[-0.1870, 5.6037], [-0.1860, 5.6045]],
  "steps": [
    {
      "instruction": "Head south on Independence Ave",
      "instruction_landmark": "Head toward Kwame Nkrumah Memorial Park",
      "verbal_alert": "In 500 metres, turn left onto Oxford St",
      "verbal_instruction": "Turn left onto Oxford St",
      "verbal_post": "Now on Oxford St",
      "name": "Independence Ave",
      "near_landmark": "Accra Mall",
      "distance_m": 1200, "duration_s": 180,
      "coordinates": [[-0.1870, 5.6037]],
      "mode": "driving",
      "surface": "paved", "turn_class": "turn", "turn_angle": -85, "bearing_before": 183, "bearing_after": 98
    }
  ],
  "landmarks_passed": [ { "slug": "accra-mall", "name": "Accra Mall", "side": "right", "at_step": 2 } ],
  "alternatives": [
    { "distance_m": 5400, "duration_s": 1020, "eta_s": 1350, "coordinates": [["..."]], "recommended": true }
  ],
  "warnings": ["Destination is inside a flood-prone zone"],
  "has_unpaved": false, "unpaved_distance_m": 0, "flood_crossings": 0
}
```

### Route map image — `GET /v2/route/static`

**No auth.** Returns a rendered route image (line + pins) for sharing/printing.
Query params: origin & destination coords, mode, width/height.

### Weather & hazard overlays (public)

| Endpoint | Returns |
| --- | --- |
| `GET /v2/route/flood-zones?scope=all` | GeoJSON FloodZoneFeature[] |
| `GET /v2/weather/alerts` | GeoJSON CAP weather alerts |
| `GET /v2/precipitation-forecast` | GeoJSON next-6h rain |

### Navigation telemetry — `POST /v2/navigation/arrival`

**No auth**, fire-and-forget. Log where the user actually arrived vs. the pin so
destination accuracy improves. Body: `{ dest_lat, dest_lng, final_lat, final_lng,
profile, route_distance_m?, route_duration_s?, rerouted?, arrived? }`.

---

## 📜 Certificates

Verification is **deliberately public** — an auditor, bank, or landlord must be able to
check a cert without trusting us or holding a key.

### Verify — `GET /v2/certificates/{id}/verify`

**No auth.** The shareable "is this cert real?" check.

```
GET /v2/certificates/GH-CERT-ABC123/verify
```

**`data`:**

```json
{
  "valid": true,
  "certificate_id": "GH-CERT-ABC123",
  "issued_at": "2026-08-01T09:00:00Z",
  "signature_valid": true,
  "revoked": false,
  "signing_key_id": "v1",
  "issuer": "GhanaPostGPS Verification Service"
}
```

### PDF — `GET /v2/certificates/{id}/pdf`

**No auth.** Download/share the printable certificate. Is a PDF (not JSON).
Open it in a web view / download it and share via the OS share sheet.

### Full payload — `GET /v2/certificates/{id}`

🔑 Returns the signed payload + signature for display in the app:

```json
{
  "certificate": {
    "id": "GH-CERT-ABC123", "version": 1, "issued_at": "2026-08-01T09:00:00Z",
    "issuer": { "name": "GhanaPostGPS Verification Service", "verification_base_url": "...", "jwks_url": ".../.well-known/verification-key.json" },
    "subject": { "customer_id": "cus_123", "declared_address": "Spintex Rd, Accra" },
    "verification": { "verification_id": "v_1", "result": "matched", "verified": true, "confidence": 0.98, "device_distance_m": 4.2, "method": "proximity", "timestamp": "2026-08-01T09:00:00Z" },
    "address": { "gps_code": "GL-0563-7842", "region": "Greater Accra", "district": "Osu Klottey", "lat": 5.6560, "lng": -0.1680, "quality_score": 0.9 },
    "integrity": { "spoof_risk": "none", "fraud_risk_score": 12, "ip_location_match": "matched" },
    "disclaimer": "This certificate attests that a device was detected within the stated distance..."
  },
  "signature": { "algorithm": "EdDSA", "kid": "v1", "signature": "<base64>" }
}
```

### Public signing key — `GET /.well-known/verification-key.json`

**No auth.** Lets the app (or an auditor) independently verify the signature offline.

---

## 🕘 Frequent searches (don't retype it)

Per-user search history so the places a user searches often are one tap away —
**synced across devices** (works identically on web and mobile). Only available
to authenticated users; unauthenticated clients skip it.

### Record a search — `POST /v2/me/recent-searches`

🔑 Call this after every successful search so the query's frequency count bumps.
Idempotent per `(user, normalized query)` — re-searching the same place bumps
`search_count` instead of duplicating.

```json
{
  "query": "accra mall",
  "result_type": "place",
  "result_ref": "GL-0563-7842",
  "display_name": "Spintex Rd, Osu Klottey, Greater Accra",
  "lat": 5.6560,
  "lng": -0.1680
}
```

`result_type`: `gps | place | landmark | poi`. Only `query` is required.

### List frequent searches — `GET /v2/me/recent-searches?limit=20`

🔑 Ranked by `search_count` (frequency) then recency, so the most-used searches
come first. Return them as tappable chips/pills under the search bar.
**`data`:**

```json
{
  "count": 3,
  "searches": [
    {
      "id": 1, "query": "accra mall", "result_type": "place",
      "result_ref": "GL-0563-7842", "display_name": "Spintex Rd, Osu Klottey, Greater Accra",
      "lat": 5.6560, "lng": -0.1680, "search_count": 7,
      "last_searched_at": "2026-08-04T09:00:00Z"
    }
  ]
}
```

### Remove one — `DELETE /v2/me/recent-searches/{id}`

🔑 Deletes a single entry (404 if it isn't the caller's).

### Clear all — `DELETE /v2/me/recent-searches`

🔑 Wipes the user's search history.

> **Mobile pattern:** after a successful search (user picked a result), fire
> `POST /v2/me/recent-searches`. On the search screen, load
> `GET /v2/me/recent-searches?limit=10` and render each as a tappable chip that
> re-runs the search. Cap stored entries at 30/user (server-enforced).

---

## 📍 POI list → select → navigate

The "business around me" flow: **locate me → grouped POI counts by kind →
tap a kind → list those POIs → tap one → details + navigate**.

### Step 1 — grouped counts — `GET /v2/landmarks/around?lat=&lng=&radius=`
**Public.** Returns how many POIs of each kind sit within `radius` m (default
2000, max 10000) of a point. Render each as a tappable chip (`church · 40`,
`school · 10`). **`data`:**
```json
{
  "lat": 5.61, "lng": -0.18, "radius": 2000, "count": 5,
  "by_kind": [
    { "kind": "church", "count": 40 },
    { "kind": "school", "count": 10 }
  ]
}
```

### Step 2 — list one kind — `GET /v2/landmarks/geocode?near=<lat>,<lng>&kind=<kind>&radius=2000&limit=25`
**Public.** All POIs of that kind near the point, ranked by distance. Each
result:
```json
{
  "matches": [
    {
      "id": 42, "slug": "accra-mall", "name": "Accra Mall", "kind": "mall",
      "region_code": "GH-AA", "confidence": 90,
      "centroid": { "lng": -0.1680, "lat": 5.6560 },
      "distance_m": 350, "street": "Spintex Rd"
    }
  ]
}
```

### Step 3 — tap a POI
- Show details (name, street, GPS code via `reverse` on the centroid, distance).
- **Navigate** → **`POST /v2/route/public`** with `from` = the user's current
  location (from `reverse`) and `to` = `{ point: { lat, lng } }` using the POI's
  `centroid`. Show the route map + turn-by-turn steps (see Navigation).
- **Record** `POST /v2/me/recent-searches` with `result_type: "poi"` and
  `result_ref` = the POI slug.

Optional: `POST /v2/route/along` (🔑) with the resulting `coordinates` +
`kinds` returns POIs along the route, for a richer "POIs on the way" list.

---

## Order of operations (mobile MVP)

1. **Search tab** — `autocomplete` (on type) → `search`/`lookup` (on submit) → `reverse`
   (device location).
2. **Tap a result** → optional `certificates/{id}/verify` if it's a cert QR, or start a
   `route/public` from the user's current `reverse` point to the destination.
3. **Navigate** — poll-free: call `route/public` once, render `coordinates` on the map
   and step through `steps` (use `verbal_instruction`/`verbal_alert` for TTS voice nav).
   Send `navigation/arrival` when the user reaches the pin.
4. **POIs / Business around me** — `landmarks/around?lat=&lng=` → grouped
   counts by kind → tap a kind → `landmarks/geocode?near=…&kind=…` → tap a POI →
   `route/public` to its centroid. `hexcode/{code}/landmarks` shows "what's here"
   at the destination.
5. **Frequent searches** — after each success, `POST /v2/me/recent-searches`; list them
   as tappable chips via `GET /v2/me/recent-searches` (authenticated only).
6. **Account** (optional, gated) — `login`/`register` → `me` + `usage`.

---

## Quick auth example (curl)

```bash
# login
curl -X POST https://api.afrihex.com/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secret"}'
# → grab data.token

# authenticated route
curl -X POST https://api.afrihex.com/v2/route \
  -H "X-API-Key: <token>" -H "Content-Type: application/json" \
  -d '{"from":{"point":{"lat":5.6037,"lng":-0.1870}},"to":{"hex":"AF-GH-7-0GXTQD5RFZZZZ"},"mode":"driving"}'

# public (no key)
curl "https://api.afrihex.com/v2/search/autocomplete?q=accra+mall&limit=5"
curl "https://api.afrihex.com/v2/certificates/GH-CERT-ABC123/verify"
```

