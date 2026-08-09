# Mobile App — Implementation Plan (mirrors the Web app)

**Audience:** mobile team · **Last updated:** 2026-08-08

This is the "how each screen works and which endpoints it calls" plan, matching the web
app (`GhanaPostGPS-Web`) so the mobile app looks and behaves the same. For full request/
response payloads use [`mobile-api.md`](./mobile-api.md) and the
[OpenAPI spec](openapi.yaml) at `https://api.afrihex.com/docs/`.

---

## 0. Conventions (read first)

| Item | Value |
|---|---|
| Base URL | `https://api.afrihex.com` |
| Auth | `X-API-Key: <token>` from login/register (opaque token, not JWT) |
| Search/geocode/lookup/nearby | public (no key) |
| Full route / transit / traffic / recent-searches / profile | authenticated |
| Response | `{ success, data, meta }` ; errors `{ success:false, error:{code,message} }` |
| Offline | cache last lookups + last route locally (web uses IndexedDB; mobile: SQLite/local store) so recent results work with no signal; re-fetch when online |

**Design rule (from the web):** never block the UI on slow/offline calls — show cached data
or a friendly state, and always `catch` so a failed request never crashes the screen.

---

## 1. FindGPS (Search & lookup) — the core screen

**What it is (web):** type a place / GPS code / address → get the GPS code, coordinates,
and an address card → drill into Nearby and "Business around me".

**Screen:**
1. Search bar (type-ahead suggestions below).
2. Result card: GPS code + coordinates + quality, map pin, Google Maps link.
3. Tabs under the result: **Nearby**, **Business around me**.
4. "Recent" and "Frequent" search chips (when signed in).

**API flow — step by step (mirrors web `FindGPS.tsx`):**

| Step | Action | Endpoint | Params / body |
|---|---|---|---|
| 1 | Type-ahead suggestions | `GET /v2/search/autocomplete` | `q`, `limit=8`, `lat`+`lng` (device location bias) |
| 2 | Submit (GPS/hex-shaped) | `GET /v2/lookup` | `address=<q>` |
| 2b | Submit (free text): parse first | `GET /v2/address/parse` | `q=<q>` |
| 2c | …if `is_code` in parse result | `GET /v2/lookup` | `address=<extracted code>` |
| 2d | …place search on cleaned query | `GET /v2/search` | `q=<geocode_query or q>`, `limit=1` |
| 2e | …if search result has `gps_name` | `GET /v2/lookup` | `address=<gps_name>` |
| 2f | …else resolve coords | `GET /v2/reverse` | `lat`, `lng` |
| 2g | …anchors (from parse) | `GET /v2/landmarks/geocode` | `q=<anchor>`, `limit=3` |
| 3 | Show result | — | GPS code + coords from the lookup/reverse result |
| 3b | **No results?** | — | read `data.did_you_mean` → show "Did you mean **X**?" → re-run step 2 with X |
| 4 | Nearby | `GET /v2/nearby` | `lat`, `lng`, `radius=0.5`, `limit=5` |
| 5 | Business around me (counts) | `GET /v2/landmarks/around` | `lat`, `lng`, `radius=2000` |
| 6 | Tap a kind → list POIs | `GET /v2/landmarks/geocode` | `near=<lat,lng>`, `kind=<kind>`, `radius=2000`, `limit=25` |
| 7 | Record search (signed in) | `POST /v2/me/recent-searches` | `{query, result_type, result_ref, display_name, lat, lng}` |
| 8 | List frequent/recent | `GET /v2/me/recent-searches` | `limit=10` |

**Notes:**
- Steps 2–2g are *sequential fallbacks*: try the next only when the previous returns
  nothing usable. Show a spinner, never a blank screen.
- GPS codes and hex codes skip parsing entirely (step 2 short-circuit).
- `did_you_mean` only appears when results are empty **and** the query isn't a code.
- Offline: cache every successful lookup locally (keyed by query); on no-network, show
  cached result + "offline" note, and sync `recent-searches` when back online.

