# AfriHex Mobile Implementation Plan

This plan covers the React Native mobile app implementation for the AfriHex API scope in
[`mobile-api.md`](./mobile-api.md). The mobile app should focus on Search, Navigation,
Certificates, and the optional account flows that improve those features without blocking
anonymous usage.

## 1. Project Foundation

The current project is a starter Expo app. The first implementation step is to convert it
into a structured Expo Router app.

Recommended installs:

```bash
npx expo install expo-router react-native-safe-area-context react-native-screens
npx expo install expo-font expo-splash-screen
npx expo install expo-secure-store
npx expo install expo-auth-session expo-crypto expo-web-browser
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
    account.tsx
  auth/
    login.tsx
    register.tsx
    callback.tsx

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
src/api/account.ts
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

Google auth starts in a system auth browser session against the backend-owned
`GET /v2/auth/google` endpoint. The mobile app should receive a one-time `code` on the
`afrihex://auth/callback` deep link and exchange it with
`POST /v2/auth/google/exchange`. The Google client secret and OAuth callback ownership stay
on backend infrastructure, never inside the mobile app.

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
Account
```

Routes:

```txt
/
/map
/directions
/certificates
/account
/auth/login
/auth/register
/auth/callback
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

### Phase 2: Session Infrastructure + Optional Account

Auth is an upgrade path, not an app gate. The core Search, public Directions,
Certificates, reverse lookup, nearby, and arrival telemetry flows must work anonymously.

Build:

- Account tab with anonymous and authenticated states.
- Login screen using `POST /v2/auth/login`.
- Register screen using `POST /v2/auth/register`.
- Google sign-in using backend `GET /v2/auth/google` plus
  `POST /v2/auth/google/exchange`.
- `afrihex://auth/callback` handling for the one-time Google code.
- Token storage in `expo-secure-store`.
- Central auth session provider so screens do not read SecureStore directly.
- API client that sends `X-API-Key` only when a token exists.
- Current user fetch via `GET /v2/me`.
- Usage summary via `GET /v2/usage`.
- Logout that clears SecureStore and authenticated query cache.

Use soft prompts instead of hard auth walls:

- Prompt after public rate-limit errors.
- Prompt before authenticated-only recent searches.
- Prompt when a user wants full route details from `/v2/route`.
- Prompt from Account for plan/usage/history.

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

### Phase 6: Verify (address verification + certificates)

Source of truth: [`verify.md`](./verify.md), the backend's mobile integration guide.

The Verify tab does **two jobs**, and they differ in audience and in auth:

| Job | Who it is for | Auth |
| --- | --- | --- |
| Verify your own address | The app's signed-in user | `X-API-Key` + `customer_id` |
| Check a certificate | A bank, landlord, or auditor holding an ID | None |
| Read the full signed payload | Signed in, and only for valid certificates | `X-API-Key` |

#### The rule that shapes the whole screen

**A certificate is not proof of a passing verification.** One is issued for
failed attempts too — it attests that a signed attempt happened, nothing more.
So the UI carries two independent facts that must never collapse into one
indicator:

- **Is this document authentic?** → `valid` from `/verify` → the hero badge.
- **Was the person actually there?** → `verified` on the verification payload →
  a distinct row inside the subject block.

A genuine certificate recording a failed verification is a normal, expected
result. It reads as "This certificate is genuine" in the hero and "Verification
— Not verified" in the detail, exactly as the web does.

#### Endpoints

| Endpoint | Auth | Use |
| --- | --- | --- |
| `POST /v2/kyc/verify` | 🔑 | Verify an address. Issues a certificate as a side effect |
| `GET /v2/certificates/{id}/verify` | None | Is this certificate genuine and un-revoked |
| `GET /v2/certificates/{id}/pdf` | None | The shareable printable certificate |
| `GET /v2/certificates/{id}` | 🔑 | Full signed payload — subject, address, integrity, signature |

#### Screens

**1. Verify tab root** — a segmented control over the two jobs.

*Verify an address* (authenticated): a GPS-code field and a "Use my location"
button, and nothing else. `POST /v2/kyc/verify` accepts four input methods, but
`verify.md` is explicit that mobile builds only `gps_code` and `gps_fix` —
`hex_code` and `manual` have no mobile use case. Signed out, this soft-prompts;
it never walls the tab, because the other half is public.

*Check a certificate* (public): ID entry or QR scan, straight through to the
certificate screen.

A read-only map sits above both inputs on the address side, showing the point
that is about to be verified. It is **not** a third input method — it cannot be
tapped. It is there because verifying is not a lookup: it writes a record
against the user's account and mints a signed certificate, so a mistyped code or
a 150 m GPS fix is worth catching one moment earlier. A loose fix is called out
in the card before the user commits to it, rather than explained afterwards by a
failed result. Empty, the card carries the "Use my location" action — most
people do not have their GPS code memorised, and a blank field makes the slow
path look like the default.

**2. Verification result** — a card under the form. Outcome headline from
`verified`, then hex code, GPS code, region/area, quality, and confidence. A
"View signed certificate" row appears **only** when `data.certificate` is
present: it is `omitempty`, and its absence is normal rather than an error.

**3. Certificate detail** (`/certificate/[id]`) — one screen, three entry
points: the result card, a QR scan, and manual ID entry.

The public half always renders: hero verdict, certificate details, actions, and
the disclaimer verbatim. The rich half — subject, address with a map pin, device
integrity, signature — renders only when the viewer is signed in **and** the
certificate is valid. Withholding detail for revoked and invalid certificates is
deliberate, and matches the web: it discourages misuse of a certificate that
should not be relied on.

#### Certificate IDs

`cert_` plus **up to** 12 alphanumerics — `cert_GPU4XBpCp7q` is 11 characters.
The server strips `-` and `_` out of base64url before truncating, so validating
for exactly 12 rejects genuine IDs. Case-sensitive and matched exactly, so user
input is sent verbatim.

Treat an ID as a credential. It is the capability for every public endpoint, so
it does not belong in logs or analytics.

#### Deliberate deviation from `verify.md`

`verify.md` says to treat a 404 the same as `valid: false`. We distinguish them,
as the live web app does: a mistyped ID and a forged certificate are different
problems with different fixes, and telling someone their landlord's certificate
is invalid when they simply typed it wrong is a bad outcome. Reverting is a
one-line change in `useCertificateVerification`.

#### Not building

- **Offline signature verification.** `verify.md` advises against it for mobile,
  and the signed bytes are Go's `json.Marshal` field order rather than JCS —
  a real footgun to reimplement. Server-side `signature_valid` is enough.
- **`POST /v2/verify/proximity`.** A separate physical-visit feature.
- **Certificate expiry.** Certificates do not expire; they are only ever valid
  or revoked.

### Phase 7: Deferred Account Features

Address-link creation is deferred until the backend provides a mobile contract for:

- endpoint URL and method
- authenticated request body
- response shape
- generated link format
- update/delete behavior, if supported

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
5. Login/register/account.
6. MapLibre polish.

This sequence produces a useful mobile app quickly, then invests in the map experience once
the API flows are stable.
