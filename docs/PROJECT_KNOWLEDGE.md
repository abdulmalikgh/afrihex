# AfriHex Mobile Project Knowledge

This file captures product, API, design, and tooling knowledge for the AfriHex mobile app.
Use it with `mobile-api.md` and `MOBILE_IMPLEMENTATION_PLAN.md`.

## Product Scope

AfriHex mobile is a focused location utility for Ghana-first addressing. The app should
help users find places, resolve addresses into useful coordinates/codes, navigate to
destinations, verify certificates, and manage the account/profile flows needed for those
features.

Build only these mobile-priority areas:

- Search
- Certificates
- Navigation
- Auth/account/profile support

Do not copy the full web app. Admin, billing dashboards, investor pages, and marketing
pages are outside the initial mobile scope unless explicitly requested.

## Source Of Truth

- API contract: `mobile-api.md`
- Base URL: `https://api.afrihex.com`
- Auth header: `X-API-Key: <token>`
- Common JSON response: `{ success, data, meta }`
- Common error response: `{ success: false, error: { code, message } }`
- Coordinates in ordinary point fields use `latitude`/`longitude` or `lat`/`lng`.
- Route geometry coordinates are `[lng, lat]` pairs.

Important auth behavior:

- `user.expires_at` is subscription expiry, not session expiry.
- Do not force logout because a subscription expires.
- Force logout only when token use returns an auth failure that means the token is invalid.

## Feature Notes

### Search

Use public search endpoints for guest users:

- `GET /v2/search/autocomplete`
- `GET /v2/search`
- `GET /v2/lookup`
- `GET /v2/reverse`
- `GET /v2/nearby`
- `GET /v2/address/parse`

Search should feel immediate and local. Bias autocomplete with device location when
permission is granted, but never block search if location is denied.

### Navigation

Use:

- `POST /v2/route/public` for anonymous users.
- `POST /v2/route` for authenticated users.

Support:

- mode: `driving`, `foot`, `bicycle`, `motor_scooter`
- narration: `landmark`, `street`, `both`
- `avoid_flood_zones`
- route summary, warnings, ETA, distance, and step list

Remember that route geometry is `[lng, lat]`; convert carefully for map components that
expect `{ latitude, longitude }`.

### Certificates

Certificate verification is public by design:

- `GET /v2/certificates/{id}/verify`
- `GET /v2/certificates/{id}/pdf`

The mobile UI should make validity, revocation, signature status, issuer, and issue date
clear at a glance.

### Profile

`/profile/new` creates a shareable address link. The mobile flow should collect the minimum
fields needed, resolve the destination through lookup/search, and provide copy/share actions.

## Visual Identity

The deployed AfriHex web app uses this identity:

- Body font: `Instrument Sans`
- Heading font: `Bricolage Grotesque`
- Code font: `Spline Sans Mono`
- Surface: `#111814`
- Card: `#1a231d`
- Card alt: `#232e26`
- Text: `#f2f4ef`
- Muted text: `#9ca89f`
- Faint text: `#6b776e`
- Border: `#2a362d`
- Strong border: `#3c4a40`
- Primary green: `#2fa162`
- Dark green: `#1d7a46`
- Light green: `#47b878`
- Gold: `#eab535`
- Violet: `#8d54ff`
- Clay/danger: `#e07160`

Use compact, map-first mobile layouts. The app should feel operational and trustworthy,
not like a landing page.

## Tooling Decisions

- Expo SDK 57 is the runtime target.
- Expo Router is the navigation layer.
- React Query owns server state.
- SecureStore owns auth token persistence.
- Expo Location owns current-location and permission flows.
- MapLibre React Native is the preferred polished map renderer.
- Static route images are acceptable as an early fallback before native maps are wired.
- Lucide icons should be used where possible to match the web app icon language.

## Map Decision

Prefer MapLibre React Native over Expo Maps for the full app because AfriHex needs custom
map styling, route polylines, GeoJSON hazard overlays, selected hex/result sheets, and
consistency with the existing web MapLibre implementation.

Expo Maps is useful to know about, but the SDK 57 docs describe it as alpha and development
build-only. It also uses Apple Maps on iOS and Google Maps on Android, which is not ideal
for a consistent AfriHex map layer.

## External References

- Expo SDK 57 docs: https://docs.expo.dev/versions/v57.0.0/
- Expo Router SDK 57: https://docs.expo.dev/versions/v57.0.0/sdk/router/
- Expo typed routes: https://docs.expo.dev/router/reference/typed-routes/
- Expo environment variables: https://docs.expo.dev/guides/environment-variables/
- Expo Maps SDK 57: https://docs.expo.dev/versions/v57.0.0/sdk/maps/
- React Native performance: https://reactnative.dev/docs/performance
- React Native styling: https://reactnative.dev/docs/style
- TanStack Query caching: https://tanstack.dev/query/latest/docs/framework/react/guides/caching
- MapLibre React Native: https://maplibre.org/maplibre-react-native/
