/**
 * Layers build-time secrets onto `app.json`.
 *
 * `app.json` stays the source of truth for everything static; this only adds
 * what must not be committed.
 *
 * The Android Maps key is not optional. `react-native-maps` renders Google Maps
 * on Android, and the SDK aborts the process when
 * `com.google.android.geo.API_KEY` is missing from the manifest — which reads
 * to a user as the app opening and closing instantly. iOS does not hit this
 * because it falls back to Apple Maps, which needs no key, so the failure only
 * ever shows up on Android.
 *
 * `GOOGLE_MAPS_ANDROID_API_KEY` is the per-environment build-time value:
 *   - EAS builds: declare it in the profile's `env` in `eas.json`, or set it as
 *     an EAS secret (`npx eas secret:create --name GOOGLE_MAPS_ANDROID_API_KEY`)
 *     so it never lands in the repo.
 *   - Local builds: `GOOGLE_MAPS_ANDROID_API_KEY=... npm run android`.
 * A Maps key is restricted by package name plus signing-certificate fingerprint,
 * so it is not a bearer credential — but it is still per-environment.
 *
 * When no real key is supplied we fall back to a non-null placeholder. The
 * placeholder keeps a key in the manifest (so a misconfigured build can never
 * hard-crash at launch) while `EXPO_PUBLIC_MAPS_CONFIGURED` stays `"false"`,
 * which makes the app swap native maps for the static fallback UI instead.
 */
const defaultAndroidMapsKey = 'AIzaSy-placeholder-key-for-android-maps';
const androidMapsApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY ?? defaultAndroidMapsKey;
const hasConfiguredAndroidMapsKey = androidMapsApiKey !== defaultAndroidMapsKey;

// Inlined by the bundler into `process.env.EXPO_PUBLIC_MAPS_CONFIGURED` reads.
// Always set to an explicit value so a stale caller environment can never turn
// native maps on without a real key (which would render a grey map, not crash).
process.env.EXPO_PUBLIC_MAPS_CONFIGURED = hasConfiguredAndroidMapsKey ? 'true' : 'false';

/**
 * Google Sign-In's config plugin exists only for iOS: it registers the
 * `com.googleusercontent.apps.*` reverse URL scheme Google redirects back to
 * after iOS sign-in. Android sign-in needs no plugin and no scheme. The plugin
 * throws when `iosUrlScheme` is missing, and without any options it falls back
 * to the Firebase setup (which would fail the Android build without
 * `google-services.json`) — so it is only registered when the value is present.
 * Set `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` before an iOS build ships Google
 * sign-in. The value comes from the iOS OAuth client in Google Cloud console.
 */
const googleIosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME;
const googleSignInPlugin =
  googleIosUrlScheme && googleIosUrlScheme.trim() !== ''
    ? ['@react-native-google-signin/google-signin', { iosUrlScheme: googleIosUrlScheme }]
    : null;

module.exports = ({ config }) => {
  const dateTimePickerPlugin = '@react-native-community/datetimepicker';
  const extraPlugins = [
    ...(config.plugins ?? []),
    ...(googleSignInPlugin ? [googleSignInPlugin] : []),
    dateTimePickerPlugin,
  ];

  return {
    ...config,
    plugins: extraPlugins,
    extra: {
      ...config.extra,
      androidMapsApiKeyConfigured: hasConfiguredAndroidMapsKey,
    },
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        googleMaps: {
          apiKey: androidMapsApiKey,
        },
      },
    },
  };
};
