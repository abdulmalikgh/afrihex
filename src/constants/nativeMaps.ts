import Constants from 'expo-constants';
import { Platform } from 'react-native';

// `EXPO_PUBLIC_MAPS_CONFIGURED` is set to an explicit "true" / "false" by
// app.config.js and inlined at bundle time, mirroring whether a real
// (non-placeholder) Android Maps key reached the native build. `extra` is read
// here as well so the gate still works for build pipelines where the inline
// value is not available; both paths agree because app.config.js derives them
// from the same source.
const mapsConfigured =
  process.env.EXPO_PUBLIC_MAPS_CONFIGURED === 'true' ||
  Constants.expoConfig?.extra?.androidMapsApiKeyConfigured === true;

// Without a configured key the Google Maps SDK aborts the process when a
// MapView mounts, so Android renderers the static fallback instead of the map.
export const canUseNativeMaps = Platform.OS !== 'android' || mapsConfigured;