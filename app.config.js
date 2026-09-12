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
 */
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    config: {
      ...config.android?.config,
      googleMaps: {
        // Set as an EAS secret (see README) rather than committed. A Maps key is
        // restricted by package name plus signing-certificate fingerprint, so it
        // is not a bearer credential — but it is still per-environment.
        apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY,
      },
    },
  },
});
