# Response Payload Reference — for mobile

Answers to the 13 endpoints the mobile build was blocked on. Everything here is
grounded in the actual handler code (`cmd/server/routes.go`,
`internal/handler/*`, `internal/model/*`) plus live round-trips against
`https://api.afrihex.com` with a demo key, captured 2026-09-11.

Source of truth going forward: `/docs/openapi.yaml` (served at `/docs`)
already has schema entries for most of these — `/v2/route/transit`,
`/v2/transit/departures`, `/v2/profile`, `/v2/profile/{slug}`,
`/v2/delivery/rendezvous`, `/v2/route/incidents`, `/v2/hexcode`,
`/v2/hexcode/{code}/landmarks` — but keep this doc for the parts the spec
doesn't cover (raw samples, the flat-map endpoints, the auth corrections
below).

---

## Read this first: your auth column is wrong on 5 of 13 rows

`internal/auth/auth.go:252` keeps an `isPublicPath()` allowlist that exempts
specific paths from the `/v2` group's key requirement even though they're
registered inside it. Verified live, with and without a key:

| Endpoint | You had | Actually | Why (from the code comment) |
|---|---|---|---|
| `GET /v2/transit/departures` | 🔑 | **None** | grouped with the other anonymous "directions consumer" reads |
| `POST /v2/navigate/voice-command` | 🔑 | **None** | "a login wall here would defeat the point of a speak-to-navigate shortcut" |
| `POST /v2/navigate/route` | 🔑 | **None** | "leaving it out meant anyone could plan a trip logged-out and then hit a login wall on Navigate" |
| `GET /v2/hexcode/{code}/landmarks` | 🔑? | **None** | "the whole /v2/hexcode tree is pure H3 math/geometry… no tenant state" |
| `GET /v2/hexcode?lat=&lng=` | ? | **None** | same hexcode-tree exemption |

Sending a key on these still works and is *better* — it attaches the request
to an account for metering/analytics — but the app must not gate any of
these five behind "user must have a key first." Everything else in the
original table (rows 3, 4, 8–13, and core `/v2/route`) has the auth already
written down.

---

## The one question that simplifies six of the others

**Is there a rule for whether a payload sits under `data` or the envelope
root?** No single rule — three genuinely different response families, and
which one an endpoint uses tracks *which file the handler lives in*, not
anything the client can sniff at runtime:

| Family | Shape | Where |
|---|---|---|
| **Enveloped** | `{ success, data, meta? }` | The default for everything built on `model.APIResponse[T]` — hexcode\*, transit\*, voice-command, `/route`, `/route/along`, banking, AML, certificates, service-area. **One exception inside this family:** `/v2/route/traffic` nests under `traffic`, not `data` — a pre-existing naming choice, confirmed live. |
| **Flat map** | `{ field, field, … }` | `profile_handler.go`, `meet_handler.go`, and the POST side of `road_incident_handler.go` were all written as plain `map[string]any`, predating the envelope convention. Fields sit at the root. Some (incidents POST) include a `success` key anyway; profile and meet do **not** — there is no top-level status field to check on those at all, only the HTTP status code. |
| **Bare passthrough** | whatever the source shape is | GeoJSON endpoints (`/route/incidents` GET, flood-zones, air-quality) return a raw `FeatureCollection`. `/v2/navigate/route` writes OSRM's own bytes straight through. Neither has a `success` field, ever. |

Practically: for #8–13 specifically, stop checking both levels — profile and
meet are *always* flat, and that hedge can come out of those two parsers
today.

---

## 1. `GET /v2/transit/departures?lat=&lng=&radius_m=`

**Auth: none** (corrected from 🔑) · Built and live

Boardable trotro/bus lines near a point, nearest stop first. `radius_m`
optional, 1–2000, default 400.

```bash
curl -H "X-API-Key: $KEY" \
  "https://api.afrihex.com/v2/transit/departures?lat=5.6037&lng=-0.1870&radius_m=800"
```

```json
{
  "success": true,
  "data": {
    "routes": [
      {
        "short_name": "414B",
        "long_name": "Madina Station to Nima Overhead Station",
        "mode": "BUS",
        "destination": "Maamobi Market",
        "dest_lat": 5.5939112,
        "dest_lng": -0.194835,
        "dest_distance_m": 1391.596949,
        "stop_name": "Jack and Jill School",
        "stop_lat": 5.6019802,
        "stop_lng": -0.189218,
        "stop_distance_m": 407
      }
    ],
    "count": 3,
    "stops": ["Jack and Jill School", "Prisons 415", "Airport Residential"],
    "no_routes": false,
    "note": ""
  }
}
```

`no_routes`/`note` only appear (via `omitempty`) when `count` is 0 — one
message for "nothing nearby," a different one for "every line here
terminates, walk on."

---

## 2. `POST /v2/navigate/voice-command`