---

## 2. Directions (routing, traffic, transit, navigation)

**What it is (web):** plan a route (drive/okada/walk/bike), see ETA + traffic, optionally
see trotro/bus options, and turn-by-turn navigate.

**Screen:**
1. From/To inputs (searchable via FindGPS autocomplete, or tap-to-pick on map).
2. Profile selector: Drive · Okada · Walk · Bike, plus a **Transit (trotro / bus)** button.
3. Result card: distance, **ETA** (`eta_s`), traffic note, live **traffic panel**, unpaved/
   flood warnings, "Start navigation".
4. Route line on the map, **tinted per segment by traffic**.
5. Steps list (turn-by-turn); navigation mode with voice prompts.

**API flow:**

| Step | Action | Endpoint | Params / body |
|---|---|---|---|
| 1 | Resolve each endpoint | `GET /v2/lookup` (if GPS) / use hex or point | — |
| 2 | Route (signed in) | `POST /v2/route` | `{from, to, mode, narration, avoid_flood_zones, avoid_locations}` |
| 2b | Route (QR / no account) | `POST /v2/route/public` | same body |
| 3 | Traffic panel (signed in) | `GET /v2/route/traffic` | — (hidden if 401 — fail-open) |
| 4 | Transit options | `POST /v2/route/transit` | `{from_lat, from_lng, to_lat, to_lng, date, time, modes}` |
| 5 | Navigation telemetry (on arrive/give-up) | `POST /v2/navigation/arrival` | `{dest_*, final_*, profile, origin_lat, origin_lng, achieved_duration_s, arrived}` |
| 6 | POIs along route (optional) | `POST /v2/route/along` | `{coordinates, kinds, buffer_m}` |

**Notes:**
- `mode`: `driving | foot | bicycle | motor_scooter` (okada). `narration`: `landmark` gives
  landmark-based instructions (great for Accra).
- Each `step` carries `traffic_factor` / `traffic_severity` / `traffic_color` — use them to
  tint the route polyline per segment (green→red). The traffic panel highlights the road
  classes actually on the route.
- Transit: itineraries = walk legs (access/egress) + bus legs (`route_short_name` +
  `route_long_name`, e.g. `081B · Adenta Station to Achimota Station`). If every itinerary
  is walk-only, show "a bus route doesn't beat walking here".
- **Send `origin_lat/lng` + `achieved_duration_s` on arrival** — this is what feeds the
  learned-traffic loop ("the more we use it, the smarter it becomes").
- Offline: cache the last route locally; show it if the plan call fails.

---

## 3. Map / hex map — **optional / deferred**

> **Decision (2026-08-08):** a dedicated hex search / grid-explore screen is **not
> necessary on mobile** — deprioritize it. Most users type a GPS code or a place name.
> Keep the cheap version below.

**Must keep — hex as an accepted input (near-zero cost):**
- Anywhere a location is entered (FindGPS search, From/To, deep links), **accept `AF-GH-…`
  hex codes** — parse them and resolve to a point via `GET /v2/address/resolve` (same
  `parseInput` logic the web uses). Prevents "why doesn't my hex work?" for power users.
- The **precision pin** (`address/resolve` → `precision` badge + gate/building-edge dot)
  stays — it's hex-backed but the user never sees the hex.

**Deferred (build only if mobile analytics show real hex usage):**

| Screen action | Endpoint |
|---|---|
| Cell details | `GET /v2/hexcode/{code}` |
| Children / neighbors / parent | `GET /v2/hexcode/{code}/children`, `/neighbors`, `/parent` |
| Cell polygon | `GET /v2/hexcode/{code}/geojson` |
| Basemap tiles | `GET /v2/map/tiles` (or self-hosted PMTiles in the web) |

---

## 4. Profile & account

