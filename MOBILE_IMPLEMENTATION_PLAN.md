# AfriHex Mobile Implementation Plan

This plan covers the React Native mobile app implementation for the AfriHex API scope in
[`mobile-api.md`](./mobile-api.md). The mobile app should focus on Search, Navigation,
Certificates, and the account/profile flows needed to support those features.

## 1. Project Foundation

The current project is a starter Expo app. The first implementation step is to convert it
into a structured Expo Router app.

Recommended installs:

```bash
npx expo install expo-router react-native-safe-area-context react-native-screens
npx expo install expo-font expo-splash-screen
npx expo install expo-secure-store
npx expo install expo-location
npx expo install expo-haptics
npx expo install expo-linear-gradient
npm install @tanstack/react-query
npm install lucide-react-native
npm install react-hook-form zod
```

Recommended folder structure:

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

src/
  api/
  components/
  constants/
  hooks/
  screens/
  storage/
  types/
  utils/
```

## 2. Design System

The mobile app should use the visual identity extracted from the existing AfriHex web app.

### Colors

```ts
export const colors = {
  surface: "#111814",
  card: "#1a231d",
  cardAlt: "#232e26",
  text: "#f2f4ef",
  muted: "#9ca89f",
  faint: "#6b776e",
  border: "#2a362d",
  borderStrong: "#3c4a40",
  primary: "#2fa162",
  primaryDark: "#1d7a46",
  primaryLight: "#47b878",
  gold: "#eab535",
  violet: "#8d54ff",
  danger: "#e07160",
};
```

### Fonts

- Body: `Instrument Sans`
- Headings: `Bricolage Grotesque`
- Codes: `Spline Sans Mono`

Use `expo-font` to load bundled font files. If the font files are not already available in
the project, add them under `assets/fonts/`.

### Shared Components

Build a small custom component system instead of adopting a heavy UI kit:

```txt
Screen
AppText
AppButton
AppInput
SearchBar
CodeChip
ResultCard
LoadingState
EmptyState
ErrorBanner
BottomSheet
SegmentedControl
```

Design direction:

- Dark, map-first interface.
- High contrast text and clear touch targets.
- Compact but readable result cards.
- Strong visual treatment for hex codes and certificate IDs.
- Minimal clutter around map surfaces.

## 3. API Layer

Create a typed API client around `fetch`.

```txt
src/api/client.ts
src/api/auth.ts
src/api/search.ts
src/api/navigation.ts
src/api/certificates.ts
src/api/profile.ts
```

Base configuration:

```ts
export const API_BASE_URL = "https://api.afrihex.com";
export const AUTH_HEADER = "X-API-Key";
```

Use `expo-secure-store` for the API token returned from:

- `POST /v2/auth/login`
- `POST /v2/auth/register`
- `POST /v2/auth/google/exchange`

Use React Query for:

- autocomplete
- full search
- reverse lookup
- nearby places
- route requests
- certificate verification
- current user
- usage summary

The shared client should normalize the API response shape:

```ts
type ApiSuccess<T> = {
  success: true;
  data: T;
  meta?: {
    request_id?: string;
    cached?: boolean;
    latency?: number;
  };
};