**Auth: none** (corrected from 🔑) · Built and live

English-only, rule-based phrase matching ("take me to X"). Never routes on
its own — client must confirm a candidate and call `/route` itself.

**Unrecognized transcript:**

```json
{
  "success": true,
  "data": { "recognized": false },
  "meta": { "request_id": "e2b4…", "cached": false, "latency": "99.17µs" }
}
```

**Recognized:**

```json
{
  "success": true,
  "data": {
    "recognized": true,
    "destination": "Accra Mall",
    "candidates": {
      "query": "Accra Mall",
      "count": 5,
      "results": [
        {
          "name": "Accra Mall Bus Terminal",
          "display_name": "Accra Mall Bus Terminal, La Dade-Kotopon, Greater Accra",
          "latitude": 5.6201308,
          "longitude": -0.1730869
        }
      ]
    }
  },
  "meta": { "request_id": "2eaf…", "cached": false, "latency": "3.67ms" }
}
```

`candidates` is the same `AutocompleteResponse` shape
`/v2/search/autocomplete` returns — reuse that model, don't write a second
one.

---

## 3. `GET /v2/route/incidents`

**Auth: none** · Built and live

Bare GeoJSON, **no envelope, no `success` field** — this is a map layer, not
an API response in the usual sense. `Cache-Control: public, max-age=30`.

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "id": "151bf31f-…",
        "kind": "flooding",
        "report_count": 1,
        "expires_at": "2026-09-12T06:48:45Z",
        "has_photo": false
      },
      "geometry": { "type": "Point", "coordinates": [-0.187, 5.6037] }
    }
  ]
}
```

`kind` ∈ `accident | flooding | road_blocked | police | smoke`. Empty-array
response when nothing active, still a 200.

---

## 4. `POST /v2/route/incidents`

**Auth: none** · Built and live

Plain JSON *or* `multipart/form-data` with an optional `photo` part (≤5MB,
jpeg/png/webp). Flat map, `201` on success.

```bash
curl -X POST https://api.afrihex.com/v2/route/incidents \
  -d '{"kind":"flooding","lat":5.6037,"lng":-0.187,"note":"…"}'
