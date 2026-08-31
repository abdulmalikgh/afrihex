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

## 🪪 Address verification (KYC)

How a certificate comes into existence. There is no standalone "issue a
certificate" call — one is created as a side effect of a verification.

### Verify an address — `POST /v2/kyc/verify`

🔑 Authenticated. The endpoint accepts four input methods; **mobile builds only
two** — a GPS-code field and a "Use my location" button. `hex_code` and `manual`
have no mobile use case.

```json
{ "customer_id": "<your user id>", "method": "gps_code", "location": { "gps_code": "GA-142-7281" } }
{ "customer_id": "<your user id>", "method": "gps_fix",  "location": { "lat": 5.6037, "lng": -0.1870 } }
```

The response carries an **optional** `certificate` block:

```json
{
  "certificate": {
    "id": "cert_GPU4XBpCp7q",
    "verification_url": "https://api.afrihex.com/v2/certificates/cert_GPU4XBpCp7q/verify",
    "json_url": "https://api.afrihex.com/v2/certificates/cert_GPU4XBpCp7q",
    "pdf_url": "https://api.afrihex.com/v2/certificates/cert_GPU4XBpCp7q/pdf",
    "jwks_url": "https://api.afrihex.com/.well-known/verification-key.json",
    "issued_at": "2026-04-27T14:06:25Z"
  }
}
```

`certificate` is `omitempty`. Its absence is **normal**, not an error — signing
may not be configured, or issuance may have failed while the verification itself
succeeded. Check for it before showing anything that depends on it.

> ⚠️ **A certificate is not proof of a passing verification.** One is issued for
> failed attempts too. Read the outcome off `verified` / `result` / `confidence`
> on the verification response — never infer pass from a certificate existing.

**Result card fields:**

| Shown as | From |
| --- | --- |
| Hex address | `data.hex_code` |
| GPS code | `data.ghanapost_code` |
| Region / Area | `data.address.region` / `data.address.area` |
| Quality | `data.quality_score` × 100 |
| Confidence | `data.verification.confidence` |
| "View signed certificate" | `data.certificate` — only when present |

> **Unverified against a live response.** These paths come from `verify.md`'s
> table; the widget's event payload shows a different shape (`declared_address`,
> `proximity.device_distance_m`). The client parses tolerantly and renders only
> what is present. One captured `POST /v2/kyc/verify` response would let us
> tighten this.

---

## 📜 Certificates

Verification is **deliberately public** — an auditor, bank, or landlord must be able to
check a cert without trusting us or holding a key. `/verify`, `/pdf` and the JWKS endpoint
sit outside the rate-limited `/v2` group, so a verifier can check many certificates with
no key and no throttle.

**ID format:** `cert_` followed by **up to** 12 alphanumerics — e.g. `cert_GPU4XBpCp7q`,
which is 11. The server base64url-encodes 9 random bytes, strips `-` and `_`, and only then
truncates to 12, so IDs that encoded those characters come out shorter. Do not validate for
exactly 12 — it rejects genuine IDs.

Case-sensitive and matched exactly, so send user input **verbatim**: normalising case turns
a valid ID into a 404. The server does no format validation, so validate lightly on the
client and let the lookup be the authority. (Earlier drafts of this doc showed
`GH-CERT-ABC123`. That was a placeholder and was never a real ID.)

**No expiry.** Certificates carry no `expires_at`, and there is no expired state — only
valid, revoked, and signature-invalid.

### Verify — `GET /v2/certificates/{id}/verify`

**No auth.** The shareable "is this cert real?" check.

```
GET /v2/certificates/cert_GPU4XBpCp7q/verify
```

**`data`:**

```json
{
  "valid": true,
  "certificate_id": "cert_svrfU56Urzy4",
  "issued_at": "2026-08-27T18:55:22.604520168Z",
  "signature_valid": true,
  "revoked": false,
  "signing_key_id": "v1",
  "issuer": "GhanaPostGPS Verification Service"
}
```

*(Captured live 2026-08-27 from `cert_svrfU56Urzy4`, a real certificate.)*
Note `issued_at` carries nanosecond precision, and `revoked_at` / `revoke_reason`
are **absent entirely** rather than `null`/`""` when the certificate is not
revoked — parse them as optional.

`issuer` is a **plain string** here. The full payload below nests it as an object — do not
share one type between the two.

`valid` is a server-computed roll-up: `valid = signature_valid && !revoked`. Only four
combinations occur:

| `valid` | `signature_valid` | `revoked` | Meaning |
| --- | --- | --- | --- |
| `true` | `true` | `false` | Genuine and current |
| `false` | `true` | `true` | Revoked by the issuer |
| `false` | `false` | `false` | Signature does not match |
| `false` | `false` | `true` | Both |

`valid: true` alongside `revoked: true` is impossible. When revoked, the response also
carries `revoked_at` (RFC3339) and `revoke_reason`; both are omitted otherwise, and there
is no "revoked by" field. `issued_at` is always RFC3339 UTC with `Z`.

**States and status codes:**

| Case | Status | Body |
| --- | --- | --- |
| Valid | 200 | `data.valid: true` |
| Revoked | 200 | `data.valid: false`, `revoked: true` |
| Signature fails | 200 | `data.valid: false`, `signature_valid: false` |
| Unknown ID | 404 | `{ "success": false, "error": { "code": "NOT_FOUND", "message": "certificate not found: <id>" } }` |
| Malformed ID | 404 | Same — the handler looks the raw string up, so anything unmatched is a 404 |