type ApiError = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};
```

## 4. Navigation Structure

Use Expo Router with five main tabs:

```txt
Find
Map
Directions
Verify
Profile
```

Routes:

```txt
/
/map
/directions
/certificates
/profile
/auth/login
/auth/register
/profile/new
```

This maps to the mobile API scope while avoiding web-only admin, pricing, dashboard, and
marketing pages.

## 5. Feature Build Order

### Phase 1: App Shell

- Set up Expo Router.
- Add tab navigation.
- Add safe-area handling.
- Add design tokens.
- Load fonts.
- Build shared components.
- Replace the starter `App.tsx` flow with the router entry.

### Phase 2: Auth

- Login screen.
- Register screen.
- Token storage in SecureStore.
- Current user fetch via `GET /v2/me`.
- Usage summary via `GET /v2/usage`.
- Logout.

Do not force logout based on `user.expires_at`; `mobile-api.md` states that this is the
subscription expiry, not the session expiry.

### Phase 3: Search / Find

Endpoints:

- `GET /v2/search/autocomplete`
- `GET /v2/search`
- `GET /v2/lookup`
- `GET /v2/reverse`
- `GET /v2/nearby`
- `GET /v2/address/parse`

Features:

- Search input with autocomplete.
- Full result list.
- Current-location reverse lookup.
- Nearby places.
- Result cards with GPS name, region, district, area, postcode, and coordinates.
- Copy/share actions for coordinates, GPS name, and Google Maps URL.

### Phase 4: Directions

Endpoints:

- `POST /v2/route/public`
- `POST /v2/route`
- `GET /v2/route/static`
- `GET /v2/route/flood-zones`
- `GET /v2/weather/alerts`
- `GET /v2/precipitation-forecast`
- `POST /v2/navigation/arrival`

Features:

- Origin and destination inputs.
- Use current location as origin.
- Route modes: driving, foot, bicycle, motor scooter.
- Narration options: landmark, street, both.
- Avoid flood zones toggle.
- Anonymous users use `/v2/route/public`.
- Authenticated users use `/v2/route`.
- Show distance, ETA, traffic note, warnings, and steps.
- Fire arrival telemetry when appropriate.

### Phase 5: Map

Recommended map renderer: MapLibre React Native.

Install when ready to add native maps:

```bash
npx expo install @maplibre/maplibre-react-native
```

Important: MapLibre requires a development build. It will not run inside Expo Go.

Map features:

- Ghana-centered default map.
- Current location marker.
- Search result marker.
- Route polyline.
- Flood and hazard overlays.
- Selected result bottom sheet.
- Hex/result details.

Fast prototype alternative:

- Delay native maps.
- Use `GET /v2/route/static` for route previews.
- Add MapLibre after the core API flows are stable.

### Phase 6: Certificates

Endpoints:

- `GET /v2/certificates/{id}/verify`
- `GET /v2/certificates/{id}/pdf`

Features:

- Certificate ID input.
- Verification result screen.
- Show valid/revoked/signature status.
- Show issuer and issued date.
- Download/share PDF.

### Phase 7: Profile / Address Link

Route:

- `/profile/new`

Features:

- Create address profile link.
- Collect handle, display name, phone, destination, label, and notes.
- Resolve destination through lookup/search.
- Show generated link.
- Copy/share actions.

## 6. Testing Plan

Install:

```bash
npx expo install jest-expo jest --dev
npx expo install @testing-library/react-native --dev
```

Initial test targets:

- API client success/error handling.
- Auth token storage.
- Login/register form validation.
- Search loading, empty, error, and success states.
- Directions request body construction.
- Certificate verification states.

Later add end-to-end testing with Maestro:

```bash
brew install maestro
```

E2E flows:

```txt
login
register
search address
reverse lookup
create route
verify certificate
create profile link
```

## 7. Build And Runtime Strategy

During early UI/API work:

```bash
npm run ios
npm run android
npm run web
```

After MapLibre is added:

```bash
npx expo run:ios
npx expo run:android
```

For real-device QA:

```bash
eas build --profile development --platform ios
eas build --profile development --platform android
```

## 8. Key Technical Decisions

Use:

- Expo Router for navigation.
- React Query for API caching and loading states.
- SecureStore for auth tokens.
- Expo Location for reverse lookup, route origin, and arrival telemetry.
- MapLibre for map rendering.
- Custom UI components for brand quality.
- Lucide icons to match the web app.

Avoid for v1:

- Redux.
- Heavy UI libraries.
- OpenAI dependencies.
- Admin/dashboard features.
- Pricing/subscription screens unless required for mobile launch.
- Full offline maps unless explicitly prioritized.

## 9. Recommended MVP

The MVP should ship in this order:

1. Find/search.
2. Reverse lookup.
3. Directions.
4. Certificate verification.
5. Login/register/profile.
6. MapLibre polish.

This sequence produces a useful mobile app quickly, then invests in the map experience once
the API flows are stable.