```

```json
{
  "success": true,
  "incident_id": "151bf31f-aa65-4441-a3d4-6b7283f08d31",
  "kind": "flooding",
  "report_count": 1,
  "expires_at": "2026-09-12T06:48:45Z"
}
```

Repeat reports for the same spot/kind *reinforce* (bump `report_count`,
extend TTL) rather than create a duplicate feature — that's why the create
response already carries a count that can be >1.

---

## 5. `POST /v2/navigate/route`

**Auth: none** (corrected from 🔑) · Built and live

**Confirmed: byte-for-byte raw OSRM.** `routing_handler.go:399-421` writes
the OSRM response body straight to the client (`w.Write(raw)`) — no model,
no envelope, no field renaming. If OSRM's shape changes upstream, this
endpoint changes with it.

```json
{
  "code": "Ok",
  "routes": [ { "geometry": "…", "legs": [ "…" ], "distance": "…", "duration": "…" } ],
  "waypoints": [ { "hint": "…", "location": [-0.187, 5.6037], "name": "…" } ]
}
```

Feed this straight to whatever OSRM-shaped decoder Ferrostar already has —
don't reuse the `RouteResponse` parser here, the field names don't overlap
(`distance` not `distance_m`, `legs[].steps` not `steps`, etc).

---

## 6. `GET /v2/hexcode/{code}/landmarks`

**Auth: none** (corrected from 🔑?) · Built and live

**Not one array — two, split by containment:** `inside` (landmark polygon
contains the hex centroid) and `nearby` (within a buffer, not containing).
Only `nearby` entries carry `distance_m` (int, metres) — an `inside` entry is
inside, distance is meaningless there and the field is absent.

```json
{
  "success": true,
  "data": {
    "hex": "AF-GH-7-0GXTQD5RFZZZZ",
    "inside": [],
    "nearby": [
      {
        "slug": "roman-ridge-f667b8",
        "name": "Roman Ridge",
        "kind": "settlement",
        "source": "osm",
        "confidence": 90,
        "distance_m": 39
      }
    ]
  },
  "meta": { "request_id": "c2c8…", "cached": false, "latency": "562.9ms" }
}
```

An `inside` entry additionally carries `geometry` (raw GeoJSON) and skips
`distance_m` entirely — the two array item shapes are genuinely different
structs (`LandmarkInside` vs `LandmarkNearby`), not one shape with optional
fields.

---

## 7. `GET /v2/hexcode?lat=&lng=`

**Auth: none** (corrected from ?) · Built and live

Optional `res` query param overrides the default H3 resolution.

```json
{
  "success": true,
  "data": {
    "code": "AF-GH-7-0GXTQD5RFZZZZ",
    "h3_index": "877576970ffffff",
    "resolution": 7,
    "country": "Ghana",
    "country_code": "GH",
    "center": { "lat": 5.604078, "lng": -0.195292 },
    "boundary": [ { "lat": 5.609496, "lng": -0.205752 } ],
    "area_km2": 3.86,
    "gps_code": "",
    "region": "",
    "district": "",
    "area": ""
  },
  "meta": { "request_id": "bae4…", "cached": true, "latency": "1.43s" }
}
```

`gps_code`/`region`/`district`/`area` are `omitempty` — present only when the
point resolved against a known GhanaPostGPS digital address; absent (not
empty-string) otherwise, so check for key presence, not falsy.

---

## 8. `POST /v2/profile`

**Auth: none** · Built and live

**`edit_token` is on the envelope root** — there is no envelope.
`profile_handler.go` returns a hand-built `map[string]any` with every field
flat, and no `success` key at all. Status `201` is the only success signal.

```json
{
  "slug": "mobiledoc6529",
  "display_name": "Test Shop",
  "hex_code": "",
  "lat": 5.6037,
  "lng": -0.187,
  "label": "Blue gate",
  "notes": "Ring bell twice",
  "view_count": 0,
  "created_at": "2026-09-11T06:47:37Z",
  "edit_token": "09789a0cb88a1eae1a2b3bf1195a997e",
  "phone": "+233200000000",
  "alert_email": "",
  "flood_alerts_on": false
}
```

`edit_token` is shown exactly once, here — store it client-side immediately.
It's the only credential for PATCH/DELETE.

---

## 9. `GET /v2/profile/{slug}`

**Auth: none** · `X-Edit-Token` header upgrades the response · Built and live

**Every listed field is always present** — it's a map with fixed keys built
by `publicProfileJSON()`, not a struct with `omitempty`. An unset `notes`
comes back as `""`, never omitted. Sending a matching `X-Edit-Token` header
adds four owner-only fields on top of the public set — it doesn't change any
existing field's value.

**Public (no header, or wrong token):**

```json
{
  "slug": "mobiledoc6529",
  "display_name": "Test Shop",
  "hex_code": "",
  "lat": 5.6037,
  "lng": -0.187,
  "label": "Blue gate",
  "notes": "Ring bell twice",
  "view_count": 1,
  "created_at": "2026-09-11T06:47:37Z"
}
```

**With correct `X-Edit-Token` — adds:**

```json
{
  "edit_token": "09789a0cb88a1eae1a2b3bf1195a997e",
  "phone": "+233200000000",
  "alert_email": "",
  "flood_alerts_on": false
}
```

Note the live side-effect: `view_count` incremented between the anonymous
create (0) and this GET (1) — it's a real counter on every read, including
your own. A wrong token is answered identically to no token (public view),
never a 401/403 — don't build UI that distinguishes them.

---

## 10. `PATCH /v2/profile/{slug}`

**Auth: `X-Edit-Token` required** · Built and live

**200 with the full owner object**, same shape as #9's owner view — not an
empty `{success:true}`. Body fields are all pointer types server-side, so
omitting a field in the PATCH body truly leaves it alone; sending it as
`null`/zero-value explicitly overwrites it.

```json
{
  "slug": "mobiledoc6529",
  "display_name": "Test Shop",
  "hex_code": "",
  "lat": 5.6037,
  "lng": -0.187,
  "label": "Blue gate",
  "notes": "Ring bell three times",
  "view_count": 2,
  "created_at": "2026-09-11T06:47:37Z",
  "edit_token": "09789a0cb88a1eae1a2b3bf1195a997e",
  "phone": "+233200000000",
  "alert_email": "",
  "flood_alerts_on": false
}
```

Wrong or missing token: `404 NOT_FOUND` ("profile not found or token
invalid") — deliberately not a 401/403, and deliberately not distinguished
from a genuinely missing slug, to stop token-probing.

---

## 11. `DELETE /v2/profile/{slug}`

**Auth: `X-Edit-Token` required** · Built and live

**Neither guess was right: it's `204 No Content`, zero bytes.** No JSON body
at all on success — don't call `.json()` on this response, it will throw.
Same 404-not-401 posture as PATCH on a bad token.

```bash
curl -X DELETE -H "X-Edit-Token: $TOKEN" \
  https://api.afrihex.com/v2/profile/mobiledoc6529 -w "%{http_code}"
