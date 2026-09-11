import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';

import { reportArrival } from '../../../api/navigation';
import type { RouteMode, RoutePoint } from '../../../api/route';
import type { PlannedRoute } from '../types/directions';

/**
 * Close enough to call it arrived. A GPS fix in Accra is routinely 10–20 m out
 * and destination pins sit at hex centroids rather than doorways, so a tighter
 * radius would mostly report give-ups for journeys that plainly succeeded.
 */
const ARRIVAL_RADIUS_M = 60;

const EARTH_RADIUS_M = 6_371_000;

/** `profile` accepts `driving | foot | bicycle`; anything else normalizes to driving. */
function toProfile(mode: RouteMode): string {
  switch (mode) {
    case 'foot':
    case 'bicycle':
      return mode;
    default:
      return 'driving';
  }
}

function distanceMeters(a: RoutePoint, b: RoutePoint) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

type UseArrivalReportInput = {
  origin: RoutePoint | null;
  destination: RoutePoint | null;
  route: PlannedRoute | null;
  mode: RouteMode;
};

/**
 * Reports where the journey actually ended, which is what feeds the learned
 * traffic estimates.
 *
 * There is no turn-by-turn mode yet, so there is no natural "you have arrived"
 * moment to hang this on. Two paths cover it instead: a proximity watch that
 * fires once the device gets within {@link ARRIVAL_RADIUS_M} of the pin, and an
 * explicit control for the times someone parks a street away and closes the app.
 * Both report at most once per planned route.
 */
export function useArrivalReport({ origin, destination, route, mode }: UseArrivalReportInput) {
  const [hasReported, setHasReported] = useState(false);
  const startedAtRef = useRef<number | null>(null);
  const lastPositionRef = useRef<RoutePoint | null>(null);
  // Read inside the position callback, which is registered once per route and
  // would otherwise close over the flag's initial value forever.
  const hasReportedRef = useRef(false);

  // A new route is a new journey: reset both the flag and the clock.
  useEffect(() => {
    hasReportedRef.current = false;
    setHasReported(false);
    startedAtRef.current = route ? Date.now() : null;
  }, [route]);

  const send = useCallback(
    (finalPosition: RoutePoint | null, arrived: boolean) => {
      if (hasReportedRef.current || !destination || !route) {
        return;
      }

      hasReportedRef.current = true;
      setHasReported(true);

      const startedAt = startedAtRef.current;

      void reportArrival({
        destLat: destination.lat,
        destLng: destination.lng,
        ...(finalPosition ? { finalLat: finalPosition.lat, finalLng: finalPosition.lng } : {}),
        ...(origin ? { originLat: origin.lat, originLng: origin.lng } : {}),
        profile: toProfile(mode),
        routeDistanceM: route.distanceM,
        routeDurationS: route.durationS,
        ...(startedAt ? { achievedDurationS: Math.round((Date.now() - startedAt) / 1000) } : {}),
        arrived,
      });
    },
    [destination, mode, origin, route],
  );

  useEffect(() => {
    if (!destination || !route) {
      return;
    }

    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    const watch = async () => {
      // Checked, never requested: the route is already on screen and asking for
      // location purely to file telemetry would be a permission prompt the user
      // gets nothing back from.
      const permission = await Location.getForegroundPermissionsAsync();

      if (!permission.granted || cancelled) {
        return;
      }

      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 25 },
        (position) => {
          const current = { lat: position.coords.latitude, lng: position.coords.longitude };
          lastPositionRef.current = current;

          if (distanceMeters(current, destination) <= ARRIVAL_RADIUS_M) {
            send(current, true);
          }
        },
      );

      if (cancelled) {
        subscription.remove();
        subscription = null;
      }
    };

    void watch();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [destination, route, send]);

  /**
   * The manual path, for the times someone parks a street away and closes the app.
   *
   * With a fix to hand, `arrived` is decided by proximity rather than taken on
   * trust — someone who ends a route two kilometres out did not arrive, and
   * recording that as a success would poison the very estimates this feeds.
   * Without one (location permission was never granted), the user's word is all
   * there is, and no position is sent rather than a fabricated one.
   */
  const reportManually = useCallback(() => {
    if (!destination) {
      return;
    }

    const finalPosition = lastPositionRef.current;

    if (!finalPosition) {
      send(null, true);
      return;
    }

    send(finalPosition, distanceMeters(finalPosition, destination) <= ARRIVAL_RADIUS_M);
  }, [destination, send]);

  return { hasReported, reportManually };
}