| Screen action | Endpoint |
|---|---|
| Login / register | `POST /v2/auth/login`, `POST /v2/auth/register` (→ `data.token`) |
| Google sign-in (mobile-native) | Google Sign-In SDK → `POST /v2/auth/google/mobile` `{ id_token }` (no redirect; audience = mobile Google client id) |
| Forgot / reset password | `POST /v2/auth/forgot-password` `{ email }` → emailed link → `POST /v2/auth/reset-password` `{ token, new_password }` |
| Set/change password | `POST /v2/me/password` — lets a Google-created account add a password so email/password login works too |
| Current user + plan | `GET /v2/me` |
| Usage / limits | `GET /v2/usage` |
| Rotate API key | `POST /v2/me/rotate` |

Note: `user.expires_at` is the *subscription* expiry, not the session — never force-logout
on it (tier just degrades to free).

---

## 5. Offline — mirrors the web's offline-first design

The web is a PWA that keeps working with no signal. Mirror it on mobile with a **local
store** (SQLite / Realm / MMKV — a KV store is fine; localStorage is too small for route
geometry). **Rule: offline persistence is best-effort — a cache write/read failure must
never crash or block a lookup** (the web's `offline.ts` degrades to no-op when IndexedDB is
unavailable).

### What to cache locally

| Data | Cap | Key | Used by |
|---|---|---|---|
| Recent lookups | 20 | `gps_name` (dedupe, most-recent-first) | FindGPS — show history offline |
| Recent routes | 10 | normalized `from\|to\|profile` | Directions — replay last route |
| Nav (turn-by-turn) routes | 10 | normalized `from\|to\|mode`, raw OSRM bytes | Navigation — replay voice nav offline |
| App shell + basemap tiles | — | bundled / cached | fully-offline map |

Normalize trip keys **case/whitespace-insensitive** (web `routeKey`: trim, collapse
spaces, uppercase) so `gl 152 4944` and `GL-152-4944` hit the same entry. **Evict the
oldest** past each cap (routes hold geometry, so keep those tight).

### Per-screen fallback (same behaviour as the web)

| Screen | Offline behaviour |
|---|---|
| FindGPS | Show cached recent lookups; a lookup returns the cached copy or a friendly "offline" note. Queue `recent-searches` and re-sync when back online. |
| Directions | On route failure → look up the cached route for the *same* trip (`from\|to\|profile`) and show it with an **"offline — showing your last saved route"** banner (web does exactly this). |
| Navigation | Replay the cached nav route bytes; if none, say turn-by-turn needs a signal. |
| Traffic / transit | Live data — **hidden/disabled offline** (fail-open, never an error page). |
| Recent/frequent searches | Read from the local cache; sync the server list when online. |

### The one design point to get right

"Show me my last lookup/route even without signal" is the highest-value offline behaviour
for couriers/field users — cache lookups and routes on **every success**, not just when the
user asks. (The web already does this: `rememberLookup`/`rememberRoute` fire after every
successful result.)

---

## 6. Quick reference — screen → endpoints

| Screen | Endpoints used |
|---|---|
| FindGPS | autocomplete, lookup, address/parse, search, reverse, landmarks/geocode, nearby, landmarks/around, me/recent-searches |
| Directions | route (or route/public), route/traffic, route/transit, navigation/arrival, route/along |
| Map / hex *(optional)* | address/resolve (keep) · hexcode/*, map/tiles (deferred) |
| Profile | auth/login, register, google, me, usage, me/rotate |
| Bank (later) | kyc/verify, verify/proximity, location/ping, certificates/* |

---

## Suggested build order

1. **FindGPS** (search + lookup + did-you-mean) — the entry point, public, no auth needed.
2. **Map basemap + resolve pin** (`address/resolve`) — hex *explore* is deferred (§3).
3. **Directions** (route + steps) → traffic panel → transit → navigation telemetry.
4. **Profile & auth** — unblocks frequent searches and the full route response.
5. **Bank flows** (certificates / verify / monitoring) — phase 2.

Keep `docs/mobile-api.md` and this plan in sync as screens evolve.