An unknown ID is therefore an error about the ID the user typed, **not** a "not valid"
verdict about a certificate. The two read very differently to someone holding a document.

### PDF — `GET /v2/certificates/{id}/pdf`

**No auth.** `Content-Type: application/pdf`, `Content-Disposition: inline`,
`Cache-Control: public, max-age=86400`. No custom headers are needed, so the URL opens
directly in an in-app browser tab — a Safari sheet on iOS, a Custom Tab on Android — with
no download step. Generated on demand, but it is a one-page A4 render and fast.

⚠️ **A revoked certificate's PDF renders with no revoked marking** — the renderer does not
check revocation status, so the document still looks valid. `/verify` is the authority;
say so in the UI rather than letting the document imply otherwise.

⚠️ **The PDF is public and prints `customer_id` and `declared_address`.** Anyone the
holder forwards it to sees both. This is deliberate — the certificate ID is treated as a
high-entropy capability — but it is worth a product decision rather than a surprise.

### Full payload — `GET /v2/certificates/{id}`

🔑 **Authenticated.** This one is *not* public: gating it keeps customer IDs and declared
addresses from being enumerable by anyone holding a certificate ID. An anonymous verifier
gets the `/verify` badge, issuer and issue date — nothing more. That is the intended
anonymous experience.

```json
{
  "certificate": {
    "id": "cert_GPU4XBpCp7q", "version": 1, "issued_at": "2026-08-01T09:00:00Z",
    "issuer": { "name": "GhanaPostGPS Verification Service", "verification_base_url": "...", "jwks_url": ".../.well-known/verification-key.json" },
    "subject": { "customer_id": "cus_123", "declared_address": "Spintex Rd, Accra" },
    "verification": { "verification_id": "v_1", "result": "NEAR", "verified": true, "confidence": 0.98, "device_distance_m": 4.2, "method": "proximity", "timestamp": "2026-08-01T09:00:00Z" },
    "address": { "gps_code": "GL-0563-7842", "region": "Greater Accra", "district": "Osu Klottey", "lat": 5.6560, "lng": -0.1680, "quality_score": 0.9 },
    "integrity": { "spoof_risk": "LOW", "fraud_risk_score": 0.12, "ip_location_match": "PASS" },
    "disclaimer": "This certificate attests that a device was detected within the stated distance..."
  },
  "signature": { "algorithm": "EdDSA", "kid": "v1", "signature": "<standard base64, padded>" }
}
```

**Enum values.** These are the real ones — earlier drafts listed `"matched"`, which is not
a value in the code, and a 0–100 fraud score, which is not the scale:

| Field | Values |
| --- | --- |
| `verification.result` | `NEAR` · `FAR` · `ADDRESS_NOT_FOUND` · `INVALID_FORMAT` |
| `verification.method` | Opaque string set at issuance — do not switch on it |
| `integrity.spoof_risk` | `LOW` · `MEDIUM` · `HIGH` |
| `integrity.ip_location_match` | `PASS` · `MISMATCH` · `NOT_PROVIDED` |
| `integrity.fraud_risk_score` | **0.0–1.0**, higher is worse |
| `integrity.fraud_risk_level` | `>=0.8` critical · `>=0.6` high · `>=0.4` medium · else low. Omitted when empty |

**Always present:** `subject.customer_id`, `subject.declared_address`,
`verification.{verification_id, result, verified, confidence, device_distance_m, method, timestamp}`,
`address.{gps_code, lat, lng}`, `integrity.{spoof_risk, fraud_risk_score}`, `disclaimer`,
`issuer.*`, `signature.*`.

**Omitted when empty:** `verification.gps_accuracy_m`, `address.{region, district, area, quality_score}`,
`integrity.{fraud_risk_level, ip_location_match}`.

`disclaimer` is a hardcoded legal attestation carried by every certificate and must be
displayed verbatim. A collapsed but reachable section is fine; it need not be above the fold.

### Public signing key — `GET /.well-known/verification-key.json`

**No auth.** A JWKS — `{ "keys": [ { "kty": "OKP", "crv": "Ed25519", "x": "<base64url, unpadded>", "use": "sig", "alg": "EdDSA", "kid": "v1" } ] }`.
The certificate's `signature.kid` selects the key.

**What is signed is not JCS.** The signed bytes are Go's `json.Marshal` of the
`certificate` object, which preserves struct field order: `id, version, issued_at, issuer,
subject, verification, address, integrity, disclaimer`. A verifier in another language must
reproduce that exact order. `signature.signature` is standard base64, **padded** (64-byte
Ed25519 signature); the JWK's `x` is base64url, **unpadded**. Do not mix the two.

Only one key (`kid: "v1"`) is live and rotation is not implemented yet. An unrecognised
`kid` fails closed — `/verify` returns `signature_valid: false`.

> **Not required for v1.** Server-side `signature_valid` is sufficient for launch. Offline
> verification matters only if the app must verify without trusting the API, and it costs a
> cryptography dependency (Ed25519 is not in `expo-crypto`).

### Not available

There is **no** endpoint listing a user's own certificates, and **no** deep-link contract
for opening one. A certificate is reached by typing its ID or by scanning its QR code,
which encodes the full verification URL `{verification_base_url}/v2/certificates/{id}/verify`.

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
curl "https://api.afrihex.com/v2/certificates/cert_GPU4XBpCp7q/verify"
```

