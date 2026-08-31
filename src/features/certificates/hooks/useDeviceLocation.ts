import { useCallback, useState } from 'react';
import * as Location from 'expo-location';

/** A reading from the device's own GPS. No server involved. */
export type DeviceFix = {
  lat: number;
  lng: number;
  /** Metres. A loose fix is worth seeing before a check is committed to it. */
  accuracyM?: number;
};

/**
 * Reads the device fix and nothing else — no geocoding, no reverse lookup. The
 * coordinates alone are enough to pin the map and to send as `gps_fix`, and the
 * verification response names the address afterwards, so resolving it up front
 * would spend a request on an answer that arrives anyway.
 */
export function useDeviceLocation() {
  const [fix, setFix] = useState<DeviceFix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const locate = useCallback(async () => {
    setError(null);
    setIsLocating(true);

    try {
      // Asked at the moment it pays for itself, rather than on screen open.
      const permission = await Location.requestForegroundPermissionsAsync();

      if (!permission.granted) {
        setError(
          permission.canAskAgain
            ? 'Location permission is off. Allow it, or enter your GPS code instead.'
            : 'Location is blocked for AfriHex. Turn it on in Settings, or enter your GPS code instead.',
        );
        return null;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const next: DeviceFix = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracyM: position.coords.accuracy ?? undefined,
      };

      setFix(next);
      return next;
    } catch {
      setError('Your location could not be read. Try again, or enter your GPS code instead.');
      return null;
    } finally {
      setIsLocating(false);
    }
  }, []);

  const reset = useCallback(() => {
    setFix(null);
    setError(null);
  }, []);

  return { fix, error, isLocating, locate, reset };
}