# → 204, empty body
```

---

## 12. `GET /v2/meet/{code}?t=`

**Auth: join token in query** · Built and live

Path param is named `code` in the router (it's the human-readable session
id, e.g. `YF-J2KAB`) — same value, `session_id` naming on the client is
fine, just don't expect a param literally called `session_id` server-side.

**`member_id`, not `id`. `has_arrived`, not `arrived`.** Confirmed against
the `memberItem` struct in `meet_handler.go:182`. Flat map again, no
envelope.

```json
{
  "session_id": "YF-J2KAB",
  "tracking_ref": "",
  "destination": { "hex": "", "lat": 5.6037, "lng": -0.187, "label": "Osu Night Market" },
  "expires_at": "2026-09-11T12:47:52Z",
  "members": [
    {
      "member_id": "…",
      "display_name": "Ama",
      "role": "organiser",
      "lat": 5.6037,
      "lng": -0.187,
      "has_arrived": false,
      "last_seen": "2026-09-11T06:50:00Z"
    }
  ]
}
```

Sessions expire 6h after creation (seen live: created 06:47:52, `expires_at`
12:47:52). Missing/invalid `t` → `401 INVALID_TOKEN`; expired session →
`410 SESSION_EXPIRED`; unknown code → `404`.

---

## 13. `POST /v2/delivery/rendezvous`

**Auth: none** · Built and live

**Both.** It returns `session_id`/`join_token` directly *and* the two
pre-built join URLs — the URLs just embed that same token with
`?role=courier` / `?role=customer` baked in, so use whichever is more
convenient per platform (deep-link the URL on mobile, or drive your own UI
off the raw id/token).

```json
{
  "session_id": "TG-CRVRJ",
  "join_token": "a1c56d3d8187b600b09a8676b295d533",
  "tracking_ref": "ORD-123",
  "destination": { "lat": 5.6037, "lng": -0.187, "label": "Customer gate" },
  "expires_at": "2026-09-11T12:47:55Z",
  "courier_join_url": "https://maps.afrihex.com/meet/TG-CRVRJ?name=Kojo&role=courier&t=a1c56d3d8187b600b09a8676b295d533",
  "customer_join_url": "https://maps.afrihex.com/meet/TG-CRVRJ?name=Efua&role=customer&t=a1c56d3d8187b600b09a8676b295d533"
}
```

Courier and customer share one session/token — role is only the query
param, not a separate credential. Poll or WS-subscribe the same
`GET /v2/meet/{code}` / `/ws` as #12 from either side.

---

## Also needed — fields on responses you already have

### `POST /v2/route/transit` — `no_transit` / `first_trip` / `last_trip`

All three exist and are wired (`model/transit.go:66-94`). Confirmed live
with a 3:30am query with no service nearby:

```json
{
  "success": true,
  "data": {
    "itineraries": [],
    "count": 0,
    "no_transit": true,
    "note": "too early — the first trotro near your start point today is the 414A from Airport Residential at 10:32",
    "first_trip": {
      "short_name": "414A",
      "long_name": "Nima Overhead Station to Madina Station",
      "stop_name": "Airport Residential",
      "time": "10:32"
    }
  }
}
```

`no_transit` is true whenever every itinerary is walk-only, including an
empty list — **not** just when the list is empty, so don't gate the "no
service" UI on `count === 0` alone. `first_trip` XOR `last_trip` is set
(never both) — whichever explains the miss: too early vs. already gone for
the day. Neither is set when the miss is a real network gap rather than a
clock problem; only `note` covers that case, with a generic message.

### `POST /v2/route` — `incident_count` & `landmarks_passed[].promotion_text`

Both real, both `omitempty` (`routing.go:179`, `:298`). `incident_count` is
an `int`, always populated regardless of `avoid_incidents` — that flag only
controls whether the router steers around incidents, not whether the count
is reported. It was `0` and therefore omitted on the short live test route
below; treat a missing key as zero, not "not implemented."

```json
{
  "success": true,
  "data": {
    "distance_m": "…", "duration_s": "…", "eta_s": "…",
    "steps": [ "…" ],
    "landmarks_passed": [
      {
        "slug": "…", "name": "…", "at_step": 3,
        "centroid": { "lng": "…", "lat": "…" },
        "promotion_text": "20% off this week — mention AfriHex"
      }
    ],
    "surface_checked": true
  }
}
```

`promotion_text` is empty/absent unless a claimed business has an *active*
promotion in its owner-set date window — expect it absent on most routes
today, this is a new (2026-08 era) feature with low landmark-claim adoption
so far, not a broken field.

### `POST /v2/route` — lane guidance

`steps[].lanes` is real (`routing.go:270-281`), sourced from Valhalla's
`turn:lanes` OSM tag pass-through:

```json
"lanes": [
  { "indications": ["left"],     "active": false, "valid": true },
  { "indications": ["straight"], "active": true,  "valid": true },
  { "indications": ["right"],    "active": false, "valid": false }
]
```

Type is right — this is what it looks like when present. It is genuinely
rare: "most Ghana roads don't yet [carry turn:lanes data]" per the code
comment, and it was absent on every live route sampled here. Build the UI to
treat `lanes` as optional per-step, not per-route — don't require it before
showing any turn instruction.
