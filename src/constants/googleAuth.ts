// Google OAuth client IDs are public, non-secret values — they ship inside every
// native build. `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` is inlined at bundle time and
// must be present in the build environment:
//   - EAS builds: declare it in the profile's `env` in `eas.json`, or set it as
//     an EAS secret (`npx eas secret:create --name EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`).
//   - Local builds: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=... npm run android`.
//
// This is the client id the backend accepts as the `aud` of the Google id_token
// it exchanges at `POST /v2/auth/google/mobile`. Without it, Google Sign-In on
// Android returns no id_token, so the sign-in flow reports "not configured".
const rawWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

// iOS needs its own app OAuth client (`EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`) passed
// to the native SDK as `iosClientId` — required because this app has no Firebase
// `GoogleService-Info.plist` to supply a default client. Build-time config lives
// in `app.config.js` via `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` (the reverse-scoped
// `com.googleusercontent.apps.*` scheme). Both stay unset on Android-only builds.
const rawIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

const isNonEmpty = (value: string | undefined): value is string =>
  Boolean(value && value.trim() !== '');

export const googleWebClientId = isNonEmpty(rawWebClientId) ? rawWebClientId : null;

export const googleIosClientId = isNonEmpty(rawIosClientId) ? rawIosClientId : null;