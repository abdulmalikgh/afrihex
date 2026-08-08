# AfriHex Mobile Patterns

## API Client

Keep fetch behavior centralized:

- Build URLs with `URL` and `URLSearchParams`.
- Attach `Content-Type: application/json` for JSON bodies.
- Attach `X-API-Key` only when a token is available.
- Parse JSON error shapes and throw a typed app error.
- Keep endpoint functions small and named after API actions.

Recommended files:

```txt
src/api/client.ts
src/api/auth.ts
src/api/search.ts
src/api/navigation.ts
src/api/certificates.ts
src/api/profile.ts
```

## React Query

Query key examples:

```ts
["search", "autocomplete", query, limit, lat, lng]
["search", "full", query, limit, offset]
["reverse", lat, lng]
["nearby", lat, lng, radius, limit]
["route", isAuthenticated ? "full" : "public", bodyHash]
["certificate", id]
["me"]
["usage"]
```

Set sensible `staleTime` values:

- autocomplete: short
- static certificate verification: medium
- current user/usage: short to medium
- map overlays: medium

## Navigation

Use Expo Router route groups:

```txt
app/
  _layout.tsx
  (tabs)/
    index.tsx
    map.tsx
    directions.tsx
    certificates.tsx
    profile.tsx
  auth/
    login.tsx
    register.tsx
  profile/
    new.tsx
```

Use typed routes once router setup is complete.

## Search UI

Search should support:

- Debounced autocomplete.
- Manual submit for full search.
- Current-location reverse lookup.
- Results with code, name, region/district, and coordinates.
- Copy/share actions.

Do not block search on location permission. Location only improves ranking and reverse lookup.

## Directions UI

Directions should support:

- Origin and destination fields.
- Current location as origin.
- Mode segmented control.
- Narration segmented control.
- Avoid flood zones toggle.
- Route summary.
- Warnings.
- Step list.
- Map or static route preview.

Convert API route coordinates from `[lng, lat]` into the shape required by the map component.

## Certificates UI

Show:

- valid/invalid state
- revoked state
- signature state
- certificate ID
- issuer
- issued date
- PDF share/download action

Do not require login for verification.

## Map UI

Start simple:

- selected marker
- route line
- result bottom sheet
- user location button

Add overlays after core map rendering is stable:

- flood zones
- weather alerts
- precipitation forecast
- hex details

If MapLibre is not installed yet, use static route image previews and keep the map-facing
data model ready for later MapLibre integration.
